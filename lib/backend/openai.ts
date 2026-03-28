import OpenAI from "openai"

import type {
  BriefState,
  Feature,
  Message,
  MessageChannel,
  StoryVariant,
  UserStory,
  WorkspaceFile,
  WorkspaceFolder,
} from "@/lib/backend/types"

type WorkspaceScaffold = {
  folders: WorkspaceFolder[]
  files: WorkspaceFile[]
  runtimeEntrypoints: string[]
}

let cachedClient: OpenAI | null = null

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey })
  }

  return cachedClient
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function toSentenceLabel(value: string, fallback: string) {
  const cleaned = normalizeText(value).replace(/[.:]/g, "")
  if (!cleaned) return fallback

  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function toCodeIdentifier(value: string, fallback: string) {
  return toSentenceLabel(value, fallback).replace(/\s+/g, "")
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    const objectMatch = value.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (!objectMatch) return null

    try {
      return JSON.parse(objectMatch[0]) as T
    } catch {
      return null
    }
  }
}

function uniqueByPath<T extends { path: string }>(items: T[]) {
  const seen = new Set<string>()
  const next: T[] = []

  for (const item of items) {
    const normalizedPath = normalizeText(item.path)
    if (!normalizedPath || seen.has(normalizedPath)) continue
    seen.add(normalizedPath)
    next.push({ ...item, path: normalizedPath })
  }

  return next
}

function normalizeList(values: string[]) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const value of values.map((item) => normalizeText(item)).filter(Boolean)) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(value)
  }

  return next
}

function coerceStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeList(
      value
        .map((entry) => (typeof entry === "string" ? entry : typeof entry === "number" ? String(entry) : ""))
        .filter(Boolean)
    )
  }

  if (typeof value === "string") {
    return normalizeList(
      value
        .split(/\n|,|;|•|-/)
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    )
  }

  return []
}

function looksLikeBrokenWorkspaceFile(path: string, content: string) {
  if (!content.trim()) return true

  if (content.includes("\\nimport ") || content.includes("\\nexport ")) {
    return true
  }

  if (content.includes("// File:") || content.includes("File: pages/api/")) {
    return true
  }

  if (path === "src/lib/preview-data.ts" && (content.includes("className=") || content.includes("useCart") || content.includes("NextApiRequest"))) {
    return true
  }

  return false
}

function recentHumanMessages(messages: Message[], limit = 6) {
  return messages
    .filter((message) => message.role === "human")
    .slice(-limit)
    .map((message) => `${message.author}: ${message.text}`)
    .join("\n")
}

function hasEnoughDiscoveryContext(brief: BriefState) {
  return Boolean(
    brief.title.trim() &&
      brief.objective.trim() &&
      brief.audience.length > 0 &&
      brief.scope.length > 0 &&
      brief.deliverables.length > 0 &&
      brief.techStack.length > 0 &&
      brief.architecture.trim()
  )
}

function nextFallbackQuestion(channel: MessageChannel, brief: BriefState) {
  if (!brief.title.trim()) return "Cum se numește produsul sau website-ul?"
  if (!brief.objective.trim()) return "Care este obiectivul principal al website-ului în producție?"
  if (brief.audience.length === 0) return "Cine sunt utilizatorii principali și ce rol au?"
  if (brief.scope.length === 0) return "Care sunt cele mai importante 3 funcționalități din MVP?"
  if (brief.deliverables.length === 0) return "Ce rezultat concret vrei să livreze website-ul după lansare?"
  if (!brief.architecture.trim()) return "Dacă nu ai preferință tehnică, e ok să-ți propun eu o arhitectură simplă pentru producție?"
  if (brief.techStack.length === 0) return "Dacă nu ai stack decis, preferi să-ți recomand eu o variantă potrivită pentru producție?"
  if (!brief.dbSchema.trim()) return "Ce entități principale trebuie să existe în baza de date?"
  if (brief.risks.length === 0) return "Ce risc tehnic sau operațional vrei să prevenim din start?"
  if (channel === "tech") {
    return "Ai nevoie de auth, roluri sau integrări externe din prima versiune?"
  }

  if (channel === "business") {
    return "Există o regulă de business sau un flux critic pe care vrei să-l clarificăm acum?"
  }

  return "Ai nevoie de auth, roluri sau integrări externe din prima versiune?"
}

function fallbackReply(channel: MessageChannel, message: string, brief: BriefState) {
  const normalized = message.trim()
  if (!normalized) return "Continuăm."

  if (hasEnoughDiscoveryContext(brief)) {
    return `Am destul context ca să construiesc documentația completă pentru website. Avem deja obiectivul, audiența, scope-ul și recomandările tehnice de bază. Dacă ești ok, mergem mai departe și generez brief-ul complet din conversația noastră.`
  }

  const question = nextFallbackQuestion(channel, brief)
  return `Am notat direcția: "${normalized}". O folosesc pentru documentația website-ului. ${brief.architecture.trim() ? "" : "Dacă nu îmi dai preferințe tehnice, îți recomand eu stack-ul și arhitectura. "}Spune-mi simplu: ${question}`
}

