import { NextRequest, NextResponse } from "next/server"

import { requireProjectAccess } from "@/lib/server/project-auth"
import { listProjectPresence, updateProjectPresence } from "@/lib/server/presence"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const presence = await listProjectPresence(access.projectId, access.user.id)
  return NextResponse.json({ presence })
}

export async function POST(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as
    | {
        pathname?: string
        locationLabel?: string
        menuLabel?: string
        storyId?: string
      }
    | null

  if (
    !body ||
    typeof body.pathname !== "string" ||
    typeof body.locationLabel !== "string" ||
    typeof body.menuLabel !== "string"
  ) {
    return NextResponse.json({ error: "A valid presence payload is required." }, { status: 400 })
  }

  await updateProjectPresence(access.projectId, access.user, {
    pathname: body.pathname,
    locationLabel: body.locationLabel,
    menuLabel: body.menuLabel,
    storyId: typeof body.storyId === "string" ? body.storyId : undefined,
  })

  const presence = await listProjectPresence(access.projectId, access.user.id)
  return NextResponse.json({ presence })
}
