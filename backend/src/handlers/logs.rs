use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::planned_exercise::{LogExerciseRequest, PlannedExercise},
    AppState,
};

pub async fn log_exercise(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<LogExerciseRequest>,
) -> Result<Json<PlannedExercise>, AppError> {
    let email = auth_user.email.clone().unwrap_or_else(|| "user".to_string());
    let has_log = payload.actual_log.as_deref().map(str::trim).filter(|s| !s.is_empty()).is_some();
    let status_str = if has_log { "completed" } else { "active" };

    let updated = sqlx::query_as::<_, PlannedExercise>(
        r#"
        UPDATE public.planned_exercises pe
        SET actual_log = $2,
            logged_at = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END,
            status = $4,
            updated_by = $5
        FROM public.weekly_plans wp
        WHERE pe.id = $1
          AND pe.weekly_plan_id = wp.id
          AND wp.user_id = $3
        RETURNING pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
                  pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
                  pe.coaching_notes, pe.actual_log, pe.logged_at,
                  pe.status, pe.created_by, pe.updated_by
        "#,
    )
    .bind(id)
    .bind(&payload.actual_log)
    .bind(auth_user.user_id)
    .bind(status_str)
    .bind(&email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::NotFound(format!(
            "Planned exercise {} not found or does not belong to you",
            id
        ))
    })?;

    // Check if all exercises in this weekly plan are now completed
    let (all_completed, total_count) = sqlx::query_as::<_, (Option<bool>, i64)>(
        r#"
        SELECT bool_and(status = 'completed'), COUNT(*)
        FROM public.planned_exercises
        WHERE weekly_plan_id = $1
        "#,
    )
    .bind(updated.weekly_plan_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((None, 0));

    if all_completed.unwrap_or(false) && total_count > 0 {
        // 1. Mark plan as completed
        sqlx::query(
            r#"
            UPDATE public.weekly_plans
            SET status = 'completed',
                updated_by = $2
            WHERE id = $1
            "#,
        )
        .bind(updated.weekly_plan_id)
        .bind(&email)
        .execute(&state.db)
        .await?;

        // 2. Fetch plan metadata to notify creator if different from updater
        let plan_meta = sqlx::query_as::<_, (Option<String>, chrono::NaiveDate)>(
            "SELECT created_by, week_start FROM public.weekly_plans WHERE id = $1",
        )
        .bind(updated.weekly_plan_id)
        .fetch_optional(&state.db)
        .await?;

        if let Some((Some(creator_email), week_start)) = plan_meta {
            if creator_email.trim().to_lowercase() != email.trim().to_lowercase() {
                let _ = sqlx::query(
                    r#"
                    INSERT INTO public.notifications (
                        recipient_email, sender_email, type, title, message, link_url, is_read, created_at
                    )
                    VALUES ($1, $2, 'plan_completed', $3, $4, $5, false, now())
                    "#,
                )
                .bind(creator_email.trim().to_lowercase())
                .bind(email.trim().to_lowercase())
                .bind(format!("Plan Completed for Week of {}", week_start))
                .bind(format!("Athlete {} has completed all scheduled exercises for the week of {}.", email, week_start))
                .bind(Some(format!("/coach?email={}", email)))
                .execute(&state.db)
                .await;
            }
        }
    }

    Ok(Json(updated))
}

pub async fn delete_planned_exercise(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM public.planned_exercises pe
        USING public.weekly_plans wp
        WHERE pe.id = $1
          AND pe.weekly_plan_id = wp.id
          AND wp.user_id = $2
        "#,
    )
    .bind(id)
    .bind(auth_user.user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(
            "Planned exercise not found or does not belong to you".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}
