import { NextResponse, type NextRequest } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse } from "@/lib/backend/http"
import { getCurrentUserFromRequest, type AuthUser } from "@/lib/server/auth"
import { getAccessibleProject } from "@/lib/server/projects"

type AuthFailure = {
  ok: false
  response: NextResponse
}

type SessionSuccess = {
  ok: true
  user: AuthUser
}

type ProjectSuccess = {
  ok: true
  user: AuthUser
  projectId: string
  isOwner: boolean
}

export async function requireSession(request: NextRequest): Promise<AuthFailure | SessionSuccess> {
  const user = await getCurrentUserFromRequest(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    }
  }

  return { ok: true, user }
}

export async function requireProjectAccess(
  request: NextRequest,
  options?: { ownerOnly?: boolean }
): Promise<AuthFailure | ProjectSuccess> {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) {
    return { ok: false, response: invalidProjectResponse() }
  }

  const session = await requireSession(request)
  if (!session.ok) return session

  const project = await getAccessibleProject(projectId, session.user.id)
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Project not found or access denied." }, { status: 404 }),
    }
  }

  const isOwner = project.ownerUserId === session.user.id
  if (options?.ownerOnly && !isOwner) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Only the project owner can perform this action." }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: session.user,
    projectId,
    isOwner,
  }
}
