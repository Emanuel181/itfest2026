import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, randomUUID } from "node:crypto"
import { promisify } from "node:util"

import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

import { getProjectsCollection, getSessionsCollection, getUsersCollection, type UserDocument } from "@/lib/server/mongodb"

const scrypt = promisify(scryptCallback)

export const SESSION_COOKIE_NAME = "agentsdlc_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export type AuthUser = {
  id: string
  email: string
  name: string
}

function shouldUseSecureCookies(request?: NextRequest) {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase()
  if (override === "true") return true
  if (override === "false") return false

  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase()
  if (forwardedProto === "https") return true
  if (forwardedProto === "http") return false

  const requestProtocol = request?.nextUrl.protocol?.replace(":", "").toLowerCase()
  if (requestProtocol === "https") return true
  if (requestProtocol === "http") return false

  return process.env.NODE_ENV === "production"
}

function nowIso() {
  return new Date().toISOString()
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":")
  if (!salt || !expectedHex) return false

  const derived = (await scrypt(password, salt, 64)) as Buffer
  const expected = Buffer.from(expectedHex, "hex")
  if (derived.length !== expected.length) return false

  return timingSafeEqual(derived, expected)
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function applySessionCookie(response: NextResponse, token: string, request?: NextRequest) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(request),
    path: "/",
    maxAge: 0,
  })
}

async function buildAuthUser(userId: string, user: UserDocument | null): Promise<AuthUser | null> {
  if (!user) return null

  return {
    id: userId,
    email: user.email,
    name: user.name,
  }
}

export async function syncPendingInvitesForUser(user: AuthUser) {
  const projects = await getProjectsCollection()
  const matchingProjects = await projects
    .find({
      "pendingInvites.email": user.email,
      collaboratorUserIds: { $ne: user.id },
      ownerUserId: { $ne: user.id },
    })
    .toArray()

  for (const project of matchingProjects) {
    const pendingInvites = project.pendingInvites.filter((invite) => invite.email !== user.email)
    const collaboratorUserIds = [...new Set([...project.collaboratorUserIds, user.id])]

    await projects.updateOne(
      { _id: project._id },
      {
        $set: {
          collaboratorUserIds,
          pendingInvites,
          updatedAt: nowIso(),
          "state.updatedAt": nowIso(),
        },
      }
    )
  }
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const users = await getUsersCollection()
  const email = normalizeEmail(input.email)
  const existing = await users.findOne({ email })
  if (existing) {
    throw new Error("An account with this email already exists.")
  }

  const createdAt = nowIso()
  const _id = randomUUID()
  const passwordHash = await hashPassword(input.password)

  await users.insertOne({
    _id,
    email,
    name: input.name.trim(),
    passwordHash,
    createdAt,
    updatedAt: createdAt,
  })

  const user = { id: _id, email, name: input.name.trim() }
  await syncPendingInvitesForUser(user)
  return user
}

export async function loginUser(input: { email: string; password: string }) {
  const users = await getUsersCollection()
  const email = normalizeEmail(input.email)
  const existing = await users.findOne({ email })
  if (!existing) {
    throw new Error("Invalid email or password.")
  }

  const valid = await verifyPassword(input.password, existing.passwordHash)
  if (!valid) {
    throw new Error("Invalid email or password.")
  }

  const user = { id: existing._id, email: existing.email, name: existing.name }
  await syncPendingInvitesForUser(user)
  return user
}

export async function createSession(userId: string) {
  const sessions = await getSessionsCollection()
  const token = randomBytes(32).toString("hex")
  const now = new Date()

  await sessions.insertOne({
    _id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: addSeconds(now, SESSION_TTL_SECONDS).toISOString(),
  })

  return token
}

export async function revokeSession(token: string | undefined | null) {
  if (!token) return

  const sessions = await getSessionsCollection()
  await sessions.deleteOne({ tokenHash: hashToken(token) })
}

async function resolveUserFromToken(token: string | undefined | null) {
  if (!token) return null

  const sessions = await getSessionsCollection()
  const session = await sessions.findOne({ tokenHash: hashToken(token) })
  if (!session) return null

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await sessions.deleteOne({ _id: session._id })
    return null
  }

  const users = await getUsersCollection()
  const user = await users.findOne({ _id: session.userId })
  return buildAuthUser(session.userId, user)
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  return resolveUserFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)
}

export async function getCurrentUserFromRequest(request: NextRequest) {
  return resolveUserFromToken(request.cookies.get(SESSION_COOKIE_NAME)?.value)
}
