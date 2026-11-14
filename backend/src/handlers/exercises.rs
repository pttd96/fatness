use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::{AuthUser, CoachUser},
    models::exercise::{
        CreateExerciseRequest, Exercise, ExerciseFilter, UpdateExerciseRequest,
    },
    AppState,
};

pub async fn list_exercises(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Query(filter): Query<ExerciseFilter>,
) -> Result<Json<Vec<Exercise>>, AppError> {
    let exercises = if let Some(muscle_group) = filter.muscle_group {
        sqlx::query_as::<_, Exercise>(
            r#"
            SELECT id, name, muscle_group, description, notes, youtube_url, metadata, created_at
            FROM public.exercises
            WHERE muscle_group = $1
            ORDER BY created_at DESC, name ASC
            "#,
        )
        .bind(muscle_group)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as::<_, Exercise>(
            r#"
            SELECT id, name, muscle_group, description, notes, youtube_url, metadata, created_at
            FROM public.exercises
            ORDER BY created_at DESC, name ASC
            "#,
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(exercises))
}

pub async fn get_exercise(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Exercise>, AppError> {
    let exercise = sqlx::query_as::<_, Exercise>(
        r#"
        SELECT id, name, muscle_group, description, notes, youtube_url, metadata, created_at
        FROM public.exercises
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Exercise with id {} not found", id)))?;

    Ok(Json(exercise))
}

pub async fn create_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateExerciseRequest>,
) -> Result<(StatusCode, Json<Exercise>), AppError> {
    let metadata = payload.metadata.unwrap_or_else(|| serde_json::json!({}));

    let exercise = sqlx::query_as::<_, Exercise>(
        r#"
        INSERT INTO public.exercises (name, muscle_group, description, notes, youtube_url, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        RETURNING id, name, muscle_group, description, notes, youtube_url, metadata, created_at
        "#,
    )
    .bind(payload.name)
    .bind(payload.muscle_group)
    .bind(payload.description)
    .bind(payload.notes)
    .bind(payload.youtube_url)
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(exercise)))
}

pub async fn update_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateExerciseRequest>,
) -> Result<Json<Exercise>, AppError> {
    let exercise = sqlx::query_as::<_, Exercise>(
        r#"
        UPDATE public.exercises
        SET name = COALESCE($2, name),
            muscle_group = COALESCE($3, muscle_group),
            description = COALESCE($4, description),
            notes = COALESCE($5, notes),
            youtube_url = COALESCE($6, youtube_url),
            metadata = COALESCE($7, metadata)
        WHERE id = $1
        RETURNING id, name, muscle_group, description, notes, youtube_url, metadata, created_at
        "#,
    )
    .bind(id)
    .bind(payload.name)
    .bind(payload.muscle_group)
    .bind(payload.description)
    .bind(payload.notes)
    .bind(payload.youtube_url)
    .bind(payload.metadata)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Exercise with id {} not found", id)))?;

    Ok(Json(exercise))
}

pub async fn delete_exercise(
    _coach: CoachUser,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Delete any planned exercises referencing this exercise first
    sqlx::query("DELETE FROM public.planned_exercises WHERE exercise_id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    let result = sqlx::query("DELETE FROM public.exercises WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Exercise with id {} not found", id)));
    }

    Ok(StatusCode::NO_CONTENT)
}
