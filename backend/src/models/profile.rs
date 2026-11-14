use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub email: Option<String>,
    pub role: String,
    pub display_name: Option<String>,
    pub fitness_level: Option<String>,
    pub goal: Option<String>,
    pub split_type: Option<String>,
    pub training_days_per_week: Option<i32>,
    pub preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProfileRequest {
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub fitness_level: Option<String>,
    pub goal: Option<String>,
    pub split_type: Option<String>,
    pub training_days_per_week: Option<i32>,
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub fitness_level: Option<String>,
    pub goal: Option<String>,
    pub split_type: Option<String>,
    pub training_days_per_week: Option<i32>,
    pub preferences: Option<serde_json::Value>,
}
