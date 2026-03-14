-- Book Brain: Supabase Schema Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Conversations table
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamptz default now() not null,
  title text
);

-- Messages table
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz default now() not null
);

-- Index for faster message lookups
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Permissive policies for anon (this is a personal demo app)
create policy "Allow all on conversations" on public.conversations
  for all using (true) with check (true);

create policy "Allow all on messages" on public.messages
  for all using (true) with check (true);
