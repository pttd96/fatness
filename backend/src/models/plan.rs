use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::planned_exercise::PlannedExerciseWithDetails;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct WeeklyPlan {
    pub id: Uuid,
    pub user_id: Uuid,
    pub week_start: NaiveDate,
    pub split_type: String,
    pub llm_prompt_used: Option<String>,
    pub llm_raw_response: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyPlanWithExercises {
    #[serde(flatten)]
    pub plan: WeeklyPlan,
    pub exercises: Vec<PlannedExerciseWithDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlanSummary {
    pub id: Uuid,
    pub week_start: NaiveDate,
    pub split_type: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlannedExerciseInput {
    pub exercise_id: serde_json::Value,
    pub day_label: String,
    pub day_index: i32,
    pub exercise_order: i32,
    #[serde(default)]
    pub target_sets: Option<i32>,
    #[serde(default)]
    pub target_reps: Option<String>,
    #[serde(default)]
    pub target_weight_kg: Option<f32>,
    #[serde(default)]
    pub coaching_notes: Option<String>,
    #[serde(default)]
    pub actual_log: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlanRequest {
    pub week_start: NaiveDate,
    pub split_type: String,
    #[serde(default)]
    pub exercises: Vec<CreatePlannedExerciseInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExerciseOrderItem {
    pub id: Uuid,
    pub exercise_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderExercisesRequest {
    pub items: Vec<ExerciseOrderItem>,
}
