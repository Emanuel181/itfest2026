import { randomUUID } from "node:crypto"

import type { CollaboratorPresence } from "@/lib/backend/types"
import type { AuthUser } from "@/lib/server/auth"
import { getProjectPresenceCollection } from "@/lib/server/mongodb"

const PRESENCE_TTL_MS = 20_000
const STALE_RETENTION_MS = 5 * 60_000

function nowIso() {
  return new Date().toISOString()
}

function addMs(date: Date, amount: number) {
  return new Date(date.getTime() + amount).toISOString()
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AI"
}

export async function updateProjectPresence(
  projectId: string,
  user: AuthUser,
  input: {
    pathname: string
    locationLabel: string
    menuLabel: string
    storyId?: string
  }
) {
  const collection = await getProjectPresenceCollection()
  const now = new Date()
  const updatedAt = now.toISOString()

  await collection.updateOne(
    { projectId, userId: user.id },
    {
      $set: {
        userName: user.name,
        userEmail: user.email,
        pathname: input.pathname,
        locationLabel: input.locationLabel,
        menuLabel: input.menuLabel,
        storyId: input.storyId,
        updatedAt,
        expiresAt: addMs(now, PRESENCE_TTL_MS),
      },
      $setOnInsert: {
        _id: randomUUID(),
        projectId,
        userId: user.id,
      },
    },
    { upsert: true }
  )
}

export async function listProjectPresence(projectId: string, currentUserId?: string): Promise<CollaboratorPresence[]> {
  const collection = await getProjectPresenceCollection()
  const now = new Date()

  await collection.deleteMany({
    projectId,
    expiresAt: { $lt: addMs(now, -STALE_RETENTION_MS) },
  })

  const records = await collection
    .find({
      projectId,
      expiresAt: { $gt: nowIso() },
    })
    .sort({ updatedAt: -1 })
    .toArray()

  return records.map((record) => ({
    userId: record.userId,
    name: record.userName,
    email: record.userEmail,
    initials: initialsFromName(record.userName),
    pathname: record.pathname,
    locationLabel: record.locationLabel,
    menuLabel: record.menuLabel,
    storyId: record.storyId,
    updatedAt: record.updatedAt,
    isCurrentUser: record.userId === currentUserId,
  }))
}
