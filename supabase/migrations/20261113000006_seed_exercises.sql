-- Migration: Seed exercises table with common exercises across all muscle groups

insert into public.exercises (name, muscle_group) values
  -- Chest (5)
  ('Bench Press', 'chest'),
  ('Incline Bench Press', 'chest'),
  ('Dumbbell Fly', 'chest'),
  ('Cable Crossover', 'chest'),
  ('Dips', 'chest'),

  -- Back (5)
  ('Barbell Row', 'back'),
  ('Lat Pulldown', 'back'),
  ('Seated Cable Row', 'back'),
  ('Pull-Ups', 'back'),
  ('Deadlift', 'back'),

  -- Shoulders (5)
  ('Overhead Press', 'shoulders'),
  ('Lateral Raise', 'shoulders'),
  ('Face Pull', 'shoulders'),
  ('Reverse Fly', 'shoulders'),
  ('Arnold Press', 'shoulders'),

  -- Legs (7)
  ('Squat', 'legs'),
  ('Leg Press', 'legs'),
  ('Romanian Deadlift', 'legs'),
  ('Leg Curl', 'legs'),
  ('Leg Extension', 'legs'),
  ('Calf Raise', 'legs'),
  ('Lunges', 'legs'),

  -- Arms (5)
  ('Barbell Curl', 'arms'),
  ('Hammer Curl', 'arms'),
  ('Tricep Pushdown', 'arms'),
  ('Skull Crushers', 'arms'),
  ('Preacher Curl', 'arms'),

  -- Core (3)
  ('Plank', 'core'),
  ('Hanging Leg Raise', 'core'),
  ('Cable Crunch', 'core');
