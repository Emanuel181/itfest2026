export type HackathonDoc = {
  title: string
  description: string
  audience: string
  features: string[]
  style: string
}

export type DesignOption = {
  name: string
  description: string
  colors: string[]
  vibe: string
}

type SectionType = "hero" | "cards" | "list" | "timeline" | "spotlight" | "form"

type SectionItem = {
  title: string
  description: string
  meta: string
  badge: string
  value: string
  status: string
}

type SiteCollectionItem = {
  id: string
  title: string
  category: string
  description: string
  metric: string
  status: string
  tags: string[]
}

type SiteCollection = {
  id: string
  name: string
  accent: string
  description: string
  items: SiteCollectionItem[]
}

type SiteSection = {
  id: string
  type: SectionType
  title: string
  description: string
  sourceCollectionId?: string
  items: SectionItem[]
}

type SitePage = {
  id: string
  label: string
  headline: string
  subheadline: string
  primaryCta: string
  secondaryCta: string
  sections: SiteSection[]
}

type SiteTheme = {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  panel: string
  text: string
  muted: string
}

type SiteActionSet = {
  primaryLabel: string
  secondaryLabel: string
  meetingLabel: string
  contactEmail: string
}

export type SiteBlueprint = {
  appName: string
  tagline: string
  description: string
  audience: string
  styleDirection: string
  theme: SiteTheme
  stats: Array<{ label: string; value: string }>
  collections: SiteCollection[]
  pages: SitePage[]
  actions: SiteActionSet
}

const allowedSectionTypes = new Set<SectionType>(["hero", "cards", "list", "timeline", "spotlight", "form"])

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
}

function slugify(value: string, fallback: string) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || fallback
}

function uniqueStrings(values: unknown[], limit = 8) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const value of values) {
    const normalized = normalizeText(value)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(normalized)

    if (next.length >= limit) break
  }

  return next
}

function isHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

function pickColor(value: unknown, fallback: string) {
  const normalized = normalizeText(value)
  return isHexColor(normalized) ? normalized : fallback
}

function deriveFeatures(doc: HackathonDoc) {
  const explicit = uniqueStrings(doc.features, 6)
  if (explicit.length > 0) return explicit

  const fallbackFromDescription = uniqueStrings(doc.description.split(/[.!?]/), 6)
  if (fallbackFromDescription.length > 0) return fallbackFromDescription

  return [
    "Clear value proposition above the fold",
    "Dedicated sections for capabilities and proof",
    "Interactive discovery and lead capture",
    "Operational dashboard with recent activity",
  ]
}

function createTheme(design?: DesignOption): SiteTheme {
  const colors = Array.isArray(design?.colors) ? design?.colors : []
  const primary = pickColor(colors?.[0], "#14b8a6")
  const secondary = pickColor(colors?.[1], "#f97316")
  const accent = pickColor(colors?.[2], "#38bdf8")

  return {
    primary,
    secondary,
    accent,
    background: "#07111b",
    surface: "#0d1725",
    panel: "rgba(15, 23, 37, 0.78)",
    text: "#e8f3ff",
    muted: "#90a7c2",
  }
}

function createContactEmail(title: string) {
  return `hello@${slugify(title, "luminescent-studio")}.studio`
}

function buildCapabilityCollection(features: string[]) {
  return features.map<SiteCollectionItem>((feature, index) => ({
    id: `capability-${index + 1}`,
    title: feature,
    category: index % 2 === 0 ? "Experience" : "Operations",
    description: `A dedicated surface for ${feature.toLowerCase()} with realistic content, reusable cards, and actionable calls to action.`,
    metric: index % 2 === 0 ? `${18 + index * 7}% lift` : `${3 + index} live flows`,
    status: index % 3 === 0 ? "Ready" : index % 3 === 1 ? "In review" : "Live",
    tags: uniqueStrings([feature.split(" ")[0], "interactive", "dynamic"], 3),
  }))
}

function buildOperationsCollection(features: string[]) {
  return features.slice(0, 5).map<SiteCollectionItem>((feature, index) => ({
    id: `ops-${index + 1}`,
    title: `${feature} workflow`,
    category: index % 2 === 0 ? "Queue" : "Automation",
    description: `Operational lane for ${feature.toLowerCase()}, enriched with health indicators, ownership, and next-step automation.`,
    metric: index % 2 === 0 ? `${6 + index} pending` : `${92 - index * 4}% healthy`,
    status: index % 3 === 0 ? "Attention" : index % 3 === 1 ? "Healthy" : "Queued",
    tags: uniqueStrings([feature, "ops", "signal"], 3),
  }))
}

