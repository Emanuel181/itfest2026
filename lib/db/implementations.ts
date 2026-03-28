import { SupabaseClient } from '@supabase/supabase-js'
import type { Implementation, InsertImplementation } from '@/lib/database.types'

export async function getImplementations(db: SupabaseClient, storyId: string) {
  const { data, error } = await db
    .from('implementations')
    .select('*')
    .eq('story_id', storyId)
    .order('variant_number', { ascending: true })
  if (error) throw error
  return data as Implementation[]
}

export async function upsertImplementation(
  db: SupabaseClient,
  payload: InsertImplementation
) {
  const { data, error } = await db
    .from('implementations')
    .upsert(payload, { onConflict: 'story_id,variant_number' })
    .select()
    .single()
  if (error) throw error
  return data as Implementation
}

export async function selectVariant(
  db: SupabaseClient,
  storyId: string,
  variantNumber: 1 | 2 | 3
) {
  // Mark chosen variant as selected, others as rejected
  const { error: rejectErr } = await db
    .from('implementations')
    .update({ status: 'rejected' })
    .eq('story_id', storyId)
    .neq('variant_number', variantNumber)

  if (rejectErr) throw rejectErr

  const { data, error } = await db
    .from('implementations')
    .update({ status: 'selected' })
    .eq('story_id', storyId)
    .eq('variant_number', variantNumber)
    .select()
    .single()

  if (error) throw error
  return data as Implementation
}