function fallbackBriefFromConversation(
  currentBrief: BriefState,
  businessMessages: Message[],
  techMessages: Message[]
) {
  const businessHuman = businessMessages.filter((message) => message.role === "human").map((message) => normalizeText(message.text)).filter(Boolean)
  const techHuman = techMessages.filter((message) => message.role === "human").map((message) => normalizeText(message.text)).filter(Boolean)

  const title =
    currentBrief.title.trim() ||
    toSentenceLabel(businessHuman[0] || techHuman[0] || "Production Website", "Production Website")

  const objective =
    currentBrief.objective.trim() ||
    businessHuman[0] ||
    techHuman[0] ||
    "Launch a production-ready website with clear business goals and technical delivery constraints."

  return {
    title,
    objective,
    audience: normalizeList(currentBrief.audience.length > 0 ? currentBrief.audience : businessHuman.slice(1, 4)),
    scope: normalizeList(currentBrief.scope.length > 0 ? currentBrief.scope : businessHuman.slice(0, 4)),
    deliverables: normalizeList(
      currentBrief.deliverables.length > 0
        ? currentBrief.deliverables
        : [
            "Production website ready for launch",
            "Structured requirements and implementation plan",
            "Traceable feature and story backlog",
          ]
    ),
    risks: normalizeList(currentBrief.risks.length > 0 ? currentBrief.risks : techHuman.slice(0, 4)),
    techStack: normalizeList(
      currentBrief.techStack.length > 0 ? currentBrief.techStack : ["Next.js", "OpenAI", "PostgreSQL", "Vercel"]
    ),
    dbSchema:
      currentBrief.dbSchema.trim() ||
      (techHuman[0]
        ? `// Derived from technical conversation\n// ${techHuman[0]}`
        : ""),
    architecture:
      currentBrief.architecture.trim() ||
      techHuman.join(" ") ||
      "Next.js application prepared for production deployment, persistence, and AI-assisted workflows.",
  }
}

function fallbackFeatures(brief: BriefState): Feature[] {
  const seeds = [...brief.scope, ...brief.deliverables, ...brief.audience]
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 3)

  const fallbackSeeds = seeds.length > 0 ? seeds : [brief.objective, brief.architecture, "Project workspace"]

  return fallbackSeeds.slice(0, 3).map((seed, index) => {
    const title = toSentenceLabel(seed, `Feature ${index + 1}`)

    return {
      id: `FEAT-${String(index + 1).padStart(2, "0")}`,
      title,
      summary: `Capability derived from the brief for ${brief.title || "this project"}: ${seed || "Define a concrete feature."}`,
      preview: index === 0 ? "Primary flow" : index === 1 ? "Supporting workflow" : "Operational view",
      estimate: index === 0 ? "M" : index === 1 ? "L" : "S",
      complexityNote:
        index === 0
          ? "Balanced implementation effort with moderate orchestration work."
          : index === 1
            ? "Requires multiple handoffs and stronger approval logic."
            : "Smaller supporting capability with low integration cost.",
      dependencyIds: index === 0 ? [] : [`FEAT-${String(index).padStart(2, "0")}`],
      variations: [
        `Deliver through ${brief.techStack[0] || "the current stack"}.`,
        `Keep the approval flow aligned with ${brief.objective || "the main objective"}.`,
        `Expose the outcome directly in the IDE shell.`,
      ],
      acceptance: [
        "Artifact is generated from the approved brief.",
        "Human can review and edit the generated result.",
      ],
    }
  })
}

