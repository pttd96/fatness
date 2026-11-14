use axum::{extract::State, http::StatusCode, Json};
use serde_json::Value;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::profile::{CreateProfileRequest, UpdateProfileRequest, UserProfile},
    AppState,
};

pub async fn get_profile(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UserProfile>, AppError> {
    let profile = sqlx::query_as::<_, UserProfile>(
        r#"
        SELECT id, user_id, email, role, display_name, fitness_level, goal, split_type,
               training_days_per_week, preferences, created_at, updated_at
        FROM public.user_profiles
        WHERE user_id = $1
        "#,
    )
    .bind(auth_user.user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(p) = profile {
        // If email was null in database profile but available from session token, backfill it
        if p.email.is_none() && auth_user.email.is_some() {
            let _ = sqlx::query("UPDATE public.user_profiles SET email = $1 WHERE id = $2")
                .bind(&auth_user.email)
                .bind(p.id)
                .execute(&state.db)
                .await;
            return Ok(Json(UserProfile {
                email: auth_user.email,
                ..p
            }));
        }
        return Ok(Json(p));
    }

    // Auto-create default profile with CLIENT role if user has no profile record yet
    let new_profile = sqlx::query_as::<_, UserProfile>(
        r#"
        INSERT INTO public.user_profiles (
            user_id, email, role, display_name, fitness_level, goal, split_type,
            training_days_per_week, preferences, created_at, updated_at
        )
        VALUES (
            $1, $2, 'CLIENT', NULL, 'intermediate', 'hypertrophy', 'push_pull_legs',
            4, '{}', now(), now()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET email = COALESCE(public.user_profiles.email, EXCLUDED.email)
        RETURNING id, user_id, email, role, display_name, fitness_level, goal, split_type,
                  training_days_per_week, preferences, created_at, updated_at
        "#,
    )
    .bind(auth_user.user_id)
    .bind(&auth_user.email)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(new_profile))
}

pub async fn create_profile(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateProfileRequest>,
) -> Result<(StatusCode, Json<UserProfile>), AppError> {
    let preferences = payload.preferences.unwrap_or_else(|| Value::Object(serde_json::Map::new()));
    let email = payload.email.or(auth_user.email);

    let profile = sqlx::query_as::<_, UserProfile>(
        r#"
        INSERT INTO public.user_profiles (
            user_id, email, role, display_name, fitness_level, goal, split_type,
            training_days_per_week, preferences, created_at, updated_at
        )
        VALUES ($1, $2, 'CLIENT', $3, $4, $5, $6, $7, $8, now(), now())
        ON CONFLICT (user_id) DO UPDATE
        SET display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
            fitness_level = COALESCE(EXCLUDED.fitness_level, public.user_profiles.fitness_level),
            goal = COALESCE(EXCLUDED.goal, public.user_profiles.goal),
            split_type = COALESCE(EXCLUDED.split_type, public.user_profiles.split_type),
            training_days_per_week = COALESCE(EXCLUDED.training_days_per_week, public.user_profiles.training_days_per_week),
            preferences = COALESCE(EXCLUDED.preferences, public.user_profiles.preferences),
            email = COALESCE(public.user_profiles.email, EXCLUDED.email),
            updated_at = now()
        RETURNING id, user_id, email, role, display_name, fitness_level, goal, split_type,
                  training_days_per_week, preferences, created_at, updated_at
        "#,
    )
    .bind(auth_user.user_id)
    .bind(email)
    .bind(payload.display_name)
    .bind(payload.fitness_level)
    .bind(payload.goal)
    .bind(payload.split_type)
    .bind(payload.training_days_per_week)
    .bind(preferences)
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn update_profile(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserProfile>, AppError> {
    let profile = sqlx::query_as::<_, UserProfile>(
        r#"
        UPDATE public.user_profiles
        SET display_name = COALESCE($2, display_name),
            fitness_level = COALESCE($3, fitness_level),
            goal = COALESCE($4, goal),
            split_type = COALESCE($5, split_type),
            training_days_per_week = COALESCE($6, training_days_per_week),
            preferences = COALESCE($7, preferences),
            updated_at = now()
        WHERE user_id = $1
        RETURNING id, user_id, email, role, display_name, fitness_level, goal, split_type,
                  training_days_per_week, preferences, created_at, updated_at
        "#,
    )
    .bind(auth_user.user_id)
    .bind(payload.display_name)
    .bind(payload.fitness_level)
    .bind(payload.goal)
    .bind(payload.split_type)
    .bind(payload.training_days_per_week)
    .bind(payload.preferences)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User profile not found".to_string()))?;

    Ok(Json(profile))
}