function buildPages(doc: HackathonDoc, design: DesignOption | undefined, features: string[], title: string): SitePage[] {
  const description = normalizeText(doc.description) || "A polished web application with multiple dynamic views."
  const style = normalizeText(doc.style) || design?.description || "Editorial glassmorphism with strong contrast and layered motion."
  const audienceLine = normalizeText(doc.audience) || "Product teams, operators, and clients"
  const capabilities = buildCapabilityCollection(features)
  const operations = buildOperationsCollection(features)

  return [
    {
      id: "home",
      label: "Home",
      headline: `${title} brings the story, product, and conversion path into one cohesive runtime.`,
      subheadline: description,
      primaryCta: "Open live demo",
      secondaryCta: "Inspect sections",
      sections: [
        {
          id: "hero-home",
          type: "hero",
          title: "First impression",
          description: `${style} Built for ${audienceLine}.`,
          items: [
            { title: "Audience", description: audienceLine, meta: "Primary target", badge: "Context", value: "4 views", status: "Aligned" },
            { title: "Style direction", description: style, meta: "Visual system", badge: "Design", value: "High fidelity", status: "Ready" },
            { title: "Content system", description: "Reusable sections, dynamic cards, saved items, and persistent navigation.", meta: "Architecture", badge: "Runtime", value: "SPA", status: "Live" },
          ],
        },
        {
          id: "capabilities-overview",
          type: "cards",
          title: "Core capabilities",
          description: "Each card is backed by live data and can be opened, searched, and saved.",
          sourceCollectionId: "capabilities",
          items: [],
        },
        {
          id: "momentum",
          type: "timeline",
          title: "Momentum timeline",
          description: "The application ships with realistic workflow events instead of placeholder lorem ipsum.",
          items: operations.slice(0, 4).map((item, index) => ({
            title: item.title,
            description: item.description,
            meta: `Milestone ${index + 1}`,
            badge: item.category,
            value: item.metric,
            status: item.status,
          })),
        },
      ],
    },
    {
      id: "solutions",
      label: "Solutions",
      headline: "Multiple content-rich pages make the generated site feel closer to a real launch candidate.",
      subheadline: "This view mixes feature merchandising, proof, and progressive disclosure in a single controlled layout.",
      primaryCta: "Save top ideas",
      secondaryCta: "Filter content",
      sections: [
        {
          id: "spotlight-solutions",
          type: "spotlight",
          title: "Design spotlight",
          description: `${design?.name || "Signature concept"} tuned for ${audienceLine}.`,
          items: capabilities.slice(0, 1).map((item) => ({
            title: item.title,
            description: item.description,
            meta: design?.vibe || "High-impact",
            badge: "Featured",
            value: item.metric,
            status: item.status,
          })),
        },
        {
          id: "solution-grid",
          type: "cards",
          title: "Solution modules",
          description: "Reusable cards render from the shared application blueprint and support search instantly.",
          sourceCollectionId: "capabilities",
          items: [],
        },
        {
          id: "proof-list",
          type: "list",
          title: "Proof points",
          description: "Trust signals, outcomes, and implementation notes are rendered as an editorial stack.",
          items: capabilities.slice(0, 4).map((item, index) => ({
            title: `${item.title} proof`,
            description: `A concrete subsection highlighting ${item.title.toLowerCase()} with tailored copy and stronger calls to action.`,
            meta: index % 2 === 0 ? "Case study" : "Customer signal",
            badge: item.status,
            value: item.metric,
            status: "Visible",
          })),
        },
      ],
    },
    {
      id: "workspace",
      label: "Workspace",
      headline: "The dashboard page turns the static layout into a dynamic product workspace.",
      subheadline: "Saved items, health signals, form submissions, and modal details all update live in the browser.",
      primaryCta: "Review queue",
      secondaryCta: "Open modal",
      sections: [
        {
          id: "workspace-hero",
          type: "hero",
          title: "Control center",
          description: "The generated application includes a richer internal view, not only a marketing landing.",
          items: operations.slice(0, 3).map((item) => ({
            title: item.title,
            description: item.description,
            meta: item.category,
            badge: "Ops",
            value: item.metric,
            status: item.status,
          })),
        },
        {
          id: "operations-board",
          type: "cards",
          title: "Operational board",
          description: "Cards on this page simulate live queues, ownership, and workflow status.",
          sourceCollectionId: "operations",
          items: [],
        },
        {
          id: "review-lane",
          type: "list",
          title: "Review lane",
          description: "Stakeholder-ready notes surface the next approvals, blockers, and follow-up actions.",
          items: operations.slice(0, 4).map((item, index) => ({
            title: `${item.title} checkpoint`,
            description: `Checkpoint ${index + 1} turns ${item.title.toLowerCase()} into a visible review step with clear state.`,
            meta: "Review",
            badge: item.status,
            value: item.metric,
            status: item.category,
          })),
        },
      ],
    },
    {
      id: "contact",
      label: "Contact",
      headline: "A dedicated final page closes the loop with structured lead capture and next-step guidance.",
      subheadline: "The generated form is interactive and feeds the activity rail without reloading the document.",
      primaryCta: "Send request",
      secondaryCta: "Book workshop",
      sections: [
        {
          id: "contact-spotlight",
          type: "spotlight",
          title: "Conversion path",
          description: "Instead of ending on a dead footer, the app includes a guided final step with context.",
          items: [
            {
              title: "Strategy workshop",
              description: `Book a guided session for ${title} and translate the feature list into a realistic launch plan.`,
              meta: "Facilitated session",
              badge: "CTA",
              value: "45 min",
              status: "Open",
            },
          ],
        },
        {
          id: "contact-form",
          type: "form",
          title: "Request a tailored version",
          description: "The form submission is handled in-browser and updates the live activity feed immediately.",
          items: [],
        },
        {
          id: "contact-checklist",
          type: "timeline",
          title: "Next steps",
          description: "A compact timeline keeps the final page actionable and aligned with launch execution.",
          items: [
            { title: "Review blueprint", description: "Validate pages, sections, and dynamic collections.", meta: "Step 1", badge: "Blueprint", value: "Today", status: "Ready" },
            { title: "Tune brand system", description: "Refine palette, typography, and motion direction.", meta: "Step 2", badge: "Design", value: "This week", status: "Ready" },
            { title: "Ship implementation", description: "Move from generated runtime into production code.", meta: "Step 3", badge: "Build", value: "Sprint", status: "Planned" },
          ],
        },
      ],
    },
  ]
}

export function createBaseBlueprint(doc: HackathonDoc, design?: DesignOption): SiteBlueprint {
  const title = normalizeText(doc.title) || "Luminescent Studio"
  const features = deriveFeatures(doc)
  const theme = createTheme(design)

  return {
    appName: title,
    tagline: normalizeText(doc.style) || design?.vibe || "Cinematic multi-page SPA",
    description: normalizeText(doc.description) || "A richly styled website generator that outputs multiple dynamic views instead of a single static page.",
    audience: normalizeText(doc.audience) || "Product teams, operators, and customers",
    styleDirection:
      normalizeText(design?.description) ||
      normalizeText(doc.style) ||
      "Editorial glassmorphism, layered gradients, animated surfaces, and high-contrast navigation.",
    theme,
    stats: [
      { label: "Pages", value: "4" },
      { label: "Core modules", value: String(Math.max(features.length, 4)) },
      { label: "Dynamic widgets", value: "6" },
      { label: "Visual intensity", value: "High" },
    ],
    collections: [
      {
        id: "capabilities",
        name: "Capabilities",
        accent: theme.primary,
        description: "Feature modules rendered into multiple pages and dynamic cards.",
        items: buildCapabilityCollection(features),
      },
      {
        id: "operations",
        name: "Operations",
        accent: theme.secondary,
        description: "Operational signals, workflow lanes, and review checkpoints.",
        items: buildOperationsCollection(features),
      },
    ],
    pages: buildPages(doc, design, features, title),
    actions: {
      primaryLabel: "Launch walkthrough",
      secondaryLabel: "Save for later",
      meetingLabel: "Book workshop",
      contactEmail: createContactEmail(title),
    },
  }
}

