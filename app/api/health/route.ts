import { NextRequest, NextResponse } from "next/server"

import { getHealth } from "@/lib/backend/service"
import { requireProjectAccess } from "@/lib/server/project-auth"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireProjectAccess(request)
  if (!access.ok) return access.response

  return NextResponse.json(await getHealth(access.projectId))
}
