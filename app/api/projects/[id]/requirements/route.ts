import { NextResponse } from 'next/server'
import { createServerClient, getToken } from '@/lib/supabase-server'
import { getRequirements, createRequirement } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = createServerClient(getToken(request))
    const requirements = await getRequirements(db, id)
    return NextResponse.json(requirements)
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
    const req = await createRequirement(db, { ...body, project_id: id })
    return NextResponse.json(req, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
