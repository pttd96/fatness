-- Migration: Enable Row Level Security on all tables and create policies

-- =============================================================================
-- user_profiles: users can SELECT, INSERT, UPDATE their own row
-- =============================================================================
alter table public.user_profiles enable row level security;

create policy "Users can view their own profile"
  on public.user_profiles for select
  using (user_id = auth.uid());

create policy "Users can insert their own profile"
  on public.user_profiles for insert
  with check (user_id = auth.uid());

create policy "Users can update their own profile"
  on public.user_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =============================================================================
-- exercises: any authenticated user can SELECT (shared library)
-- =============================================================================
alter table public.exercises enable row level security;

create policy "Authenticated users can view exercises"
  on public.exercises for select
  using (auth.role() = 'authenticated');

-- =============================================================================
-- weekly_plans: users can SELECT and INSERT their own plans
-- =============================================================================
alter table public.weekly_plans enable row level security;

create policy "Users can view their own plans"
  on public.weekly_plans for select
  using (user_id = auth.uid());

create policy "Users can insert their own plans"
  on public.weekly_plans for insert
  with check (user_id = auth.uid());

-- =============================================================================
-- planned_exercises: users can SELECT and UPDATE their own planned exercises
-- (ownership verified via join to weekly_plans)
-- =============================================================================
alter table public.planned_exercises enable row level security;

create policy "Users can view their own planned exercises"
  on public.planned_exercises for select
  using (
    exists (
      select 1 from public.weekly_plans wp
      where wp.id = planned_exercises.weekly_plan_id
        and wp.user_id = auth.uid()
    )
  );

create policy "Users can update their own planned exercises"
  on public.planned_exercises for update
  using (
    exists (
      select 1 from public.weekly_plans wp
      where wp.id = planned_exercises.weekly_plan_id
        and wp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.weekly_plans wp
      where wp.id = planned_exercises.weekly_plan_id
        and wp.user_id = auth.uid()
    )
  );

-- Also allow INSERT for planned_exercises (needed when creating plans)
create policy "Users can insert their own planned exercises"
  on public.planned_exercises for insert
  with check (
    exists (
      select 1 from public.weekly_plans wp
      where wp.id = planned_exercises.weekly_plan_id
        and wp.user_id = auth.uid()
    )
  );
