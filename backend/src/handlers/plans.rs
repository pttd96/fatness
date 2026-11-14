use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{Datelike, Duration, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::{
        plan::{
            CreatePlanRequest, PaginationParams, PlanSummary, ReorderExercisesRequest,
            WeeklyPlan, WeeklyPlanWithExercises,
        },
        planned_exercise::PlannedExerciseWithDetails,
    },
    AppState,
};

pub async fn get_current_plan(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<WeeklyPlanWithExercises>, AppError> {
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
    .bind(auth_user.user_id)
    .bind(this_monday)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("No active or current weekly plan found".to_string()))?;

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

    Ok(Json(WeeklyPlanWithExercises { plan, exercises }))
}

pub async fn get_plan(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(plan_id): Path<Uuid>,
) -> Result<Json<WeeklyPlanWithExercises>, AppError> {
    let plan = sqlx::query_as::<_, WeeklyPlan>(
        r#"
        SELECT id, user_id, week_start, split_type, llm_prompt_used, llm_raw_response, status, created_at
        FROM public.weekly_plans
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(plan_id)
    .bind(auth_user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Plan with id {} not found", plan_id)))?;

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

    Ok(Json(WeeklyPlanWithExercises { plan, exercises }))
}

pub async fn list_plans(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Query(pagination): Query<PaginationParams>,
) -> Result<Json<Vec<PlanSummary>>, AppError> {
    let page = pagination.page.unwrap_or(1).max(1);
    let per_page = pagination.per_page.unwrap_or(10).clamp(1, 50);
    let offset = ((page - 1) * per_page) as i64;

    let plans = sqlx::query_as::<_, PlanSummary>(
        r#"
        SELECT id, week_start, split_type, status, created_at
        FROM public.weekly_plans
        WHERE user_id = $1
        ORDER BY week_start DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(auth_user.user_id)
    .bind(per_page as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(plans))
}

pub async fn create_plan(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreatePlanRequest>,
) -> Result<(StatusCode, Json<WeeklyPlanWithExercises>), AppError> {
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
    .bind(auth_user.user_id)
    .bind(payload.week_start)
    .bind(&payload.split_type)
    .fetch_one(&mut *tx)
    .await?;

    // Delete existing exercises if overwriting a week plan
    sqlx::query(
        r#"
        DELETE FROM public.planned_exercises
        WHERE weekly_plan_id = $1
        "#,
    )
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
        // Resolve exercise_id safely whether it's UUID, string ID, or name
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
                    // Try looking up by name
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

        let coaching_notes = ex.coaching_notes.as_deref().filter(|s| !s.trim().is_empty());
        let target_reps = ex.target_reps.as_deref().filter(|s| !s.trim().is_empty());
        let actual_log = ex.actual_log.as_deref().filter(|s| !s.trim().is_empty());

        sqlx::query(
            r#"
            INSERT INTO public.planned_exercises (
                weekly_plan_id, exercise_id, day_label, day_index, exercise_order,
                target_sets, target_reps, target_weight_kg, coaching_notes, actual_log, logged_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10 IS NOT NULL THEN now() ELSE NULL END)
            "#,
        )
        .bind(plan.id)
        .bind(resolved_id)
        .bind(&ex.day_label)
        .bind(ex.day_index)
        .bind(ex.exercise_order)
        .bind(ex.target_sets)
        .bind(target_reps)
        .bind(ex.target_weight_kg)
        .bind(coaching_notes)
        .bind(actual_log)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

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

pub async fn delete_plan(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(plan_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM public.weekly_plans
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(plan_id)
    .bind(auth_user.user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Plan not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn generate_plan(
    _auth_user: AuthUser,
    State(_state): State<AppState>,
) -> Result<(StatusCode, Json<Value>), AppError> {
    Ok((
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "message": "Vertex AI weekly plan generation is scheduled for Phase 3"
        })),
    ))
}

pub async fn add_planned_exercise(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(plan_id): Path<Uuid>,
    Json(payload): Json<crate::models::plan::CreatePlannedExerciseInput>,
) -> Result<(StatusCode, Json<PlannedExerciseWithDetails>), AppError> {
    // 1. Verify plan belongs to user
    let plan = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM public.weekly_plans WHERE id = $1 AND user_id = $2",
    )
    .bind(plan_id)
    .bind(auth_user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Plan {} not found", plan_id)))?;

    // 2. Resolve exercise ID
    let first_db_exercise = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM public.exercises ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await?;

    let resolved_id = match &payload.exercise_id {
        Value::String(s) => {
            if let Ok(u) = Uuid::parse_str(s) {
                let exists = sqlx::query_scalar::<_, bool>(
                    "SELECT EXISTS(SELECT 1 FROM public.exercises WHERE id = $1)",
                )
                .bind(u)
                .fetch_one(&state.db)
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
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);

                by_name.or(first_db_exercise).unwrap_or_else(Uuid::new_v4)
            }
        }
        _ => first_db_exercise.unwrap_or_else(Uuid::new_v4),
    };

    // 3. Determine order if <= 0
    let exercise_order = if payload.exercise_order > 0 {
        payload.exercise_order
    } else {
        let max_order = sqlx::query_scalar::<_, Option<i32>>(
            "SELECT MAX(exercise_order) FROM public.planned_exercises WHERE weekly_plan_id = $1 AND day_index = $2",
        )
        .bind(plan)
        .bind(payload.day_index)
        .fetch_one(&state.db)
        .await
        .unwrap_or(None)
        .unwrap_or(0);
        max_order + 1
    };

    let coaching_notes = payload.coaching_notes.as_deref().filter(|s| !s.trim().is_empty());
    let target_reps = payload.target_reps.as_deref().filter(|s| !s.trim().is_empty());
    let actual_log = payload.actual_log.as_deref().filter(|s| !s.trim().is_empty());

    let inserted_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO public.planned_exercises (
            weekly_plan_id, exercise_id, day_label, day_index, exercise_order,
            target_sets, target_reps, target_weight_kg, coaching_notes, actual_log, logged_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $10 IS NOT NULL THEN now() ELSE NULL END)
        RETURNING id
        "#,
    )
    .bind(plan)
    .bind(resolved_id)
    .bind(&payload.day_label)
    .bind(payload.day_index)
    .bind(exercise_order)
    .bind(payload.target_sets)
    .bind(target_reps)
    .bind(payload.target_weight_kg)
    .bind(coaching_notes)
    .bind(actual_log)
    .fetch_one(&state.db)
    .await?;

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
    .bind(inserted_id)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(exercise)))
}

pub async fn reorder_planned_exercises(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(plan_id): Path<Uuid>,
    Json(payload): Json<ReorderExercisesRequest>,
) -> Result<Json<WeeklyPlanWithExercises>, AppError> {
    // 1. Verify plan exists and belongs to auth_user
    let plan = sqlx::query_as::<_, WeeklyPlan>(
        r#"
        SELECT id, user_id, week_start, split_type, llm_prompt_used, llm_raw_response, status, created_at
        FROM public.weekly_plans
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(plan_id)
    .bind(auth_user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Plan {} not found", plan_id)))?;

    // 2. Atomically update exercise_order within a transaction
    let mut tx = state.db.begin().await?;
    for item in &payload.items {
        sqlx::query(
            r#"
            UPDATE public.planned_exercises
            SET exercise_order = $1
            WHERE id = $2 AND weekly_plan_id = $3
            "#,
        )
        .bind(item.exercise_order)
        .bind(item.id)
        .bind(plan.id)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    // 3. Return full updated plan with exercises ordered by day_index ASC, exercise_order ASC
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

    Ok(Json(WeeklyPlanWithExercises { plan, exercises }))
}
