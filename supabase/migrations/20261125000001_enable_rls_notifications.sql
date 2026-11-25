-- Migration: Enable Row Level Security on notifications table
-- Restricts direct PostgREST access so users can only view/update their own notifications

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Users can only view notifications where they are the recipient
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- 2. Users can update their own notifications (e.g. mark as read)
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  )
  WITH CHECK (
    LOWER(recipient_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- 3. Users can insert notifications where they are the sender
CREATE POLICY "Users can insert notifications as sender"
  ON public.notifications FOR INSERT
  WITH CHECK (
    LOWER(sender_email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );
