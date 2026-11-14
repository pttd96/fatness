-- Migration: Create planned_exercises table
-- Individual exercises within a weekly plan, grouped by day

create table public.planned_exercises (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  day_label text not null,
  day_index integer not null,
  exercise_order integer not null,
  target_sets integer,
  target_reps text,
  target_weight_kg real,
  coaching_notes text,
  actual_log text,
  logged_at timestamptz
);

comment on table public.planned_exercises is 'Individual exercises within a weekly training plan';
comment on column public.planned_exercises.day_label is 'Human-readable day name, e.g. Push Day, Upper A';
comment on column public.planned_exercises.day_index is 'Numeric day ordering within the week (1, 2, 3...)';
comment on column public.planned_exercises.exercise_order is 'Order of exercise within the day';
comment on column public.planned_exercises.target_reps is 'Rep target as text, e.g. 8-10 or 5';
comment on column public.planned_exercises.actual_log is 'User-filled log of what they actually did';
comment on column public.planned_exercises.logged_at is 'Timestamp when the user logged this exercise';

-- Index on weekly_plan_id for fast plan lookups
create index idx_planned_exercises_plan_id on public.planned_exercises (weekly_plan_id);

-- Index for ordering exercises within a plan
create index idx_planned_exercises_day_order on public.planned_exercises (weekly_plan_id, day_index, exercise_order);
