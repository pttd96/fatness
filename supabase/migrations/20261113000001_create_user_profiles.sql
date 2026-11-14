-- Migration: Create user_profiles table
-- Stores user fitness preferences and settings, linked to Supabase auth.users

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  goal text check (goal in ('strength', 'hypertrophy', 'endurance', 'general')),
  split_type text check (split_type in ('bro_split', 'upper_lower', 'push_pull_legs', 'full_body')),
  training_days_per_week integer check (training_days_per_week between 1 and 7),
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'User fitness profiles linked to Supabase auth.users';
comment on column public.user_profiles.user_id is 'References auth.users(id); one profile per user';
comment on column public.user_profiles.split_type is 'Preferred training split';
comment on column public.user_profiles.preferences is 'Freeform JSON for additional user preferences';

-- Index on user_id for fast lookups (unique constraint already creates one, but being explicit)
create index idx_user_profiles_user_id on public.user_profiles (user_id);
