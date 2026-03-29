import { randomUUID } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import type { MessageChannel, StageKey } from "@/lib/backend/types"

const projectIdPattern = /^[a-z0-9][a-z0-9-]{5,63}$/i

export function createProjectId() {
  return `project-${randomUUID()}`
}

export function isValidProjectId(value: unknown): value is string {
  return typeof value === "string" && projectIdPattern.test(value)
}

export function getProjectIdFromRequest(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project")
  return isValidProjectId(projectId) ? projectId : null
}

export function invalidProjectResponse() {
  return NextResponse.json({ error: "A valid project query parameter is required." }, { status: 400 })
}

export async function readJsonBody(request: NextRequest) {
  try {
    return { ok: true as const, data: await request.json() }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }),
    }
  }
}

export function isMessageChannel(value: unknown): value is MessageChannel {
  return value === "product" || value === "technical"
}

export function isStageKey(value: unknown): value is StageKey {
  return (
    value === "Planning" ||
    value === "Analysis" ||
    value === "Design" ||
    value === "Implementation" ||
    value === "Testing & Integration" ||
    value === "Maintenance"
  )
}
