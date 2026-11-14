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
    let updated = sqlx::query_as::<_, PlannedExercise>(
        r#"
        UPDATE public.planned_exercises pe
        SET actual_log = $2,
            logged_at = CASE WHEN $2 IS NOT NULL THEN now() ELSE NULL END
        FROM public.weekly_plans wp
        WHERE pe.id = $1
          AND pe.weekly_plan_id = wp.id
          AND wp.user_id = $3
        RETURNING pe.id, pe.weekly_plan_id, pe.exercise_id, pe.day_label, pe.day_index,
                  pe.exercise_order, pe.target_sets, pe.target_reps, pe.target_weight_kg,
                  pe.coaching_notes, pe.actual_log, pe.logged_at
        "#,
    )
    .bind(id)
    .bind(payload.actual_log)
    .bind(auth_user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| {
        AppError::NotFound(format!(
            "Planned exercise {} not found or does not belong to you",
            id
        ))
    })?;

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
