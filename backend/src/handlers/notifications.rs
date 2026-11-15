use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use uuid::Uuid;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    models::notification::{Notification, NotificationListResponse},
    AppState,
};

pub async fn get_recent_notifications(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<NotificationListResponse>, AppError> {
    let email = match &auth_user.email {
        Some(e) if !e.trim().is_empty() => e.trim().to_lowercase(),
        _ => {
            return Ok(Json(NotificationListResponse {
                notifications: vec![],
                unread_count: 0,
            }));
        }
    };

    let notifications = sqlx::query_as::<_, Notification>(
        r#"
        SELECT id, recipient_email, sender_email, type, title, message, link_url, is_read, created_at
        FROM public.notifications
        WHERE LOWER(recipient_email) = $1
        ORDER BY created_at DESC
        LIMIT 5
        "#,
    )
    .bind(&email)
    .fetch_all(&state.db)
    .await?;

    let unread_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)
        FROM public.notifications
        WHERE LOWER(recipient_email) = $1 AND is_read = false
        "#,
    )
    .bind(&email)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(NotificationListResponse {
        notifications,
        unread_count,
    }))
}

pub async fn mark_as_read(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(notification_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let email = auth_user
        .email
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_lowercase();

    if email.is_empty() {
        return Err(AppError::Unauthorized("User email is required".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE public.notifications
        SET is_read = true
        WHERE id = $1 AND LOWER(recipient_email) = $2
        "#,
    )
    .bind(notification_id)
    .bind(&email)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn mark_all_read(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let email = auth_user
        .email
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .to_lowercase();

    if email.is_empty() {
        return Err(AppError::Unauthorized("User email is required".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE public.notifications
        SET is_read = true
        WHERE LOWER(recipient_email) = $1 AND is_read = false
        "#,
    )
    .bind(&email)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}
