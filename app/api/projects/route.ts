import { NextResponse } from 'next/server'
import { createServerClient, getToken } from '@/lib/supabase-server'
import { getProjects, createProject } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const db = createServerClient(getToken(request))
    const projects = await getProjects(db)
    return NextResponse.json(projects)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const db = createServerClient(getToken(request))
    const body = await request.json()
    const project = await createProject(db, body)
    return NextResponse.json(project, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
