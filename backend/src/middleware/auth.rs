use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::{Duration, Instant},
};

use axum::{
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{errors::AppError, AppState};

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CoachUser(pub AuthUser);

#[derive(Debug, Serialize, Deserialize)]
struct LegacyClaims {
    pub sub: String,
    pub email: Option<String>,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
struct SupabaseUserResponse {
    pub id: Uuid,
    pub email: Option<String>,
}

pub type TokenCache = Arc<RwLock<HashMap<String, (Uuid, Option<String>, Instant)>>>;

pub fn new_token_cache() -> TokenCache {
    Arc::new(RwLock::new(HashMap::new()))
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|val| val.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid Authorization header format".to_string()))?
            .trim();

        // 1. Check in-memory fast cache (valid for 60 seconds)
        if let Ok(cache) = state.token_cache.read() {
            if let Some((cached_id, cached_email, cached_at)) = cache.get(token) {
                if cached_at.elapsed() < Duration::from_secs(60) {
                    return Ok(AuthUser {
                        user_id: *cached_id,
                        email: cached_email.clone(),
                    });
                }
            }
        }

        // 2. Try legacy HS256 JWT decoding if legacy secret is configured
        if let Some(secret) = &state.legacy_jwt_secret {
            let mut validation = Validation::new(Algorithm::HS256);
            validation.validate_exp = true;

            if let Ok(token_data) = decode::<LegacyClaims>(
                token,
                &DecodingKey::from_secret(secret.as_bytes()),
                &validation,
            ) {
                if let Ok(user_id) = Uuid::parse_str(&token_data.claims.sub) {
                    let email = token_data.claims.email.clone();
                    if let Ok(mut cache) = state.token_cache.write() {
                        cache.insert(
                            token.to_string(),
                            (user_id, email.clone(), Instant::now()),
                        );
                    }
                    return Ok(AuthUser { user_id, email });
                }
            }
        }

        // 3. Verify with Supabase Auth API (compatible with new ES256 Asymmetric Signing Keys)
        let endpoint = format!("{}/auth/v1/user", state.supabase_url.trim_end_matches('/'));
        let mut req = state
            .http_client
            .get(&endpoint)
            .header(header::AUTHORIZATION, format!("Bearer {}", token));

        if !state.supabase_anon_key.is_empty() {
            req = req.header("apikey", &state.supabase_anon_key);
        }

        let resp = req.send().await.map_err(|e| {
            tracing::error!("Failed to contact Supabase Auth API: {:?}", e);
            AppError::InternalError("Failed to verify user credentials".to_string())
        })?;

        if !resp.status().is_success() {
            return Err(AppError::Unauthorized(
                "Invalid, expired, or revoked session token".to_string(),
            ));
        }

        let user: SupabaseUserResponse = resp.json().await.map_err(|e| {
            tracing::error!("Failed to parse Supabase Auth response: {:?}", e);
            AppError::Unauthorized("Invalid auth response from identity provider".to_string())
        })?;

        // Cache the verified user ID and email
        if let Ok(mut cache) = state.token_cache.write() {
            cache.insert(
                token.to_string(),
                (user.id, user.email.clone(), Instant::now()),
            );
        }

        Ok(AuthUser {
            user_id: user.id,
            email: user.email,
        })
    }
}

impl FromRequestParts<AppState> for CoachUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_user = AuthUser::from_request_parts(parts, state).await?;

        let role = sqlx::query_scalar::<_, String>(
            "SELECT role FROM public.user_profiles WHERE user_id = $1",
        )
        .bind(auth_user.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check user role: {:?}", e);
            AppError::InternalError("Failed to verify user authorization".to_string())
        })?
        .unwrap_or_else(|| "CLIENT".to_string());

        if role != "COACH" {
            return Err(AppError::Forbidden(
                "Only users with the COACH role can perform this action".to_string(),
            ));
        }

        Ok(CoachUser(auth_user))
    }
}
