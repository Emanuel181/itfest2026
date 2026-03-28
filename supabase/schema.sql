-- ============================================================
-- Luminescent IDE — Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ───────────────────────────────────────────────────

-- Projects (main entity — one per SDLC flow)
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade not null,
  title           text not null,
  objective       text,
  audience        jsonb default '[]',
  scope           jsonb default '[]',
  deliverables    jsonb default '[]',
  risks           jsonb default '[]',
  tech_stack      jsonb default '[]',
  architecture    text,
  db_schema       text,
  status          text not null default 'ideation'
                  check (status in ('ideation','requirements','stories','implementation','security','merge','done')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Messages (chat history per project + stage)
create table if not exists messages (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade not null,
  stage       text not null default 'ideation'
              check (stage in ('ideation','requirements','stories','implementation','security','merge')),
  author      text not null,
  role        text not null check (role in ('human','ai')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- Requirements
create table if not exists requirements (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade not null,
  ref_id      text,                        -- e.g. "REQ-001"
  title       text not null,
  description text,
  type        text not null default 'functional'
              check (type in ('functional','non-functional')),
  status      text not null default 'draft'
              check (status in ('draft','approved')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Features (derived from requirements)
create table if not exists features (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid references projects(id) on delete cascade not null,
  requirement_id      uuid references requirements(id) on delete set null,
  title               text not null,
  summary             text,
  acceptance_criteria jsonb default '[]',
  status              text not null default 'draft'
                      check (status in ('draft','approved')),
  created_at          timestamptz not null default now()
);

-- User Stories
create table if not exists user_stories (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid references projects(id) on delete cascade not null,
  feature_id          uuid references features(id) on delete set null,
  as_a                text not null,
  i_want              text not null,
  so_that             text,
  acceptance_criteria jsonb default '[]',
  complexity          text default 'M' check (complexity in ('S','M','L','XL')),
  status              text not null default 'draft'
                      check (status in ('draft','approved','in_progress','done')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Implementation Variants (3 per story)
create table if not exists implementations (
  id              uuid primary key default uuid_generate_v4(),
  story_id        uuid references user_stories(id) on delete cascade not null,
  variant_number  int not null check (variant_number between 1 and 3),
  title           text not null,
  code            text,
  architecture    text,
  tradeoffs_pro   jsonb default '[]',
  tradeoffs_con   jsonb default '[]',
  status          text not null default 'draft'
                  check (status in ('draft','selected','rejected')),
  created_at      timestamptz not null default now(),
  unique (story_id, variant_number)
);

-- Security Issues
create table if not exists security_issues (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid references projects(id) on delete cascade not null,
  story_id     uuid references user_stories(id) on delete set null,
  title        text not null,
  description  text,
  severity     text not null default 'medium'
               check (severity in ('low','medium','high','critical')),
  owasp        text,
  status       text not null default 'open'
               check (status in ('open','resolved')),
  created_at   timestamptz not null default now()
);

-- Agent Activity Log
create table if not exists activities (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade not null,
  agent       text not null,
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

-- Workspace Files (generated artifacts)
create table if not exists workspace_files (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade not null,
  name        text not null,
  content     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Auto-update updated_at ────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger trg_requirements_updated_at
  before update on requirements
  for each row execute function update_updated_at();

create trigger trg_stories_updated_at
  before update on user_stories
  for each row execute function update_updated_at();

create trigger trg_files_updated_at
  before update on workspace_files
  for each row execute function update_updated_at();

-- ── Indexes ───────────────────────────────────────────────────
create index idx_projects_user_id       on projects(user_id);
create index idx_messages_project_id    on messages(project_id);
create index idx_messages_stage         on messages(project_id, stage);
create index idx_requirements_project   on requirements(project_id);
create index idx_features_project       on features(project_id);
create index idx_stories_project        on user_stories(project_id);
create index idx_stories_feature        on user_stories(feature_id);
create index idx_implementations_story  on implementations(story_id);
create index idx_security_project       on security_issues(project_id);
create index idx_activities_project     on activities(project_id);
create index idx_files_project          on workspace_files(project_id);

-- ── Row Level Security ────────────────────────────────────────
alter table projects         enable row level security;
alter table messages         enable row level security;
alter table requirements     enable row level security;
alter table features         enable row level security;
alter table user_stories     enable row level security;
alter table implementations  enable row level security;
alter table security_issues  enable row level security;
alter table activities       enable row level security;
alter table workspace_files  enable row level security;

-- Projects: owner only
create policy "owner_all" on projects
  for all using (auth.uid() = user_id);

-- All child tables: accessible if the parent project belongs to the user
create policy "owner_all" on messages
  for all using (
    exists (select 1 from projects where projects.id = messages.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on requirements
  for all using (
    exists (select 1 from projects where projects.id = requirements.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on features
  for all using (
    exists (select 1 from projects where projects.id = features.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on user_stories
  for all using (
    exists (select 1 from projects where projects.id = user_stories.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on implementations
  for all using (
    exists (
      select 1 from user_stories
      join projects on projects.id = user_stories.project_id
      where user_stories.id = implementations.story_id
        and projects.user_id = auth.uid()
    )
  );

create policy "owner_all" on security_issues
  for all using (
    exists (select 1 from projects where projects.id = security_issues.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on activities
  for all using (
    exists (select 1 from projects where projects.id = activities.project_id and projects.user_id = auth.uid())
  );

create policy "owner_all" on workspace_files
  for all using (
    exists (select 1 from projects where projects.id = workspace_files.project_id and projects.user_id = auth.uid())
  );
