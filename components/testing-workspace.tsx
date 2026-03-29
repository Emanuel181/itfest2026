"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { callAgentStream } from "@/lib/agents/client"
import { SDLCShell } from "@/components/sdlc-shell"
import { withProjectQuery } from "@/lib/backend/project-url"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProjectState } from "@/lib/backend/types"

export function TestingWorkspace({ initialProject, projectId }: { initialProject: ProjectState; projectId: string }) {
  const [project, setProject] = useState(initialProject)
  const [mergeLog, setMergeLog] = useState("")
  const [running, setRunning] = useState(false)
  const [previewKey, setPreviewKey] = useState(initialProject.updatedAt)
  const [selectedPath, setSelectedPath] = useState(initialProject.workspace.selectedFileId || "")
  const selectedVariants = useMemo(
    () =>
      project.userStories
        .map((story) => ({
          story,
          variant: story.variants.find((variant) => variant.id === story.selectedVariantId),
        }))
        .filter((item) => item.variant),
    [project.userStories]
  )

  useEffect(() => {
    if (!selectedPath) {
      setSelectedPath(project.workspace.selectedFileId || project.workspace.files[0]?.id || "")
    }
  }, [project.workspace.files, project.workspace.selectedFileId, selectedPath])

  const workspaceFiles = useMemo(() => {
    if (project.workspace.files.length > 0) return project.workspace.files

    return selectedVariants.flatMap(({ story, variant }) => [
      { id: `${story.id}-backend`, path: `stories/${story.id}/backend.ts`, content: variant?.backendCode || "// no backend code" },
      { id: `${story.id}-frontend`, path: `stories/${story.id}/frontend.tsx`, content: variant?.frontendCode || "// no frontend code" },
      { id: `${story.id}-security`, path: `stories/${story.id}/security.md`, content: variant?.securitySummary || "No security summary" },
    ])
  }, [project.workspace.files, selectedVariants])

  const activeFile =
    workspaceFiles.find((file) => file.id === selectedPath) ??
    workspaceFiles.find((file) => file.path === "src/app/page.tsx") ??
    workspaceFiles[0]

  async function patchProject(body: unknown) {
    const response = await fetch(withProjectQuery("/api/project", projectId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return (await response.json()) as ProjectState
  }

  async function runMergeAgent() {
    setRunning(true)
    setMergeLog("")
    try {
      const nextProject = await patchProject({ type: "run-merge" })
      setProject(nextProject)
      setPreviewKey(nextProject.updatedAt)
      const content = await callAgentStream(
        {
          role: "merge",
          storyId: "MERGE",
          storyTitle: "Testing & Integration",
          storyDescription: "Merge all selected variants into a single project",
          context: selectedVariants
            .map(({ story, variant }) => `${story.id} · ${variant?.label}\n${variant?.code ?? ""}`)
            .join("\n\n"),
        },
        (delta) => setMergeLog((current) => current + delta)
      )
      setMergeLog(content)
    } finally {
      setRunning(false)
    }
  }

  return (
    <SDLCShell
      active="testing"
      projectId={projectId}
      title="Testing & Integration"
      subtitle="Aici vezi proiectul rezultat ca preview live și ca workspace navigabil, nu doar ca text brut."
      workspaceFiles={workspaceFiles.map((file) => ({ id: file.id, path: file.path }))}
      selectedFileId={activeFile?.id}
      onSelectFile={setSelectedPath}
      previewUrl={withProjectQuery("/api/preview", projectId)}
    >
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[16px] border-border/40 bg-card/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Testing & Integration</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Live Preview + Project Browser</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Varianta aleasă pentru fiecare story este pusă în workspace, iar preview-ul rulează direct din fișierele generate.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void runMergeAgent()} disabled={running || selectedVariants.length === 0}>
                {running ? "Merging..." : "Run Merge Agent"}
              </Button>
              <Button variant="outline" onClick={() => setPreviewKey(String(Date.now()))}>
                Refresh Preview
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <Card className="rounded-[16px] border-border/40 bg-card/70 p-4">
            <Tabs defaultValue="preview" className="gap-4">
              <TabsList className="rounded-2xl bg-muted/60 p-1">
                <TabsTrigger value="preview" className="rounded-xl px-3 py-1.5 text-xs">Preview</TabsTrigger>
                <TabsTrigger value="merge-log" className="rounded-xl px-3 py-1.5 text-xs">Merge Log</TabsTrigger>
              </TabsList>

              <TabsContent value="preview">
                <div className="overflow-hidden rounded-[24px] border border-border/30 bg-background/80">
                  <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary">App Preview</div>
                      <div className="mt-1 text-sm text-muted-foreground">Rendered from `/api/preview` using the current workspace.</div>
                    </div>
                    <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] text-primary">
                      {project.workspace.files.length} files
                    </div>
                  </div>
                  <iframe
                    key={previewKey}
                    title="Generated App Preview"
                    src={withProjectQuery(`/api/preview?v=${encodeURIComponent(String(previewKey))}`, projectId)}
                    className="h-[720px] w-full border-0 bg-white"
                  />
                </div>
              </TabsContent>

              <TabsContent value="merge-log">
                <pre className="min-h-[720px] whitespace-pre-wrap rounded-[24px] border border-border/30 bg-background/60 p-4 text-xs leading-relaxed text-foreground/85">
                  {mergeLog || project.mergeReport.summary || "Merge log will appear here."}
                </pre>
              </TabsContent>
            </Tabs>
          </Card>

          <Card className="rounded-[16px] border-border/40 bg-card/70 p-4">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Project Browser</div>
            <div className="mt-4 grid gap-4">
              <div className="grid max-h-[280px] gap-2 overflow-y-auto rounded-2xl border border-border/30 bg-background/50 p-2">
                {workspaceFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedPath(file.id)}
                    className={`rounded-xl px-3 py-2 text-left text-xs transition ${
                      activeFile?.id === file.id
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <div>
                <div className="rounded-t-2xl border border-border/30 bg-muted/40 px-4 py-3 text-xs font-medium text-foreground">
                  {activeFile?.path || "No file selected"}
                </div>
                <pre className="min-h-[390px] overflow-auto rounded-b-2xl border-x border-b border-border/30 bg-[#0f172a] px-4 py-4 text-xs leading-relaxed text-slate-100">
                  {activeFile?.content || "No file content available."}
                </pre>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => {
                window.location.href = withProjectQuery("/maintenance", projectId)
              }}>
                Continue To Maintenance
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </SDLCShell>
  )
}
