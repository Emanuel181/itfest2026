import { SupabaseClient } from '@supabase/supabase-js'
import type { Requirement, InsertRequirement } from '@/lib/database.types'

export async function getRequirements(db: SupabaseClient, projectId: string) {
  const { data, error } = await db
    .from('requirements')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Requirement[]
}

export async function createRequirement(
  db: SupabaseClient,
  payload: InsertRequirement
) {
  const { data, error } = await db
    .from('requirements')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as Requirement
}

export async function updateRequirement(
  db: SupabaseClient,
  id: string,
  payload: Partial<InsertRequirement>
) {
  const { data, error } = await db
    .from('requirements')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Requirement
}

export async function deleteRequirement(db: SupabaseClient, id: string) {
  const { error } = await db.from('requirements').delete().eq('id', id)
  if (error) throw error
}