function fallbackStories(feature: Feature, brief: BriefState): UserStory[] {
  const audiences = brief.audience.length > 0 ? brief.audience : ["team member", "technical lead", "reviewer"]

  return audiences.slice(0, 3).map((audience, index) => {
    const summary = `As a ${audience}, I want ${feature.title.toLowerCase()} available in the workflow so that ${brief.objective || "the team can move faster"}.`

    const id = `US-${String(index + 1).padStart(2, "0")}`
    const code = `export const ${toCodeIdentifier(feature.title, "featurePlan")}Story${index + 1} = {\n  feature: ${JSON.stringify(feature.title)},\n  audience: ${JSON.stringify(audience)},\n  goal: ${JSON.stringify(summary)},\n}\n`
    const variants: StoryVariant[] = [
      {
        id: `${id}-VAR-01`,
        label: "Variant 1",
        teamName: "Frontend + Backend + TL Alpha",
        focus: "Optimize for rapid delivery with a single cohesive surface.",
        architecture: "Direct App Router implementation with compact orchestration support.",
        pros: ["Fastest to ship", "Lowest integration overhead", "Simple review path"],
        cons: ["Tighter coupling across concerns", "Less flexibility for later scale"],
        tradeoff: "Favors speed and simplicity.",
        code,
      },
      {
        id: `${id}-VAR-02`,
        label: "Variant 2",
        teamName: "Frontend + Backend + TL Beta",
        focus: "Balance delivery speed with maintainable boundaries.",
        architecture: "Layered flow with explicit orchestration and clearer separation of runtime data.",
        pros: ["Balanced maintenance cost", "Cleaner orchestration boundaries", "Good default choice"],
        cons: ["More coordination than Variant 1", "Slightly more code upfront"],
        tradeoff: "Balanced path between speed and structure.",
        code: `${code}\nexport const implementationMode = "balanced"\n`,
      },
      {
        id: `${id}-VAR-03`,
        label: "Variant 3",
        teamName: "Frontend + Backend + TL Gamma",
        focus: "Maximize modularity and future extensibility.",
        architecture: "Componentized implementation with stronger data and workflow separation.",
        pros: ["Strongest extensibility", "Easier long-term growth", "Better isolation"],
        cons: ["Highest initial complexity", "More review surface"],
        tradeoff: "Favors extensibility over immediate speed.",
        code: `${code}\nexport const implementationMode = "modular"\n`,
      },
    ]

    return {
      id,
      title: `Story ${index + 1}: ${feature.title}`,
      stack: brief.techStack.slice(0, 2).join(" + ") || "Next.js + OpenAI",
      summary,
      tradeoff:
        index === 0
          ? "Fastest path to delivery, with moderate structural flexibility."
          : index === 1
            ? "Balanced implementation effort and maintainability."
            : "Highest flexibility, but more moving parts to maintain.",
      estimate: index === 0 ? "M" : index === 1 ? "L" : "S",
      complexityNote:
        index === 0
          ? "Needs one coordinated UI and backend pass."
          : index === 1
            ? "Touches orchestration, approvals and persistence together."
            : "Local implementation with lighter coupling.",
      dependencyIds: index === 0 ? [] : [`US-${String(index).padStart(2, "0")}`],
      previewTitle: `${feature.title} Runtime`,
      previewDescription: `Preview the ${feature.title.toLowerCase()} flow directly from generated workspace files.`,
      code,
      variants,
      selectedVariantId: variants[1]?.id ?? variants[0]?.id ?? "",
    }
  })
}

function inferWorkspaceExperience(options: {
  brief: BriefState
  feature: Feature
  story: UserStory
}) {
  const corpus = [
    options.brief.title,
    options.brief.objective,
    ...options.brief.scope,
    ...options.brief.deliverables,
    options.feature.title,
    options.feature.summary,
    options.story.title,
    options.story.summary,
    options.story.previewTitle,
    options.story.previewDescription,
  ]
    .join(" ")
    .toLowerCase()

  if (/(admin|crud|inventory|orders|catalog management|categories)/.test(corpus)) {
    return "admin"
  }

  if (/(checkout|cart|product|shop|store|magazin|catalog)/.test(corpus)) {
    return "commerce"
  }

  return "workspace"
}