function normalizeStat(raw: unknown, fallback: { label: string; value: string }, index: number) {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}

  return {
    label: normalizeText(value.label) || fallback.label || `Stat ${index + 1}`,
    value: normalizeText(value.value) || fallback.value || "Ready",
  }
}

function normalizeCollectionItem(raw: unknown, fallback: SiteCollectionItem, index: number): SiteCollectionItem {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}

  return {
    id: slugify(normalizeText(value.id) || normalizeText(value.title) || fallback.id, `item-${index + 1}`),
    title: normalizeText(value.title) || fallback.title,
    category: normalizeText(value.category) || fallback.category,
    description: normalizeText(value.description) || fallback.description,
    metric: normalizeText(value.metric) || fallback.metric,
    status: normalizeText(value.status) || fallback.status,
    tags: uniqueStrings(Array.isArray(value.tags) ? value.tags : fallback.tags, 4),
  }
}

function normalizeCollection(raw: unknown, fallback: SiteCollection, index: number): SiteCollection {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}
  const rawItems = Array.isArray(value.items) ? value.items : fallback.items

  return {
    id: slugify(normalizeText(value.id) || fallback.id, `collection-${index + 1}`),
    name: normalizeText(value.name) || fallback.name,
    accent: pickColor(value.accent, fallback.accent),
    description: normalizeText(value.description) || fallback.description,
    items: rawItems.slice(0, 8).map((item, itemIndex) =>
      normalizeCollectionItem(item, fallback.items[itemIndex] ?? fallback.items[0], itemIndex)
    ),
  }
}

function normalizeSectionItem(raw: unknown, fallback: SectionItem, index: number): SectionItem {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}

  return {
    title: normalizeText(value.title) || fallback.title || `Item ${index + 1}`,
    description: normalizeText(value.description) || fallback.description,
    meta: normalizeText(value.meta) || fallback.meta,
    badge: normalizeText(value.badge) || fallback.badge,
    value: normalizeText(value.value) || fallback.value,
    status: normalizeText(value.status) || fallback.status,
  }
}

function normalizeSection(raw: unknown, fallback: SiteSection, index: number): SiteSection {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}
  const requestedType = normalizeText(value.type) as SectionType
  const items = Array.isArray(value.items) ? value.items : fallback.items

  return {
    id: slugify(normalizeText(value.id) || fallback.id, `section-${index + 1}`),
    type: allowedSectionTypes.has(requestedType) ? requestedType : fallback.type,
    title: normalizeText(value.title) || fallback.title,
    description: normalizeText(value.description) || fallback.description,
    sourceCollectionId: normalizeText(value.sourceCollectionId) || fallback.sourceCollectionId,
    items: items.slice(0, 6).map((item, itemIndex) =>
      normalizeSectionItem(item, fallback.items[itemIndex] ?? fallback.items[0] ?? {
        title: `Item ${itemIndex + 1}`,
        description: "",
        meta: "",
        badge: "",
        value: "",
        status: "",
      }, itemIndex)
    ),
  }
}

function normalizePage(raw: unknown, fallback: SitePage, index: number): SitePage {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}
  const rawSections = Array.isArray(value.sections) ? value.sections : fallback.sections

  return {
    id: slugify(normalizeText(value.id) || fallback.id, `page-${index + 1}`),
    label: normalizeText(value.label) || fallback.label,
    headline: normalizeText(value.headline) || fallback.headline,
    subheadline: normalizeText(value.subheadline) || fallback.subheadline,
    primaryCta: normalizeText(value.primaryCta) || fallback.primaryCta,
    secondaryCta: normalizeText(value.secondaryCta) || fallback.secondaryCta,
    sections: rawSections.slice(0, 4).map((section, sectionIndex) =>
      normalizeSection(section, fallback.sections[sectionIndex] ?? fallback.sections[0], sectionIndex)
    ),
  }
}

export function normalizeBlueprint(raw: unknown, fallback: SiteBlueprint): SiteBlueprint {
  const value = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {}

  const rawCollections = Array.isArray(value.collections) ? value.collections : fallback.collections
  const collections = rawCollections.slice(0, 4).map((collection, index) =>
    normalizeCollection(collection, fallback.collections[index] ?? fallback.collections[0], index)
  )

  const rawPages = Array.isArray(value.pages) ? value.pages : fallback.pages
  const pages = rawPages.length >= 4
    ? rawPages.slice(0, 6).map((page, index) => normalizePage(page, fallback.pages[index] ?? fallback.pages[0], index))
    : fallback.pages

  const actionsValue =
    typeof value.actions === "object" && value.actions ? (value.actions as Record<string, unknown>) : {}

  return {
    appName: normalizeText(value.appName) || fallback.appName,
    tagline: normalizeText(value.tagline) || fallback.tagline,
    description: normalizeText(value.description) || fallback.description,
    audience: normalizeText(value.audience) || fallback.audience,
    styleDirection: normalizeText(value.styleDirection) || fallback.styleDirection,
    theme: {
      primary: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).primary : "", fallback.theme.primary),
      secondary: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).secondary : "", fallback.theme.secondary),
      accent: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).accent : "", fallback.theme.accent),
      background: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).background : "", fallback.theme.background),
      surface: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).surface : "", fallback.theme.surface),
      panel: normalizeText(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).panel : "") || fallback.theme.panel,
      text: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).text : "", fallback.theme.text),
      muted: pickColor(typeof value.theme === "object" && value.theme ? (value.theme as Record<string, unknown>).muted : "", fallback.theme.muted),
    },
    stats: (Array.isArray(value.stats) ? value.stats : fallback.stats)
      .slice(0, 6)
      .map((item, index) => normalizeStat(item, fallback.stats[index] ?? fallback.stats[0], index)),
    collections,
    pages,
    actions: {
      primaryLabel: normalizeText(actionsValue.primaryLabel) || fallback.actions.primaryLabel,
      secondaryLabel: normalizeText(actionsValue.secondaryLabel) || fallback.actions.secondaryLabel,
      meetingLabel: normalizeText(actionsValue.meetingLabel) || fallback.actions.meetingLabel,
      contactEmail: normalizeText(actionsValue.contactEmail) || fallback.actions.contactEmail,
    },
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function serializeJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}

