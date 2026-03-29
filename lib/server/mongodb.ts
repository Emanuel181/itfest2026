import { MongoClient, ServerApiVersion, type Collection } from "mongodb"

import type { ProjectState } from "@/lib/backend/types"

export type UserDocument = {
  _id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export type SessionDocument = {
  _id: string
  userId: string
  tokenHash: string
  createdAt: string
  expiresAt: string
}

export type ProjectInvite = {
  email: string
  invitedAt: string
  invitedByUserId: string
}

export type ProjectDocument = {
  _id: string
  ownerUserId: string
  collaboratorUserIds: string[]
  pendingInvites: ProjectInvite[]
  state: ProjectState
  createdAt: string
  updatedAt: string
}

export type ProjectPresenceDocument = {
  _id: string
  projectId: string
  userId: string
  userName: string
  userEmail: string
  pathname: string
  locationLabel: string
  menuLabel: string
  storyId?: string
  updatedAt: string
  expiresAt: string
}

declare global {
  var __agentsdlcMongoClientPromise: Promise<MongoClient> | undefined
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.")
  }

  return uri
}

function getMongoDbName(uri: string) {
  const explicit = process.env.MONGODB_DB?.trim()
  if (explicit) return explicit

  try {
    const parsed = new URL(uri)
    const pathname = parsed.pathname.replace(/^\/+/, "").trim()
    return pathname || "agentsdlc"
  } catch {
    return "agentsdlc"
  }
}

function createClient() {
  return new MongoClient(getMongoUri(), {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })
}

async function getMongoClient() {
  if (!global.__agentsdlcMongoClientPromise) {
    global.__agentsdlcMongoClientPromise = createClient().connect()
  }

  return global.__agentsdlcMongoClientPromise
}

export async function getDatabase() {
  const client = await getMongoClient()
  return client.db(getMongoDbName(getMongoUri()))
}

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const db = await getDatabase()
  return db.collection<UserDocument>("users")
}

export async function getSessionsCollection(): Promise<Collection<SessionDocument>> {
  const db = await getDatabase()
  return db.collection<SessionDocument>("sessions")
}

export async function getProjectsCollection(): Promise<Collection<ProjectDocument>> {
  const db = await getDatabase()
  return db.collection<ProjectDocument>("projects")
}

export async function getProjectPresenceCollection(): Promise<Collection<ProjectPresenceDocument>> {
  const db = await getDatabase()
  return db.collection<ProjectPresenceDocument>("projectPresence")
}
