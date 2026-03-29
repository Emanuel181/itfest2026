-- Rulează în Supabase → SQL Editor → New query

-- Șterge orice variantă existentă a policy-ului de insert pe teams
drop policy if exists "team_insert"       on teams;
drop policy if exists "team_owner_insert" on teams;
drop policy if exists "owner_insert_team" on teams;

-- Recreează
create policy "team_insert" on teams
  for insert with check (auth.uid() = owner_id);