import { useEffect, useSyncExternalStore } from "react"

import {
  buildStoredIdeStateFromProject,
  fetchProjectSnapshot,
  syncLegacySnapshots,
} from "@/lib/backend/project-client"
import {
  buildVirtualFilesFromState,
  type StoredIdeState,
  type VirtualFile,
  type VirtualFileBuildResult,
} from "@/lib/code-viewer/virtual-files"

export const CODE_WORKSPACE_BROADCAST_CHANNEL = "itfest-code-workspace"
const CODE_WORKSPACE_INTERNAL_EVENT = "itfest-code-workspace-updated"

export type StoredWorkspace = {
  files: VirtualFile[]
  storyCount: number
  variantCount: number
  selectedVariantCount: number
  updatedAt: string
  ideState: StoredIdeState | null
}

const EMPTY_WORKSPACE_RESULT = buildVirtualFilesFromState(null)
const EMPTY_WORKSPACE: StoredWorkspace = {
  files: EMPTY_WORKSPACE_RESULT.files,
  storyCount: EMPTY_WORKSPACE_RESULT.storyCount,
  variantCount: EMPTY_WORKSPACE_RESULT.variantCount,
  selectedVariantCount: EMPTY_WORKSPACE_RESULT.selectedVariantCount,
  updatedAt: "",
  ideState: null,
}

const workspaceCache = new Map<string, StoredWorkspace>()
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()

function emitWorkspaceChange() {
  if (typeof window === "undefined") return

  window.dispatchEvent(new Event(CODE_WORKSPACE_INTERNAL_EVENT))

  try {
    const channel = new BroadcastChannel(CODE_WORKSPACE_BROADCAST_CHANNEL)
    channel.postMessage({ type: "workspace-updated" })
    channel.close()
  } catch {
    // BroadcastChannel is best-effort only.
  }
}

function isValidVirtualFile(value: unknown): value is VirtualFile {
  if (!value || typeof value !== "object") return false
  const file = value as Partial<VirtualFile>
  return (
    typeof file.path === "string" &&
    typeof file.content === "string" &&
    typeof file.kind === "string" &&
    typeof file.origin === "string"
  )
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!value || typeof value !== "object") return false
  const workspace = value as Partial<StoredWorkspace>
  return (
    Array.isArray(workspace.files) &&
    workspace.files.every(isValidVirtualFile) &&
    typeof workspace.storyCount === "number" &&
    typeof workspace.variantCount === "number" &&
    typeof workspace.selectedVariantCount === "number" &&
    typeof workspace.updatedAt === "string"
  )
}

function toStoredWorkspace(result: VirtualFileBuildResult, ideState: StoredIdeState | null): StoredWorkspace {
  return {
    files: result.files,
    storyCount: result.storyCount,
    variantCount: result.variantCount,
    selectedVariantCount: result.selectedVariantCount,
    updatedAt: new Date().toISOString(),
    ideState,
  }
}

export function buildWorkspaceFromIdeState(state: StoredIdeState | null | undefined) {
  return toStoredWorkspace(buildVirtualFilesFromState(state), state ?? null)
}

async function persistWorkspace(projectId: string, workspace: StoredWorkspace) {
  const project = await fetchProjectSnapshot(projectId)
  if (!project) return

  const legacyState = {
    ...(project.legacyState ?? {}),
    ...buildStoredIdeStateFromProject(project),
    codeWorkspace: workspace,
  }

  await syncLegacySnapshots({
    projectId,
    legacyState,
    legacyPoker: project.legacyPoker ?? {},
  })
}

function scheduleWorkspaceSync(projectId: string, workspace: StoredWorkspace) {
  const pending = syncTimers.get(projectId)
  if (pending) clearTimeout(pending)

  const timer = setTimeout(() => {
    syncTimers.delete(projectId)
    void persistWorkspace(projectId, workspace)
  }, 300)

  syncTimers.set(projectId, timer)
}

export async function loadProjectIdeState(projectId: string) {
  const project = await fetchProjectSnapshot(projectId)
  return buildStoredIdeStateFromProject(project)
}

export async function hydrateEditableWorkspace(projectId: string) {
  if (!projectId) return EMPTY_WORKSPACE

  const project = await fetchProjectSnapshot(projectId)
  if (!project) {
    workspaceCache.set(projectId, EMPTY_WORKSPACE)
    emitWorkspaceChange()
    return EMPTY_WORKSPACE
  }

  const ideState = buildStoredIdeStateFromProject(project)
  const codeWorkspace = (project.legacyState as Record<string, unknown> | undefined)?.codeWorkspace
  const nextWorkspace =
    isStoredWorkspace(codeWorkspace)
      ? {
          ...codeWorkspace,
          ideState,
        }
      : buildWorkspaceFromIdeState(ideState)

  workspaceCache.set(projectId, nextWorkspace)
  emitWorkspaceChange()
  return nextWorkspace
}

export function getEditableWorkspaceSnapshot(projectId: string) {
  return workspaceCache.get(projectId) ?? EMPTY_WORKSPACE
}

export function saveEditableWorkspace(projectId: string, workspace: StoredWorkspace) {
  const next = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  }

  workspaceCache.set(projectId, next)
  emitWorkspaceChange()
  scheduleWorkspaceSync(projectId, next)
}

export async function clearEditableWorkspace(projectId: string) {
  const ideState = await loadProjectIdeState(projectId)
  const next = buildWorkspaceFromIdeState(ideState)
  workspaceCache.set(projectId, next)
  emitWorkspaceChange()
  scheduleWorkspaceSync(projectId, next)
}

export async function reloadEditableWorkspaceFromProject(projectId: string) {
  const ideState = await loadProjectIdeState(projectId)
  const next = buildWorkspaceFromIdeState(ideState)
  workspaceCache.set(projectId, next)
  emitWorkspaceChange()
  scheduleWorkspaceSync(projectId, next)
  return next
}

function subscribeWorkspace(projectId: string, listener: () => void) {
  if (typeof window === "undefined") return () => {}

  const handleInternal = () => listener()
  window.addEventListener(CODE_WORKSPACE_INTERNAL_EVENT, handleInternal)

  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CODE_WORKSPACE_BROADCAST_CHANNEL)
    channel.onmessage = () => listener()
  } catch {
    channel = null
  }

  return () => {
    window.removeEventListener(CODE_WORKSPACE_INTERNAL_EVENT, handleInternal)
    if (channel) channel.close()
  }
}

export function useEditableWorkspace(projectId: string) {
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = subscribeWorkspace(projectId, () => undefined)

    if (!workspaceCache.has(projectId)) {
      void hydrateEditableWorkspace(projectId)
    }

    return unsubscribe
  }, [projectId])

  return useSyncExternalStore(
    (listener) => subscribeWorkspace(projectId, listener),
    () => getEditableWorkspaceSnapshot(projectId),
    () => EMPTY_WORKSPACE
  )
}