function buildHtml(blueprint: SiteBlueprint) {
  return `<!DOCTYPE html>
<div class="generated-app">
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>
  <div class="ambient ambient-three"></div>

  <header class="topbar">
    <div class="brand-block">
      <div class="brand-kicker">Generated Runtime</div>
      <h1>${escapeHtml(blueprint.appName)}</h1>
      <p>${escapeHtml(blueprint.tagline)}</p>
    </div>

    <div class="toolbar-actions">
      <label class="search-shell">
        <span>Search</span>
        <input id="global-search" type="search" placeholder="Search cards, workflows, and proofs..." autocomplete="off" />
      </label>
      <button type="button" class="ghost-button" data-cta="meeting">${escapeHtml(blueprint.actions.meetingLabel)}</button>
      <button type="button" class="primary-button" data-cta="primary">${escapeHtml(blueprint.actions.primaryLabel)}</button>
    </div>
  </header>

  <div class="main-layout">
    <aside class="summary-rail">
      <section class="glass-card intro-card">
        <div class="section-kicker">Audience</div>
        <h2>${escapeHtml(blueprint.audience)}</h2>
        <p>${escapeHtml(blueprint.description)}</p>
      </section>

      <section class="glass-card">
        <div class="section-kicker">Live metrics</div>
        <div id="stats-strip" class="stats-strip"></div>
      </section>
    </aside>

    <main class="page-shell">
      <nav id="page-nav" class="page-nav" aria-label="Generated pages"></nav>
      <section id="page-stage" class="page-stage"></section>
    </main>

    <aside class="inspector-rail">
      <section class="glass-card">
        <div class="section-kicker">Saved items</div>
        <div id="saved-items" class="stack-list"></div>
      </section>

      <section class="glass-card">
        <div class="section-kicker">Activity feed</div>
        <div id="activity-feed" class="stack-list"></div>
      </section>
    </aside>
  </div>

  <div id="modal-root" class="modal-root" hidden></div>
  <div id="toast-stack" class="toast-stack" aria-live="polite"></div>
  <script id="app-blueprint" type="application/json">${serializeJson(blueprint)}</script>
</div>`
}

