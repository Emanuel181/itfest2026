import { SupabaseClient } from '@supabase/supabase-js'
import type { Message, InsertMessage, MessageStage } from '@/lib/database.types'

export async function getMessages(
  db: SupabaseClient,
  projectId: string,
  stage?: MessageStage
) {
  let query = db
    .from('messages')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (stage) query = query.eq('stage', stage)

  const { data, error } = await query
  if (error) throw error
  return data as Message[]
}

export async function addMessage(db: SupabaseClient, payload: InsertMessage) {
  const { data, error } = await db
    .from('messages')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as Message
}

export async function deleteMessages(
  db: SupabaseClient,
  projectId: string,
  stage?: MessageStage
) {
  let query = db.from('messages').delete().eq('project_id', projectId)
  if (stage) query = query.eq('stage', stage)
  const { error } = await query
  if (error) throw error
}
