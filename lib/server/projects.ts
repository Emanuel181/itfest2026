import { createDefaultProjectState, normalizeProjectState } from "@/lib/backend/defaults"
import { createProjectId } from "@/lib/backend/http"
import type { Collaborator, ProjectState } from "@/lib/backend/types"
import { getProjectsCollection, getUsersCollection, type ProjectDocument, type UserDocument } from "@/lib/server/mongodb"
import { normalizeEmail, type AuthUser } from "@/lib/server/auth"

type ProjectSummary = {
  id: string
  title: string
  updatedAt: string
  currentStage: ProjectState["currentStage"]
  isOwner: boolean
  ownerName: string
  ownerEmail: string
  collaborators: Collaborator[]
}

function nowIso() {
  return new Date().toISOString()
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AI"
}

function inferRoleFromOwner(isOwner: boolean, pending: boolean) {
  if (isOwner) return "Owner"
  if (pending) return "Invited"
  return "Collaborator"
}

function inferStatusFromOwner(isOwner: boolean, pending: boolean) {
  if (isOwner) return "Project owner"
  if (pending) return "Invitation pending"
  return "Can view and edit the project"
}

function getProjectTitle(project: ProjectState) {
  return project.brief.title.trim() || "Untitled Project"
}

async function getUsersByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, UserDocument>()

  const users = await getUsersCollection()
  const records = await users.find({ _id: { $in: userIds } }).toArray()
  return new Map(records.map((record) => [record._id, record]))
}

async function buildCollaborators(project: ProjectDocument) {
  const userIds = [project.ownerUserId, ...project.collaboratorUserIds]
  const usersById = await getUsersByIds(userIds)
  const collaborators: Collaborator[] = []

  const owner = usersById.get(project.ownerUserId)
  if (owner) {
    collaborators.push({
      id: owner._id,
      name: owner.name,
      email: owner.email,
      role: inferRoleFromOwner(true, false),
      initials: initialsFromName(owner.name),
      status: inferStatusFromOwner(true, false),
      isOwner: true,
    })
  }

  for (const collaboratorId of project.collaboratorUserIds) {
    const collaborator = usersById.get(collaboratorId)
    if (!collaborator) continue

    collaborators.push({
      id: collaborator._id,
      name: collaborator.name,
      email: collaborator.email,
      role: inferRoleFromOwner(false, false),
      initials: initialsFromName(collaborator.name),
      status: inferStatusFromOwner(false, false),
    })
  }

  for (const invite of project.pendingInvites) {
    collaborators.push({
      id: `invite:${invite.email}`,
      name: invite.email,
      email: invite.email,
      role: inferRoleFromOwner(false, true),
      initials: invite.email.slice(0, 2).toUpperCase(),
      status: inferStatusFromOwner(false, true),
      invitePending: true,
    })
  }

  return collaborators
}

async function syncCollaboratorsIntoState(project: ProjectDocument) {
  const collaborators = await buildCollaborators(project)
  const normalizedState = normalizeProjectState(
    {
      ...project.state,
      collaborators,
    },
    project._id
  )

  const changed =
    JSON.stringify(project.state.collaborators ?? []) !== JSON.stringify(collaborators) ||
    JSON.stringify(project.state) !== JSON.stringify(normalizedState)

  if (changed) {
    const projects = await getProjectsCollection()
    const updatedAt = nowIso()
    await projects.updateOne(
      { _id: project._id },
      {
        $set: {
          state: {
            ...normalizedState,
            updatedAt,
          },
          updatedAt,
        },
      }
    )

    return {
      ...project,
      updatedAt,
      state: {
        ...normalizedState,
        updatedAt,
      },
    }
  }

  return {
    ...project,
    state: normalizedState,
  }
}

export async function createProjectForUser(user: AuthUser, name?: string) {
  const projects = await getProjectsCollection()
  const id = createProjectId()
  const createdAt = nowIso()
  const state = createDefaultProjectState(id)
  const title = name?.trim() || "Untitled Project"
  state.brief.title = title
  state.updatedAt = createdAt

  const project: ProjectDocument = {
    _id: id,
    ownerUserId: user.id,
    collaboratorUserIds: [],
    pendingInvites: [],
    state,
    createdAt,
    updatedAt: createdAt,
  }

  await projects.insertOne(project)
  const synced = await syncCollaboratorsIntoState(project)

  return {
    id,
    state: synced.state,
  }
}

export async function getAccessibleProject(projectId: string, userId: string) {
  const projects = await getProjectsCollection()
  const project = await projects.findOne({
    _id: projectId,
    $or: [{ ownerUserId: userId }, { collaboratorUserIds: userId }],
  })

  if (!project) return null
  return syncCollaboratorsIntoState(project)
}

