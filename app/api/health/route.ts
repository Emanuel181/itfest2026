import { NextRequest, NextResponse } from "next/server"

import { getProjectIdFromRequest, invalidProjectResponse } from "@/lib/backend/http"
import { getHealth } from "@/lib/backend/service"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const projectId = getProjectIdFromRequest(request)
  if (!projectId) return invalidProjectResponse()

  return NextResponse.json(await getHealth(projectId))
}
