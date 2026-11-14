use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::models::plan::WeeklyPlanWithExercises;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientLookupResponse {
    pub client_id: Uuid,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub fitness_level: Option<String>,
    pub goal: Option<String>,
    pub split_type: Option<String>,
    pub training_days_per_week: Option<i32>,
    pub active_plan: Option<WeeklyPlanWithExercises>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlannedExerciseTargets {
    pub target_sets: Option<i32>,
    pub target_reps: Option<String>,
    pub target_weight_kg: Option<f64>,
    pub coaching_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddExerciseToDayRequest {
    pub exercise_id: Uuid,
    pub day_index: i32,
    pub day_label: String,
    pub target_sets: Option<i32>,
    pub target_reps: Option<String>,
    pub target_weight_kg: Option<f64>,
    pub coaching_notes: Option<String>,
}
