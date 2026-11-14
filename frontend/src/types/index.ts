export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'full_body'

export type SplitType = 'bro_split' | 'upper_lower' | 'push_pull_legs' | 'full_body'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

export type Goal = 'strength' | 'hypertrophy' | 'endurance' | 'general'

export type UserRole = 'CLIENT' | 'COACH'

export interface UserProfile {
  id: string
  user_id: string
  email?: string | null
  role: UserRole
  display_name: string | null
  fitness_level: FitnessLevel | null
  goal: Goal | null
  split_type: SplitType | null
  training_days_per_week: number | null
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  description: string | null
  notes: string | null
  youtube_url: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface PlannedExerciseWithDetails {
  id: string
  weekly_plan_id: string
  exercise_id: string
  day_label: string
  day_index: number
  exercise_order: number
  target_sets: number | null
  target_reps: string | null
  target_weight_kg: number | null
  coaching_notes: string | null
  actual_log: string | null
  logged_at: string | null
  exercise_name: string
  muscle_group: string
  youtube_url: string | null
}

export interface WeeklyPlan {
  id: string
  user_id: string
  week_start: string
  split_type: string
  llm_prompt_used: string | null
  llm_raw_response: string | null
  status: 'generated' | 'active' | 'completed'
  created_at: string
}

export interface WeeklyPlanWithExercises {
  id: string
  user_id: string
  week_start: string
  split_type: string
  llm_prompt_used: string | null
  llm_raw_response: string | null
  status: 'generated' | 'active' | 'completed'
  created_at: string
  exercises: PlannedExerciseWithDetails[]
}

export interface PlanSummary {
  id: string
  week_start: string
  split_type: string
  status: string
  created_at: string
}

export interface CreatePlannedExerciseInput {
  exercise_id: string
  day_label: string
  day_index: number
  exercise_order: number
  target_sets?: number | null
  target_reps?: string | null
  target_weight_kg?: number | null
  coaching_notes?: string | null
  actual_log?: string | null
}

export interface CreatePlanRequest {
  week_start: string
  split_type: string
  exercises: CreatePlannedExerciseInput[]
}

export interface ClientLookupResponse {
  client_id: string
  email: string | null
  display_name: string | null
  fitness_level: FitnessLevel | null
  goal: Goal | null
  split_type: SplitType | null
  training_days_per_week: number | null
  active_plan: WeeklyPlanWithExercises | null
}

export interface UpdatePlannedExerciseTargets {
  target_sets?: number | null
  target_reps?: string | null
  target_weight_kg?: number | null
  coaching_notes?: string | null
}

export interface AddExerciseToDayRequest {
  exercise_id: string
  day_index: number
  day_label: string
  target_sets?: number | null
  target_reps?: string | null
  target_weight_kg?: number | null
  coaching_notes?: string | null
}
