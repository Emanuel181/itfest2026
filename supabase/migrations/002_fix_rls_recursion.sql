-- ============================================================
-- Fix: infinite recursion in team_members / teams RLS
-- Idempotent — safe to run multiple times
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Drop ALL existing policies pe cele 3 tabele ───────────────
do $$ declare r record;
begin
  for r in select policyname from pg_policies where tablename in ('teams','team_members','team_invites') loop
    execute format('drop policy if exists %I on %I', r.policyname,
      (select tablename from pg_policies where policyname = r.policyname and tablename in ('teams','team_members','team_invites') limit 1));
  end loop;
end $$;

-- ── Helper function (security definer = ocoleste RLS) ─────────
create or replace function is_team_member(tid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from team_members
    where team_id = tid and user_id = auth.uid()
  )
$$;

-- ── teams ─────────────────────────────────────────────────────
create policy "team_select" on teams
  for select using (is_team_member(id));

create policy "team_insert" on teams
  for insert with check (auth.uid() = owner_id);

create policy "team_update" on teams
  for update using (auth.uid() = owner_id);

create policy "team_delete" on teams
  for delete using (auth.uid() = owner_id);

-- ── team_members ──────────────────────────────────────────────
create policy "tm_select" on team_members
  for select using (is_team_member(team_id));

create policy "tm_insert" on team_members
  for insert with check (
    auth.uid() = user_id
    or exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  );

create policy "tm_delete" on team_members
  for delete using (
    auth.uid() = user_id
    or exists (select 1 from teams where id = team_members.team_id and owner_id = auth.uid())
  );

-- ── team_invites ──────────────────────────────────────────────
create policy "ti_select" on team_invites
  for select using (true);

create policy "ti_insert" on team_invites
  for insert with check (
    exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  );

create policy "ti_delete" on team_invites
  for delete using (
    exists (select 1 from teams where id = team_invites.team_id and owner_id = auth.uid())
  );