function buildCss(blueprint: SiteBlueprint) {
  return `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Instrument+Serif:ital@0;1&display=swap');

:root {
  --bg: ${blueprint.theme.background};
  --surface: ${blueprint.theme.surface};
  --panel: ${blueprint.theme.panel};
  --primary: ${blueprint.theme.primary};
  --secondary: ${blueprint.theme.secondary};
  --accent: ${blueprint.theme.accent};
  --text: ${blueprint.theme.text};
  --muted: ${blueprint.theme.muted};
  --line: rgba(148, 163, 184, 0.16);
  --shadow: 0 24px 60px rgba(3, 8, 18, 0.34);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at 15% 20%, rgba(20, 184, 166, 0.2), transparent 24%),
    radial-gradient(circle at 85% 12%, rgba(249, 115, 22, 0.16), transparent 22%),
    radial-gradient(circle at 50% 80%, rgba(56, 189, 248, 0.16), transparent 25%),
    linear-gradient(180deg, #050b12 0%, var(--bg) 100%);
  color: var(--text);
  font-family: "Space Grotesk", "Segoe UI", sans-serif;
}

body {
  min-height: 100vh;
}

.generated-app {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 28px;
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.35;
  pointer-events: none;
}

.ambient-one {
  width: 24rem;
  height: 24rem;
  left: -6rem;
  top: -3rem;
  background: color-mix(in srgb, var(--primary) 65%, transparent);
}

.ambient-two {
  width: 20rem;
  height: 20rem;
  right: -4rem;
  top: 4rem;
  background: color-mix(in srgb, var(--secondary) 68%, transparent);
}

.ambient-three {
  width: 22rem;
  height: 22rem;
  left: 50%;
  bottom: -7rem;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--accent) 62%, transparent);
}

.topbar,
.main-layout {
  position: relative;
  z-index: 1;
}

.topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
  margin-bottom: 22px;
}

.brand-block h1 {
  margin: 6px 0 0;
  font-size: clamp(2.1rem, 5vw, 3.8rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.brand-block p {
  max-width: 44rem;
  margin: 10px 0 0;
  color: color-mix(in srgb, var(--text) 76%, transparent);
  font-size: 1rem;
  line-height: 1.65;
}

.brand-kicker,
.section-kicker,
.pill,
.card-meta,
.timeline-meta,
.status-pill {
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.68rem;
}

.brand-kicker,
.section-kicker {
  color: var(--muted);
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.search-shell,
.glass-card,
.nav-pill,
.ghost-button,
.primary-button,
.card-button,
.modal-card {
  border: 1px solid var(--line);
  backdrop-filter: blur(18px);
}

.search-shell {
  display: grid;
  gap: 8px;
  min-width: min(100%, 18rem);
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(10, 18, 30, 0.68);
}

.search-shell span {
  color: var(--muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.search-shell input,
.form-grid input,
.form-grid textarea {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--text);
  font: inherit;
}

.search-shell input::placeholder,
.form-grid input::placeholder,
.form-grid textarea::placeholder {
  color: color-mix(in srgb, var(--muted) 88%, transparent);
}

.ghost-button,
.primary-button,
.card-button {
  cursor: pointer;
  border-radius: 999px;
  padding: 0.9rem 1.1rem;
  font: inherit;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.ghost-button {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
}

.primary-button,
.card-button {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  box-shadow: 0 12px 32px color-mix(in srgb, var(--primary) 24%, transparent);
}

.ghost-button:hover,
.primary-button:hover,
.card-button:hover,
.nav-pill:hover {
  transform: translateY(-1px);
}

.main-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 310px;
  gap: 18px;
  align-items: start;
}

.glass-card,
.page-view,
.modal-card {
  border-radius: 28px;
  background: rgba(7, 16, 28, 0.72);
  box-shadow: var(--shadow);
}

.glass-card {
  padding: 18px;
}

.intro-card h2 {
  margin: 10px 0 0;
  font-size: 1.35rem;
}

.intro-card p {
  margin: 10px 0 0;
  color: color-mix(in srgb, var(--text) 74%, transparent);
  line-height: 1.6;
}

.summary-rail,
.inspector-rail {
  display: grid;
  gap: 16px;
}

.stats-strip,
.stack-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.mini-stat,
.stack-item {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 18px;
  padding: 12px 13px;
  background: rgba(255, 255, 255, 0.03);
}

.mini-stat strong,
.stack-item strong {
  display: block;
  font-size: 0.95rem;
}

.mini-stat span,
.stack-item span {
  display: block;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.78rem;
}

.page-shell {
  display: grid;
  gap: 14px;
}

.page-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.nav-pill {
  cursor: pointer;
  border-radius: 999px;
  padding: 0.78rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  color: color-mix(in srgb, var(--text) 82%, transparent);
  font: inherit;
}

.nav-pill.is-active {
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 70%, transparent), color-mix(in srgb, var(--accent) 70%, transparent));
  color: white;
  box-shadow: 0 12px 30px color-mix(in srgb, var(--primary) 18%, transparent);
}

.page-stage {
  display: grid;
}

.page-view {
  display: none;
  padding: 22px;
  gap: 18px;
}

.page-view.is-active {
  display: grid;
  animation: fade-up 220ms ease;
}

.page-header {
  display: grid;
  gap: 10px;
}

.page-header h2 {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.8rem);
  line-height: 1.02;
  letter-spacing: -0.045em;
}

.page-header p {
  margin: 0;
  color: color-mix(in srgb, var(--text) 75%, transparent);
  line-height: 1.65;
}

.hero-grid,
.cards-grid,
.two-column,
.timeline-list {
  display: grid;
  gap: 14px;
}

.hero-grid {
  grid-template-columns: 1.35fr 0.85fr;
}

.hero-panel,
.spotlight-panel,
.card,
.timeline-item,
.contact-panel {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
}

.hero-panel {
  padding: 22px;
  overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--primary) 24%, rgba(255, 255, 255, 0.04)), rgba(255, 255, 255, 0.02)),
    rgba(255, 255, 255, 0.04);
}

.hero-panel h3,
.spotlight-panel h3 {
  margin: 10px 0 0;
  font-size: 1.5rem;
}

.hero-panel p,
.spotlight-panel p,
.card p,
.timeline-item p,
.contact-panel p {
  color: color-mix(in srgb, var(--text) 74%, transparent);
  line-height: 1.65;
}

.hero-actions,
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.cards-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  display: grid;
  gap: 12px;
  padding: 18px;
}

.card-topline,
.timeline-topline {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.card h4,
.timeline-item h4,
.stack-item strong {
  margin: 0;
  font-size: 1rem;
}

.pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 0.5rem 0.75rem;
}

.pill {
  background: color-mix(in srgb, var(--secondary) 18%, transparent);
  color: white;
}

.status-pill {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  color: color-mix(in srgb, white 84%, var(--text));
}

.card-meta,
.timeline-meta {
  color: var(--muted);
}

.card-value {
  font-size: 1.2rem;
  font-weight: 700;
}

.timeline-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.timeline-item,
.contact-panel {
  padding: 18px;
}

.spotlight-panel {
  padding: 22px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 28%, transparent), transparent 38%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
}

.contact-panel {
  display: grid;
  gap: 14px;
}

.form-grid {
  display: grid;
  gap: 12px;
}

.form-grid textarea {
  min-height: 130px;
  resize: vertical;
}

.form-field {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.modal-root[hidden] {
  display: none;
}

.modal-root {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(3, 8, 18, 0.62);
  backdrop-filter: blur(16px);
}

.modal-card {
  width: min(720px, 100%);
  padding: 24px;
}

.modal-card h3 {
  margin: 8px 0 0;
  font-size: 1.6rem;
}

.toast-stack {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 30;
  display: grid;
  gap: 12px;
}

.toast {
  min-width: 220px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(7, 16, 28, 0.9);
  color: var(--text);
  box-shadow: var(--shadow);
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1200px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .summary-rail,
  .inspector-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .generated-app {
    padding: 16px;
  }

  .topbar {
    grid-template-columns: 1fr;
  }

  .summary-rail,
  .inspector-rail,
  .hero-grid,
  .cards-grid,
  .timeline-list {
    grid-template-columns: 1fr;
  }

  .toolbar-actions {
    justify-content: stretch;
  }

  .toolbar-actions > * {
    width: 100%;
  }
}`
}

