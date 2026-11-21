-- Migration: Allow 'custom' in user_profiles.split_type
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_split_type_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_split_type_check
  CHECK (split_type IN ('bro_split', 'upper_lower', 'push_pull_legs', 'full_body', 'custom'));
