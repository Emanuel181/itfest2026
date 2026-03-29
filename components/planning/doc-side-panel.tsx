"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type DocSidePanelProps = {
  title: string
  icon: string
  sections: { label: string; key: string; type: "text" | "list" }[]
  parsedDoc: Record<string, unknown>
  variant?: "product" | "technical"
  questionProgress?: Record<string, boolean>
  isSummarizing?: boolean
}

const sectionIcons: Record<string, string> = {
  title: "title",
  objective: "target",
  audience: "group",
  scope: "checklist",
  outOfScope: "block",
  deliverables: "package_2",
  risks: "warning",
  techStack: "code",
  architecture: "account_tree",
  database: "database",
  apis: "api",
  deployment: "cloud_upload",
  infrastructure: "dns",
  authStrategy: "lock",
  dbSchema: "database",
  apiDesign: "api",
  extraNotes: "sticky_note_2",
}

function hasSectionContent(value: unknown): boolean {
  if (!value) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

export function DocSidePanel({
  title,
  icon,
  sections,
  parsedDoc,
  variant = "product",
  questionProgress = {},
  isSummarizing = false,
}: DocSidePanelProps) {
  const completedCount = sections.filter((s) => hasSectionContent(parsedDoc[s.key])).length
  const totalSections = sections.length
  const progress = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/20 px-5 py-3.5">
        <div className="grid size-8 place-items-center rounded-lg bg-primary/10">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          <p className="text-[10px] text-muted-foreground/60">
            {completedCount}/{totalSections} sections
          </p>
        </div>
        {completedCount > 0 && (
          <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
            {progress}%
          </Badge>
        )}
      </div>

      {/* Progress stepper */}
      <div className="px-5 py-3 border-b border-border/10">
        <div className="flex items-center gap-1">
          {sections.map((section, i) => {
            const filled = hasSectionContent(parsedDoc[section.key])
            const summarizing = isSummarizing && !filled && questionProgress[section.key]
            return (
              <div key={section.key} className="flex items-center flex-1">
                <div
                  className={cn(
                    "size-5 rounded-full grid place-items-center transition-all duration-500 shrink-0",
                    filled
                      ? "bg-primary text-primary-foreground"
                      : summarizing
                        ? "bg-primary/20 text-primary animate-pulse"
                        : "bg-muted/40 text-muted-foreground/30"
                  )}
                  title={section.label}
                >
                  {filled ? (
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>
                  ) : summarizing ? (
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 10 }}>progress_activity</span>
                  ) : (
                    <span className="text-[8px] font-bold">{i + 1}</span>
                  )}
                </div>
                {i < sections.length - 1 && (
                  <div className={cn(
                    "h-px flex-1 mx-0.5 transition-colors duration-500",
                    filled ? "bg-primary/50" : "bg-muted/30"
                  )} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[8px] text-muted-foreground/40 truncate">{sections[0]?.label}</span>
          <span className="text-[8px] text-muted-foreground/40 truncate">{sections[sections.length - 1]?.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      {completedCount > 0 && (
        <div className="px-5 pt-2">
          <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-5 py-4 space-y-1">
          {sections.map((section) => {
            const value = parsedDoc[section.key]
            const filled = hasSectionContent(value)
            const sectionIcon = sectionIcons[section.key] || "article"
            const isTechnical = variant === "technical"
            const summarizing = isSummarizing && !filled

            // Summarizing state — skeleton
            if (summarizing && questionProgress[section.key]) {
              return (
                <div key={section.key} className="group">
                  <div className="rounded-xl px-3 py-3">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="material-symbols-outlined text-primary/40 animate-pulse" style={{ fontSize: 16 }}>{sectionIcon}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/40">{section.label}</span>
                      <span className="material-symbols-outlined text-primary/30 ml-auto animate-spin" style={{ fontSize: 12 }}>progress_activity</span>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      {section.type === "list" && <Skeleton className="h-3 w-1/2" />}
                    </div>
                  </div>
                  <Separator className="my-1 opacity-30" />
                </div>
              )
            }

            // Filled state — render content
            if (filled) {
              if (section.type === "list" && Array.isArray(value) && value.length > 0) {
                return (
                  <div key={section.key} className="group animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="rounded-xl px-3 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="material-symbols-outlined text-muted-foreground/50" style={{ fontSize: 16 }}>{sectionIcon}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{section.label}</span>
                        <span className="ml-auto font-mono text-[9px] text-muted-foreground/30">{(value as string[]).length}</span>
                      </div>

                      {isTechnical && section.key === "techStack" ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(value as string[]).map((item, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-medium">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <ul className="space-y-1.5 pl-1">
                          {(value as string[]).map((item, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                              <span className={cn(
                                "mt-2 size-1.5 shrink-0 rounded-full",
                                section.key === "risks" ? "bg-destructive/60" : "bg-primary/50"
                              )} />
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Separator className="my-1 opacity-30" />
                  </div>
                )
              }

              if (section.type === "text" && typeof value === "string" && value.trim()) {
                return (
                  <div key={section.key} className="group animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="rounded-xl px-3 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="material-symbols-outlined text-muted-foreground/50" style={{ fontSize: 16 }}>{sectionIcon}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">{section.label}</span>
                      </div>

                      {section.key === "title" ? (
                        <h2 className="text-lg font-bold text-foreground tracking-tight">{value}</h2>
                      ) : isTechnical ? (
                        <div className="text-sm leading-relaxed text-foreground/80 space-y-2">
                          {value.split("\n\n").map((paragraph, i) => {
                            if (paragraph.length < 60 && !paragraph.includes(".") && paragraph === paragraph.trim()) {
                              return <h4 key={i} className="font-semibold text-foreground mt-2 first:mt-0">{paragraph}</h4>
                            }
                            if (paragraph.includes("\n- ") || paragraph.startsWith("- ")) {
                              const lines = paragraph.split("\n")
                              return (
                                <div key={i} className="space-y-1">
                                  {lines.map((line, j) => {
                                    const cleaned = line.replace(/^-\s*/, "")
                                    if (line.startsWith("- ")) {
                                      return (
                                        <div key={j} className="flex items-start gap-2 pl-1">
                                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/40" />
                                          <span>{cleaned}</span>
                                        </div>
                                      )
                                    }
                                    return <p key={j}>{line}</p>
                                  })}
                                </div>
                              )
                            }
                            return <p key={i} className="whitespace-pre-wrap">{paragraph}</p>
                          })}
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{value}</p>
                      )}
                    </div>
                    <Separator className="my-1 opacity-30" />
                  </div>
                )
              }
            }

            // Pending state — ghost placeholder
            return (
              <div key={section.key} className="group">
                <div className="rounded-xl px-3 py-3 opacity-40">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-muted-foreground/30" style={{ fontSize: 16 }}>{sectionIcon}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/30">{section.label}</span>
                    <span className="ml-auto">
                      <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 12 }}>radio_button_unchecked</span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground/25 italic">
                    Will be filled as you discuss this topic
                  </p>
                </div>
                <Separator className="my-1 opacity-15" />
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
