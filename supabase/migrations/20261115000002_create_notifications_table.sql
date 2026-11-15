-- Migration: Create notifications table
-- Stores user notifications (plan completion, coach assignment, etc.)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  sender_email text not null,
  type text not null check (type in ('plan_completed', 'plan_created', 'plan_updated', 'exercise_completed')),
  title text not null,
  message text not null,
  link_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is 'User notifications for coaching and plan milestones';
comment on column public.notifications.recipient_email is 'Email of the notification recipient';
comment on column public.notifications.sender_email is 'Email of the user or coach who triggered the event';
comment on column public.notifications.type is 'Type of notification event';
comment on column public.notifications.is_read is 'Whether the recipient has marked this notification as read';

-- Index for querying recent notifications per user
create index if not exists idx_notifications_recipient_created on public.notifications (lower(recipient_email), created_at desc);

-- Partial index for fast unread count
create index if not exists idx_notifications_unread on public.notifications (lower(recipient_email), is_read) where is_read = false;
