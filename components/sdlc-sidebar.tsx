"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

type SDLCPhase = {
  id: string
  number: number
  label: string
  icon: string
  color: string
  stages: SDLCStage[]
}

type SDLCStage = {
  id: string
  number: string
  label: string
  description: string
  icon: string
  /** internal = stage inside IdeationDashboard, external = separate route */
  type: "internal" | "external"
  /** For external stages, the href to navigate to */
  href?: string
  /** For internal stages, the StageKey to transition to */
  stageKey?: string
}

const SDLC_PHASES: SDLCPhase[] = [
  {
    id: "planning",
    number: 1,
    label: "Planning",
    icon: "chat",
    color: "text-emerald-500",
    stages: [
      { id: "product-tech-chat", number: "01", label: "Product & Tech Chat", description: "Shape your idea with AI agents", icon: "forum", type: "internal", stageKey: "Conversation" },
    ],
  },
  {
    id: "analysis",
    number: 2,
    label: "Analysis",
    icon: "analytics",
    color: "text-amber-500",
    stages: [
      { id: "requirements", number: "02", label: "Requirements", description: "AI-generated from documentation", icon: "assignment", type: "internal", stageKey: "Requirements" },
    ],
  },
  {
    id: "design",
    number: 3,
    label: "Design",
    icon: "design_services",
    color: "text-orange-500",
    stages: [
      { id: "product-backlog", number: "03", label: "Product Backlog", description: "User stories, estimation & sprint planning", icon: "view_kanban", type: "external", href: "/analysis" },
    ],
  },
  {
    id: "implementation",
    number: 4,
    label: "Implementation",
    icon: "code",
    color: "text-red-500",
    stages: [
      { id: "agent-pipeline", number: "04", label: "Agent Pipeline", description: "3-variant AI code generation", icon: "construction", type: "external", href: "/implementation" },
    ],
  },
  {
    id: "testing",
    number: 5,
    label: "Testing & Integration",
    icon: "integration_instructions",
    color: "text-blue-500",
    stages: [
      { id: "merge-review", number: "05", label: "Merge & Code Review", description: "Merge variants & review code", icon: "merge_type", type: "internal", stageKey: "Merge" },
    ],
  },
  {
    id: "maintenance",
    number: 6,
    label: "Maintenance",
    icon: "settings_suggest",
    color: "text-sky-500",
    stages: [
      { id: "project-review", number: "06", label: "Project Review", description: "Health, progress & tech debt", icon: "assessment", type: "internal", stageKey: "Project Review" },
    ],
  },
]

export { SDLC_PHASES }
export type { SDLCPhase, SDLCStage }

type SDLCSidebarProps = {
  /** Current active stage key for IdeationDashboard internal stages */
  activeStageKey?: string
  /** Current active external page id (e.g. "planning-poker", "agent-pipeline", "merge-terminal", "intelligence") */
  activeExternalId?: string
  /** Callback when an internal stage is clicked */
  onStageClick?: (stageKey: string) => void
  /** Whether the component is hydrated (for SSR text rendering) */
  isHydrated?: boolean
}

export function SDLCSidebar({ activeStageKey, activeExternalId, onStageClick, isHydrated = true }: SDLCSidebarProps) {
  const activePhaseId = getActivePhaseId(activeStageKey, activeExternalId)
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(activePhaseId ? [activePhaseId] : []))

  useEffect(() => {
    if (activePhaseId) {
      setExpandedPhases((prev) => {
        const next = new Set(prev)
        next.add(activePhaseId)
        return next
      })
    }
  }, [activePhaseId])

  function togglePhase(phaseId: string) {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4 no-scrollbar">
      <div className="mb-1 flex items-center gap-2 border-b border-border/30 px-2 pb-3">
        <span className="material-symbols-outlined text-muted-foreground/70" style={{ fontSize: 16 }}>account_tree</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70">SDLC Pipeline</span>
      </div>

      <div className="space-y-1">
        {SDLC_PHASES.map((phase) => {
          const isExpanded = expandedPhases.has(phase.id)
          const isActivePhase = phase.id === activePhaseId

          return (
            <div key={phase.id}>
              <button
                onClick={() => togglePhase(phase.id)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-all duration-200",
                  isActivePhase
                    ? "bg-primary/8 text-foreground"
                    : "text-muted-foreground/70 hover:bg-card hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid size-[22px] shrink-0 place-items-center rounded-[6px] border font-mono text-[9px] font-bold transition-all duration-300",
                    isActivePhase
                      ? "border-primary/30 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_1px_5px_rgba(16,185,129,0.3)]"
                      : "border-border/50 bg-muted/40 text-muted-foreground/60 group-hover:bg-muted group-hover:text-foreground"
                  )}
                >
                  {phase.number}
                </span>
                <span className="flex-1 text-[12px] font-semibold uppercase tracking-wide">
                  {isHydrated ? phase.label : ""}
                </span>
                <span
                  className={cn(
                    "material-symbols-outlined text-muted-foreground/40 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                  style={{ fontSize: 14 }}
                >
                  expand_more
                </span>
              </button>

              {isExpanded && (
                <div className="ml-3 mt-0.5 space-y-[2px] border-l border-border/20 pl-3">
                  {phase.stages.map((stage) => {
                    const isActive =
                      (stage.type === "internal" && stage.stageKey === activeStageKey) ||
                      (stage.type === "external" && stage.id === activeExternalId)

                    const content = (
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "material-symbols-outlined",
                              isActive ? "text-primary" : "text-muted-foreground/50"
                            )}
                            style={{ fontSize: 13 }}
                          >
                            {stage.icon}
                          </span>
                          <span className="text-[12px]">{isHydrated ? stage.label : ""}</span>
                          {stage.type === "external" && (
                            <span
                              className="material-symbols-outlined text-muted-foreground/30"
                              style={{ fontSize: 10 }}
                            >
                              open_in_new
                            </span>
                          )}
                        </span>
                        <span className="ml-[22px] text-[10px] font-normal leading-snug text-muted-foreground/60">
                          {isHydrated ? stage.description : ""}
                        </span>
                      </span>
                    )

                    if (stage.type === "external") {
                      return (
                        <a
                          key={stage.id}
                          href={stage.href}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] font-medium transition-all duration-200",
                            isActive
                              ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20"
                              : "text-muted-foreground/70 hover:bg-card hover:text-foreground hover:shadow-sm"
                          )}
                        >
                          {content}
                        </a>
                      )
                    }

                    return (
                      <button
                        key={stage.id}
                        onClick={() => onStageClick?.(stage.stageKey!)}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary/10 text-primary shadow-sm ring-1 ring-inset ring-primary/20"
                            : "text-muted-foreground/70 hover:bg-card hover:text-foreground hover:shadow-sm"
                        )}
                      >
                        {content}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-auto border-t border-border/20 pt-3">
        <p className="text-center font-mono text-[9px] text-muted-foreground/40">SDLC v2.4.0</p>
      </div>
    </div>
  )
}

function getActivePhaseId(activeStageKey?: string, activeExternalId?: string): string | undefined {
  for (const phase of SDLC_PHASES) {
    for (const stage of phase.stages) {
      if (stage.type === "internal" && stage.stageKey === activeStageKey) return phase.id
      if (stage.type === "external" && stage.id === activeExternalId) return phase.id
    }
  }
  return undefined
}
