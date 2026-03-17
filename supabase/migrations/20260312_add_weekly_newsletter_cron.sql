-- ============================================
-- Supabase Cron: Weekly Newsletter
-- Invokes send-weekly-newsletter Edge Function every Monday at 8:00 AM UTC.
--
-- Add this job manually like your other cron jobs: run the SELECT cron.schedule(...)
-- below in SQL Editor. Replace YOUR_ANON_KEY with your anon key (same as in your
-- update-realtime-prices and other cron jobs). Project URL is set for hlwpasiewplmjvrtuuxf.
--
-- To change schedule: cron.unschedule('send-weekly-newsletter'); then re-run with
-- a different expression (e.g. '0 12 * * 1' = Monday noon UTC).
-- ============================================

-- Optional: enable extensions if not already enabled (skip if you already have other cron jobs)
-- create extension if not exists pg_cron with schema pg_catalog;
-- create extension if not exists pg_net with schema extensions;
-- grant usage on schema cron to postgres;
-- grant all privileges on all tables in schema cron to postgres;

-- Weekly newsletter: every Monday at 8:00 AM UTC (minute hour day month dow; 1 = Monday)
select cron.schedule(
  'send-weekly-newsletter',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://hlwpasiewplmjvrtuuxf.supabase.co/functions/v1/send-weekly-newsletter',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
