"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getProjectIdFromCurrentUrl, withOptionalProjectQuery } from "@/lib/backend/project-client"
import {
  buildWorkspaceFromIdeState,
  useEditableWorkspace,
  loadIdeStateFromStorage,
  saveEditableWorkspace,
  type StoredWorkspace,
} from "@/lib/code-viewer/workspace-store"
import { type VirtualFile } from "@/lib/code-viewer/virtual-files"
import { cn } from "@/lib/utils"

type TreeNode = {
  name: string
  path: string
  kind: "folder" | "file"
  children: TreeNode[]
  file?: VirtualFile
}

function insertNode(root: TreeNode, file: VirtualFile) {
  const segments = file.path.split("/").filter(Boolean)
  let current = root

  for (const [index, segment] of segments.entries()) {
    const path = current.path ? `${current.path}/${segment}` : segment
    const isFile = index === segments.length - 1
    let child = current.children.find((node) => node.path === path)

    if (!child) {
      child = {
        name: segment,
        path,
        kind: isFile ? "file" : "folder",
        children: [],
      }
      current.children.push(child)
    }

    if (isFile) child.file = file
    current = child
  }
}

function sortTree(nodes: TreeNode[]) {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1
    return left.name.localeCompare(right.name)
  })

  for (const node of nodes) {
    if (node.children.length > 0) sortTree(node.children)
  }
}

function buildTree(files: VirtualFile[]) {
  const root: TreeNode = { name: "", path: "", kind: "folder", children: [] }

  for (const file of files) {
    insertNode(root, file)
  }

  sortTree(root.children)
  return root.children
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return nodes

  return nodes
    .map((node) => {
      if (node.kind === "file") {
        return node.path.toLowerCase().includes(normalized) ? node : null
      }

      const children = filterTree(node.children, normalized)
      if (children.length > 0 || node.path.toLowerCase().includes(normalized)) {
        return { ...node, children }
      }

      return null
    })
    .filter((node): node is TreeNode => node !== null)
}

function fileIcon(path: string) {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "javascript"
  if (path.endsWith(".ts") || path.endsWith(".js")) return "code"
  if (path.endsWith(".css") || path.endsWith(".scss")) return "palette"
  if (path.endsWith(".json")) return "data_object"
  if (path.endsWith(".md")) return "description"
  return "draft"
}

function fileAccent(kind: VirtualFile["kind"]) {
  if (kind === "code") return "text-[#4fc1ff]"
  if (kind === "json") return "text-[#ffd166]"
  if (kind === "markdown") return "text-[#6ffbbe]"
  return "text-[#c8c6c5]"
}

function originLabel(origin: VirtualFile["origin"]) {
  switch (origin) {
    case "documentation":
      return "Docs"
    case "requirements":
      return "Analysis"
    case "story":
      return "Story"
    case "variant":
      return "Variant"
    case "merge":
      return "Merged"
    case "report":
      return "Report"
    default:
      return "System"
  }
}

function languageLabel(path: string) {
  if (path.endsWith(".tsx")) return "TypeScript React"
  if (path.endsWith(".ts")) return "TypeScript"
  if (path.endsWith(".css")) return "CSS"
  if (path.endsWith(".scss")) return "SCSS"
  if (path.endsWith(".json")) return "JSON"
  if (path.endsWith(".md")) return "Markdown"
  return "Plain Text"
}

function treeIsOpen(path: string, collapsedFolders: Set<string>, query: string) {
  if (query.trim()) return true
  return !collapsedFolders.has(path)
}

function firstInterestingFile(files: VirtualFile[]) {
  return (
    files.find((file) => file.path === "src/app/page.tsx")?.path ??
    files.find((file) => file.kind === "code")?.path ??
    files[0]?.path ??
    ""
  )
}

function cloneWorkspaceFiles(files: VirtualFile[]) {
  return files.map((file) => ({ ...file }))
}

