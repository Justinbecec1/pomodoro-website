create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

create table if not exists public.timer_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  remaining_seconds integer not null default 1500 check (remaining_seconds >= 0 and remaining_seconds <= 86400),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.timer_state
  add column if not exists current_mode text not null default 'work';

alter table public.timer_state
  add column if not exists todays_pomodoros integer not null default 0;

alter table public.timer_state
  add column if not exists time_worked_seconds integer not null default 0;

alter table public.timer_state
  add column if not exists stats_date date not null default current_date;

alter table public.timer_state
  add column if not exists last_work_seconds integer not null default 1500;

alter table public.timer_state drop constraint if exists timer_state_current_mode_check;
alter table public.timer_state
  add constraint timer_state_current_mode_check check (current_mode in ('work', 'break'));

alter table public.timer_state drop constraint if exists timer_state_todays_pomodoros_check;
alter table public.timer_state
  add constraint timer_state_todays_pomodoros_check check (todays_pomodoros >= 0);

alter table public.timer_state drop constraint if exists timer_state_time_worked_seconds_check;
alter table public.timer_state
  add constraint timer_state_time_worked_seconds_check check (time_worked_seconds >= 0);

alter table public.timer_state drop constraint if exists timer_state_last_work_seconds_check;
alter table public.timer_state
  add constraint timer_state_last_work_seconds_check check (last_work_seconds > 0 and last_work_seconds <= 86400);

alter table public.timer_state enable row level security;

drop policy if exists "Users can view their own timer state" on public.timer_state;
create policy "Users can view their own timer state"
  on public.timer_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own timer state" on public.timer_state;
create policy "Users can insert their own timer state"
  on public.timer_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own timer state" on public.timer_state;
create policy "Users can update their own timer state"
  on public.timer_state
  for update
  using (auth.uid() = user_id);
