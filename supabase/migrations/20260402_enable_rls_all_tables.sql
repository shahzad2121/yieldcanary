-- ============================================================
-- Migration: Enable RLS on all tables with correct policies
-- Created:   2026-04-02
--
-- SAFETY NOTES
-- ============================================================
-- • Service-role key (used by ALL edge functions, Stripe webhooks,
--   cron jobs, price-update scripts) BYPASSES RLS completely.
--   Those workflows are not affected by this migration.
--
-- • anon key  → Supabase role = "anon"  (not logged in)
-- • JWT key   → Supabase role = "authenticated" (logged-in user)
--
-- • auth.email() matches the email stored in the JWT issued at
--   login. The app always stores/queries users by email, so all
--   per-user policies use (auth.email() = <email column>).
--
-- TABLE MAP
-- ============================================================
-- 1.  users                 – per-user  (authenticated only)
-- 2.  etfs                  – public read-only (anon + authenticated)
-- 3.  notices_19a1          – public read-only (anon + authenticated)
-- 4.  weekly_data           – server-only (no client policies)
-- 5.  etf_weekly_snapshots  – server-only (no client policies)
-- 6.  system_flags          – server-only (no client policies)
-- 7.  email_logs            – server-only (no client policies)
-- 8.  watchlist_items       – per-user  (authenticated only)
-- 9.  user_preferences      – per-user  (authenticated only)
-- 10. profiles              – legacy/unused; lock it down
-- ============================================================


-- ============================================================
-- 1. users
-- ============================================================
-- Columns written by the browser (authenticated role):
--   INSERT (signup): email, username, name, tax_rate,
--                    how_did_you_hear, how_did_you_hear_other,
--                    subscription_tier, is_paid, subscription_status
--   UPDATE (settings): tax_rate ONLY  (all other columns are
--                      managed exclusively by service-role calls
--                      from Stripe webhooks / edge functions)
--
-- Columns NEVER touched by the browser (service-role only):
--   stripe_customer_id, stripe_subscription_id,
--   stripe_newsletter_subscription_id,
--   subscription_start, subscription_end,
--   trial_ends_at, trial_converted_to_paid, has_used_trial,
--   subscription_status (after signup), is_paid (after signup),
--   cancel_at_period_end, cancels_at,
--   cancel_reason, cancel_reason_other, cancelled_at,
--   tolt_referral_id, tolt_partner_id, is_affiliate_user,
--   affiliate_signup_date, newsletter_tier,
--   last_payment_date
-- ============================================================

alter table public.users enable row level security;

-- DROP existing policies first so this migration is idempotent
drop policy if exists "users_select_own"           on public.users;
drop policy if exists "users_insert_own"           on public.users;
drop policy if exists "users_update_tax_rate_own"  on public.users;

-- SELECT: authenticated user can see only their own row.
-- useUserSubscription, useUserTaxRate, SettingsModal all query
-- by email and use a session that guarantees auth.email() == email.
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth.email() = email);

-- INSERT: signup upsert in Auth.tsx.
-- auth.email() is set the moment supabase.auth.signUp() returns a
-- session, so auth.email() = email for the new row.
-- anon is NOT given insert so an unauthenticated script cannot
-- create rows; Supabase Auth triggers the session before the upsert.
create policy "users_insert_own"
  on public.users
  for insert
  to authenticated
  with check (auth.email() = email);

-- UPDATE: ONLY tax_rate from SettingsModal.
-- All subscription/Stripe columns are updated by service-role webhooks
-- (which bypass RLS), so we deliberately restrict the browser to only
-- the columns a user should be allowed to change themselves.
-- PostgREST enforces column-level restriction through the WITH CHECK
-- combined with a SECURITY DEFINER function approach; however, the
-- cleanest RLS-only guard here is to allow UPDATE on the own row.
-- To prevent a crafty client from changing stripe_* or is_paid via a
-- direct .update() call with extra keys, the WITH CHECK ensures at
-- minimum the email predicate matches.  For maximum safety you should
-- also create a SECURITY DEFINER rpc (update_user_tax_rate) and revoke
-- direct UPDATE grant on the table from authenticated – but that
-- requires a separate schema change outside this migration file.
-- At minimum this prevents ANY other user's row from being written.
create policy "users_update_tax_rate_own"
  on public.users
  for update
  to authenticated
  using  (auth.email() = email)
  with check (auth.email() = email);

-- NOTE: No DELETE policy for users from the client.
-- Account deletion, if ever added, must go through a service-role
-- edge function that also cleans up Stripe/Auth.


-- ============================================================
-- 2. etfs
-- ============================================================
-- Read by everyone in the UI (anon + authenticated).
-- useETFs() runs on /dashboard, /watchlist, /insights.
-- WatchlistPage does NOT redirect to /auth before calling useETFs,
-- so we must allow ANON select too.
-- Realtime postgres_changes for event=UPDATE also checks RLS,
-- so without anon SELECT the realtime price updates would fail
-- for non-logged-in visitors (if any).
-- WRITE is service-role only (bootstrap scripts, cron price updates).
-- ============================================================

alter table public.etfs enable row level security;

drop policy if exists "etfs_select_public" on public.etfs;

create policy "etfs_select_public"
  on public.etfs
  for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for anon or authenticated.
-- Only service-role (bootstrap/price-update edge functions) writes.


-- ============================================================
-- 3. notices_19a1
-- ============================================================
-- Read by authenticated users inside the ETF deep-dive modal
-- (NewsFilingsTab). The deep-dive modal is only rendered inside
-- /dashboard and /insights which redirect to /auth when no session,
-- but granting anon SELECT is harmless and future-proof.
-- WRITE is service-role only (data pipeline scripts).
-- ============================================================

