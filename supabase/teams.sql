-- ============================================================
-- Teams & Members schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Run AFTER schema.sql
-- ============================================================

-- ── Profiles (display name + email per user) ──────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  updated_at   timestamptz not null default now()
);

-- Auto-create profile when a new user registers
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
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

create trigger trg_teams_updated_at
  before update on teams
  for each row execute function update_updated_at();

-- ── Team Members ──────────────────────────────────────────────
create table if not exists team_members (
  id        uuid primary key default uuid_generate_v4(),
  team_id   uuid references teams(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  role      text not null default 'member'
            check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- ── Team Invites ──────────────────────────────────────────────
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

-- ── Indexes ───────────────────────────────────────────────────
create index idx_team_members_team    on team_members(team_id);
create index idx_team_members_user    on team_members(user_id);
create index idx_team_invites_team    on team_invites(team_id);
create index idx_team_invites_token   on team_invites(token);
create index idx_team_invites_email   on team_invites(email);

-- ── Row Level Security ────────────────────────────────────────
alter table profiles     enable row level security;
alter table teams        enable row level security;
alter table team_members enable row level security;
alter table team_invites enable row level security;

-- Profiles: own row + readable by teammates
create policy "read_own_profile" on profiles
  for select using (auth.uid() = id);

create policy "update_own_profile" on profiles
  for update using (auth.uid() = id);

create policy "read_teammate_profiles" on profiles
  for select using (
    exists (
      select 1 from team_members tm1
      join team_members tm2 on tm1.team_id = tm2.team_id
      where tm1.user_id = auth.uid() and tm2.user_id = profiles.id
    )
  );

-- Teams: members can read, only owner can update/delete
create policy "members_read_team" on teams
  for select using (
    exists (select 1 from team_members where team_id = teams.id and user_id = auth.uid())
  );

create policy "owner_insert_team" on teams
  for insert with check (auth.uid() = owner_id);

create policy "owner_update_team" on teams
  for update using (auth.uid() = owner_id);

create policy "owner_delete_team" on teams
  for delete using (auth.uid() = owner_id);

-- Team members: visible to all team members, owner can insert/delete
create policy "members_read" on team_members
  for select using (
    exists (select 1 from team_members tm where tm.team_id = team_members.team_id and tm.user_id = auth.uid())
  );

create policy "owner_manage_members" on team_members
  for all using (
    exists (select 1 from teams where teams.id = team_members.team_id and teams.owner_id = auth.uid())
  );

create policy "self_insert_member" on team_members
  for insert with check (auth.uid() = user_id);

-- Team invites: team members can read, owner/admin can insert, owner can delete
create policy "members_read_invites" on team_invites
  for select using (
    exists (select 1 from team_members where team_id = team_invites.team_id and user_id = auth.uid())
  );

create policy "owner_manage_invites" on team_invites
  for all using (
    exists (select 1 from teams where teams.id = team_invites.team_id and teams.owner_id = auth.uid())
  );

-- Anyone can read an invite by token (needed for /join page)
create policy "public_read_invite_by_token" on team_invites
  for select using (true);
