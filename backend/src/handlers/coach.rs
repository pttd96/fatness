use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, Duration, Utc};
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::CoachUser,
    models::{
        coach::{AddExerciseToDayRequest, ClientLookupResponse, UpdatePlannedExerciseTargets},
        plan::{CreatePlanRequest, WeeklyPlan, WeeklyPlanWithExercises},
        planned_exercise::PlannedExerciseWithDetails,
        profile::UserProfile,
    },
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct LookupQuery {
    pub email: String,
}

pub async fn lookup_client(
    _coach: CoachUser,
    State(state): State<AppState>,
    Query(query): Query<LookupQuery>,
) -> Result<Json<ClientLookupResponse>, AppError> {
    let email = query.email.trim();
    if email.is_empty() {
        return Err(AppError::BadRequest("Email parameter is required".to_string()));
    }

    // 1. Find user profile by email
    let mut profile = sqlx::query_as::<_, UserProfile>(
        r#"
        SELECT id, user_id, email, role, display_name, fitness_level, goal, split_type,
               training_days_per_week, preferences, created_at, updated_at
        FROM public.user_profiles
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        "#,
    )
    .bind(email)
    .fetch_optional(&state.db)
    .await?;

    // If not found in user_profiles, check auth.users directly and create on the fly
    if profile.is_none() {
        let auth_user_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        )
        .bind(email)
        .fetch_optional(&state.db)
        .await?;

        if let Some(user_id) = auth_user_id {
            let created = sqlx::query_as::<_, UserProfile>(
                r#"
                INSERT INTO public.user_profiles (
                    user_id, email, role, fitness_level, goal, split_type,
                    training_days_per_week, preferences, created_at, updated_at
                )
                VALUES ($1, $2, 'CLIENT', 'intermediate', 'hypertrophy', 'push_pull_legs', 4, '{}', now(), now())
                ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email
                RETURNING id, user_id, email, role, display_name, fitness_level, goal, split_type,
                          training_days_per_week, preferences, created_at, updated_at
                "#,
            )
            .bind(user_id)
            .bind(email)
            .fetch_one(&state.db)
            .await?;
            profile = Some(created);
        }
    }

    let client = profile.ok_or_else(|| {
        AppError::NotFound(format!("No registered client found with email '{}'", email))
    })?;

    // 2. Fetch client's current weekly plan
    let today = Utc::now().date_naive();
    let days_from_monday = today.weekday().num_days_from_monday();
    let this_monday = today - Duration::days(days_from_monday as i64);

    let plan = sqlx::query_as::<_, WeeklyPlan>(
        r#"
        SELECT id, user_id, week_start, split_type, llm_prompt_used, llm_raw_response, status, created_at
        FROM public.weekly_plans
        WHERE user_id = $1 AND (week_start = $2 OR status = 'active')
        ORDER BY week_start DESC
        LIMIT 1
        "#,
    )
    .bind(client.user_id)
    .bind(this_monday)
    .fetch_optional(&state.db)
    .await?;

    let active_plan = if let Some(p) = plan {
        let exercises = sqlx::query_as::<_, PlannedExerciseWithDetails>(
            r#"
            SELECT pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
                   pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
                   pe.coaching_notes, pe.actual_log, pe.logged_at,
                   e.name AS exercise_name, e.muscle_group, e.youtube_url
            FROM public.planned_exercises pe
            JOIN public.exercises e ON e.id = pe.exercise_id
            WHERE pe.weekly_plan_id = $1
            ORDER BY pe.day_index ASC, pe.exercise_order ASC
            "#,
        )
        .bind(p.id)
        .fetch_all(&state.db)
        .await?;

        Some(WeeklyPlanWithExercises { plan: p, exercises })
    } else {
        None
    };

    Ok(Json(ClientLookupResponse {
        client_id: client.user_id,
        email: client.email,
        display_name: client.display_name,
        fitness_level: client.fitness_level,
        goal: client.goal,
        split_type: client.split_type,
        training_days_per_week: client.training_days_per_week,
        active_plan,
    }))
}

