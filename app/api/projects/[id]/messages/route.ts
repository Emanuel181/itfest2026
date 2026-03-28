import { NextResponse } from 'next/server'
import { createServerClient, getToken } from '@/lib/supabase-server'
import { getMessages, addMessage } from '@/lib/db'
import type { MessageStage } from '@/lib/database.types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage') as MessageStage | null

    const db = createServerClient(getToken(request))
    const messages = await getMessages(db, id, stage ?? undefined)
    return NextResponse.json(messages)
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
    const msg = await addMessage(db, { ...body, project_id: id })
    return NextResponse.json(msg, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
