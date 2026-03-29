"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SDLCShell } from "@/components/sdlc-shell"
import { withProjectQuery } from "@/lib/backend/project-url"
import type { ProjectState } from "@/lib/backend/types"

function listOrFallback(items: string[], fallback: string) {
  return items.length > 0 ? items : [fallback]
}

export function PlanningWorkspace({
  initialProject,
  projectId,
}: {
  initialProject: ProjectState
  projectId: string
}) {
  const [project, setProject] = useState(initialProject)
  const [activeChannel, setActiveChannel] = useState<"product" | "technical">("product")
  const [composer, setComposer] = useState("")
  const [sending, setSending] = useState(false)

  const canOpenTechnical = Boolean(
    project.brief.title.trim() &&
      project.brief.objective.trim() &&
      project.brief.audience.length > 0 &&
      project.brief.scope.length > 0
  )
  const canOpenAnalysis = Boolean(
    canOpenTechnical &&
      project.brief.architecture.trim() &&
      project.brief.techStack.length > 0 &&
      project.brief.dbSchema.trim()
  )

  async function sendMessage() {
    const text = composer.trim()
    if (!text || sending) return
    setSending(true)
    setComposer("")

    try {
      const response = await fetch(withProjectQuery("/api/messages", projectId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: activeChannel,
          author: "User",
          text,
        }),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      setProject((await response.json()) as ProjectState)
    } catch {
      setComposer(text)
    } finally {
      setSending(false)
    }
  }

  const messages = project.messages[activeChannel]

  return (
    <SDLCShell
      active="planning"
      projectId={projectId}
      title="Planning"
      subtitle="Începe cu un chat de produs, dezvoltă ideea împreună cu un LLM creativ, apoi continuă cu documentația tehnică într-un chat separat."
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="flex min-h-[420px] flex-col overflow-hidden rounded-[16px] border-border/40 bg-card/70">
          <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Planning Chats</div>
              <div className="mt-1 text-sm text-muted-foreground">Product discovery first, technical documentation second.</div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={activeChannel === "product" ? "default" : "outline"}
                onClick={() => setActiveChannel("product")}
              >
                Product
              </Button>
              <Button
                size="sm"
                variant={activeChannel === "technical" ? "default" : "outline"}
                disabled={!canOpenTechnical}
                onClick={() => setActiveChannel("technical")}
              >
                Technical
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-[16px] border border-border/40 bg-background/50 p-4 text-sm text-muted-foreground">
              {activeChannel === "product"
                ? "Creative Product AI te ajută să clarifici problema, utilizatorii, MVP-ul și valoarea produsului."
                : "Technical Documentation AI rafinează arhitectura, integrarea, schema de date și constrângerile de producție."}
            </div>

            <div className="max-h-[440px] space-y-3 overflow-y-auto pr-2">
              {messages.length > 0 ? (
                messages.map((message) => (
                  <div key={message.id} className={message.role === "human" ? "text-right" : "text-left"}>
                    <div className="mb-1 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      {message.author}
                    </div>
                    <div className={`inline-block max-w-[90%] rounded-[16px] px-4 py-3 text-sm leading-relaxed ${message.role === "human" ? "rounded-tr-[4px] bg-primary text-primary-foreground" : "rounded-tl-[4px] border border-border/40 bg-background/80 text-foreground"}`}>
                      {message.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[16px] border border-dashed border-border/40 bg-background/50 p-5 text-sm text-muted-foreground">
                  {activeChannel === "product"
                    ? "Spune ce produs vrei să construiești, cine îl folosește și ce problemă rezolvă."
                    : "Continuă cu tehnologia: auth, integrări, schema de date, arhitectura și cerințele de producție."}
                </div>
              )}

              {sending && (
                <div className="rounded-[16px] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                  AI scrie
                  <span className="ml-2 inline-flex gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} className="inline-block size-2 animate-pulse rounded-full bg-primary/80" />
                    ))}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Input
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
                placeholder={activeChannel === "product" ? "Describe product idea, users, workflows..." : "Ask about architecture, data model, auth, APIs..."}
              />
              <Button onClick={() => void sendMessage()} disabled={!composer.trim() || sending}>
                Send
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="flex flex-col rounded-[16px] border-border/40 bg-card/70 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
                {activeChannel === "product" ? "Product Documentation" : "Technical Documentation"}
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Live Sync
              </Badge>
            </div>

            {activeChannel === "product" ? (
              <div className="mt-4 space-y-4 text-sm">
                <Section label="Title" items={listOrFallback(project.brief.title ? [project.brief.title] : [], "Not enough context yet")} />
                <Section label="Objective" items={listOrFallback(project.brief.objective ? [project.brief.objective] : [], "Waiting for product objective")} />
                <Section label="Audience" items={listOrFallback(project.brief.audience, "Audience will appear here")} />
                <Section label="Scope" items={listOrFallback(project.brief.scope, "Core capabilities will appear here")} />
                <Section label="Deliverables" items={listOrFallback(project.brief.deliverables, "Expected deliverables will appear here")} />
                <Section label="Risks" items={listOrFallback(project.brief.risks, "Business constraints will appear here")} />
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <Section label="Tech Stack" items={listOrFallback(project.brief.techStack, "Technical stack will appear here")} />
                <Section label="Architecture" items={listOrFallback(project.brief.architecture ? [project.brief.architecture] : [], "Architecture summary will appear here")} />
                <Section label="DB Schema" items={listOrFallback(project.brief.dbSchema ? [project.brief.dbSchema] : [], "Data model notes will appear here")} />
                <Section label="Risks" items={listOrFallback(project.brief.risks, "Operational risks will appear here")} />
              </div>
            )}
          </Card>

          <Card className="rounded-[16px] border-border/40 bg-card/70 p-5">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">Stage Gates</div>
            <div className="mt-4 space-y-3 text-sm">
              <Gate ready={canOpenTechnical} title="Switch To Technical" detail="Available after product chat gathers enough context." />
              <Gate ready={canOpenAnalysis} title="Go To Analysis" detail="Available after technical documentation is detailed enough." />
            </div>
            <div className="mt-5 flex gap-3">
              <Button disabled={!canOpenTechnical} variant="outline" onClick={() => setActiveChannel("technical")}>
                Open Technical Chat
              </Button>
              <Button disabled={!canOpenAnalysis} onClick={() => {
                if (canOpenAnalysis) window.location.href = withProjectQuery("/analysis", projectId)
              }}>
                Continue To Analysis
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </SDLCShell>
  )
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="rounded-2xl border border-border/30 bg-background/50 px-3 py-2 text-foreground/90">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function Gate({ ready, title, detail }: { ready: boolean; title: string; detail: string }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${ready ? "border-primary/30 bg-primary/5" : "border-border/30 bg-background/40"}`}>
      <div className="flex items-center justify-between">
        <div className="font-medium text-foreground">{title}</div>
        <Badge variant="outline" className={ready ? "border-primary/30 bg-primary/10 text-primary" : ""}>
          {ready ? "Ready" : "Locked"}
        </Badge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}
