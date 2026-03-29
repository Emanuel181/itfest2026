import {
  buildVirtualFilesFromState,
  type StoredIdeState,
  type VirtualFile,
  type VirtualFileBuildResult,
} from "@/lib/code-viewer/virtual-files"
import { useSyncExternalStore } from "react"

export const CODE_WORKSPACE_STORAGE_KEY = "itfest_code_workspace_v1"
export const CODE_WORKSPACE_BROADCAST_CHANNEL = "itfest-code-workspace"
const CODE_WORKSPACE_INTERNAL_EVENT = "itfest-code-workspace-updated"

export type StoredWorkspace = {
  files: VirtualFile[]
  storyCount: number
  variantCount: number
  selectedVariantCount: number
  updatedAt: string
}

const EMPTY_WORKSPACE_RESULT = buildVirtualFilesFromState(null)
const EMPTY_WORKSPACE: StoredWorkspace = {
  files: EMPTY_WORKSPACE_RESULT.files,
  storyCount: EMPTY_WORKSPACE_RESULT.storyCount,
  variantCount: EMPTY_WORKSPACE_RESULT.variantCount,
  selectedVariantCount: EMPTY_WORKSPACE_RESULT.selectedVariantCount,
  updatedAt: "",
}

let cachedSnapshotKey = "__empty__"
let cachedSnapshot: StoredWorkspace = EMPTY_WORKSPACE

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

function toStoredWorkspace(result: VirtualFileBuildResult): StoredWorkspace {
  return {
    files: result.files,
    storyCount: result.storyCount,
    variantCount: result.variantCount,
    selectedVariantCount: result.selectedVariantCount,
    updatedAt: new Date().toISOString(),
  }
}

export function buildWorkspaceFromIdeState(state: StoredIdeState | null | undefined) {
  return toStoredWorkspace(buildVirtualFilesFromState(state))
}

export function loadEditableWorkspace() {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem(CODE_WORKSPACE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>
    const files = Array.isArray(parsed.files) ? parsed.files.filter(isValidVirtualFile) : []
    if (files.length === 0) return null

    return {
      files,
      storyCount: typeof parsed.storyCount === "number" ? parsed.storyCount : 0,
      variantCount: typeof parsed.variantCount === "number" ? parsed.variantCount : 0,
      selectedVariantCount: typeof parsed.selectedVariantCount === "number" ? parsed.selectedVariantCount : 0,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    } satisfies StoredWorkspace
  } catch {
    return null
  }
}

export function loadIdeStateFromStorage() {
  if (typeof window === "undefined") return null

  try {
    const raw = localStorage.getItem("itfest_state")
    return raw ? (JSON.parse(raw) as StoredIdeState) : null
  } catch {
    return null
  }
}

export function loadOrBuildEditableWorkspace() {
  const existing = loadEditableWorkspace()
  if (existing) return existing

  return buildWorkspaceFromIdeState(loadIdeStateFromStorage())
}

export function saveEditableWorkspace(workspace: StoredWorkspace) {
  if (typeof window === "undefined") return

  const next = {
    ...workspace,
    updatedAt: new Date().toISOString(),
  }

  localStorage.setItem(CODE_WORKSPACE_STORAGE_KEY, JSON.stringify(next))
  cachedSnapshotKey = `workspace:${JSON.stringify(next)}`
  cachedSnapshot = next
  window.dispatchEvent(new Event(CODE_WORKSPACE_INTERNAL_EVENT))
}

export function clearEditableWorkspace() {
  if (typeof window === "undefined") return
  localStorage.removeItem(CODE_WORKSPACE_STORAGE_KEY)
  const next = buildWorkspaceFromIdeState(loadIdeStateFromStorage())
  cachedSnapshotKey = `ide:${JSON.stringify(loadIdeStateFromStorage())}`
  cachedSnapshot = next
  window.dispatchEvent(new Event(CODE_WORKSPACE_INTERNAL_EVENT))
}

function subscribeWorkspace(listener: () => void) {
  if (typeof window === "undefined") return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === CODE_WORKSPACE_STORAGE_KEY) listener()
  }

  window.addEventListener("storage", handleStorage)
  window.addEventListener(CODE_WORKSPACE_INTERNAL_EVENT, listener)

  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(CODE_WORKSPACE_INTERNAL_EVENT, listener)
  }
}

function getServerWorkspaceSnapshot() {
  return EMPTY_WORKSPACE
}

function getClientWorkspaceSnapshot() {
  if (typeof window === "undefined") return EMPTY_WORKSPACE

  const rawWorkspace = localStorage.getItem(CODE_WORKSPACE_STORAGE_KEY)
  if (rawWorkspace) {
    const nextKey = `workspace:${rawWorkspace}`
    if (cachedSnapshotKey === nextKey) return cachedSnapshot

    const parsed = loadEditableWorkspace()
    cachedSnapshotKey = nextKey
    cachedSnapshot = parsed ?? EMPTY_WORKSPACE
    return cachedSnapshot
  }

  const rawIdeState = localStorage.getItem("itfest_state")
  const nextKey = `ide:${rawIdeState ?? ""}`
  if (cachedSnapshotKey === nextKey) return cachedSnapshot

  cachedSnapshotKey = nextKey
  cachedSnapshot = buildWorkspaceFromIdeState(loadIdeStateFromStorage())
  return cachedSnapshot
}

export function useEditableWorkspace() {
  return useSyncExternalStore(subscribeWorkspace, getClientWorkspaceSnapshot, getServerWorkspaceSnapshot)
}
