"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { callAgentStream } from "@/lib/agents/client"
import { SDLCShell } from "@/components/sdlc-shell"
import { withProjectQuery } from "@/lib/backend/project-url"
import type { ProjectState } from "@/lib/backend/types"

const pokerAgents = [
  { label: "Technical Lead Agent", color: "text-primary" },
  { label: "Frontend Agent", color: "text-emerald-500" },
  { label: "Backend Agent", color: "text-sky-500" },
]

export function DesignWorkspace({ initialProject, projectId }: { initialProject: ProjectState; projectId: string }) {
  const [project, setProject] = useState(initialProject)
  const [activeStoryId, setActiveStoryId] = useState("")
  const [running, setRunning] = useState(false)

  async function patchProject(body: unknown) {
    const response = await fetch(withProjectQuery("/api/project", projectId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return (await response.json()) as ProjectState
  }

  async function generateBacklog() {
    setRunning(true)
    try {
      setProject(await patchProject({ type: "generate-backlog" }))
    } finally {
      setRunning(false)
    }
  }

  async function runPoker() {
    if (project.userStories.length === 0) return
    setRunning(true)
    try {
      const updatedStories = [...project.userStories]

      for (const story of updatedStories) {
        const history: string[] = []
        const estimates: number[] = []

        for (const agent of pokerAgents) {
          const content = await callAgentStream(
            {
              role: "poker_estimate",
              storyId: story.id,
              storyTitle: story.title,
              storyDescription: story.summary,
              context: agent.label,
            },
            () => {}
          )
          history.push(`${agent.label}\n${content}`)
          const match = content.match(/Card:\s*(\d+)/i)
          estimates.push(match ? Number(match[1]) : 5)
        }

        for (const agent of pokerAgents) {
          const debate = await callAgentStream(
            {
              role: "poker_debate",
              storyId: story.id,
              storyTitle: story.title,
              storyDescription: story.summary,
              variantId: agent.label,
              context: history.join("\n\n"),
            },
            () => {}
          )
          history.push(`${agent.label} debate\n${debate}`)
        }

        const sorted = [...estimates].sort((left, right) => left - right)
        const consensus = sorted[Math.floor(sorted.length / 2)] ?? 5

        const savedProject = await patchProject({
          type: "save-story-planning",
          storyId: story.id,
          storyPoints: consensus,
          pokerHistory: history,
          pokerConsensus: `Consensus reached at ${consensus} story points.`,
        })
        setProject(savedProject)
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <SDLCShell
      active="design"
      projectId={projectId}
      title="Design"
      subtitle="A backlog agent transformă requirements în user stories, apoi Technical Lead, Frontend și Backend joacă poker și ajung la consens."
    >
      <div className="space-y-6">
        <Card className="rounded-[16px] border-border/40 bg-card/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Design Agents</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Product Backlog & Planning Poker</h2>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => void generateBacklog()} disabled={running || project.requirements.length === 0}>
                Generate Backlog
              </Button>
              <Button onClick={() => void runPoker()} disabled={running || project.userStories.length === 0}>
                Activate 3 Poker Agents
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {project.userStories.length > 0 ? (
            project.userStories.map((story) => (
              <Card key={story.id} className="rounded-[16px] border-border/40 bg-card/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-primary">{story.id}</div>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{story.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{story.summary}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline">{story.storyPoints ? `${story.storyPoints} pts` : "No estimate yet"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setActiveStoryId((current) => (current === story.id ? "" : story.id))}>
                      {activeStoryId === story.id ? "Hide Poker History" : "Show Poker History"}
                    </Button>
                  </div>
                </div>

                {activeStoryId === story.id && (
                  <div className="mt-4 space-y-3">
                    {(story.pokerHistory ?? []).map((entry, index) => (
                      <div key={`${story.id}-${index}`} className="rounded-[14px] border border-border/30 bg-background/50 px-4 py-3 text-sm whitespace-pre-wrap text-foreground/90">
                        {entry}
                      </div>
                    ))}
                    {story.pokerConsensus ? (
                      <div className="rounded-[14px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                        {story.pokerConsensus}
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            ))
          ) : (
            <Card className="rounded-[16px] border-dashed border-border/40 bg-card/60 p-6 text-sm text-muted-foreground">
              Generate backlog to create user stories from the requirements.
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <Button disabled={project.userStories.length === 0} onClick={() => {
            if (project.userStories.length > 0) window.location.href = withProjectQuery("/implementation", projectId)
          }}>
            Implement Backlog
          </Button>
        </div>
      </div>
    </SDLCShell>
  )
}
