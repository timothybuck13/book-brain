-- Book Brain: Supabase Schema Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Drop old permissive policies (from v1)
-- ============================================
drop policy if exists "Allow all on conversations" on public.conversations;
drop policy if exists "Allow all on messages" on public.messages;

-- ============================================
-- Conversations table (updated for multi-user)
-- ============================================
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamptz default now() not null,
  title text,
  user_id uuid references auth.users(id) on delete cascade
);

-- Add user_id column if table already exists
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'user_id'
  ) then
    alter table public.conversations add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- ============================================
-- Messages table (updated for multi-user)
-- ============================================
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz default now() not null,
  user_id uuid references auth.users(id) on delete cascade
);

-- Add user_id column if table already exists
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'user_id'
  ) then
    alter table public.messages add column user_id uuid references auth.users(id) on delete cascade;
  end if;
end $$;

-- Index for faster message lookups
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);

-- ============================================
-- User books table (for Goodreads import)
-- ============================================
create table if not exists public.user_books (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  author text not null,
  isbn text,
  rating integer check (rating >= 0 and rating <= 5),
  date_read date,
  shelves text,
  review text,
  created_at timestamptz default now()
);

-- Unique constraints for smart merge
create unique index if not exists idx_user_books_isbn on public.user_books(user_id, isbn) where isbn is not null and isbn != '';
create unique index if not exists idx_user_books_title_author on public.user_books(user_id, title, author);

-- ============================================
-- Row Level Security
-- ============================================
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_books enable row level security;

-- Conversations: users see their own + anonymous (user_id is null) for demo
create policy "Users see own conversations" on public.conversations
  for select using (user_id is null or auth.uid() = user_id);
create policy "Users insert own conversations" on public.conversations
  for insert with check (user_id is null or auth.uid() = user_id);
create policy "Users delete own conversations" on public.conversations
  for delete using (user_id is null or auth.uid() = user_id);
create policy "Users update own conversations" on public.conversations
  for update using (user_id is null or auth.uid() = user_id);

-- Messages: same pattern
create policy "Users see own messages" on public.messages
  for select using (user_id is null or auth.uid() = user_id);
create policy "Users insert own messages" on public.messages
  for insert with check (user_id is null or auth.uid() = user_id);
create policy "Users delete own messages" on public.messages
  for delete using (user_id is null or auth.uid() = user_id);

-- User books: only own
create policy "Users see own books" on public.user_books
  for select using (auth.uid() = user_id);
create policy "Users insert own books" on public.user_books
  for insert with check (auth.uid() = user_id);
create policy "Users delete own books" on public.user_books
  for delete using (auth.uid() = user_id);
create policy "Users update own books" on public.user_books
  for update using (auth.uid() = user_id);
