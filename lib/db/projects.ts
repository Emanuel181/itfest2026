import { SupabaseClient } from '@supabase/supabase-js'
import type { Project, InsertProject } from '@/lib/database.types'

export async function getProjects(db: SupabaseClient) {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function getProject(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Project
}

export async function createProject(db: SupabaseClient, payload: InsertProject) {
  const { data, error } = await db
    .from('projects')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function updateProject(
  db: SupabaseClient,
  id: string,
  payload: Partial<InsertProject>
) {
  const { data, error } = await db
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(db: SupabaseClient, id: string) {
  const { error } = await db.from('projects').delete().eq('id', id)
  if (error) throw error
}
