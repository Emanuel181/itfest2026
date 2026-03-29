import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { requireSession } from "@/lib/server/project-auth"
import { deleteProject, getProjectSummary, inviteCollaborator, removeCollaborator } from "@/lib/server/projects"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession(request)
  if (!session.ok) return session.response

  const { projectId } = await context.params
  const project = await getProjectSummary(projectId, session.user)
  if (!project) {
    return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 })
  }

  return NextResponse.json({ project })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession(request)
  if (!session.ok) return session.response

  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const { projectId } = await context.params
  const body = payload.data as
    | { type: "invite-collaborator"; email?: string }
    | { type: "remove-collaborator"; collaboratorId?: string }

  try {
    if (body.type === "invite-collaborator") {
      if (typeof body.email !== "string" || !body.email.includes("@")) {
        return NextResponse.json({ error: "A valid collaborator email is required." }, { status: 400 })
      }

      const project = await inviteCollaborator(projectId, session.user, body.email)
      return NextResponse.json({ collaborators: project.state.collaborators })
    }

    if (body.type === "remove-collaborator") {
      if (typeof body.collaboratorId !== "string" || !body.collaboratorId.trim()) {
        return NextResponse.json({ error: "A collaborator identifier is required." }, { status: 400 })
      }

      const project = await removeCollaborator(projectId, session.user, body.collaboratorId)
      return NextResponse.json({ collaborators: project.state.collaborators })
    }

    return NextResponse.json({ error: "Unsupported project action." }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project update failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const session = await requireSession(request)
  if (!session.ok) return session.response

  const { projectId } = await context.params

  try {
    await deleteProject(projectId, session.user)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project deletion failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
