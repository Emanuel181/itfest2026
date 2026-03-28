import { NextResponse } from 'next/server'
import { createServerClient, getToken } from '@/lib/supabase-server'
import { getStories, createStory } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const featureId = searchParams.get('feature_id') ?? undefined

    const db = createServerClient(getToken(request))
    const stories = await getStories(db, id, featureId)
    return NextResponse.json(stories)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServerClient(getToken(request))
    const body = await request.json()
    const story = await createStory(db, { ...body, project_id: id })
    return NextResponse.json(story, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