pub async fn create_or_update_client_plan(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path(client_id): Path<Uuid>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<(StatusCode, Json<WeeklyPlanWithExercises>), AppError> {
    // Verify client exists
    let client_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE user_id = $1)",
    )
    .bind(client_id)
    .fetch_one(&state.db)
    .await?;

    if !client_exists {
        return Err(AppError::NotFound("Client does not exist".to_string()));
    }

    let mut tx = state.db.begin().await?;

    let plan = sqlx::query_as::<_, WeeklyPlan>(
        r#"
        INSERT INTO public.weekly_plans (user_id, week_start, split_type, status, created_at)
        VALUES ($1, $2, $3, 'active', now())
        ON CONFLICT (user_id, week_start)
        DO UPDATE SET split_type = EXCLUDED.split_type, status = 'active'
        RETURNING id, user_id, week_start, split_type, llm_prompt_used, llm_raw_response, status, created_at
        "#,
    )
    .bind(client_id)
    .bind(payload.week_start)
    .bind(&payload.split_type)
    .fetch_one(&mut *tx)
    .await?;

    // Delete existing exercises if overwriting this week's plan
    sqlx::query("DELETE FROM public.planned_exercises WHERE weekly_plan_id = $1")
        .bind(plan.id)
        .execute(&mut *tx)
        .await?;

    // Get a fallback exercise ID if needed
    let first_db_exercise = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM public.exercises ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&mut *tx)
    .await?;

    for ex in &payload.exercises {
        let resolved_id = match &ex.exercise_id {
            Value::String(s) => {
                if let Ok(u) = Uuid::parse_str(s) {
                    let exists = sqlx::query_scalar::<_, bool>(
                        "SELECT EXISTS(SELECT 1 FROM public.exercises WHERE id = $1)",
                    )
                    .bind(u)
                    .fetch_one(&mut *tx)
                    .await
                    .unwrap_or(false);

                    if exists {
                        u
                    } else {
                        first_db_exercise.unwrap_or_else(Uuid::new_v4)
                    }
                } else {
                    let by_name = sqlx::query_scalar::<_, Uuid>(
                        "SELECT id FROM public.exercises WHERE name ILIKE $1 LIMIT 1",
                    )
                    .bind(format!("%{}%", s))
                    .fetch_optional(&mut *tx)
                    .await
                    .unwrap_or(None);

                    by_name.or(first_db_exercise).unwrap_or_else(Uuid::new_v4)
                }
            }
            _ => first_db_exercise.unwrap_or_else(Uuid::new_v4),
        };

        sqlx::query(
            r#"
            INSERT INTO public.planned_exercises (
                weekly_plan_id, exercise_id, day_label, day_index, exercise_order,
                target_sets, target_reps, target_weight_kg, coaching_notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(plan.id)
        .bind(resolved_id)
        .bind(&ex.day_label)
        .bind(ex.day_index)
        .bind(ex.exercise_order)
        .bind(ex.target_sets)
        .bind(&ex.target_reps)
        .bind(ex.target_weight_kg)
        .bind(&ex.coaching_notes)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Fetch the created plan with full details
    let exercises = sqlx::query_as::<_, PlannedExerciseWithDetails>(
        r#"
        SELECT pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
               pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
               pe.coaching_notes, pe.actual_log, pe.logged_at,
               e.name AS exercise_name, e.muscle_group, e.youtube_url
        FROM public.planned_exercises pe
        JOIN public.exercises e ON e.id = pe.exercise_id
        WHERE pe.weekly_plan_id = $1
        ORDER BY pe.day_index ASC, pe.exercise_order ASC
        "#,
    )
    .bind(plan.id)
    .fetch_all(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(WeeklyPlanWithExercises { plan, exercises })))
}

pub async fn add_client_planned_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path(client_id): Path<Uuid>,
    Json(payload): Json<AddExerciseToDayRequest>,
) -> Result<(StatusCode, Json<PlannedExerciseWithDetails>), AppError> {
    // 1. Get client's active weekly plan
    let plan = sqlx::query_as::<_, WeeklyPlan>(
        r#"
        SELECT id, user_id, week_start, split_type, llm_prompt_used, llm_raw_response, status, created_at
        FROM public.weekly_plans
        WHERE user_id = $1 AND status = 'active'
        ORDER BY week_start DESC
        LIMIT 1
        "#,
    )
    .bind(client_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Client does not have an active weekly plan".to_string()))?;

    // 2. Find max order for this day
    let next_order = sqlx::query_scalar::<_, i32>(
        r#"
        SELECT COALESCE(MAX(exercise_order), 0) + 1
        FROM public.planned_exercises
        WHERE weekly_plan_id = $1 AND day_index = $2
        "#,
    )
    .bind(plan.id)
    .bind(payload.day_index)
    .fetch_one(&state.db)
    .await?;

    // 3. Insert planned exercise
    let planned_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO public.planned_exercises (
            weekly_plan_id, exercise_id, day_label, day_index, exercise_order,
            target_sets, target_reps, target_weight_kg, coaching_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        "#,
    )
    .bind(plan.id)
    .bind(payload.exercise_id)
    .bind(&payload.day_label)
    .bind(payload.day_index)
    .bind(next_order)
    .bind(payload.target_sets.unwrap_or(3))
    .bind(payload.target_reps.unwrap_or_else(|| "10".to_string()))
    .bind(payload.target_weight_kg.unwrap_or(0.0))
    .bind(payload.coaching_notes)
    .fetch_one(&state.db)
    .await?;

    // 4. Fetch full planned exercise details
    let planned_ex = sqlx::query_as::<_, PlannedExerciseWithDetails>(
        r#"
        SELECT pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
               pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
               pe.coaching_notes, pe.actual_log, pe.logged_at,
               e.name AS exercise_name, e.muscle_group, e.youtube_url
        FROM public.planned_exercises pe
        JOIN public.exercises e ON e.id = pe.exercise_id
        WHERE pe.id = $1
        "#,
    )
    .bind(planned_id)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(planned_ex)))
}