function fallbackWorkspaceScaffold(options: {
  brief: BriefState
  feature: Feature
  story: UserStory
  variant?: StoryVariant
}): WorkspaceScaffold {
  const appName = options.brief.title || options.feature.title || "AI-Native Workspace"
  const objective = options.brief.objective || "Build a working application flow from the approved story."
  const primaryMetric = options.brief.deliverables[0] || "Approved brief"
  const secondaryMetric = options.brief.scope[0] || options.feature.title
  const tertiaryMetric = options.brief.techStack[0] || "Next.js"
  const variant = options.variant ?? options.story.variants.find((item) => item.id === options.story.selectedVariantId) ?? options.story.variants[0]
  const experience = inferWorkspaceExperience(options)
  const feedItems = [
    `Selected feature: ${options.feature.title}`,
    `Selected story: ${options.story.title}`,
    `Chosen variant: ${variant?.label || "Default"} · ${variant?.focus || "Standard implementation path"}`,
    `Preview generated from the persistent backend workspace.`,
  ]
  const experienceConfig =
    experience === "admin"
      ? {
          pageTitle: options.story.previewTitle || "Admin Product Console",
          pageSubtitle:
            options.story.previewDescription ||
            "Administrators can manage catalog items, categories, and stock updates from a single interface.",
          primaryCta: "Add product",
          secondaryCta: "Sync catalog",
          panelTitle: "Catalog operations",
          panelDescription: "Use the queue below to validate, publish, and retire products without blocking the storefront.",
          stats: [
            { label: "Draft products", value: "18" },
            { label: "Needs review", value: "4" },
            { label: "Categories", value: "12" },
          ],
          highlights: [
            { title: "Create product", detail: "Add SKU, price, stock, and category mappings with validation." },
            { title: "Bulk edits", detail: "Queue description and media updates without downtime." },
            { title: "Order impact", detail: "Check whether catalog changes affect active orders or bundles." },
          ],
          queue: [
            { name: "Păpușa Sofia Ballet", meta: "Draft · Dolls", status: "Ready to publish" },
            { name: "Set accesorii roz", meta: "Needs category", status: "Validation warning" },
            { name: "Păpușa Luna Deluxe", meta: "Stock sync", status: "Awaiting inventory" },
          ],
        }
      : experience === "commerce"
        ? {
            pageTitle: options.story.previewTitle || "Toy Storefront",
            pageSubtitle:
              options.story.previewDescription ||
              "Shoppers can browse featured toys, inspect pricing, and move quickly toward cart and checkout.",
            primaryCta: "Add to cart",
            secondaryCta: "Open category",
            panelTitle: "Featured products",
            panelDescription: "The storefront highlights the hero catalog slice, purchase intent, and trust signals for checkout.",
            stats: [
              { label: "Featured SKUs", value: "6" },
              { label: "Cart conversion", value: "4.8%" },
              { label: "Shipping SLA", value: "24h" },
            ],
            highlights: [
              { title: "Păpușa Velvet", detail: "Best-seller hero product with price, CTA, and delivery promise." },
              { title: "Family bundle", detail: "Cross-sell card for accessories and gift wrapping." },
              { title: "Trust row", detail: "Quick delivery, secure checkout, and return policy messaging." },
            ],
            queue: [
              { name: "Păpușa Velvet", meta: "129 RON · 5-8 ani", status: "Top seller" },
              { name: "Casă de păpuși Mini", meta: "219 RON · Bundle", status: "Low stock" },
              { name: "Set haine pastel", meta: "49 RON · Add-on", status: "Cross-sell ready" },
            ],
          }
        : {
            pageTitle: options.story.previewTitle || "Project Runtime",
            pageSubtitle: options.story.previewDescription || "This workspace preview summarizes the generated implementation path.",
            primaryCta: "Review implementation",
            secondaryCta: "Open workspace",
            panelTitle: "Execution surface",
            panelDescription: "The generated page highlights the active story, operational metrics, and artifacts ready for review.",
            stats: [
              { label: "Outcome", value: primaryMetric },
              { label: "Scope", value: secondaryMetric },
              { label: "Stack", value: tertiaryMetric },
            ],
            highlights: [
              { title: "Brief", detail: objective },
              { title: "Feature", detail: options.feature.summary },
              { title: "Story", detail: options.story.summary },
            ],
            queue: [
              { name: options.feature.title, meta: options.story.title, status: "Ready for review" },
              { name: primaryMetric, meta: secondaryMetric, status: tertiaryMetric },
              { name: "Activity", meta: "Persistent workspace", status: "Synced" },
            ],
          }
  const folders: WorkspaceFolder[] = [
    { id: "folder-docs", name: "docs", path: "docs" },
    { id: "folder-specs", name: "specs", path: "specs" },
    { id: "folder-src", name: "src", path: "src" },
    { id: "folder-src-app", name: "app", path: "src/app" },
    { id: "folder-src-components", name: "components", path: "src/components" },
    { id: "folder-src-lib", name: "lib", path: "src/lib" },
  ]
  const files: WorkspaceFile[] = [
    {
      id: "file-brief",
      name: "project-brief.md",
      path: "docs/project-brief.md",
      content: `# ${appName}\n\n## Objective\n${objective}\n\n## Audience\n${options.brief.audience.map((item) => `- ${item}`).join("\n") || "- Define target audience"}\n\n## Scope\n${options.brief.scope.map((item) => `- ${item}`).join("\n") || "- Define scope"}\n`,
    },
    {
      id: "file-story",
      name: "selected-story.md",
      path: "specs/selected-story.md",
      content: `# ${options.story.id} ${options.story.title}\n\n## Summary\n${options.story.summary}\n\n## Tradeoff\n${options.story.tradeoff}\n`,
    },
    {
      id: "file-variant",
      name: "selected-variant.md",
      path: "specs/selected-variant.md",
      content: `# ${variant?.id || "VAR-DEFAULT"} ${variant?.label || "Selected Variant"}\n\n## Team\n${variant?.teamName || "Implementation team"}\n\n## Focus\n${variant?.focus || "Balanced implementation"}\n\n## Architecture\n${variant?.architecture || options.story.tradeoff}\n\n## Tradeoff\n${variant?.tradeoff || options.story.tradeoff}\n\n## Pros\n${(variant?.pros ?? []).map((item) => `- ${item}`).join("\n") || "- No explicit pros"}\n\n## Cons\n${(variant?.cons ?? []).map((item) => `- ${item}`).join("\n") || "- No explicit cons"}\n`,
    },
    {
      id: "file-story-implementation",
      name: "generated-implementation.ts",
      path: "specs/generated-implementation.ts",
      content: `${variant?.code || options.story.code}\n`,
    },
    {
      id: "file-layout",
      name: "layout.tsx",
      path: "src/app/layout.tsx",
      content: `export const appName = ${JSON.stringify(appName)}\nexport const appDescription = ${JSON.stringify(objective)}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return children\n}\n`,
    },
    {
      id: "file-page",
      name: "page.tsx",
      path: "src/app/page.tsx",
      content: `import { agentStatuses } from "@/components/agent-status"\nimport { experienceHighlights, experienceQueue, experienceStats, previewMeta } from "@/lib/preview-data"\n\nexport const heroTitle = ${JSON.stringify(experienceConfig.pageTitle)}\nexport const heroSubtitle = ${JSON.stringify(experienceConfig.pageSubtitle)}\nexport const primaryCta = ${JSON.stringify(experienceConfig.primaryCta)}\nexport const secondaryCta = ${JSON.stringify(experienceConfig.secondaryCta)}\nexport const stageItems = ${JSON.stringify(["Brief approved", options.feature.title, options.story.title, variant?.label || "Variant selected", "Preview generated"], null, 2)}\nexport const feedItems = ${JSON.stringify(feedItems, null, 2)}\n\nconst shellStyle = {\n  minHeight: "100vh",\n  padding: "32px",\n  background: "linear-gradient(180deg, #fff8f1 0%, #fffdf8 100%)",\n  color: "#1f2937",\n  fontFamily: "\"Space Grotesk\", \"Segoe UI\", sans-serif",\n}\n\nconst heroCardStyle = {\n  borderRadius: "28px",\n  padding: "28px",\n  background: "linear-gradient(135deg, #f97316 0%, #fb7185 100%)",\n  color: "white",\n  boxShadow: "0 24px 60px rgba(249, 115, 22, 0.22)",\n}\n\nconst statGridStyle = {\n  display: "grid",\n  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",\n  gap: "12px",\n  marginTop: "18px",\n}\n\nconst statCardStyle = {\n  borderRadius: "18px",\n  padding: "14px",\n  background: "rgba(255,255,255,0.18)",\n  backdropFilter: "blur(8px)",\n}\n\nconst contentGridStyle = {\n  display: "grid",\n  gridTemplateColumns: "1.2fr 0.8fr",\n  gap: "18px",\n  marginTop: "18px",\n}\n\nconst panelStyle = {\n  borderRadius: "24px",\n  border: "1px solid rgba(251, 113, 133, 0.16)",\n  background: "white",\n  padding: "22px",\n  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",\n}\n\nconst listCardStyle = {\n  borderRadius: "18px",\n  border: "1px solid rgba(15, 23, 42, 0.08)",\n  padding: "14px",\n  marginTop: "12px",\n  background: \"#fffaf5\",\n}\n\nexport default function Page() {\n  return (\n    <main style={shellStyle}>\n      <section style={heroCardStyle}>\n        <div style={{ fontSize: 12, letterSpacing: \"0.16em\", textTransform: \"uppercase\", opacity: 0.82 }}>\n          {previewMeta.experience} workspace · {previewMeta.variantLabel}\n        </div>\n        <h1 style={{ margin: \"12px 0 0\", fontSize: 42, lineHeight: 1.05 }}>{heroTitle}</h1>\n        <p style={{ margin: \"12px 0 0\", maxWidth: 760, fontSize: 16, lineHeight: 1.6 }}>{heroSubtitle}</p>\n        <div style={{ marginTop: 14, display: \"inline-flex\", borderRadius: 999, padding: \"8px 12px\", background: \"rgba(255,255,255,0.16)\", fontSize: 12 }}>\n          {previewMeta.variantFocus}\n        </div>\n        <div style={{ display: \"flex\", gap: 10, flexWrap: \"wrap\", marginTop: 18 }}>\n          <button style={{ border: 0, borderRadius: 999, padding: \"12px 18px\", background: \"#ffffff\", color: \"#c2410c\", fontWeight: 700 }}>{primaryCta}</button>\n          <button style={{ borderRadius: 999, padding: \"12px 18px\", background: \"transparent\", color: \"white\", border: \"1px solid rgba(255,255,255,0.35)\" }}>{secondaryCta}</button>\n        </div>\n        <div style={statGridStyle}>\n          {experienceStats.map((stat) => (\n            <article key={stat.label} style={statCardStyle}>\n              <div style={{ fontSize: 11, letterSpacing: \"0.08em\", textTransform: \"uppercase\", opacity: 0.8 }}>{stat.label}</div>\n              <strong style={{ display: \"block\", marginTop: 8, fontSize: 24 }}>{stat.value}</strong>\n            </article>\n          ))}\n        </div>\n      </section>\n\n      <section style={contentGridStyle}>\n        <div style={panelStyle}>\n          <div style={{ fontSize: 12, letterSpacing: \"0.14em\", textTransform: \"uppercase\", color: \"#9a3412\" }}>{previewMeta.panelTitle}</div>\n          <h2 style={{ margin: \"10px 0 0\", fontSize: 24 }}>{previewMeta.featureLabel}</h2>\n          <p style={{ margin: \"10px 0 0\", color: \"#4b5563\", lineHeight: 1.7 }}>{previewMeta.panelDescription}</p>\n          <div style={{ marginTop: 12, borderRadius: 16, padding: 14, background: \"#fff7ed\", color: \"#7c2d12\" }}>\n            <strong style={{ display: \"block\", fontSize: 13 }}>{previewMeta.variantLabel}</strong>\n            <p style={{ margin: \"6px 0 0\", lineHeight: 1.6 }}>{previewMeta.variantArchitecture}</p>\n          </div>\n          {experienceHighlights.map((item) => (\n            <article key={item.title} style={listCardStyle}>\n              <strong style={{ display: \"block\", fontSize: 15 }}>{item.title}</strong>\n              <p style={{ margin: \"6px 0 0\", color: \"#6b7280\", lineHeight: 1.6 }}>{item.detail}</p>\n            </article>\n          ))}\n        </div>\n\n        <div style={{ display: \"grid\", gap: 18 }}>\n          <section style={panelStyle}>\n            <div style={{ fontSize: 12, letterSpacing: \"0.14em\", textTransform: \"uppercase\", color: \"#9a3412\" }}>Live queue</div>\n            {experienceQueue.map((item) => (\n              <article key={item.name} style={listCardStyle}>\n                <strong style={{ display: \"block\", fontSize: 15 }}>{item.name}</strong>\n                <div style={{ marginTop: 6, color: \"#6b7280\", fontSize: 13 }}>{item.meta}</div>\n                <div style={{ marginTop: 10, display: \"inline-flex\", borderRadius: 999, background: \"#ffedd5\", color: \"#c2410c\", padding: \"6px 10px\", fontSize: 12 }}>{item.status}</div>\n              </article>\n            ))}\n          </section>\n\n          <section style={panelStyle}>\n            <div style={{ fontSize: 12, letterSpacing: \"0.14em\", textTransform: \"uppercase\", color: \"#9a3412\" }}>Agent coordination</div>\n            {agentStatuses.map((agent) => (\n              <article key={agent.name} style={listCardStyle}>\n                <strong style={{ display: \"block\", fontSize: 15 }}>{agent.name}</strong>\n                <div style={{ marginTop: 6, color: \"#6b7280\", fontSize: 13 }}>{agent.status}</div>\n              </article>\n            ))}\n          </section>\n        </div>\n      </section>\n    </main>\n  )\n}\n`,
    },
    {
      id: "file-component",
      name: "agent-status.tsx",
      path: "src/components/agent-status.tsx",
      content: `export const agentStatuses = ${JSON.stringify(
        [
          { name: "Business AI", status: "brief-ready" },
          { name: "Tech AI", status: "architecture-ready" },
          { name: "Orchestrator Agent", status: variant?.label ? `selected-${variant.label.toLowerCase().replace(/\s+/g, "-")}` : "story-selected" },
          { name: "Merge Agent", status: "awaiting-approval" },
        ],
        null,
        2
      )}\n`,
    },
    {
      id: "file-lib",
      name: "preview-data.ts",
      path: "src/lib/preview-data.ts",
      content: `export const previewMeta = {\n  title: ${JSON.stringify(options.story.previewTitle)},\n  feature: ${JSON.stringify(options.feature.id)},\n  status: "generated-from-brief",\n  experience: ${JSON.stringify(experience)},\n  panelTitle: ${JSON.stringify(experienceConfig.panelTitle)},\n  panelDescription: ${JSON.stringify(experienceConfig.panelDescription)},\n  featureLabel: ${JSON.stringify(options.feature.title)},\n  variantLabel: ${JSON.stringify(variant?.label || "Selected Variant")},\n  variantFocus: ${JSON.stringify(variant?.focus || "Balanced implementation")},\n  variantArchitecture: ${JSON.stringify(variant?.architecture || options.story.tradeoff)},\n}\n\nexport const experienceStats = ${JSON.stringify(experienceConfig.stats, null, 2)}\n\nexport const experienceHighlights = ${JSON.stringify(experienceConfig.highlights, null, 2)}\n\nexport const experienceQueue = ${JSON.stringify(experienceConfig.queue, null, 2)}\n`,
    },
  ]

  return {
    folders,
    files,
    runtimeEntrypoints: ["src/app/layout.tsx", "src/app/page.tsx"],
  }
}