function buildJavascript() {
  return [
    "const blueprintNode = document.getElementById('app-blueprint');",
    "if (!blueprintNode) {",
    "  throw new Error('Missing application blueprint.');",
    "}",
    "",
    "const blueprint = JSON.parse(blueprintNode.textContent || '{}');",
    "const storageKey = 'luminescent-hackathon-saved';",
    "const activityKey = 'luminescent-hackathon-activity';",
    "const state = {",
    "  activePage: window.location.hash.replace('#', '') || (blueprint.pages[0] && blueprint.pages[0].id) || 'home',",
    "  query: '',",
    "  savedIds: new Set(readStorage(storageKey)),",
    "  activity: readStorage(activityKey),",
    "  modalItemId: '',",
    "  toasts: [],",
    "};",
    "",
    "const pageNav = document.getElementById('page-nav');",
    "const pageStage = document.getElementById('page-stage');",
    "const statsStrip = document.getElementById('stats-strip');",
    "const savedItems = document.getElementById('saved-items');",
    "const activityFeed = document.getElementById('activity-feed');",
    "const modalRoot = document.getElementById('modal-root');",
    "const toastStack = document.getElementById('toast-stack');",
    "const searchInput = document.getElementById('global-search');",
    "",
    "function readStorage(key) {",
    "  try {",
    "    const raw = window.localStorage.getItem(key);",
    "    return raw ? JSON.parse(raw) : [];",
    "  } catch {",
    "    return [];",
    "  }",
    "}",
    "",
    "function writeStorage(key, value) {",
    "  try {",
    "    window.localStorage.setItem(key, JSON.stringify(value));",
    "  } catch {}",
    "}",
    "",
    "function escapeHtml(value) {",
    "  return String(value ?? '')",
    "    .replace(/&/g, '&amp;')",
    "    .replace(/</g, '&lt;')",
    "    .replace(/>/g, '&gt;')",
    "    .replace(/\\\"/g, '&quot;')",
    "    .replace(/'/g, '&#39;');",
    "}",
    "",
    "function getCollection(id) {",
    "  return blueprint.collections.find(function(collection) { return collection.id === id; });",
    "}",
    "",
    "function allItems() {",
    "  return blueprint.collections.flatMap(function(collection) { return collection.items || []; });",
    "}",
    "",
    "function findItem(itemId) {",
    "  return allItems().find(function(item) { return item.id === itemId; });",
    "}",
    "",
    "function itemMatchesQuery(item) {",
    "  const q = state.query.trim().toLowerCase();",
    "  if (!q) return true;",
    "  const haystack = [item.title, item.category, item.description, item.metric].concat(item.tags || []).join(' ').toLowerCase();",
    "  return haystack.includes(q);",
    "}",
    "",
    "function sectionItems(section) {",
    "  if (section.sourceCollectionId) {",
    "    const collection = getCollection(section.sourceCollectionId);",
    "    const items = (collection && collection.items) || [];",
    "    return items.filter(itemMatchesQuery).map(function(item) {",
    "      return {",
    "        id: item.id,",
    "        title: item.title,",
    "        description: item.description,",
    "        meta: item.category,",
    "        badge: item.status,",
    "        value: item.metric,",
    "        status: (item.tags || []).join(' • '),",
    "      };",
    "    });",
    "  }",
    "",
    "  return (section.items || []).filter(function(item) {",
    "    if (!state.query.trim()) return true;",
    "    const haystack = [item.title, item.description, item.meta, item.badge, item.value, item.status].join(' ').toLowerCase();",
    "    return haystack.includes(state.query.trim().toLowerCase());",
    "  }).map(function(item, index) {",
    "    return Object.assign({ id: section.id + '-item-' + index }, item);",
    "  });",
    "}",
    "",
    "function renderStats() {",
    "  statsStrip.innerHTML = (blueprint.stats || []).map(function(stat) {",
    "    return `<article class=\"mini-stat\"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span></article>`;",
    "  }).join('');",
    "}",
    "",
    "function renderNav() {",
    "  pageNav.innerHTML = blueprint.pages.map(function(page) {",
    "    const isActive = page.id === state.activePage;",
    "    return `<button type=\"button\" class=\"nav-pill ${isActive ? 'is-active' : ''}\" data-nav=\"${escapeHtml(page.id)}\">${escapeHtml(page.label)}</button>`;",
    "  }).join('');",
    "}",
    "",
    "function renderHero(section, page) {",
    "  const items = sectionItems(section).slice(0, 3);",
    "  return `",
    "    <section class=\"hero-grid\">",
    "      <article class=\"hero-panel\">",
    "        <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "        <h3>${escapeHtml(page.headline)}</h3>",
    "        <p>${escapeHtml(page.subheadline)}</p>",
    "        <div class=\"hero-actions\">",
    "          <button type=\"button\" class=\"primary-button\" data-cta=\"primary\">${escapeHtml(page.primaryCta)}</button>",
    "          <button type=\"button\" class=\"ghost-button\" data-cta=\"secondary\">${escapeHtml(page.secondaryCta)}</button>",
    "        </div>",
    "      </article>",
    "      <article class=\"hero-panel\">",
    "        <div class=\"section-kicker\">${escapeHtml(section.description)}</div>",
    "        ${items.map(function(item) {",
    "          return `<div class=\"stack-item\"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)} • ${escapeHtml(item.value)}</span></div>`;",
    "        }).join('')}",
    "      </article>",
    "    </section>`;",
    "}",
    "",
    "function renderCards(section) {",
    "  const items = sectionItems(section);",
    "  return `",
    "    <section class=\"two-column\">",
    "      <div>",
    "        <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "        <p>${escapeHtml(section.description)}</p>",
    "      </div>",
    "      <div class=\"cards-grid\">",
    "        ${items.length ? items.map(function(item) {",
    "          const isSaved = state.savedIds.has(item.id);",
    "          return `<article class=\"card\">",
    "            <div class=\"card-topline\">",
    "              <span class=\"pill\">${escapeHtml(item.badge || item.meta || 'Live')}</span>",
    "              <span class=\"status-pill\">${escapeHtml(item.status || 'Visible')}</span>",
    "            </div>",
    "            <div>",
    "              <h4>${escapeHtml(item.title)}</h4>",
    "              <p>${escapeHtml(item.description)}</p>",
    "            </div>",
    "            <div class=\"card-meta\">${escapeHtml(item.meta || 'Dynamic section')}</div>",
    "            <div class=\"card-value\">${escapeHtml(item.value || 'Ready')}</div>",
    "            <div class=\"card-actions\">",
    "              <button type=\"button\" class=\"ghost-button\" data-open-item=\"${escapeHtml(item.id)}\">Open</button>",
    "              <button type=\"button\" class=\"card-button\" data-save-item=\"${escapeHtml(item.id)}\">${isSaved ? 'Saved' : 'Save item'}</button>",
    "            </div>",
    "          </article>`;",
    "        }).join('') : '<article class=\"card\"><h4>No matching results</h4><p>Try another search query to reveal more modules.</p></article>'}",
    "      </div>",
    "    </section>`;",
    "}",
    "",
    "function renderList(section) {",
    "  const items = sectionItems(section);",
    "  return `",
    "    <section class=\"glass-card\">",
    "      <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "      <p>${escapeHtml(section.description)}</p>",
    "      <div class=\"stack-list\">",
    "        ${items.map(function(item) {",
    "          return `<article class=\"stack-item\"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)} • ${escapeHtml(item.value)} • ${escapeHtml(item.status)}</span></article>`;",
    "        }).join('')}",
    "      </div>",
    "    </section>`;",
    "}",
    "",
    "function renderTimeline(section) {",
    "  const items = sectionItems(section);",
    "  return `",
    "    <section>",
    "      <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "      <p>${escapeHtml(section.description)}</p>",
    "      <div class=\"timeline-list\">",
    "        ${items.map(function(item) {",
    "          return `<article class=\"timeline-item\"><div class=\"timeline-topline\"><span class=\"pill\">${escapeHtml(item.meta || 'Step')}</span><span class=\"timeline-meta\">${escapeHtml(item.value || '')}</span></div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.description)}</p></article>`;",
    "        }).join('')}",
    "      </div>",
    "    </section>`;",
    "}",
    "",
    "function renderSpotlight(section) {",
    "  const items = sectionItems(section);",
    "  const lead = items[0] || { title: section.title, description: section.description, meta: 'Featured', badge: 'Spotlight', value: 'Live', status: 'Ready' };",
    "  return `",
    "    <section class=\"spotlight-panel\">",
    "      <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "      <h3>${escapeHtml(lead.title)}</h3>",
    "      <p>${escapeHtml(lead.description)}</p>",
    "      <div class=\"hero-actions\">",
    "        <span class=\"pill\">${escapeHtml(lead.meta || lead.badge)}</span>",
    "        <span class=\"status-pill\">${escapeHtml(lead.value || lead.status)}</span>",
    "      </div>",
    "    </section>`;",
    "}",
    "",
    "function renderForm(section) {",
    "  return `",
    "    <section class=\"contact-panel\">",
    "      <div class=\"section-kicker\">${escapeHtml(section.title)}</div>",
    "      <p>${escapeHtml(section.description)}</p>",
    "      <form class=\"form-grid\" data-contact-form>",
    "        <label class=\"form-field\"><span>Name</span><input name=\"name\" placeholder=\"Alexandra Pop\" required /></label>",
    "        <label class=\"form-field\"><span>Email</span><input name=\"email\" type=\"email\" placeholder=\"team@company.com\" required /></label>",
    "        <label class=\"form-field\"><span>Project brief</span><textarea name=\"message\" placeholder=\"Describe the extra sections, flows, and interactions you want.\"></textarea></label>",
    "        <button type=\"submit\" class=\"primary-button\">${escapeHtml(blueprint.actions.primaryLabel)}</button>",
    "      </form>",
    "    </section>`;",
    "}",
    "",
    "function renderSection(section, page) {",
    "  switch (section.type) {",
    "    case 'hero': return renderHero(section, page);",
    "    case 'cards': return renderCards(section);",
    "    case 'list': return renderList(section);",
    "    case 'timeline': return renderTimeline(section);",
    "    case 'spotlight': return renderSpotlight(section);",
    "    case 'form': return renderForm(section);",
    "    default: return renderCards(section);",
    "  }",
    "}",
    "",
    "function renderPages() {",
    "  pageStage.innerHTML = blueprint.pages.map(function(page) {",
    "    const isActive = page.id === state.activePage;",
    "    return `<section id=\"page-${escapeHtml(page.id)}\" class=\"page-view ${isActive ? 'is-active' : ''}\">",
    "      <header class=\"page-header\">",
    "        <div class=\"section-kicker\">${escapeHtml(page.label)}</div>",
    "        <h2>${escapeHtml(page.headline)}</h2>",
    "        <p>${escapeHtml(page.subheadline)}</p>",
    "      </header>",
    "      ${page.sections.map(function(section) { return renderSection(section, page); }).join('')}",
    "    </section>`;",
    "  }).join('');",
    "}",
    "",
    "function renderSavedItems() {",
    "  const items = Array.from(state.savedIds).map(findItem).filter(Boolean);",
    "  savedItems.innerHTML = items.length ? items.map(function(item) {",
    "    return `<article class=\"stack-item\"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.metric)} • ${escapeHtml(item.status)}</span></article>`;",
    "  }).join('') : '<article class=\"stack-item\"><strong>No saved items yet</strong><span>Use Save item on any card to pin it here.</span></article>';",
    "}",
    "",
    "function renderActivity() {",
    "  activityFeed.innerHTML = state.activity.length ? state.activity.slice(0, 6).map(function(entry) {",
    "    return `<article class=\"stack-item\"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.meta)}</span></article>`;",
    "  }).join('') : '<article class=\"stack-item\"><strong>Fresh runtime</strong><span>Search, save, and submit the form to generate activity.</span></article>';",
    "}",
    "",
    "function renderModal() {",
    "  const item = state.modalItemId ? findItem(state.modalItemId) : null;",
    "  if (!item) {",
    "    modalRoot.hidden = true;",
    "    modalRoot.innerHTML = '';",
    "    return;",
    "  }",
    "",
    "  modalRoot.hidden = false;",
    "  modalRoot.innerHTML = `<div class=\"modal-card\"><div class=\"section-kicker\">${escapeHtml(item.category)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class=\"hero-actions\"><span class=\"pill\">${escapeHtml(item.metric)}</span><span class=\"status-pill\">${escapeHtml(item.status)}</span></div><div class=\"card-actions\"><button type=\"button\" class=\"ghost-button\" data-close-modal=\"true\">Close</button><button type=\"button\" class=\"primary-button\" data-save-item=\"${escapeHtml(item.id)}\">${state.savedIds.has(item.id) ? 'Saved' : 'Save item'}</button></div></div>`;",
    "}",
    "",
    "function renderToasts() {",
    "  toastStack.innerHTML = state.toasts.map(function(toast) {",
    "    return `<div class=\"toast\">${escapeHtml(toast)}</div>`;",
    "  }).join('');",
    "}",
    "",
    "function pushToast(message) {",
    "  state.toasts = [message].concat(state.toasts).slice(0, 3);",
    "  renderToasts();",
    "  window.setTimeout(function() {",
    "    state.toasts = state.toasts.filter(function(entry) { return entry !== message; });",
    "    renderToasts();",
    "  }, 2200);",
    "}",
    "",
    "function pushActivity(title, meta) {",
    "  state.activity = [{ title: title, meta: meta }].concat(state.activity).slice(0, 8);",
    "  writeStorage(activityKey, state.activity);",
    "  renderActivity();",
    "}",
    "",
    "function saveItem(itemId) {",
    "  if (state.savedIds.has(itemId)) {",
    "    state.savedIds.delete(itemId);",
    "    pushToast('Item removed from saved list');",
    "  } else {",
    "    state.savedIds.add(itemId);",
    "    const item = findItem(itemId);",
    "    pushToast((item && item.title) ? item.title + ' saved' : 'Item saved');",
    "  }",
    "",
    "  writeStorage(storageKey, Array.from(state.savedIds));",
    "  renderSavedItems();",
    "  renderPages();",
    "  renderModal();",
    "}",
    "",
    "function setActivePage(pageId) {",
    "  if (!blueprint.pages.some(function(page) { return page.id === pageId; })) return;",
    "  state.activePage = pageId;",
    "  window.location.hash = pageId;",
    "  renderNav();",
    "  renderPages();",
    "}",
    "",
    "function renderApp() {",
    "  renderStats();",
    "  renderNav();",
    "  renderPages();",
    "  renderSavedItems();",
    "  renderActivity();",
    "  renderModal();",
    "  renderToasts();",
    "}",
    "",
    "document.addEventListener('click', function(event) {",
    "  const target = event.target instanceof Element ? event.target.closest('[data-nav], [data-open-item], [data-save-item], [data-close-modal], [data-cta]') : null;",
    "  if (!target) return;",
    "",
    "  if (target.hasAttribute('data-nav')) {",
    "    setActivePage(target.getAttribute('data-nav') || 'home');",
    "    return;",
    "  }",
    "",
    "  if (target.hasAttribute('data-open-item')) {",
    "    state.modalItemId = target.getAttribute('data-open-item') || '';",
    "    renderModal();",
    "    return;",
    "  }",
    "",
    "  if (target.hasAttribute('data-save-item')) {",
    "    saveItem(target.getAttribute('data-save-item') || '');",
    "    return;",
    "  }",
    "",
    "  if (target.hasAttribute('data-close-modal')) {",
    "    state.modalItemId = '';",
    "    renderModal();",
    "    return;",
    "  }",
    "",
    "  if (target.hasAttribute('data-cta')) {",
    "    const action = target.getAttribute('data-cta');",
    "    if (action === 'meeting') {",
    "      pushToast('Workshop request staged');",
    "      pushActivity('Workshop staged', blueprint.actions.contactEmail);",
    "      setActivePage('contact');",
    "    } else if (action === 'secondary') {",
    "      pushToast('Explore the next page for more detail');",
    "      const activeIndex = blueprint.pages.findIndex(function(page) { return page.id === state.activePage; });",
    "      const nextPage = blueprint.pages[(activeIndex + 1) % blueprint.pages.length];",
    "      setActivePage(nextPage.id);",
    "    } else {",
    "      pushToast('Primary CTA activated');",
    "      pushActivity('Demo launched', blueprint.appName);",
    "    }",
    "  }",
    "});",
    "",
    "document.addEventListener('submit', function(event) {",
    "  const form = event.target instanceof HTMLFormElement && event.target.matches('[data-contact-form]') ? event.target : null;",
    "  if (!form) return;",
    "",
    "  event.preventDefault();",
    "  const formData = new FormData(form);",
    "  const name = String(formData.get('name') || 'Guest');",
    "  const email = String(formData.get('email') || blueprint.actions.contactEmail);",
    "  pushToast('Request saved to live activity');",
    "  pushActivity('Lead captured', name + ' • ' + email);",
    "  form.reset();",
    "});",
    "",
    "searchInput.addEventListener('input', function(event) {",
    "  const target = event.target;",
    "  state.query = target && 'value' in target ? String(target.value || '') : '';",
    "  renderPages();",
    "});",
    "",
    "window.addEventListener('hashchange', function() {",
    "  const next = window.location.hash.replace('#', '');",
    "  if (next) {",
    "    state.activePage = next;",
    "    renderNav();",
    "    renderPages();",
    "  }",
    "});",
    "",
    "renderApp();",
  ].join("\n")
}

export function buildGeneratedApp(blueprint: SiteBlueprint) {
  return {
    html: buildHtml(blueprint),
    css: buildCss(blueprint),
    js: buildJavascript(),
  }
}

export function extractBlueprintFromHtml(html: string) {
  const match = html.match(new RegExp('<script id="app-blueprint" type="application/json">([\\\\s\\\\S]*?)<\\\\/script>', "i"))
  if (!match) return null

  try {
    return JSON.parse(match[1]) as SiteBlueprint
  } catch {
    return null
  }
}
