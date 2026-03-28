import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { createDefaultProjectState, normalizeProjectState } from "@/lib/backend/defaults"
import type { ProjectState } from "@/lib/backend/types"

const dataDirectory = path.join(process.cwd(), ".data")
const projectsDirectory = path.join(dataDirectory, "projects")

const stateQueues = new Map<string, Promise<unknown>>()

async function ensureDataDirectory() {
  await mkdir(projectsDirectory, { recursive: true })
}

function getProjectStatePath(projectId: string) {
  return path.join(projectsDirectory, `${projectId}.json`)
}

async function writeProjectStateFile(projectId: string, projectState: ProjectState) {
  await ensureDataDirectory()
  const projectStatePath = getProjectStatePath(projectId)
  const tempPath = `${projectStatePath}.${randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(projectState, null, 2), "utf8")
  await rename(tempPath, projectStatePath)
  return projectState
}

async function initializeProjectStateFile(projectId: string) {
  const initialState = createDefaultProjectState(projectId)
  return writeProjectStateFile(projectId, initialState)
}

async function loadProjectStateFromDisk(projectId: string) {
  await ensureDataDirectory()
  const projectStatePath = getProjectStatePath(projectId)

  let raw: string

  try {
    raw = await readFile(projectStatePath, "utf8")
  } catch {
    return initializeProjectStateFile(projectId)
  }

  if (!raw.trim()) {
    const backupPath = `${projectStatePath}.${randomUUID()}.empty`
    await rename(projectStatePath, backupPath)
    return initializeProjectStateFile(projectId)
  }

  try {
    const parsed = JSON.parse(raw) as ProjectState
    const normalized = normalizeProjectState(parsed, projectId)

    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      await writeProjectStateFile(projectId, normalized)
    }

    return normalized
  } catch {
    const backupPath = `${projectStatePath}.${randomUUID()}.corrupt`
    await rename(projectStatePath, backupPath)
    return initializeProjectStateFile(projectId)
  }
}

function queueStateOperation<T>(projectId: string, operation: () => Promise<T>) {
  const currentQueue = stateQueues.get(projectId) ?? Promise.resolve()
  const next = currentQueue.then(operation, operation)
  stateQueues.set(projectId, next.then(
    () => undefined,
    () => undefined
  ))

  return next
}

export async function readProjectState(projectId: string) {
  return queueStateOperation(projectId, () => loadProjectStateFromDisk(projectId))
}

export async function writeProjectState(projectId: string, projectState: ProjectState) {
  return queueStateOperation(projectId, async () => {
    const normalized = normalizeProjectState(projectState, projectId)
    return writeProjectStateFile(projectId, normalized)
  })
}

export async function updateProjectState(projectId: string, updater: (state: ProjectState) => ProjectState | Promise<ProjectState>) {
  return queueStateOperation(projectId, async () => {
    const current = await loadProjectStateFromDisk(projectId)
    const next = await updater(current)
    const normalized = normalizeProjectState(next, projectId)
    return writeProjectStateFile(projectId, normalized)
  })
}
