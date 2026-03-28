import { NextResponse } from 'next/server'
import { createServerClient, getToken } from '@/lib/supabase-server'
import { getImplementations, upsertImplementation, selectVariant } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServerClient(getToken(request))
    const implementations = await getImplementations(db, id)
    return NextResponse.json(implementations)
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
    const impl = await upsertImplementation(db, { ...body, story_id: id })
    return NextResponse.json(impl, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH /api/stories/:id/implementations  { variant_number: 1|2|3 }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServerClient(getToken(request))
    const { variant_number } = await request.json()
    const impl = await selectVariant(db, id, variant_number)
    return NextResponse.json(impl)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
