-- User preferences table (key-value per user). Keeps users table lean and allows adding more preferences without new columns.
-- Example: insights_section_order, future theme/layout prefs, etc.

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  preference_key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),

  constraint user_preferences_user_email_fkey
    foreign key (user_email) references public.users(email) on delete cascade
);

create unique index if not exists user_preferences_user_key_unique
  on public.user_preferences (user_email, preference_key);

create index if not exists user_preferences_user_email_idx
  on public.user_preferences (user_email);

alter table public.user_preferences enable row level security;

drop policy if exists "Users can view own preferences" on public.user_preferences;
create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.email() = user_email);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.email() = user_email);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.email() = user_email)
  with check (auth.email() = user_email);

drop policy if exists "Users can delete own preferences" on public.user_preferences;
create policy "Users can delete own preferences"
  on public.user_preferences for delete
  using (auth.email() = user_email);
