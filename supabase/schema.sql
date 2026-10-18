-- Run this once in your Supabase project's SQL Editor.
-- Matches the content structure: Module -> Chapter -> Quiz -> Question,
-- plus Student -> Progress / Quiz Attempt for tracking.

create extension if not exists "pgcrypto";

create table modules (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  title text not null
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) on delete cascade,
  number int not null,
  title text not null,
  content text not null
);

create table quizzes (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references chapters(id) on delete cascade,
  title text not null
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  type text not null default 'mcq',
  prompt text not null,
  options jsonb not null,       -- e.g. ["Option A", "Option B", "Option C"]
  correct_index int not null    -- index into options, e.g. 1
);

-- One row per authenticated student, keyed to Supabase's built-in auth.users.
create table students (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  cohort text
);

create table progress (
  student_id uuid references students(id) on delete cascade,
  chapter_id uuid references chapters(id) on delete cascade,
  status text not null default 'complete',
  completed_at timestamptz default now(),
  primary key (student_id, chapter_id)
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete cascade,
  score int not null,
  attempted_at timestamptz default now()
);

-- Row Level Security: this is what keeps chapter/quiz content behind login.
-- Without these policies, Supabase denies all access by default once RLS is
-- enabled, which is the safe direction to fail in.
alter table modules enable row level security;
alter table chapters enable row level security;
alter table quizzes enable row level security;
alter table questions enable row level security;
alter table students enable row level security;
alter table progress enable row level security;
alter table quiz_attempts enable row level security;

create policy "Signed-in students can read modules" on modules for select using (auth.role() = 'authenticated');
create policy "Signed-in students can read chapters" on chapters for select using (auth.role() = 'authenticated');
create policy "Signed-in students can read quizzes" on quizzes for select using (auth.role() = 'authenticated');
create policy "Signed-in students can read questions" on questions for select using (auth.role() = 'authenticated');

create policy "Students see their own student row" on students for select using (auth.uid() = id);
create policy "Students create their own student row" on students for insert with check (auth.uid() = id);

create policy "Students read own progress" on progress for select using (auth.uid() = student_id);
create policy "Students write own progress" on progress for insert with check (auth.uid() = student_id);
create policy "Students update own progress" on progress for update using (auth.uid() = student_id);

create policy "Students read own quiz attempts" on quiz_attempts for select using (auth.uid() = student_id);
create policy "Students write own quiz attempts" on quiz_attempts for insert with check (auth.uid() = student_id);

-- Known limitation, worth knowing rather than discovering later:
-- the "questions" policy above lets any signed-in student SELECT the
-- correct_index column directly, since it isn't hidden from the query result
-- itself (only from the UI). Fine for a first version with an honesty-system
-- cohort. If that ever matters, the fix is to move answer-checking into a
-- Postgres function (or Supabase Edge Function) that grades server-side
-- and never returns correct_index to the client at all.