pub async fn update_client_planned_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path((_client_id, planned_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePlannedExerciseTargets>,
) -> Result<Json<PlannedExerciseWithDetails>, AppError> {
    let updated = sqlx::query(
        r#"
        UPDATE public.planned_exercises
        SET target_sets = COALESCE($2, target_sets),
            target_reps = COALESCE($3, target_reps),
            target_weight_kg = COALESCE($4, target_weight_kg),
            coaching_notes = COALESCE($5, coaching_notes)
        WHERE id = $1
        "#,
    )
    .bind(planned_id)
    .bind(payload.target_sets)
    .bind(payload.target_reps)
    .bind(payload.target_weight_kg)
    .bind(payload.coaching_notes)
    .execute(&state.db)
    .await?;

    if updated.rows_affected() == 0 {
        return Err(AppError::NotFound("Planned exercise not found".to_string()));
    }

    let exercise = sqlx::query_as::<_, PlannedExerciseWithDetails>(
        r#"
        SELECT pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
               pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
               pe.coaching_notes, pe.actual_log, pe.logged_at,
               e.name AS exercise_name, e.muscle_group, e.youtube_url
        FROM public.planned_exercises pe
        JOIN public.exercises e ON e.id = pe.exercise_id
        WHERE pe.id = $1
        "#,
    )
    .bind(planned_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(exercise))
}

pub async fn delete_client_planned_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path((_client_id, planned_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM public.planned_exercises WHERE id = $1")
        .bind(planned_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Planned exercise not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