async function requestJsonArray<T>(instructions: string, input: string): Promise<T[] | null> {
  const client = getOpenAIClient()
  if (!client) return null

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      instructions,
      input,
    })

    const parsed = safeJsonParse<T[]>(response.output_text)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function generateOpenAIReply(options: {
  channel: MessageChannel
  author: string
  message: string
  brief: BriefState
  history: Message[]
}) {
  const fallback = fallbackReply(options.channel, options.message, options.brief)
  const client = getOpenAIClient()

  if (!client) return fallback

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      instructions:
        "You are a general AI discovery assistant inside an AI-native SDLC IDE. The user is defining a production website. Reply in Romanian, in 2-4 short sentences. First confirm what you understood. Ask at most one simple follow-up question only if essential information is still missing for documentation. If enough information already exists, stop asking repetitive questions and instead briefly summarize what is now clear and say you can generate the documentation. If the user did not provide technical guidance, proactively recommend a suitable production stack and architecture. Keep the tone practical and concise.",
      input: `Project title: ${options.brief.title}
Project objective: ${options.brief.objective}
Speaker: ${options.author}
Channel: ${options.channel}
Recent conversation:
${recentHumanMessages(options.history)}

User message: ${options.message}`,
    })

    return response.output_text.trim() || fallback
  } catch {
    return fallback
  }
}