export async function listProjectsForUser(user: AuthUser): Promise<ProjectSummary[]> {
  const projects = await getProjectsCollection()
  const records = await projects
    .find({
      $or: [{ ownerUserId: user.id }, { collaboratorUserIds: user.id }],
    })
    .sort({ updatedAt: -1 })
    .toArray()

  const uniqueOwnerIds = [...new Set(records.map((record) => record.ownerUserId))]
  const ownersById = await getUsersByIds(uniqueOwnerIds)
  const summaries: ProjectSummary[] = []

  for (const record of records) {
    const synced = await syncCollaboratorsIntoState(record)
    const owner = ownersById.get(record.ownerUserId)
    summaries.push({
      id: record._id,
      title: getProjectTitle(synced.state),
      updatedAt: synced.updatedAt,
      currentStage: synced.state.currentStage,
      isOwner: record.ownerUserId === user.id,
      ownerName: owner?.name ?? "Unknown owner",
      ownerEmail: owner?.email ?? "",
      collaborators: synced.state.collaborators,
    })
  }

  return summaries
}

export async function inviteCollaborator(projectId: string, owner: AuthUser, emailInput: string) {
  const projects = await getProjectsCollection()
  const users = await getUsersCollection()
  const email = normalizeEmail(emailInput)
  const project = await projects.findOne({ _id: projectId, ownerUserId: owner.id })
  if (!project) {
    throw new Error("Project not found or you are not allowed to manage it.")
  }

  if (email === owner.email) {
    throw new Error("The project owner is already part of the project.")
  }

  const invitedUser = await users.findOne({ email })
  let collaboratorUserIds = [...project.collaboratorUserIds]
  let pendingInvites = [...project.pendingInvites]

  if (invitedUser) {
    if (collaboratorUserIds.includes(invitedUser._id)) {
      throw new Error("This collaborator is already part of the project.")
    }

    collaboratorUserIds = [...collaboratorUserIds, invitedUser._id]
    pendingInvites = pendingInvites.filter((invite) => invite.email !== email)
  } else if (!pendingInvites.some((invite) => invite.email === email)) {
    pendingInvites.push({
      email,
      invitedAt: nowIso(),
      invitedByUserId: owner.id,
    })
  } else {
    throw new Error("An invitation for this email is already pending.")
  }

  const updatedAt = nowIso()
  await projects.updateOne(
    { _id: projectId },
    {
      $set: {
        collaboratorUserIds,
        pendingInvites,
        updatedAt,
      },
    }
  )

  const nextProject = await projects.findOne({ _id: projectId })
  if (!nextProject) {
    throw new Error("Failed to refresh the project after inviting a collaborator.")
  }

  return syncCollaboratorsIntoState(nextProject)
}

export async function removeCollaborator(projectId: string, owner: AuthUser, collaboratorId: string) {
  const projects = await getProjectsCollection()
  const project = await projects.findOne({ _id: projectId, ownerUserId: owner.id })
  if (!project) {
    throw new Error("Project not found or you are not allowed to manage it.")
  }

  const collaboratorUserIds = project.collaboratorUserIds.filter((userId) => userId !== collaboratorId)
  const pendingInvites = project.pendingInvites.filter((invite) => `invite:${invite.email}` !== collaboratorId && invite.email !== collaboratorId)

  if (
    collaboratorUserIds.length === project.collaboratorUserIds.length &&
    pendingInvites.length === project.pendingInvites.length
  ) {
    throw new Error("Collaborator not found.")
  }

  const updatedAt = nowIso()
  await projects.updateOne(
    { _id: projectId },
    {
      $set: {
        collaboratorUserIds,
        pendingInvites,
        updatedAt,
      },
    }
  )

  const nextProject = await projects.findOne({ _id: projectId })
  if (!nextProject) {
    throw new Error("Failed to refresh the project after removing a collaborator.")
  }

  return syncCollaboratorsIntoState(nextProject)
}

export async function deleteProject(projectId: string, owner: AuthUser) {
  const projects = await getProjectsCollection()
  const result = await projects.deleteOne({ _id: projectId, ownerUserId: owner.id })
  if (result.deletedCount === 0) {
    throw new Error("Project not found or you are not allowed to delete it.")
  }
}

export async function getProjectSummary(projectId: string, user: AuthUser) {
  const project = await getAccessibleProject(projectId, user.id)
  if (!project) return null

  const ownerUsers = await getUsersByIds([project.ownerUserId])
  const owner = ownerUsers.get(project.ownerUserId)

  return {
    id: project._id,
    title: getProjectTitle(project.state),
    updatedAt: project.updatedAt,
    currentStage: project.state.currentStage,
    isOwner: project.ownerUserId === user.id,
    ownerName: owner?.name ?? "Unknown owner",
    ownerEmail: owner?.email ?? "",
    collaborators: project.state.collaborators,
  }
}
