-- Migration: Create exercises table
-- Catalog/library of exercises with metadata and instructions

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  muscle_group text not null check (muscle_group in ('chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'full_body')),
  description text,
  notes text,
  youtube_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.exercises is 'Catalog of exercises with descriptions, tips, and tutorial links';
comment on column public.exercises.name is 'Unique exercise name, e.g. Barbell Bench Press';
comment on column public.exercises.muscle_group is 'Target muscle group';
comment on column public.exercises.youtube_url is 'Link to tutorial or demonstration video';
comment on column public.exercises.metadata is 'Additional metadata (e.g. equipment needed, difficulty)';

create index idx_exercises_muscle_group on public.exercises (muscle_group);
create index idx_exercises_name on public.exercises (name);
