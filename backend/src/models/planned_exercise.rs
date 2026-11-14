use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlannedExercise {
    pub id: Uuid,
    pub weekly_plan_id: Uuid,
    pub exercise_id: Uuid,
    pub day_label: String,
    pub day_index: i32,
    pub exercise_order: i32,
    pub target_sets: Option<i32>,
    pub target_reps: Option<String>,
    pub target_weight_kg: Option<f32>,
    pub coaching_notes: Option<String>,
    pub actual_log: Option<String>,
    pub logged_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlannedExerciseWithDetails {
    pub id: Uuid,
    pub weekly_plan_id: Uuid,
    pub exercise_id: Uuid,
    pub day_label: String,
    pub day_index: i32,
    pub exercise_order: i32,
    pub target_sets: Option<i32>,
    pub target_reps: Option<String>,
    pub target_weight_kg: Option<f32>,
    pub coaching_notes: Option<String>,
    pub actual_log: Option<String>,
    pub logged_at: Option<DateTime<Utc>>,
    pub exercise_name: String,
    pub muscle_group: String,
    pub youtube_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogExerciseRequest {
    pub actual_log: Option<String>,
}