export async function generateBriefFromConversation(options: {
  currentBrief: BriefState
  businessMessages: Message[]
  techMessages: Message[]
}) {
  const fallback = fallbackBriefFromConversation(options.currentBrief, options.businessMessages, options.techMessages)
  const client = getOpenAIClient()
  if (!client) return fallback

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      instructions:
        "You turn a project discovery conversation into production-ready documentation for a website. Return ONLY valid JSON with the keys: title, objective, audience, scope, deliverables, risks, techStack, dbSchema, architecture. audience, scope, deliverables, risks, techStack must be arrays of short strings. Keep the content concise, specific, and usable for implementation planning. Prefer Romanian. If technical instructions are missing, proactively recommend a sensible production setup instead of leaving fields empty. Do not add markdown fences.",
      input: JSON.stringify({
        currentBrief: options.currentBrief,
        businessConversation: options.businessMessages.map((message) => ({
          role: message.role,
          author: message.author,
          text: message.text,
        })),
        technicalConversation: options.techMessages.map((message) => ({
          role: message.role,
          author: message.author,
          text: message.text,
        })),
      }),
    })

    const parsed = safeJsonParse<Partial<BriefState>>(response.output_text)
    if (!parsed) return fallback

    return {
      title: normalizeText(parsed.title || "") || fallback.title,
      objective: normalizeText(parsed.objective || "") || fallback.objective,
      audience: normalizeList(Array.isArray(parsed.audience) ? parsed.audience : fallback.audience),
      scope: normalizeList(Array.isArray(parsed.scope) ? parsed.scope : fallback.scope),
      deliverables: normalizeList(Array.isArray(parsed.deliverables) ? parsed.deliverables : fallback.deliverables),
      risks: normalizeList(Array.isArray(parsed.risks) ? parsed.risks : fallback.risks),
      techStack: normalizeList(Array.isArray(parsed.techStack) ? parsed.techStack : fallback.techStack),
      dbSchema: typeof parsed.dbSchema === "string" && parsed.dbSchema.trim() ? parsed.dbSchema.trim() : fallback.dbSchema,
      architecture:
        typeof parsed.architecture === "string" && parsed.architecture.trim()
          ? parsed.architecture.trim()
          : fallback.architecture,
    }
  } catch {
    return fallback
  }
}

