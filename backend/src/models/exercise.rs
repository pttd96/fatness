use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Exercise {
    pub id: Uuid,
    pub name: String,
    pub muscle_group: String,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub youtube_url: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExerciseFilter {
    pub muscle_group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExerciseRequest {
    pub name: String,
    pub muscle_group: String,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub youtube_url: Option<String>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateExerciseRequest {
    pub name: Option<String>,
    pub muscle_group: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub youtube_url: Option<String>,
    pub metadata: Option<serde_json::Value>,
}