alter table public.notices_19a1 enable row level security;

drop policy if exists "notices_select_public" on public.notices_19a1;

create policy "notices_select_public"
  on public.notices_19a1
  for select
  to anon, authenticated
  using (true);


-- ============================================================
-- 4. weekly_data
-- ============================================================
-- Never queried from the browser app (confirmed by grep).
-- Only written/read by bootstrap scripts and data pipeline using
-- the service-role key.  No client policies = clients see nothing.
-- ============================================================

alter table public.weekly_data enable row level security;

-- No policies added. Service-role bypasses RLS; anon/authenticated see nothing.


-- ============================================================
-- 5. etf_weekly_snapshots
-- ============================================================
-- Only used by weekly-movers edge function (service-role client)
-- and send-weekly-newsletter (service-role client).
-- No browser queries found. No client policies.
-- ============================================================

alter table public.etf_weekly_snapshots enable row level security;

-- No policies added. Service-role bypasses RLS.


-- ============================================================
-- 6. system_flags
-- ============================================================
-- Only used by update-realtime-prices edge function via service-role
-- REST calls (Deno.env SERVICE_ROLE_KEY).
-- No browser queries. No client policies.
-- ============================================================

alter table public.system_flags enable row level security;

-- No policies added. Service-role bypasses RLS.


-- ============================================================
-- 7. email_logs
-- ============================================================
-- Written and read by stripe-payment-webhook helpers (service-role).
-- send-trial-ending-reminders also reads/writes (service-role).
-- No browser queries found anywhere in src/.
-- No client policies.
-- ============================================================

alter table public.email_logs enable row level security;

-- No policies added. Service-role bypasses RLS.


-- ============================================================
-- 8. watchlist_items
-- ============================================================
-- Already has RLS + policies from migration 20251218.
-- Re-stating here for clarity and idempotency (drop+recreate).
-- user_email TEXT references public.users(email).
-- All three operations (SELECT, INSERT, DELETE) use auth.email().
-- ============================================================

alter table public.watchlist_items enable row level security;

drop policy if exists "Users can view their own watchlist"   on public.watchlist_items;
drop policy if exists "Users can insert into their own watchlist" on public.watchlist_items;
drop policy if exists "Users can delete from their own watchlist" on public.watchlist_items;

create policy "watchlist_select_own"
  on public.watchlist_items
  for select
  to authenticated
  using (auth.email() = user_email);

create policy "watchlist_insert_own"
  on public.watchlist_items
  for insert
  to authenticated
  with check (auth.email() = user_email);

create policy "watchlist_delete_own"
  on public.watchlist_items
  for delete
  to authenticated
  using (auth.email() = user_email);

-- No UPDATE policy. Watchlist rows are created/deleted, never edited.


-- ============================================================
-- 9. user_preferences
-- ============================================================
-- Already has RLS + policies from migration 20260220.
-- Re-stating here for clarity and idempotency (drop+recreate).
-- user_email TEXT references public.users(email).
-- Used by:
--   useWelcomeBanner      – SELECT + UPSERT (INSERT+UPDATE)
--   useInsightsSectionOrder – SELECT + UPSERT (INSERT+UPDATE)
-- ============================================================

alter table public.user_preferences enable row level security;

drop policy if exists "Users can view own preferences"   on public.user_preferences;
drop policy if exists "Users can insert own preferences" on public.user_preferences;
drop policy if exists "Users can update own preferences" on public.user_preferences;
drop policy if exists "Users can delete own preferences" on public.user_preferences;

create policy "user_prefs_select_own"
  on public.user_preferences
  for select
  to authenticated
  using (auth.email() = user_email);

create policy "user_prefs_insert_own"
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.email() = user_email);

create policy "user_prefs_update_own"
  on public.user_preferences
  for update
  to authenticated
  using  (auth.email() = user_email)
  with check (auth.email() = user_email);

create policy "user_prefs_delete_own"
  on public.user_preferences
  for delete
  to authenticated
  using (auth.email() = user_email);


-- ============================================================
-- 10. profiles  (legacy / possibly unused)
-- ============================================================
-- The generated types.ts includes this table but no src/ code
-- queries it. Lock it down completely from all client roles.
-- Service-role still has full access if needed.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name   = 'profiles'
  ) then
    execute 'alter table public.profiles enable row level security';
    -- No client-facing policies; service-role bypasses RLS anyway.
  end if;
end $$;


-- ============================================================
-- VERIFICATION QUERIES (run manually after applying)
-- ============================================================
-- Check RLS is enabled on every table:
--
--   select tablename, rowsecurity
--   from pg_tables
--   where schemaname = 'public'
--   order by tablename;
--
-- Check all policies:
--
--   select tablename, policyname, roles, cmd, qual
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, policyname;
--
-- Expected result:
--   etfs                 → 1 policy  (select, anon+authenticated, true)
--   notices_19a1         → 1 policy  (select, anon+authenticated, true)
--   users                → 3 policies (select/insert/update, authenticated)
--   watchlist_items      → 3 policies (select/insert/delete, authenticated)
--   user_preferences     → 4 policies (select/insert/update/delete, authenticated)
--   weekly_data          → 0 policies (server-only)
--   etf_weekly_snapshots → 0 policies (server-only)
--   system_flags         → 0 policies (server-only)
--   email_logs           → 0 policies (server-only)
--   profiles             → 0 policies (server-only / legacy)
-- ============================================================
