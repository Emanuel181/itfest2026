-- ============================================================
-- Luminescent IDE — Full Migration
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  updated_at   timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Teams ─────────────────────────────────────────────────────
create table if not exists teams (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_members (
  id        uuid primary key default uuid_generate_v4(),
  team_id   uuid references teams(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  role      text not null default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists team_invites (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid references teams(id) on delete cascade not null,
  email       text not null,
  token       text not null unique,
  invited_by  uuid references auth.users(id) on delete cascade not null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (team_id, email)
);

-- ── Projects ──────────────────────────────────────────────────
create table if not exists projects (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  team_id      uuid references teams(id) on delete set null,
  title        text not null,
  objective    text,
  audience     jsonb default '[]',
  scope        jsonb default '[]',
  deliverables jsonb default '[]',
  risks        jsonb default '[]',
  tech_stack   jsonb default '[]',
  architecture text,
  db_schema    text,
  status       text not null default 'ideation'
               check (status in ('ideation','requirements','stories','implementation','security','merge','done')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Project child tables ──────────────────────────────────────
create table if not exists messages (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  stage      text not null default 'ideation'
             check (stage in ('ideation','requirements','stories','implementation','security','merge')),
  author     text not null,
  role       text not null check (role in ('human','ai')),
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists requirements (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  ref_id     text,
  title      text not null,
  description text,
  type       text not null default 'functional' check (type in ('functional','non-functional')),
  status     text not null default 'draft' check (status in ('draft','approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists features (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid references projects(id) on delete cascade not null,
  requirement_id      uuid references requirements(id) on delete set null,
  title               text not null,
  summary             text,
  acceptance_criteria jsonb default '[]',
  status              text not null default 'draft' check (status in ('draft','approved')),
  created_at          timestamptz not null default now()
);

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

create table if not exists implementations (
  id             uuid primary key default uuid_generate_v4(),
  story_id       uuid references user_stories(id) on delete cascade not null,
  variant_number int not null check (variant_number between 1 and 3),
  title          text not null,
  code           text,
  architecture   text,
  tradeoffs_pro  jsonb default '[]',
  tradeoffs_con  jsonb default '[]',
  status         text not null default 'draft' check (status in ('draft','selected','rejected')),
  created_at     timestamptz not null default now(),
  unique (story_id, variant_number)
);

create table if not exists security_issues (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references projects(id) on delete cascade not null,
  story_id    uuid references user_stories(id) on delete set null,
  title       text not null,
  description text,
  severity    text not null default 'medium' check (severity in ('low','medium','high','critical')),
  owasp       text,
  status      text not null default 'open' check (status in ('open','resolved')),
  created_at  timestamptz not null default now()
);

create table if not exists activities (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  agent      text not null,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create table if not exists workspace_files (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade not null,
  name       text not null,
  content    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger function ───────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_projects_upd    before update on projects       for each row execute function update_updated_at();
create trigger trg_teams_upd       before update on teams          for each row execute function update_updated_at();
create trigger trg_req_upd         before update on requirements   for each row execute function update_updated_at();
create trigger trg_stories_upd     before update on user_stories   for each row execute function update_updated_at();
create trigger trg_files_upd       before update on workspace_files for each row execute function update_updated_at();

-- ── Indexes ───────────────────────────────────────────────────
create index idx_projects_user_id      on projects(user_id);
create index idx_projects_team_id      on projects(team_id);
create index idx_messages_project      on messages(project_id);
create index idx_requirements_project  on requirements(project_id);
create index idx_features_project      on features(project_id);
create index idx_stories_project       on user_stories(project_id);
create index idx_stories_feature       on user_stories(feature_id);
create index idx_implementations_story on implementations(story_id);
create index idx_security_project      on security_issues(project_id);
create index idx_activities_project    on activities(project_id);
create index idx_files_project         on workspace_files(project_id);
create index idx_team_members_team     on team_members(team_id);
create index idx_team_members_user     on team_members(user_id);
create index idx_team_invites_token    on team_invites(token);
create index idx_team_invites_email    on team_invites(email);

-- ── RLS enable ────────────────────────────────────────────────
alter table profiles        enable row level security;
alter table teams           enable row level security;
alter table team_members    enable row level security;
alter table team_invites    enable row level security;
alter table projects        enable row level security;
alter table messages        enable row level security;
alter table requirements    enable row level security;
alter table features        enable row level security;
alter table user_stories    enable row level security;
alter table implementations enable row level security;
alter table security_issues enable row level security;
alter table activities      enable row level security;
alter table workspace_files enable row level security;

-- ── Helper: is current user a member of a project's team? ─────
-- Used repeatedly in RLS policies below
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from projects p
    join team_members tm on tm.team_id = p.team_id
    where p.id = pid and tm.user_id = auth.uid()
  )
$$;

-- ── Profiles RLS ─────────────────────────────────────────────
create policy "profile_own"      on profiles for all  using (auth.uid() = id);
create policy "profile_teammate" on profiles for select using (
  exists (
    select 1 from team_members a join team_members b on a.team_id = b.team_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);

-- ── Teams RLS ────────────────────────────────────────────────
create policy "team_member_read"   on teams for select using (
  exists (select 1 from team_members where team_id = teams.id and user_id = auth.uid())
);
create policy "team_owner_insert"  on teams for insert with check (auth.uid() = owner_id);
create policy "team_owner_update"  on teams for update using (auth.uid() = owner_id);
create policy "team_owner_delete"  on teams for delete using (auth.uid() = owner_id);

-- ── Team members RLS ─────────────────────────────────────────
create policy "members_read" on team_members for select using (
  exists (select 1 from team_members tm where tm.team_id = team_members.team_id and tm.user_id = auth.uid())
);
create policy "owner_manage" on team_members for all using (
  exists (select 1 from teams where id = team_members.team_id and owner_id = auth.uid())
);
create policy "self_join" on team_members for insert with check (auth.uid() = user_id);

-- ── Team invites RLS ─────────────────────────────────────────
create policy "invites_team_read"   on team_invites for select using (
  exists (select 1 from team_members where team_id = team_invites.team_id and user_id = auth.uid())
  or true  -- allow reading by token for /join page
);
create policy "invites_owner_all"   on team_invites for all using (
  exists (select 1 from teams where id = team_invites.team_id and owner_id = auth.uid())
);

-- ── Projects RLS — owner or team member ──────────────────────
create policy "project_select" on projects for select using (
  auth.uid() = user_id
  or (team_id is not null and is_project_member(id))
);
create policy "project_insert" on projects for insert with check (auth.uid() = user_id);
create policy "project_update" on projects for update using (
  auth.uid() = user_id
  or (team_id is not null and is_project_member(id))
);
create policy "project_delete" on projects for delete using (auth.uid() = user_id);

-- ── Child tables RLS — owner or team member of parent project ─
create or replace function can_access_project(pid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from projects p
    where p.id = pid
    and (
      p.user_id = auth.uid()
      or (p.team_id is not null and is_project_member(pid))
    )
  )
$$;

create policy "access" on messages        for all using (can_access_project(project_id));
create policy "access" on requirements    for all using (can_access_project(project_id));
create policy "access" on features        for all using (can_access_project(project_id));
create policy "access" on user_stories    for all using (can_access_project(project_id));
create policy "access" on security_issues for all using (can_access_project(project_id));
create policy "access" on activities      for all using (can_access_project(project_id));
create policy "access" on workspace_files for all using (can_access_project(project_id));

create policy "access" on implementations for all using (
  exists (
    select 1 from user_stories s
    where s.id = implementations.story_id
    and can_access_project(s.project_id)
  )
);
