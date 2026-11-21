-- Migration: Add coach_by column to user_profiles and allow plan_replaced in notifications

-- 1. Add coach_by column to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS coach_by text;

COMMENT ON COLUMN public.user_profiles.coach_by IS 'Email of the coach managing this client profile';

CREATE INDEX IF NOT EXISTS idx_user_profiles_coach_by ON public.user_profiles (LOWER(coach_by));

-- 2. Update notifications check constraint to include plan_replaced
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('plan_completed', 'plan_created', 'plan_updated', 'plan_replaced', 'exercise_completed'));
