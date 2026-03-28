import { SupabaseClient } from '@supabase/supabase-js'
import type { UserStory, InsertUserStory } from '@/lib/database.types'

export async function getStories(
  db: SupabaseClient,
  projectId: string,
  featureId?: string
) {
  let query = db
    .from('user_stories')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (featureId) query = query.eq('feature_id', featureId)

  const { data, error } = await query
  if (error) throw error
  return data as UserStory[]
}

export async function getStory(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from('user_stories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as UserStory
}

export async function createStory(
  db: SupabaseClient,
  payload: InsertUserStory
) {
  const { data, error } = await db
    .from('user_stories')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as UserStory
}

export async function updateStory(
  db: SupabaseClient,
  id: string,
  payload: Partial<InsertUserStory>
) {
  const { data, error } = await db
    .from('user_stories')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as UserStory
}

export async function deleteStory(db: SupabaseClient, id: string) {
  const { error } = await db.from('user_stories').delete().eq('id', id)
  if (error) throw error
}
