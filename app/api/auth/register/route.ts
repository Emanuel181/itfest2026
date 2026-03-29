import { NextRequest, NextResponse } from "next/server"

import { readJsonBody } from "@/lib/backend/http"
import { applySessionCookie, createSession, registerUser } from "@/lib/server/auth"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const payload = await readJsonBody(request)
  if (!payload.ok) return payload.response

  const body = payload.data as { name?: string; email?: string; password?: string }
  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters long." }, { status: 400 })
  }

  if (typeof body.email !== "string" || !body.email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  }

  if (typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 })
  }

  try {
    const user = await registerUser({
      name: body.name,
      email: body.email,
      password: body.password,
    })

    const token = await createSession(user.id)
    const response = NextResponse.json({ user })
    applySessionCookie(response, token, request)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