export async function generateFeaturesFromBrief(brief: BriefState) {
  const fallback = fallbackFeatures(brief)
  const result = await requestJsonArray<{
    title?: string
    summary?: string
    preview?: string
    estimate?: "S" | "M" | "L" | "XL"
    complexityNote?: string
    dependencyIds?: string[]
    variations?: string[]
    acceptance?: string[]
  }>(
    "Return only JSON. Generate exactly 3 concrete product features for the provided project brief. Stay faithful to the user's actual domain and business goal. Each item must contain title, summary, preview, estimate, complexityNote, dependencyIds, variations, acceptance. estimate must be one of S, M, L, XL. Keep the content concise and in English.",
    JSON.stringify(brief)
  )

  if (!result) return fallback

  return result.slice(0, 3).map((item, index) => ({
    id: `FEAT-${String(index + 1).padStart(2, "0")}`,
    title: normalizeText(item.title || "") || fallback[index]?.title || `Feature ${index + 1}`,
    summary: normalizeText(item.summary || "") || fallback[index]?.summary || "",
    preview: normalizeText(item.preview || "") || fallback[index]?.preview || "Feature preview",
    estimate: item.estimate && ["S", "M", "L", "XL"].includes(item.estimate) ? item.estimate : fallback[index]?.estimate || "M",
    complexityNote: normalizeText(item.complexityNote || "") || fallback[index]?.complexityNote || "",
    dependencyIds: coerceStringArray(item.dependencyIds).slice(0, 3),
    variations: coerceStringArray(item.variations).slice(0, 3),
    acceptance: coerceStringArray(item.acceptance).slice(0, 3),
  }))
}

