"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SDLCShell } from "@/components/sdlc-shell"
import { withProjectQuery } from "@/lib/backend/project-url"
import type { ProjectState } from "@/lib/backend/types"

export function MaintenanceWorkspace({ initialProject, projectId }: { initialProject: ProjectState; projectId: string }) {
  const [project, setProject] = useState(initialProject)
  const [running, setRunning] = useState(false)

  async function runMaintenanceReview() {
    setRunning(true)
    try {
      const response = await fetch(withProjectQuery("/api/project", projectId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "generate-maintenance-review" }),
      })
      setProject((await response.json()) as ProjectState)
    } finally {
      setRunning(false)
    }
  }

  return (
    <SDLCShell
      active="maintenance"
      projectId={projectId}
      title="Maintenance"
      subtitle="Rulează security agent pe aplicația integrată și inspectează problemele semnalate înainte de evoluții ulterioare."
    >
      <div className="space-y-6">
        <Card className="rounded-[16px] border-border/40 bg-card/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Maintenance Security Agent</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Post-Integration Security Check</h2>
            </div>
            <Button onClick={() => void runMaintenanceReview()} disabled={running}>
              {running ? "Scanning..." : "Run Security Scan"}
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          {project.securityReport.issues.length > 0 ? (
            project.securityReport.issues.map((issue) => (
              <Card key={issue.id} className="rounded-[16px] border-border/40 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary">{issue.id}</div>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{issue.title}</h3>
                  </div>
                  <Badge variant="outline">{issue.severity}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{issue.detail}</p>
                <div className="mt-3 rounded-2xl border border-border/30 bg-background/50 px-4 py-3 text-sm text-foreground/90">
                  {issue.remediation}
                </div>
              </Card>
            ))
          ) : (
            <Card className="rounded-[16px] border-dashed border-border/40 bg-card/60 p-6 text-sm text-muted-foreground">
              No maintenance findings yet.
            </Card>
          )}
        </div>
      </div>
    </SDLCShell>
  )
}
