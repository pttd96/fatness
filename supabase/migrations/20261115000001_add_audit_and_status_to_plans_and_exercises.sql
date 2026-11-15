-- Migration: Add audit columns and status to weekly_plans and planned_exercises

-- 1. Add created_by and updated_by to weekly_plans
alter table public.weekly_plans 
  add column if not exists created_by text,
  add column if not exists updated_by text;

comment on column public.weekly_plans.created_by is 'Email of the user or coach who created the plan';
comment on column public.weekly_plans.updated_by is 'Email of the user or coach who last updated the plan';

-- 2. Add created_by, updated_by, and status to planned_exercises
alter table public.planned_exercises 
  add column if not exists created_by text,
  add column if not exists updated_by text,
  add column if not exists status text not null default 'active' 
    check (status in ('active', 'completed'));

comment on column public.planned_exercises.created_by is 'Email of the user or coach who added the exercise';
comment on column public.planned_exercises.updated_by is 'Email of the user or coach who last logged or edited the exercise';
comment on column public.planned_exercises.status is 'Current status of the planned exercise: active or completed';

-- 3. Create index for filtering active/completed exercises
create index if not exists idx_planned_exercises_status on public.planned_exercises (status);
