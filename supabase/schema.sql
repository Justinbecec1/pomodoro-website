create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_path text,
  avatar_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profiles
  add column if not exists avatar_updated_at timestamptz;

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

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tasks
  add column if not exists due_at timestamptz;

create index if not exists tasks_user_id_created_at_idx
  on public.tasks (user_id, created_at desc);

alter table public.tasks enable row level security;

drop policy if exists "Users can view their own tasks" on public.tasks;
create policy "Users can view their own tasks"
  on public.tasks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on public.tasks;
create policy "Users can insert their own tasks"
  on public.tasks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on public.tasks;
create policy "Users can update their own tasks"
  on public.tasks
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can delete their own tasks"
  on public.tasks
  for delete
  using (auth.uid() = user_id);

create table if not exists public.activity_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null default current_date,
  seconds_spent integer not null default 0 check (seconds_spent >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, activity_date)
);

create index if not exists activity_daily_user_date_idx
  on public.activity_daily (user_id, activity_date desc);

alter table public.activity_daily enable row level security;

drop policy if exists "Users can view their own activity" on public.activity_daily;
create policy "Users can view their own activity"
  on public.activity_daily
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own activity" on public.activity_daily;
create policy "Users can insert their own activity"
  on public.activity_daily
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own activity" on public.activity_daily;
create policy "Users can update their own activity"
  on public.activity_daily
  for update
  using (auth.uid() = user_id);

create table if not exists public.progress_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  range_key text not null,
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, range_key)
);

alter table public.progress_notes drop constraint if exists progress_notes_range_key_check;
alter table public.progress_notes
  add constraint progress_notes_range_key_check check (range_key in ('day', 'week', 'month'));

create index if not exists progress_notes_user_updated_idx
  on public.progress_notes (user_id, updated_at desc);

alter table public.progress_notes enable row level security;

drop policy if exists "Users can view their own progress notes" on public.progress_notes;
create policy "Users can view their own progress notes"
  on public.progress_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own progress notes" on public.progress_notes;
create policy "Users can insert their own progress notes"
  on public.progress_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own progress notes" on public.progress_notes;
create policy "Users can update their own progress notes"
  on public.progress_notes
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own progress notes" on public.progress_notes;
create policy "Users can delete their own progress notes"
  on public.progress_notes
  for delete
  using (auth.uid() = user_id);
