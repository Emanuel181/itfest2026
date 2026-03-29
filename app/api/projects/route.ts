import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { requireSession } from "@/lib/server/project-auth"
import { createProjectForUser, listProjectsForUser } from "@/lib/server/projects"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await requireSession(request)
  if (!session.ok) return session.response

  const projects = await listProjectsForUser(session.user)
  return NextResponse.json({ projects })
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request)
  if (!session.ok) return session.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { name?: string }
  const created = await createProjectForUser(session.user, body.name)
  return NextResponse.json({ projectId: created.id, project: created.state }, { status: 201 })
}
