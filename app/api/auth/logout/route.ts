import { NextRequest, NextResponse } from "next/server"

import { clearSessionCookie, revokeSession, SESSION_COOKIE_NAME } from "@/lib/server/auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  await revokeSession(token)

  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
