"use client"

export const dynamic = "force-dynamic"

import Link from "next/link"
import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import {
  useEditableWorkspace,
} from "@/lib/code-viewer/workspace-store"
import { getProjectIdFromCurrentUrl, withOptionalProjectQuery } from "@/lib/backend/project-client"
import type { VirtualFile } from "@/lib/code-viewer/virtual-files"
import { cn } from "@/lib/utils"

type PreviewItem = {
  id: string
  storyId: string
  title: string
  variantLabel: string
  headline: string
  summary: string
  labels: string[]
  acceptanceCriteria: string[]
  sourcePath: string
  rootTag: "main" | "section" | "div" | "article"
  rootClassName: string
  rootStyle: CSSProperties
}

const TAILWIND_COLOR_MAP: Record<string, string> = {
  "bg-red-500": "#ef4444",
  "bg-red-600": "#dc2626",
  "bg-red-700": "#b91c1c",
  "bg-blue-500": "#3b82f6",
  "bg-emerald-500": "#10b981",
  "bg-black": "#000000",
  "bg-white": "#ffffff",
  "text-white": "#ffffff",
  "text-black": "#000000",
  "text-red-500": "#ef4444",
}

function extractPreviewCopy(file: VirtualFile) {
  const headingMatch = file.content.match(/<h1>([\s\S]*?)<\/h1>/i)
  const paragraphMatch = file.content.match(/<p>([\s\S]*?)<\/p>/i)

  return {
    headline: headingMatch?.[1]?.trim() || file.path.split("/").slice(-2).join(" / "),
    summary: paragraphMatch?.[1]?.trim() || "This preview is built from the editable workspace currently loaded in View Code.",
  }
}

function extractRootElement(file: VirtualFile) {
  const tagMatch = file.content.match(/<(main|section|div|article)\b([^>]*)>/i)
  const tag = (tagMatch?.[1]?.toLowerCase() as PreviewItem["rootTag"] | undefined) ?? "main"
  const attrs = tagMatch?.[2] ?? ""

  const classMatch = attrs.match(/className\s*=\s*(?:"([^"]*)"|'([^']*)')/)
  const rootClassName = classMatch?.[1] ?? classMatch?.[2] ?? ""

  const styleMatch = file.content.match(/style=\{\{([\s\S]*?)\}\}/)
  const rootStyle = parseInlineStyle(styleMatch?.[1] ?? "", rootClassName)

  return { rootTag: tag, rootClassName, rootStyle }
}