export default function CodePage() {
  const projectId = useMemo(() => getProjectIdFromCurrentUrl(), [])
  const workspace = useEditableWorkspace()
  const [selectedPath, setSelectedPath] = useState("")
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    return []
  })
  const [filter, setFilter] = useState("")
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [isApplyingAiEdit, setIsApplyingAiEdit] = useState(false)
  const [aiInstruction, setAiInstruction] = useState("")
  const [aiStatus, setAiStatus] = useState("")
  const [manualStatus, setManualStatus] = useState("Autosaved locally")

  const lineNumberRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const files = workspace.files
  const tree = useMemo(() => buildTree(files), [files])
  const filteredTree = useMemo(() => filterTree(tree, filter), [tree, filter])
  const effectiveSelectedPath =
    selectedPath && files.some((file) => file.path === selectedPath) ? selectedPath : firstInterestingFile(files)
  const selectedFile = useMemo(() => files.find((file) => file.path === effectiveSelectedPath) ?? files[0] ?? null, [effectiveSelectedPath, files])
  const selectedLines = useMemo(() => (selectedFile ? selectedFile.content.split("\n") : []), [selectedFile])

  function publishWorkspace(nextWorkspace: StoredWorkspace, statusMessage: string) {
    saveEditableWorkspace(nextWorkspace)
    setManualStatus(statusMessage)
  }

  function reloadFromAiArtifacts() {
    const nextWorkspace = buildWorkspaceFromIdeState(loadIdeStateFromStorage())
    const nextSelectedPath = firstInterestingFile(nextWorkspace.files)
    setSelectedPath(nextSelectedPath)
    setOpenTabs((current) => {
      const kept = current.filter((path) => nextWorkspace.files.some((file) => file.path === path))
      return kept.includes(nextSelectedPath) ? kept : nextSelectedPath ? [...kept, nextSelectedPath] : kept
    })
    publishWorkspace(nextWorkspace, "Reloaded from AI pipeline")
    setAiStatus("")
  }

  function selectFile(path: string) {
    setSelectedPath(path)
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
  }

  function toggleFolder(path: string) {
    setCollapsedFolders((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function closeTab(path: string) {
    setOpenTabs((current) => {
      const next = current.filter((tab) => tab !== path)
      if (effectiveSelectedPath === path) {
        setSelectedPath(next[next.length - 1] ?? firstInterestingFile(files))
      }
      return next
    })
  }

  function updateSelectedFileContent(nextContent: string) {
    if (!selectedFile) return

    const nextWorkspace: StoredWorkspace = {
      ...workspace,
      files: cloneWorkspaceFiles(
        files.map((file) => (file.path === selectedFile.path ? { ...file, content: nextContent } : file))
      ),
      updatedAt: new Date().toISOString(),
    }

    setSelectedPath(selectedFile.path)
    publishWorkspace(nextWorkspace, "Saved locally")
  }

  async function applyAiEdit() {
    if (!selectedFile || !aiInstruction.trim()) return

    setIsApplyingAiEdit(true)
    setAiStatus("")

    try {
      const response = await fetch("/api/code-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedFile.path,
          content: selectedFile.content,
          instruction: aiInstruction.trim(),
          workspaceFiles: files,
          projectContext: loadIdeStateFromStorage(),
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? `Request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as { content?: string }
      if (typeof payload.content !== "string") {
        throw new Error("AI did not return updated file contents.")
      }

      updateSelectedFileContent(payload.content)
      setAiInstruction("")
      setAiStatus("AI changes applied")
    } catch (error) {
      setAiStatus(String(error))
    } finally {
      setIsApplyingAiEdit(false)
    }
  }

  function syncLineNumbers() {
    if (!editorRef.current || !lineNumberRef.current) return
    lineNumberRef.current.scrollTop = editorRef.current.scrollTop
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="hidden w-[264px] shrink-0 border-r border-border/20 bg-sidebar lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-border/20 px-5 py-3">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
            <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 14 }}>code</span>
          </div>
          <span className="font-brand text-sm font-bold tracking-tight text-foreground">AgenticSDLC</span>
        </div>
        <SDLCSidebar />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#1e1e1e] text-[#d4d4d4]">
        <header className="flex items-center justify-between border-b border-[#2d2d30] bg-[#181818] px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-white">View Code</h1>
            <span className="rounded-md bg-[#007acc]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4fc1ff]">
              Workspace Explorer
            </span>
            <span className="font-mono text-[10px] text-[#8b949e]">
              {workspace.storyCount} stories · {workspace.variantCount} variants · {workspace.selectedVariantCount} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={withOptionalProjectQuery("/code/preview", projectId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-[#d97706]/30 bg-[#d97706]/10 px-3 py-1.5 text-xs font-semibold text-[#f0b35d] transition-colors hover:bg-[#d97706]/15"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_circle</span>
              Open Preview
            </Link>
            <Link
              href={withOptionalProjectQuery("/implementation", projectId)}
              className="flex items-center gap-1 rounded-lg border border-[#333] px-3 py-1.5 text-xs text-[#9da3ae] transition-colors hover:text-white"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Implementation
            </Link>
            <button
              onClick={reloadFromAiArtifacts}
              className="flex items-center gap-1.5 rounded-lg border border-[#007acc]/30 bg-[#007acc]/10 px-3 py-1.5 text-xs font-semibold text-[#4fc1ff] transition-colors hover:bg-[#007acc]/15"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              Reload AI Output
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-12 shrink-0 flex-col items-center gap-3 border-r border-[#2d2d30] bg-[#181818] py-3">
            <div className="grid size-9 place-items-center rounded-lg bg-[#007acc]/15 text-[#4fc1ff]">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>files</span>
            </div>
            <div className="grid size-9 place-items-center rounded-lg text-[#71777f]">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
            </div>
            <div className="grid size-9 place-items-center rounded-lg text-[#71777f]">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>smart_toy</span>
            </div>
          </div>

          <div className="flex w-[320px] shrink-0 flex-col border-r border-[#2d2d30] bg-[#252526]">
            <div className="border-b border-[#2d2d30] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b949e]">Explorer</div>
              <div className="mt-3 rounded-md border border-[#3c3c3c] bg-[#1f1f1f] px-3 py-2">
                <div className="flex items-center gap-2 text-[#8b949e]">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>search</span>
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder="Filter files"
                    className="w-full bg-transparent text-xs text-[#d4d4d4] outline-none placeholder:text-[#6b7280]"
                  />
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-2 py-3">
                {filteredTree.length === 0 ? (
                  <div className="px-3 py-6 text-xs text-[#8b949e]">No files match the current filter.</div>
                ) : (
                  filteredTree.map((node) => (
                    <TreeBranch
                      key={node.path}
                      node={node}
                      depth={0}
                      collapsedFolders={collapsedFolders}
                      filter={filter}
                      onToggleFolder={toggleFolder}
                      onSelectFile={selectFile}
                      selectedPath={selectedFile?.path ?? ""}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
            <div className="flex min-h-[40px] items-stretch overflow-x-auto border-b border-[#2d2d30] bg-[#252526]">
              {openTabs.map((path) => {
                const file = files.find((item) => item.path === path)
                if (!file) return null

                const active = selectedFile?.path === path
                return (
                  <button
                    key={path}
                    onClick={() => selectFile(path)}
                    className={cn(
                      "group flex items-center gap-2 border-r border-[#2d2d30] px-4 text-xs",
                      active ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#9da3ae] hover:text-white"
                    )}
                  >
                    <span className={cn("material-symbols-outlined", fileAccent(file.kind))} style={{ fontSize: 14 }}>
                      {fileIcon(path)}
                    </span>
                    <span className="whitespace-nowrap">{path.split("/").pop()}</span>
                    <span
                      onClick={(event) => {
                        event.stopPropagation()
                        closeTab(path)
                      }}
                      className="material-symbols-outlined rounded text-[#6b7280] transition-colors hover:text-white"
                      style={{ fontSize: 14 }}
                    >
                      close
                    </span>
                  </button>
                )
              })}
            </div>

            {selectedFile ? (
              <>
                <div className="flex items-center justify-between border-b border-[#2d2d30] bg-[#1f1f1f] px-4 py-2">
                  <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                    {selectedFile.path.split("/").map((segment, index, segments) => (
                      <div key={`${segment}-${index}`} className="flex items-center gap-2">
                        <span>{segment}</span>
                        {index < segments.length - 1 ? (
                          <span className="material-symbols-outlined text-[#5a5f66]" style={{ fontSize: 12 }}>chevron_right</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#007acc]/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4fc1ff]">
                      {originLabel(selectedFile.origin)}
                    </span>
                    <span className="text-[10px] text-[#8b949e]">{languageLabel(selectedFile.path)}</span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="border-b border-[#2d2d30] bg-[#202020] px-4 py-2 text-[11px] text-[#8b949e]">
                      Manual edits are autosaved locally and pushed live to the preview tab.
                    </div>

                    <div className="flex min-h-0 flex-1">
                      <div
                        ref={lineNumberRef}
                        className="hidden w-[72px] shrink-0 overflow-hidden border-r border-[#2d2d30] bg-[#1a1a1a] font-mono text-[12px] leading-6 text-[#6b7280] md:block"
                      >
                        <div className="px-4 py-3 text-right">
                          {selectedLines.map((_, index) => (
                            <div key={`${selectedFile.path}-line-${index}`}>{index + 1}</div>
                          ))}
                        </div>
                      </div>

                      <textarea
                        ref={editorRef}
                        value={selectedFile.content}
                        spellCheck={false}
                        wrap="off"
                        onScroll={syncLineNumbers}
                          onChange={(event) => updateSelectedFileContent(event.target.value)}
                        className="min-h-0 flex-1 resize-none overflow-auto bg-[#1e1e1e] px-4 py-3 font-mono text-[12px] leading-6 text-[#d4d4d4] outline-none"
                      />
                    </div>
                  </div>

                  <div className="hidden w-[320px] shrink-0 border-l border-[#2d2d30] bg-[#252526] xl:flex xl:flex-col">
                    <div className="border-b border-[#2d2d30] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8b949e]">
                      AI Edit
                    </div>
                    <div className="space-y-4 px-4 py-4 text-xs">
                      <InfoRow label="Path" value={selectedFile.path} />
                      <InfoRow label="Type" value={languageLabel(selectedFile.path)} />
                      <InfoRow label="Origin" value={originLabel(selectedFile.origin)} />
                      <InfoRow label="Lines" value={String(selectedLines.length)} />
                      <InfoRow label="Characters" value={String(selectedFile.content.length)} />

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b949e]">Ask AI</div>
                        <textarea
                          value={aiInstruction}
                          onChange={(event) => setAiInstruction(event.target.value)}
                          placeholder="Ex: transforma pagina intr-un dashboard cu hero, cards si un CTA clar"
                          className="mt-2 min-h-[110px] w-full resize-none rounded-lg border border-[#3c3c3c] bg-[#1f1f1f] px-3 py-2 text-xs text-[#d4d4d4] outline-none placeholder:text-[#6b7280]"
                        />
                        <button
                          onClick={applyAiEdit}
                          disabled={isApplyingAiEdit || !aiInstruction.trim()}
                          className={cn(
                            "mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                            isApplyingAiEdit || !aiInstruction.trim()
                              ? "cursor-not-allowed bg-[#2d2d30] text-[#6b7280]"
                              : "bg-[#007acc] text-white hover:bg-[#1187d8]"
                          )}
                        >
                          {isApplyingAiEdit ? (
                            <>
                              <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              Applying AI edit...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
                              Apply AI Edit
                            </>
                          )}
                        </button>
                        {aiStatus ? <p className="mt-3 text-[11px] text-[#8b949e]">{aiStatus}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-[#007acc] px-4 py-1.5 text-[11px] text-white">
                  <div className="flex items-center gap-4">
                    <span>Explorer</span>
                    <span>{languageLabel(selectedFile.path)}</span>
                    <span>{manualStatus}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{selectedLines.length} lines</span>
                    <span>{selectedFile.content.length} chars</span>
                    <span>{originLabel(selectedFile.origin)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-[#8b949e]">
                No generated files available yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function TreeBranch({
  node,
  depth,
  collapsedFolders,
  filter,
  onToggleFolder,
  onSelectFile,
  selectedPath,
}: {
  node: TreeNode
  depth: number
  collapsedFolders: Set<string>
  filter: string
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  selectedPath: string
}) {
  if (node.kind === "folder") {
    const open = treeIsOpen(node.path, collapsedFolders, filter)

    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-[#c8c6c5] hover:bg-[#2a2d2e]"
          style={{ paddingLeft: 8 + depth * 14 }}
        >
          <span className="material-symbols-outlined text-[#8b949e]" style={{ fontSize: 14 }}>
            {open ? "expand_more" : "chevron_right"}
          </span>
          <span className="material-symbols-outlined text-[#dcb67a]" style={{ fontSize: 14 }}>
            {open ? "folder_open" : "folder"}
          </span>
          <span>{node.name}</span>
        </button>

        {open
          ? node.children.map((child) => (
              <TreeBranch
                key={child.path}
                node={child}
                depth={depth + 1}
                collapsedFolders={collapsedFolders}
                filter={filter}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))
          : null}
      </div>
    )
  }

  const active = selectedPath === node.path
  const file = node.file
  if (!file) return null

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors",
        active ? "bg-[#37373d] text-white" : "text-[#c8c6c5] hover:bg-[#2a2d2e]"
      )}
      style={{ paddingLeft: 28 + depth * 14 }}
    >
      <span className={cn("material-symbols-outlined", fileAccent(file.kind))} style={{ fontSize: 14 }}>
        {fileIcon(node.path)}
      </span>
      <span className="truncate">{node.name}</span>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b949e]">{label}</div>
      <div className="mt-1 break-words text-[#d4d4d4]">{value}</div>
    </div>
  )
}
