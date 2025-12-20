-- Watchlist items table for user-starred ETFs

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  ticker text not null,
  created_at timestamptz not null default now(),

  constraint watchlist_user_email_fkey
    foreign key (user_email) references public.users(email) on delete cascade,
  constraint watchlist_ticker_fkey
    foreign key (ticker) references public.etfs(ticker) on delete cascade
);

-- Ensure one watchlist entry per user+ticker
create unique index if not exists watchlist_user_ticker_unique
  on public.watchlist_items (user_email, ticker);

-- Enable row level security
alter table public.watchlist_items enable row level security;

-- Policy: user can view their own watchlist
drop policy if exists "Users can view their own watchlist" on public.watchlist_items;
create policy "Users can view their own watchlist"
  on public.watchlist_items
  for select
  using (auth.email() = user_email);

-- Policy: user can insert into their own watchlist
drop policy if exists "Users can insert into their own watchlist" on public.watchlist_items;
create policy "Users can insert into their own watchlist"
  on public.watchlist_items
  for insert
  with check (auth.email() = user_email);

-- Policy: user can delete from their own watchlist
drop policy if exists "Users can delete from their own watchlist" on public.watchlist_items;
create policy "Users can delete from their own watchlist"
  on public.watchlist_items
  for delete
  using (auth.email() = user_email);


