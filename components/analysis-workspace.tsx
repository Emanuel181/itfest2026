"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SDLCShell } from "@/components/sdlc-shell"
import { withProjectQuery } from "@/lib/backend/project-url"
import type { ProjectState } from "@/lib/backend/types"

export function AnalysisWorkspace({ initialProject, projectId }: { initialProject: ProjectState; projectId: string }) {
  const [project, setProject] = useState(initialProject)
  const [loading, setLoading] = useState(false)

  async function generateRequirements() {
    setLoading(true)
    try {
      const response = await fetch(withProjectQuery("/api/project", projectId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "generate-requirements" }),
      })
      setProject((await response.json()) as ProjectState)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SDLCShell
      active="analysis"
      projectId={projectId}
      title="Analysis"
      subtitle="Un agent generează requirements din documentația de produs și documentația tehnică rezultate din planning."
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <DocCard title="Product Documentation" items={[project.brief.title, project.brief.objective, ...project.brief.scope].filter(Boolean)} />
          <DocCard title="Technical Documentation" items={[project.brief.architecture, project.brief.dbSchema, ...project.brief.techStack].filter(Boolean)} />
        </div>

        <Card className="rounded-[16px] border-border/40 bg-card/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Requirements Agent</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Generate Implementation Requirements</h2>
              <p className="mt-1 text-sm text-muted-foreground">Requirements are synthesized from both product and technical documentation.</p>
            </div>
            <Button onClick={() => void generateRequirements()} disabled={loading}>
              {loading ? "Generating..." : "Generate Requirements"}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {project.requirements.length > 0 ? (
            project.requirements.map((requirement) => (
              <Card key={requirement.id} className="rounded-[16px] border-border/40 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary">{requirement.id}</div>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{requirement.title}</h3>
                  </div>
                  <Badge variant="outline">{requirement.kind}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{requirement.detail}</p>
              </Card>
            ))
          ) : (
            <Card className="rounded-[16px] border-dashed border-border/40 bg-card/60 p-6 text-sm text-muted-foreground">
              Generate requirements to continue to the design phase.
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <Button disabled={project.requirements.length === 0} onClick={() => {
            if (project.requirements.length > 0) window.location.href = withProjectQuery("/design", projectId)
          }}>
            Continue To Design
          </Button>
        </div>
      </div>
    </SDLCShell>
  )
}

function DocCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{title}</div>
      <div className="mt-4 space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl border border-border/30 bg-background/50 px-3 py-2 text-sm text-foreground/90">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/30 bg-background/50 px-3 py-2 text-sm text-muted-foreground">
            Waiting for documentation.
          </div>
        )}
      </div>
    </Card>
  )
}