export async function generateStoriesFromFeature(feature: Feature, brief: BriefState) {
  const fallback = fallbackStories(feature, brief)
  const result = await requestJsonArray<{
    title?: string
    stack?: string
    summary?: string
    tradeoff?: string
    estimate?: "S" | "M" | "L" | "XL"
    complexityNote?: string
    dependencyIds?: string[]
    previewTitle?: string
    previewDescription?: string
    code?: string
    variants?: Array<{
      label?: string
      teamName?: string
      focus?: string
      architecture?: string
      pros?: string[]
      cons?: string[]
      tradeoff?: string
      code?: string
    }>
  }>(
    "Return only JSON. Generate exactly 3 implementation-ready user stories for the provided feature. Each item must contain title, stack, summary, tradeoff, estimate, complexityNote, dependencyIds, previewTitle, previewDescription, code, variants. variants must contain exactly 3 implementation options, each with label, teamName, focus, architecture, pros, cons, tradeoff, code. estimate must be one of S, M, L, XL. Keep code concise and valid TypeScript for a Next.js App Router codebase. Do not use pages/api, NextApiRequest, or NextApiResponse.",
    JSON.stringify({ brief, feature })
  )

  if (!result) return fallback

  return result.slice(0, 3).map((item, index) => ({
    id: `US-${String(index + 1).padStart(2, "0")}`,
    title: normalizeText(item.title || "") || fallback[index]?.title || `Story ${index + 1}`,
    stack: normalizeText(item.stack || "") || fallback[index]?.stack || "Next.js + OpenAI",
    summary: normalizeText(item.summary || "") || fallback[index]?.summary || "",
    tradeoff: normalizeText(item.tradeoff || "") || fallback[index]?.tradeoff || "",
    estimate: item.estimate && ["S", "M", "L", "XL"].includes(item.estimate) ? item.estimate : fallback[index]?.estimate || "M",
    complexityNote: normalizeText(item.complexityNote || "") || fallback[index]?.complexityNote || "",
    dependencyIds: coerceStringArray(item.dependencyIds).slice(0, 3),
    previewTitle: normalizeText(item.previewTitle || "") || fallback[index]?.previewTitle || "Preview",
    previewDescription:
      normalizeText(item.previewDescription || "") || fallback[index]?.previewDescription || "",
    code: item.code?.trim() || fallback[index]?.code || "",
    variants: ((Array.isArray(item.variants) ? item.variants : fallback[index]?.variants ?? []).slice(0, 3)).map((variant, variantIndex) => ({
      id: `US-${String(index + 1).padStart(2, "0")}-VAR-${String(variantIndex + 1).padStart(2, "0")}`,
      label: normalizeText(variant.label || "") || fallback[index]?.variants?.[variantIndex]?.label || `Variant ${variantIndex + 1}`,
      teamName: normalizeText(variant.teamName || "") || fallback[index]?.variants?.[variantIndex]?.teamName || `Team ${variantIndex + 1}`,
      focus: normalizeText(variant.focus || "") || fallback[index]?.variants?.[variantIndex]?.focus || "",
      architecture: normalizeText(variant.architecture || "") || fallback[index]?.variants?.[variantIndex]?.architecture || "",
      pros: coerceStringArray(variant.pros).slice(0, 3),
      cons: coerceStringArray(variant.cons).slice(0, 3),
      tradeoff: normalizeText(variant.tradeoff || "") || fallback[index]?.variants?.[variantIndex]?.tradeoff || "",
      code: variant.code?.trim() || fallback[index]?.variants?.[variantIndex]?.code || item.code?.trim() || fallback[index]?.code || "",
    })),
    selectedVariantId: `US-${String(index + 1).padStart(2, "0")}-VAR-02`,
  }))
}

export async function generateWorkspaceScaffold(options: {
  brief: BriefState
  feature: Feature
  story: UserStory
  variant?: StoryVariant
}) {
  const fallback = fallbackWorkspaceScaffold(options)
  const client = getOpenAIClient()
  if (!client) return fallback

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      instructions:
        "You are a senior AI-native IDE scaffold generator. Return ONLY valid JSON for a workspace scaffold. The JSON object must have folders, files, and runtimeEntrypoints arrays. Each folder needs id, name, path. Each file needs id, name, path, content. Use TypeScript or TSX for source files. The workspace should represent a small but real Next.js app with readable code and no markdown fences. Keep paths consistent and include src/app/layout.tsx, src/app/page.tsx, src/components/agent-status.tsx, and src/lib/preview-data.ts whenever possible. Never concatenate multiple virtual files into one file. Never include markers like // File:. Keep src/lib/preview-data.ts as plain data exports only.",
      input: JSON.stringify({
        brief: options.brief,
        feature: options.feature,
        story: options.story,
        variant: options.variant,
        requiredPaths: [
          "src/app/layout.tsx",
          "src/app/page.tsx",
          "src/components/agent-status.tsx",
          "src/lib/preview-data.ts",
        ],
      }),
    })

    const parsed = safeJsonParse<Partial<WorkspaceScaffold>>(response.output_text)
    if (!parsed) return fallback

    const folders = Array.isArray(parsed.folders)
      ? uniqueByPath(
          parsed.folders
            .map((folder, index) => {
              const path = normalizeText((folder as { path?: string }).path ?? "")
              return {
                id: normalizeText((folder as { id?: string }).id || `folder-ai-${index + 1}`),
                name: normalizeText((folder as { name?: string }).name || path.split("/").pop() || `folder-${index + 1}`),
                path,
              }
            })
            .filter((folder) => folder.path)
        )
      : []

    const files = Array.isArray(parsed.files)
      ? uniqueByPath(
          parsed.files
            .map((file, index) => {
              const path = normalizeText((file as { path?: string }).path ?? "")
              return {
                id: normalizeText((file as { id?: string }).id || `file-ai-${index + 1}`),
                name: normalizeText((file as { name?: string }).name || path.split("/").pop() || `file-${index + 1}`),
                path,
                content: typeof (file as { content?: unknown }).content === "string" ? ((file as { content?: string }).content ?? "") : "",
              }
            })
            .filter((file) => file.path && file.content.trim() && !looksLikeBrokenWorkspaceFile(file.path, file.content))
        )
      : []

    const runtimeEntrypoints = Array.isArray(parsed.runtimeEntrypoints)
      ? parsed.runtimeEntrypoints.map((item) => normalizeText(item)).filter(Boolean)
      : []

    const requiredPaths = new Set([
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/components/agent-status.tsx",
      "src/lib/preview-data.ts",
    ])
    const filePaths = new Set(files.map((file) => file.path))
    const hasRequiredFiles = [...requiredPaths].every((path) => filePaths.has(path))

    if (!folders.length || !files.length || !runtimeEntrypoints.length || !hasRequiredFiles) {
      return fallback
    }

    return {
      folders,
      files,
      runtimeEntrypoints,
    }
  } catch {
    return fallback
  }
}