function parseInlineStyle(styleSource: string, className: string): CSSProperties {
  const style: CSSProperties = {}

  const propertyPatterns: Array<{ key: keyof CSSProperties; pattern: RegExp }> = [
    { key: "background", pattern: /background\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "backgroundColor", pattern: /backgroundColor\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "color", pattern: /color\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "padding", pattern: /padding\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "borderRadius", pattern: /borderRadius\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "fontFamily", pattern: /fontFamily\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "maxWidth", pattern: /maxWidth\s*:\s*["'`]([^"'`]+)["'`]/i },
    { key: "margin", pattern: /margin\s*:\s*["'`]([^"'`]+)["'`]/i },
  ]

  for (const property of propertyPatterns) {
    const match = styleSource.match(property.pattern)
    if (match?.[1]) {
      style[property.key] = match[1] as never
    }
  }

  for (const token of className.split(/\s+/).filter(Boolean)) {
    if (token.startsWith("bg-") && TAILWIND_COLOR_MAP[token] && !style.background && !style.backgroundColor) {
      style.backgroundColor = TAILWIND_COLOR_MAP[token]
    }
    if (token.startsWith("text-") && TAILWIND_COLOR_MAP[token] && !style.color) {
      style.color = TAILWIND_COLOR_MAP[token]
    }
  }

  return style
}

function buildPreviewItems(files: VirtualFile[]): PreviewItem[] {
  const previewFiles = files.filter(
    (file) => file.path.endsWith("frontend.tsx") || file.path === "src/app/page.tsx"
  )

  return previewFiles.map((file) => {
    const segments = file.path.split("/")
    const storyId = segments.includes("generated") ? segments[segments.indexOf("generated") + 1] ?? "WORKSPACE" : "MERGED"
    const variantId = segments.includes("generated") ? segments[segments.indexOf("generated") + 2] ?? "A" : "APP"
    const previewCopy = extractPreviewCopy(file)
    const rootElement = extractRootElement(file)

    return {
      id: file.path,
      storyId,
      title: storyId === "MERGED" ? "Merged Application" : storyId,
      variantLabel: variantId === "APP" ? "App Runtime" : `Variant ${variantId}`,
      headline: previewCopy.headline,
      summary: previewCopy.summary,
      labels: [],
      acceptanceCriteria: [],
      sourcePath: file.path,
      rootTag: rootElement.rootTag,
      rootClassName: rootElement.rootClassName,
      rootStyle: rootElement.rootStyle,
    }
  })
}

function scopeCssForPreview(css: string) {
  return css
    .replace(/\bhtml\b/g, "[data-preview-canvas]")
    .replace(/\bbody\b/g, "[data-preview-canvas]")
}

function buildCssBundle(files: VirtualFile[]) {
  return files
    .filter((file) => file.path.endsWith(".css") || file.path.endsWith(".scss"))
    .map((file) => `/* ${file.path} */\n${scopeCssForPreview(file.content)}`)
    .join("\n\n")
}

export default function CodePreviewPage() {
  const projectId = useMemo(() => getProjectIdFromCurrentUrl(), [])
  const workspace = useEditableWorkspace(projectId)
  const previewItems = useMemo(() => buildPreviewItems(workspace.files), [workspace.files])
  const cssBundle = useMemo(() => buildCssBundle(workspace.files), [workspace.files])
  const [activeItemId, setActiveItemId] = useState("")

  const activeItem = useMemo(
    () => previewItems.find((item) => item.id === activeItemId) ?? previewItems[0] ?? null,
    [activeItemId, previewItems]
  )

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

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f8f6ef]">
        {cssBundle ? <style>{cssBundle}</style> : null}
        <header className="flex items-center justify-between border-b border-[#e6ddce] bg-white/85 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-[#1e1d1b]">Generated Preview</h1>
            <span className="rounded-md bg-[#d97706]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d97706]">
              Live Sync
            </span>
            <span suppressHydrationWarning className="text-[11px] text-[#7e776b]">
              {workspace.updatedAt ? `Updated ${new Date(workspace.updatedAt).toLocaleTimeString()}` : "Waiting for workspace edits"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={withOptionalProjectQuery("/code", projectId)}
              className="flex items-center gap-1 rounded-lg border border-[#d8d1c4] px-3 py-1.5 text-xs text-[#6c665d] transition-colors hover:text-[#1e1d1b]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              View Code
            </Link>
          </div>
        </header>

        {previewItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="material-symbols-outlined text-[#c6b79f]" style={{ fontSize: 56 }}>widgets</span>
            <div>
              <p className="text-lg font-semibold text-[#1e1d1b]">No previewable frontend files yet</p>
              <p className="mt-2 text-sm text-[#6c665d]">
                Generate or mock implementation first, then edit frontend files in <span className="font-semibold">View Code</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
            <aside className="border-r border-[#e6ddce] bg-[#f2ede2] p-5">
              <div className="rounded-[24px] bg-[#201c17] p-5 text-white shadow-[0_18px_50px_rgba(32,28,23,0.16)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Project</div>
                <h2 className="mt-3 font-serif text-3xl leading-tight">Generated Application</h2>
                <p className="mt-3 text-sm text-white/70">
                  Preview-ul urmărește workspace-ul editabil din View Code și se sincronizează live când schimbi fișiere.
                </p>
              </div>

              <div className="mt-5 space-y-2">
                {previewItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveItemId(item.id)}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                      activeItem?.id === item.id
                        ? "border-[#d97706]/30 bg-white shadow-sm"
                        : "border-transparent bg-white/50 hover:border-[#d8d1c4]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-[#d97706]/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#d97706]">
                        {item.storyId}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7e776b]">
                        {item.variantLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#1e1d1b]">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#6c665d]">{item.summary}</p>
                  </button>
                ))}
              </div>
            </aside>

            <section className="min-w-0 overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(217,119,6,0.16),_transparent_28%),linear-gradient(180deg,#fffdf8_0%,#f6f2e8_100%)] p-8">
              {activeItem ? (
                <div className="mx-auto max-w-5xl">
                  <div className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-[0_25px_70px_rgba(88,64,32,0.12)] backdrop-blur">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-[#1e1d1b] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                        {activeItem.storyId}
                      </span>
                      <span className="rounded-full bg-[#d97706]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d97706]">
                        {activeItem.variantLabel}
                      </span>
                    </div>

                    <h2 className="mt-6 font-serif text-5xl leading-[1.02] text-[#1e1d1b]">{activeItem.headline}</h2>
                    <p className="mt-5 max-w-3xl text-lg leading-8 text-[#4f4a43]">{activeItem.summary}</p>

                    <div className="mt-8 flex flex-wrap gap-2">
                      {activeItem.labels.length > 0 ? (
                        activeItem.labels.map((label) => (
                          <span key={label} className="rounded-full border border-[#ded6c7] bg-[#f6f1e7] px-3 py-1 text-[11px] font-mono text-[#6c665d]">
                            {label}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-[#ded6c7] bg-[#f6f1e7] px-3 py-1 text-[11px] font-mono text-[#6c665d]">
                          {activeItem.sourcePath}
                        </span>
                      )}
                    </div>

                    <div className="mt-10 grid gap-5 md:grid-cols-3">
                      <article className="rounded-[24px] bg-[#faf6ee] p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c7e54]">Live Edit Loop</div>
                        <p className="mt-3 text-sm leading-6 text-[#4f4a43]">
                          Manual edits and AI edits update the workspace immediately and refresh this preview in real time.
                        </p>
                      </article>
                      <article className="rounded-[24px] bg-[#faf6ee] p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c7e54]">Source File</div>
                        <p className="mt-3 break-words text-sm leading-6 text-[#4f4a43]">{activeItem.sourcePath}</p>
                      </article>
                      <article className="rounded-[24px] bg-[#faf6ee] p-5">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c7e54]">Rendering Model</div>
                        <p className="mt-3 text-sm leading-6 text-[#4f4a43]">
                          The shell is derived from the current frontend code and applies any CSS files from the editable workspace live.
                        </p>
                      </article>
                    </div>

                    <div className="mt-10 rounded-[28px] border border-[#efe7d8] bg-[#fffaf0] p-4">
                      <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c7e54]">Live Canvas</div>
                      <div className="overflow-hidden rounded-[24px] border border-[#e7dcc8] bg-white shadow-[0_12px_35px_rgba(88,64,32,0.08)]">
                        <div className="flex items-center gap-2 border-b border-[#efe7d8] bg-[#fbf6ec] px-4 py-2">
                          <div className="flex gap-1.5">
                            <div className="size-2.5 rounded-full bg-[#ff8f8f]" />
                            <div className="size-2.5 rounded-full bg-[#ffd36a]" />
                            <div className="size-2.5 rounded-full bg-[#7ce7a2]" />
                          </div>
                          <div className="ml-2 text-[11px] text-[#7e776b]">{activeItem.sourcePath}</div>
                        </div>
                        <div data-preview-canvas className="min-h-[340px] bg-white p-6">
                          <PreviewCanvas item={activeItem} />
                        </div>
                      </div>
                    </div>

                    {activeItem.acceptanceCriteria.length > 0 ? (
                      <div className="mt-10 rounded-[28px] border border-[#efe7d8] bg-[#fffaf0] p-6">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9c7e54]">Acceptance Criteria</div>
                        <div className="mt-4 space-y-3">
                          {activeItem.acceptanceCriteria.map((criterion, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[#d97706]/12 text-[#d97706]">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                              </div>
                              <p className="text-sm leading-6 text-[#4f4a43]">{criterion}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function PreviewCanvas({ item }: { item: PreviewItem }) {
  const Tag = item.rootTag

  return (
    <Tag
      className={item.rootClassName || undefined}
      style={item.rootStyle}
      data-preview-root=""
    >
      <h1>{item.headline}</h1>
      <p>{item.summary}</p>
    </Tag>
  )
}
