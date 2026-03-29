import { normalizeProjectState } from "@/lib/backend/defaults"
import type { ProjectState } from "@/lib/backend/types"
import { getProjectsCollection } from "@/lib/server/mongodb"

const stateQueues = new Map<string, Promise<unknown>>()

async function loadProjectStateFromDatabase(projectId: string) {
  const projects = await getProjectsCollection()
  const project = await projects.findOne({ _id: projectId })
  if (!project) {
    throw new Error(`Project ${projectId} was not found.`)
  }

  const normalized = normalizeProjectState(project.state, projectId)
  if (JSON.stringify(project.state) !== JSON.stringify(normalized)) {
    const updatedAt = new Date().toISOString()
    await projects.updateOne(
      { _id: projectId },
      {
        $set: {
          state: {
            ...normalized,
            updatedAt,
          },
          updatedAt,
        },
      }
    )

    return {
      ...normalized,
      updatedAt,
    }
  }

  return normalized
}

function queueStateOperation<T>(projectId: string, operation: () => Promise<T>) {
  const currentQueue = stateQueues.get(projectId) ?? Promise.resolve()
  const next = currentQueue.then(operation, operation)
  stateQueues.set(
    projectId,
    next.then(
      () => undefined,
      () => undefined
    )
  )

  return next
}

export async function readProjectState(projectId: string) {
  return queueStateOperation(projectId, () => loadProjectStateFromDatabase(projectId))
}

export async function writeProjectState(projectId: string, projectState: ProjectState) {
  return queueStateOperation(projectId, async () => {
    const projects = await getProjectsCollection()
    const normalized = normalizeProjectState(projectState, projectId)
    const updatedAt = new Date().toISOString()

    await projects.updateOne(
      { _id: projectId },
      {
        $set: {
          state: {
            ...normalized,
            updatedAt,
          },
          updatedAt,
        },
      }
    )

    return {
      ...normalized,
      updatedAt,
    }
  })
}

export async function updateProjectState(
  projectId: string,
  updater: (state: ProjectState) => ProjectState | Promise<ProjectState>
) {
  return queueStateOperation(projectId, async () => {
    const current = await loadProjectStateFromDatabase(projectId)
    const next = await updater(current)
    const normalized = normalizeProjectState(next, projectId)
    const updatedAt = new Date().toISOString()
    const projects = await getProjectsCollection()

    await projects.updateOne(
      { _id: projectId },
      {
        $set: {
          state: {
            ...normalized,
            updatedAt,
          },
          updatedAt,
        },
      }
    )

    return {
      ...normalized,
      updatedAt,
    }
  })
}
