import path from "node:path"
import OpenAI from "openai"

import type { ProjectState, WorkspaceFile } from "@/lib/backend/types"

type WorkspacePlugin = {
  name: string
  setup: (buildApi: {
    onResolve: (
      options: { filter: RegExp },
      callback: (args: { path: string; resolveDir: string }) => unknown
    ) => void
    onLoad: (
      options: { filter: RegExp; namespace?: string },
      callback: (args: { path: string }) => unknown
    ) => void
  }) => void
}

type BuildApi = {
  onResolve: (
    options: { filter: RegExp },
    callback: (args: { path: string; resolveDir: string }) => unknown
  ) => void
  onLoad: (
    options: { filter: RegExp; namespace?: string },
    callback: (args: { path: string }) => unknown
  ) => void
}

type PreviewBundle = {
  js: string
  css: string
  entrypoint: string
  mode: "workspace" | "fallback"
}

const previewCache = new Map<string, string>()
const PREVIEW_CACHE_VERSION = "browser-runtime-v1"
let cachedPreviewClient: OpenAI | null = null

function getPreviewOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  if (!cachedPreviewClient) {
    cachedPreviewClient = new OpenAI({ apiKey })
  }

  return cachedPreviewClient
}

function normalizePreviewText(value: string) {
  return value.trim().replace(/\s+/g, " ")
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

function detectPreviewExperience(project: ProjectState) {
  const source = [
    project.brief.title,
    project.brief.objective,
    project.brief.architecture,
    ...project.brief.scope,
    ...project.brief.deliverables,
  ]
    .join(" ")
    .toLowerCase()

  if (/(magazin|shop|store|commerce|checkout|catalog|stripe|cart|produs|produse)/.test(source)) return "commerce"
  if (/(prezentare|landing|portfolio|servicii|showcase|brand|firma|company)/.test(source)) return "presentation"
  if (/(dashboard|admin|analytics|raport|backoffice|kpi|metrics)/.test(source)) return "dashboard"
  return "platform"
}

function synthesizePreviewWorkspaceFiles(project: ProjectState): WorkspaceFile[] {
  const selectedStory =
    project.userStories.find((story) => story.id === project.selectedStoryId) ??
    project.userStories[0]
  const selectedVariant =
    selectedStory?.variants.find((variant) => variant.id === selectedStory.selectedVariantId) ??
    selectedStory?.variants[0]
  const experience = detectPreviewExperience(project)

  const title = project.brief.title.trim() || selectedStory?.title || "Generated Website"
  const objective =
    project.brief.objective.trim() ||
    selectedStory?.summary ||
    "A generated application preview based on the current project brief."
  const audience = project.brief.audience.filter(Boolean)
  const scope = project.brief.scope.filter(Boolean)
  const deliverables = project.brief.deliverables.filter(Boolean)
  const techStack = project.brief.techStack.filter(Boolean)
  const architecture = project.brief.architecture.trim() || selectedVariant?.architecture || "Preview generated from the current brief and implementation context."
  const previewLabel =
    experience === "presentation"
      ? "Presentation website preview"
      : experience === "dashboard"
        ? "Dashboard preview"
        : experience === "commerce"
          ? "Commerce preview"
          : "Platform preview"
  const navItems =
    experience === "presentation"
      ? ["Acasa", "Despre", "Servicii", "Portofoliu", "Contact"]
      : experience === "dashboard"
        ? ["Overview", "Analytics", "Workflows", "Users", "Settings"]
        : experience === "commerce"
          ? ["Acasa", "Catalog", "Checkout", "Admin", "AI Support"]
          : ["Acasa", "Produs", "Module", "Admin", "Support"]
  const products = [
    {
      name: "Set cuburi creative",
      price: "79 RON",
      badge: "Best seller",
      detail: scope[0] || "Filtrare rapida pe categorii si varsta.",
      rating: "4.9",
      seller: "ToyCraft Studio",
      stock: "24 in stoc",
    },
    {
      name: "Joc educativ STEM",
      price: "129 RON",
      badge: "Nou",
      detail: scope[1] || "Checkout simplu cu plata securizata.",
      rating: "4.8",
      seller: "Micul Inventator",
      stock: "11 in stoc",
    },
    {
      name: "Puzzle premium",
      price: "59 RON",
      badge: "Livrare 24h",
      detail: scope[2] || "Panou admin pentru stoc si comenzi.",
      rating: "4.7",
      seller: "Puzzle Atelier",
      stock: "58 in stoc",
    },
  ]
  const categories =
    experience === "presentation"
      ? ["Hero", "Servicii", "Beneficii", "Testimoniale", "FAQ", "Contact"]
      : ["0-3 ani", "STEM", "Puzzle", "Jocuri educative", "Lemn premium", "Cadouri"]
  const stats = [
    { label: "Comenzi azi", value: "148" },
    { label: "Vanzatori activi", value: "42" },
    { label: "Conversie checkout", value: "5.4%" },
    { label: "Timp raspuns AI", value: "12 sec" },
  ]
  const cartItems =
    experience === "presentation"
      ? [
          { name: "Cerere demo", qty: 1, price: "Lead" },
          { name: "Consultatie", qty: 1, price: "CTA" },
        ]
      : [
          { name: "Set cuburi creative", qty: 1, price: "79 RON" },
          { name: "Joc educativ STEM", qty: 1, price: "129 RON" },
        ]
  const adminMetrics =
    experience === "presentation"
      ? [
          { label: "Sectiuni", value: "6" },
          { label: "CTA-uri", value: "3" },
          { label: "Testimoniale", value: "4" },
          { label: "Lead forms", value: "2" },
        ]
      : [
          { label: "Produse publicate", value: "312" },
          { label: "Comenzi in procesare", value: "27" },
          { label: "Rute livrare", value: "8" },
          { label: "Abandon checkout", value: "11%" },
        ]
  const supportTopics =
    experience === "presentation"
      ? ["Hero messaging", "Beneficii", "Dovada sociala", "Lead capture"]
      : ["Disponibilitate si timp de livrare", "Recomandari de jucarii pe varsta", "Retur si garantie", "Comenzi corporate / pachete cadou"]

  const layoutContent = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body style={{ margin: 0, background: "#fff8f1", color: "#1f2937", fontFamily: "\\"Space Grotesk\\", \\"Segoe UI\\", sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
`

  const pageContent = `const audience = ${JSON.stringify(audience, null, 2)}
const products = ${JSON.stringify(products, null, 2)}
const categories = ${JSON.stringify(categories, null, 2)}
const techStack = ${JSON.stringify(techStack, null, 2)}
const deliverables = ${JSON.stringify(deliverables, null, 2)}
const stats = ${JSON.stringify(stats, null, 2)}
const cartItems = ${JSON.stringify(cartItems, null, 2)}
const adminMetrics = ${JSON.stringify(adminMetrics, null, 2)}
const supportTopics = ${JSON.stringify(supportTopics, null, 2)}

const shell = {
  minHeight: "100vh",
  padding: "24px 18px 48px",
  background: "linear-gradient(180deg, #fff8f1 0%, #fffdf9 50%, #ffffff 100%)",
}

const card = {
  borderRadius: 28,
  background: "white",
  border: "1px solid rgba(251, 146, 60, 0.18)",
  boxShadow: "0 20px 45px rgba(15, 23, 42, 0.08)",
}

const chip = {
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
}

export default function Page() {
  return (
    <main style={shell}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <header
          style={{
            ...card,
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            position: "sticky",
            top: 14,
            zIndex: 10,
            backdropFilter: "blur(14px)",
          }}
        >
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "#c2410c" }}>${JSON.stringify(previewLabel)}</div>
            <strong style={{ display: "block", marginTop: 4, fontSize: 20 }}>${JSON.stringify(title)}</strong>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "#6b7280", fontSize: 14 }}>
            {${JSON.stringify(navItems, null, 2)}.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </nav>
        </header>

        <section
          style={{
            ...card,
            marginTop: 18,
            padding: 28,
            background: "linear-gradient(135deg, #ea580c 0%, #f97316 48%, #fb7185 100%)",
            color: "white",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", right: -50, top: -30, width: 220, height: 220, borderRadius: 999, background: "rgba(255,255,255,0.12)" }} />
          <div style={{ position: "relative", display: "grid", gap: 18, gridTemplateColumns: "1.15fr 0.85fr" }}>
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", opacity: 0.82 }}>
                ${experience === "presentation" ? "Marketing website" : experience === "dashboard" ? "Operational dashboard" : experience === "commerce" ? "Marketplace MVP" : "Product platform"}
              </div>
              <h1 style={{ margin: "14px 0 0", fontSize: 48, lineHeight: 1.02, maxWidth: 760 }}>
                ${JSON.stringify(title)}
              </h1>
              <p style={{ margin: "14px 0 0", maxWidth: 760, fontSize: 16, lineHeight: 1.75 }}>
                ${JSON.stringify(objective)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                {audience.map((item) => (
                  <span key={item} style={{ ...chip, background: "rgba(255,255,255,0.16)" }}>
                    {item}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                <button style={{ border: 0, borderRadius: 999, background: "#ffffff", color: "#c2410c", fontWeight: 700, padding: "12px 18px" }}>
                  ${experience === "presentation" ? "Solicita oferta" : experience === "dashboard" ? "Open workspace" : experience === "commerce" ? "Incepe sa vinzi" : "Explore product"}
                </button>
                <button style={{ borderRadius: 999, background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.35)", padding: "12px 18px" }}>
                  ${experience === "presentation" ? "Vezi demo" : experience === "dashboard" ? "View reports" : "Vezi dashboard admin"}
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ ...card, padding: 16, background: "rgba(255,255,255,0.16)", color: "white", border: "1px solid rgba(255,255,255,0.18)" }}>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.8 }}>Launch snapshot</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  {stats.map((stat) => (
                    <div key={stat.label} style={{ borderRadius: 18, background: "rgba(255,255,255,0.12)", padding: 14 }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>{stat.label}</div>
                      <strong style={{ display: "block", marginTop: 8, fontSize: 24 }}>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ display: "grid", gap: 18, gridTemplateColumns: "1fr 320px", marginTop: 18 }}>
          <article style={{ ...card, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#c2410c" }}>
                  ${experience === "presentation" ? "Presentation flow" : experience === "dashboard" ? "Operations surface" : experience === "commerce" ? "Catalog experience" : "Product experience"}
                </div>
                <h2 style={{ margin: "10px 0 0", fontSize: 28 }}>
                  ${JSON.stringify(
                    experience === "presentation"
                      ? "Un website de prezentare adaptat specificatiilor utilizatorului"
                      : experience === "dashboard"
                        ? "Suprafata operationala si modulele principale ale produsului"
                        : experience === "commerce"
                          ? "Descopera jucarii vandute de comercianti individuali"
                          : "Fluxuri cheie ale produsului"
                  )}
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {categories.map((item, index) => (
                  <span key={item} style={{ ...chip, background: index === 0 ? "#ffedd5" : "#f8fafc", color: index === 0 ? "#c2410c" : "#475569" }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, marginTop: 18 }}>
              {products.map((product) => (
                <div
                  key={product.name}
                  style={{
                    borderRadius: 24,
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                    background: "#fffaf5",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ height: 180, background: "linear-gradient(135deg, #fed7aa 0%, #fdba74 50%, #fb7185 100%)", position: "relative" }}>
                    <div style={{ position: "absolute", top: 14, left: 14, ...chip, background: "rgba(255,255,255,0.88)", color: "#9a3412" }}>
                      {product.badge}
                    </div>
                  </div>
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: 18 }}>{product.name}</strong>
                      <span style={{ color: "#c2410c", fontWeight: 700 }}>{product.price}</span>
                    </div>
                    <div style={{ marginTop: 8, color: "#6b7280", lineHeight: 1.6 }}>{product.detail}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14, color: "#64748b", fontSize: 13 }}>
                      <span>{product.seller}</span>
                      <span>{product.rating} ★</span>
                    </div>
                    <div style={{ marginTop: 8, color: "#9a3412", fontSize: 13 }}>{product.stock}</div>
                    <button style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 16, background: "#111827", color: "white", padding: "12px 14px", fontWeight: 700 }}>
                      Adauga in cos
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <aside style={{ display: "grid", gap: 18 }}>
            <article style={{ ...card, padding: 22 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#c2410c" }}>
                ${experience === "presentation" ? "Contact & conversion" : experience === "dashboard" ? "Alerts & tasks" : experience === "commerce" ? "Cos & checkout" : "Primary workflow"}
              </div>
              <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                {cartItems.map((item) => (
                  <div key={item.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(148,163,184,0.14)", paddingBottom: 12 }}>
                    <div>
                      <strong style={{ display: "block" }}>{item.name}</strong>
                      <span style={{ color: "#64748b", fontSize: 13 }}>Cantitate: {item.qty}</span>
                    </div>
                    <span style={{ color: "#c2410c", fontWeight: 700 }}>{item.price}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, borderRadius: 18, background: "#fff7ed", padding: 14, color: "#7c2d12", lineHeight: 1.7 }}>
                ${JSON.stringify(
                  experience === "presentation"
                    ? "Formular de contact, CTA-uri, proof si structura de conversie pentru un site de prezentare."
                    : experience === "dashboard"
                      ? "Lista de task-uri, alerte si actiuni operationale derivate din brief."
                      : experience === "commerce"
                        ? "Stripe Checkout, livrare nationala, sumar TVA si date GDPR pentru consimtamant."
                        : "Fluxul principal este generat direct din specificatiile proiectului."
                )}
              </div>
              <button style={{ width: "100%", marginTop: 16, border: 0, borderRadius: 16, background: "#ea580c", color: "white", padding: "12px 14px", fontWeight: 700 }}>
                ${experience === "presentation" ? "Trimite cererea" : experience === "dashboard" ? "Open queue" : experience === "commerce" ? "Continua spre plata" : "Continue"}
              </button>
            </article>

            <article style={{ ...card, padding: 22, background: "#0f172a", color: "#e2e8f0" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#fb923c" }}>
                ${experience === "presentation" ? "Content strategy" : experience === "dashboard" ? "Operational intelligence" : "AI customer support"}
              </div>
              <p style={{ margin: "14px 0 0", color: "#cbd5e1", lineHeight: 1.7 }}>
                ${JSON.stringify(
                  experience === "presentation"
                    ? "Preview-ul poate deveni un site de prezentare real, nu doar un magazin online. Structura vine din brief si din cerintele utilizatorului."
                    : experience === "dashboard"
                      ? "Preview-ul poate reprezenta un dashboard sau un produs operational, nu doar o pagina de ecommerce."
                      : "Asistentul poate recomanda jucarii pe intervale de varsta, explica livrarea si preia intrebari despre retur."
                )}
              </p>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                {supportTopics.map((topic) => (
                  <div key={topic} style={{ borderRadius: 16, background: "rgba(255,255,255,0.08)", padding: "12px 14px" }}>
                    {topic}
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <section style={{ display: "grid", gap: 18, gridTemplateColumns: "0.95fr 1.05fr", marginTop: 18 }}>
          <article style={{ ...card, padding: 24 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#c2410c" }}>
              ${experience === "presentation" ? "Conversion sections" : "Admin operations"}
            </div>
            <h2 style={{ margin: "10px 0 0", fontSize: 28 }}>
              ${JSON.stringify(
                experience === "presentation" ? "Blocuri de continut si conversie pentru website-ul de prezentare" : "Panou pentru administrare si operatiuni"
              )}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14, marginTop: 18 }}>
              {adminMetrics.map((metric) => (
                <div key={metric.label} style={{ borderRadius: 20, background: "#fffaf5", padding: 18, border: "1px solid rgba(148,163,184,0.16)" }}>
                  <div style={{ color: "#64748b", fontSize: 13 }}>{metric.label}</div>
                  <strong style={{ display: "block", marginTop: 8, fontSize: 28 }}>{metric.value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              {(deliverables.length > 0 ? deliverables : [
                ${experience === "presentation"
                  ? '"Hero section", "Servicii si capabilitati", "Testimoniale si proof", "Lead capture si contact"'
                  : '"Management produse", "Monitorizare comenzi", "Configurare livrare", "Analytics si campanii"'}
              ]).map((item) => (
                <div key={item} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.16)", padding: "14px 16px" }}>
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article style={{ ...card, padding: 24 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#c2410c" }}>Platform blueprint</div>
            <h2 style={{ margin: "10px 0 0", fontSize: 28 }}>
              ${JSON.stringify(experience === "presentation" ? "Structura livrabila pentru website-ul de prezentare" : "Fluxuri principale in MVP")}
            </h2>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {${JSON.stringify(
                experience === "presentation"
                  ? [
                      "Hero section cu value proposition clara",
                      "Sectiuni de servicii si beneficii",
                      "Testimoniale, proof si CTA-uri",
                      "Lead form si date de contact",
                      "SEO copy si structura de lansare",
                    ]
                  : experience === "dashboard"
                    ? [
                        "Overview KPI si operational health",
                        "Task queues si alerte prioritare",
                        "Analytics, funnels si statusuri",
                        "Management utilizatori si permisiuni",
                        "Workflow-uri configurabile",
                      ]
                    : [
                        "Catalog + filtrare + SEO landing pages",
                        "Autentificare utilizator, profil si istoric comenzi",
                        "Checkout cu Stripe si confirmare automata",
                        "Livrare cu status, cost estimat si acoperire nationala",
                        "Admin pentru stoc, comenzi, promotii si seller onboarding",
                      ],
                null,
                2
              )}.map((item) => (
                <div key={item} style={{ borderRadius: 18, background: "#f8fafc", padding: "14px 16px", color: "#334155" }}>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, borderRadius: 20, background: "#111827", color: "#e2e8f0", padding: 18 }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.16em", color: "#fb923c" }}>Architecture</div>
              <p style={{ margin: "10px 0 0", lineHeight: 1.75 }}>
                ${JSON.stringify(architecture)}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
                {techStack.map((item) => (
                  <span key={item} style={{ ...chip, background: "rgba(255,255,255,0.08)", color: "#f8fafc" }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
`

  return [
    { id: "virtual-layout", name: "layout.tsx", path: "src/app/layout.tsx", content: layoutContent },
    { id: "virtual-page", name: "page.tsx", path: "src/app/page.tsx", content: pageContent },
  ]
}

async function buildAiPreviewWorkspaceFiles(project: ProjectState): Promise<WorkspaceFile[] | null> {
  const client = getPreviewOpenAIClient()
  if (!client) return null

  const selectedStory =
    project.userStories.find((story) => story.id === project.selectedStoryId) ??
    project.userStories[0]
  const selectedVariant =
    selectedStory?.variants.find((variant) => variant.id === selectedStory.selectedVariantId) ??
    selectedStory?.variants[0]

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-5.1-nano",
      instructions:
        "You generate a realistic Next.js App Router preview from user specifications. Return ONLY valid JSON with keys layoutTsx and pageTsx. The code must be valid TSX, use no external imports, use inline styles only, and reflect the user's requested product type. If the brief describes a presentation website, generate a marketing/presentation site. If it describes commerce, generate a storefront. If it describes admin/dashboard, generate a dashboard. Make it rich and complete, not a tiny mock.",
      input: JSON.stringify({
        brief: project.brief,
        selectedStory,
        selectedVariant,
        currentStage: project.currentStage,
      }),
    })

    const parsed = safeJsonParse<{ layoutTsx?: string; pageTsx?: string }>(response.output_text)
    const layoutTsx = parsed?.layoutTsx?.trim() ?? ""
    const pageTsx = parsed?.pageTsx?.trim() ?? ""

    if (!normalizePreviewText(layoutTsx) || !normalizePreviewText(pageTsx)) return null

    return [
      { id: "virtual-layout", name: "layout.tsx", path: "src/app/layout.tsx", content: layoutTsx },
      { id: "virtual-page", name: "page.tsx", path: "src/app/page.tsx", content: pageTsx },
    ]
  } catch {
    return null
  }
}

async function resolvePreviewProject(project: ProjectState): Promise<ProjectState> {
  const files = Array.isArray(project.workspace.files) ? project.workspace.files : []
  if (files.length > 0) return project

  const synthesizedFiles = (await buildAiPreviewWorkspaceFiles(project)) ?? synthesizePreviewWorkspaceFiles(project)
  const runtimeEntrypoints =
    Array.isArray(project.workspace.runtimeEntrypoints) && project.workspace.runtimeEntrypoints.length > 0
      ? project.workspace.runtimeEntrypoints
      : ["src/app/layout.tsx", "src/app/page.tsx"]

  return {
    ...project,
    workspace: {
      ...project.workspace,
      files: synthesizedFiles,
      runtimeEntrypoints,
      selectedFileId: project.workspace.selectedFileId || synthesizedFiles[1]?.id || synthesizedFiles[0]?.id || "",
    },
  }
}

function resolveProjectPackageFile(packageName: string, relativePath: string) {
  return path.resolve(process.cwd(), "node_modules", packageName, relativePath)
}

function escapePreviewHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeInlineScript(value: string) {
  return value.replaceAll("</script", "<\\/script")
}

function normalizeWorkspacePath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/")
}

function stripExtension(value: string) {
  return value.replace(/\.[^.\/]+$/, "")
}

function workspaceImportSpecifier(workspacePath: string) {
  const normalized = normalizeWorkspacePath(workspacePath)
  if (normalized.startsWith("src/")) {
    return `@/${stripExtension(normalized.slice("src/".length))}`
  }

  return `./${stripExtension(normalized)}`
}

function candidateWorkspacePaths(rawPath: string) {
  const normalized = normalizeWorkspacePath(rawPath)
  const base = stripExtension(normalized)
  const candidates = new Set<string>()

  candidates.add(normalized)
  candidates.add(base)

  if (!path.posix.extname(normalized)) {
    for (const extension of [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".json", ".css", ".md"]) {
      candidates.add(`${base}${extension}`)
    }

    for (const indexFile of ["index.tsx", "index.ts", "index.jsx", "index.js", "index.mjs", "index.cjs"]) {
      candidates.add(path.posix.join(base, indexFile))
    }
  }

  return [...candidates]
}

function resolveWorkspaceFile(filesByPath: Map<string, WorkspaceFile>, rawPath: string) {
  for (const candidate of candidateWorkspacePaths(rawPath)) {
    if (filesByPath.has(candidate)) {
      return candidate
    }
  }

  return null
}

function resolveWorkspaceImport(specifier: string, resolveDir: string, filesByPath: Map<string, WorkspaceFile>) {
  if (specifier.startsWith("@/")) {
    return resolveWorkspaceFile(filesByPath, normalizeWorkspacePath(`src/${specifier.slice(2)}`))
  } else if (specifier.startsWith("src/")) {
    return resolveWorkspaceFile(filesByPath, normalizeWorkspacePath(specifier))
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const relativeCandidates = [
      normalizeWorkspacePath(path.posix.join(resolveDir || "", specifier)),
      normalizeWorkspacePath(path.posix.join(path.posix.dirname(resolveDir || ""), specifier)),
    ]

    for (const candidate of relativeCandidates) {
      const directMatch = resolveWorkspaceFile(filesByPath, candidate)
      if (directMatch) {
        return directMatch
      }

      if (!candidate.startsWith("src/")) {
        const srcPrefixedMatch = resolveWorkspaceFile(filesByPath, normalizeWorkspacePath(`src/${candidate}`))
        if (srcPrefixedMatch) {
          return srcPrefixedMatch
        }
      }
    }

    return null
  } else if (specifier.startsWith("/")) {
    return resolveWorkspaceFile(filesByPath, normalizeWorkspacePath(specifier))
  } else if (filesByPath.has(normalizeWorkspacePath(specifier))) {
    return normalizeWorkspacePath(specifier)
  }

  return null
}

function loaderForWorkspacePath(workspacePath: string) {
  const extension = path.posix.extname(workspacePath).toLowerCase()

  switch (extension) {
    case ".tsx":
      return "tsx" as const
    case ".ts":
      return "ts" as const
    case ".jsx":
      return "jsx" as const
    case ".js":
    case ".mjs":
    case ".cjs":
      return "js" as const
    case ".json":
      return "json" as const
    case ".css":
      return "css" as const
    case ".md":
      return "text" as const
    default:
      return "text" as const
  }
}

function toWorkspaceAlias(workspacePath: string) {
  const normalized = normalizeWorkspacePath(workspacePath)
  if (!normalized.startsWith("src/")) return null

  return `@/${stripExtension(normalized.slice("src/".length))}`
}

function normalizeWorkspaceSourceImports(
  source: string,
  workspacePath: string,
  filesByPath: Map<string, WorkspaceFile>
) {
  const resolveDir = normalizeWorkspacePath(path.posix.dirname(workspacePath))

  const rewriteSpecifier = (specifier: string) => {
    if (!specifier.startsWith(".")) return specifier

    const resolved = resolveWorkspaceImport(specifier, resolveDir, filesByPath)
    if (!resolved) return specifier

    return toWorkspaceAlias(resolved) ?? specifier
  }

  const importExportPattern = /\b(from\s+['"])([^'"]+)(['"])/g
  const dynamicImportPattern = /\b(import\(\s*['"])([^'"]+)(['"]\s*\))/g

  return source
    .replace(importExportPattern, (_, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`)
    .replace(dynamicImportPattern, (_, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`)
}

function getWorkspaceFolders(project: ProjectState) {
  return Array.isArray(project.workspace.folders) ? project.workspace.folders : []
}

function getWorkspaceFiles(project: ProjectState) {
  const files = Array.isArray(project.workspace.files) ? project.workspace.files : []
  return files.length > 0 ? files : synthesizePreviewWorkspaceFiles(project)
}

function getRuntimeEntrypoints(project: ProjectState) {
  return Array.isArray(project.workspace.runtimeEntrypoints) ? project.workspace.runtimeEntrypoints : []
}

function getArtifacts(project: ProjectState) {
  return Array.isArray(project.artifacts) ? project.artifacts : []
}

function pickResolvedPath(filesByPath: Map<string, WorkspaceFile>, candidates: string[]) {
  for (const candidate of candidates) {
    const resolved = resolveWorkspaceFile(filesByPath, candidate)
    if (resolved) {
      return resolved
    }
  }

  return null
}

function pickEntrypoints(project: ProjectState, filesByPath: Map<string, WorkspaceFile>) {
  const explicitEntrypoints = getRuntimeEntrypoints(project).map(normalizeWorkspacePath)
  const pageEntrypoints = [
    ...explicitEntrypoints.filter((entrypoint) => !path.posix.basename(entrypoint).startsWith("layout.")),
    "src/app/page.tsx",
    "src/app/page.ts",
    "src/app/page.jsx",
    "src/app/page.js",
  ]
  const layoutEntrypoints = [
    ...explicitEntrypoints.filter((entrypoint) => path.posix.basename(entrypoint).startsWith("layout.")),
    "src/app/layout.tsx",
    "src/app/layout.ts",
    "src/app/layout.jsx",
    "src/app/layout.js",
  ]

  return {
    pagePath: pickResolvedPath(filesByPath, pageEntrypoints),
    layoutPath: pickResolvedPath(filesByPath, layoutEntrypoints),
  }
}

function createWorkspacePlugin(filesByPath: Map<string, WorkspaceFile>): WorkspacePlugin {
  return {
    name: "workspace-runtime",
    setup(buildApi) {
      buildApi.onResolve({ filter: /.*/ }, (args) => {
        const resolvedPath = resolveWorkspaceImport(args.path, normalizeWorkspacePath(args.resolveDir || ""), filesByPath)
        if (!resolvedPath) {
          return undefined
        }

        return {
          path: resolvedPath,
          namespace: "workspace-runtime",
        }
      })

      buildApi.onLoad({ filter: /.*/, namespace: "workspace-runtime" }, (args) => {
        const file = filesByPath.get(args.path)
        if (!file) {
          return {
            errors: [{ text: `Workspace file not found: ${args.path}` }],
          }
        }

        return {
          contents: normalizeWorkspaceSourceImports(file.content, args.path, filesByPath),
          loader: loaderForWorkspacePath(args.path),
          resolveDir: normalizeWorkspacePath(path.posix.dirname(args.path)),
        }
      })
    },
  }
}

function createPackageResolvePlugin(): WorkspacePlugin {
  const packageResolutions = new Map<string, string>([
    ["react", resolveProjectPackageFile("react", "index.js")],
    ["react/jsx-runtime", resolveProjectPackageFile("react", "jsx-runtime.js")],
    ["react-dom/client", resolveProjectPackageFile("react-dom", "client.js")],
  ])
  const previewModules = new Map<string, string>([
    [
      "next/link",
      `
      import * as React from "react"

      export default function Link(props) {
        const { href = "#", children, ...rest } = props ?? {}
        return React.createElement("a", { href, ...rest }, children)
      }
      `,
    ],
    [
      "next/image",
      `
      import * as React from "react"

      export default function Image(props) {
        const { src = "", alt = "", ...rest } = props ?? {}
        return React.createElement("img", { src, alt, ...rest })
      }
      `,
    ],
    [
      "next/navigation",
      `
      export function useRouter() {
        return {
          push() {},
          replace() {},
          refresh() {},
          back() {},
          forward() {},
          prefetch() {},
        }
      }
      `,
    ],
  ])

  return {
    name: "preview-package-resolver",
    setup(buildApi: BuildApi) {
      buildApi.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom\/client)$/ }, (args) => {
        const resolved = packageResolutions.get(args.path)
        if (!resolved) {
          return undefined
        }

        return {
          path: resolved,
        }
      })

      buildApi.onResolve({ filter: /^next\/(link|image|navigation)$/ }, (args) => ({
        path: args.path,
        namespace: "preview-shim",
      }))

      buildApi.onLoad({ filter: /^next\/(link|image|navigation)$/, namespace: "preview-shim" }, (args) => ({
        contents: previewModules.get(args.path) ?? "export {}",
        loader: "js",
      }))
    },
  }
}

function buildWorkspaceRuntimeSource(pagePath: string, layoutPath: string | null) {
  const lines = [
    `import * as React from "react"`,
    `import { createRoot } from "react-dom/client"`,
    layoutPath ? `import Layout from "${workspaceImportSpecifier(layoutPath)}"` : "",
    `import Page from "${workspaceImportSpecifier(pagePath)}"`,
    `const rootElement = document.getElementById("root")`,
    `if (!rootElement) { throw new Error("Preview root element not found.") }`,
    `const root = createRoot(rootElement)`,
    layoutPath
      ? `root.render(React.createElement(Layout, null, React.createElement(Page, null)))`
      : `root.render(React.createElement(Page, null))`,
  ]

  return lines.filter(Boolean).join("\n")
}

function buildFallbackRuntimeSource(project: ProjectState, layoutPath: string | null) {
  const workspaceFolders = getWorkspaceFolders(project)
  const workspaceFiles = getWorkspaceFiles(project)
  const runtimeEntrypoints = getRuntimeEntrypoints(project)
  const artifacts = getArtifacts(project)

  const previewData = {
    title: project.brief.title || "Untitled project",
    objective:
      project.brief.objective ||
      "Completează brief-ul și generează workspace-ul pentru a vedea preview-ul real.",
    stage: project.currentStage,
    brief: {
      audience: Array.isArray(project.brief.audience) ? project.brief.audience : [],
      scope: Array.isArray(project.brief.scope) ? project.brief.scope : [],
      deliverables: Array.isArray(project.brief.deliverables) ? project.brief.deliverables : [],
      risks: Array.isArray(project.brief.risks) ? project.brief.risks : [],
      techStack: Array.isArray(project.brief.techStack) ? project.brief.techStack : [],
    },
    workspace: {
      folders: workspaceFolders.map((folder) => ({ path: folder.path, name: folder.name })),
      files: workspaceFiles.map((file) => ({
        path: file.path,
        lines: file.content.split("\n").length,
      })),
      runtimeEntrypoints,
    },
    artifacts: artifacts.map((artifact) => ({
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
    })),
  }

  const layoutImport = layoutPath ? `import Layout from "${workspaceImportSpecifier(layoutPath)}"` : ""

  return `
import * as React from "react"
import { createRoot } from "react-dom/client"
${layoutImport}

const previewData = ${JSON.stringify(previewData)}

const shellStyle = {
  minHeight: "100%",
  padding: "32px",
  color: "#e8f0f8",
  background: "radial-gradient(circle at top left, rgba(52, 211, 153, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(96, 165, 250, 0.16), transparent 24%), linear-gradient(180deg, #08111a 0%, #0b1118 100%)",
  boxSizing: "border-box",
  fontFamily: "Inter, system-ui, sans-serif",
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
  marginTop: "24px",
}

const cardStyle = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "20px",
  background: "rgba(7, 16, 24, 0.82)",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.22)",
  padding: "18px",
}

const mutedStyle = {
  color: "#8aa0b8",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

const titleStyle = {
  margin: "10px 0 0",
  fontSize: "32px",
  lineHeight: 1.1,
}

const textStyle = {
  margin: "10px 0 0",
  color: "#c5d3e0",
  lineHeight: 1.6,
  fontSize: "14px",
}

const pillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "7px 11px",
  borderRadius: "999px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(52, 211, 153, 0.12)",
  color: "#d8fff1",
  fontSize: "11px",
  letterSpacing: "0.06em",
  marginRight: "8px",
  marginBottom: "8px",
}

const statGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
  marginTop: "22px",
}

const statStyle = {
  border: "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "18px",
  padding: "14px",
  background: "rgba(255, 255, 255, 0.03)",
}

const statLabelStyle = {
  color: "#8aa0b8",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

const statValueStyle = {
  marginTop: "8px",
  fontSize: "18px",
  fontWeight: 700,
  color: "#f8fbff",
}

const fileRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  marginTop: "10px",
  padding: "11px 12px",
  borderRadius: "14px",
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(255, 255, 255, 0.03)",
  fontSize: "12px",
}

const fileMetaStyle = {
  color: "#8aa0b8",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
}

function StatCard(props) {
  return React.createElement(
    "div",
    { style: statStyle },
    React.createElement("div", { style: statLabelStyle }, props.label),
    React.createElement("div", { style: statValueStyle }, props.value)
  )
}

function Section(props) {
  return React.createElement(
    "section",
    { style: cardStyle },
    React.createElement("div", { style: mutedStyle }, props.eyebrow),
    React.createElement("h2", { style: { margin: "10px 0 0", fontSize: "18px" } }, props.title),
    props.children
  )
}

function App() {
  const fileItems =
    previewData.workspace.files.length > 0
      ? previewData.workspace.files.map((file) =>
          React.createElement(
            "div",
            { style: fileRowStyle, key: file.path },
            React.createElement("span", null, file.path),
            React.createElement("span", { style: fileMetaStyle }, String(file.lines) + " lines")
          )
        )
      : [
          React.createElement(
            "div",
            { style: fileRowStyle, key: "empty" },
            React.createElement("span", null, "No workspace files yet"),
            React.createElement("span", { style: fileMetaStyle }, "empty")
          ),
        ]

  const audiencePills = previewData.brief.audience.map((item) => React.createElement("span", { style: pillStyle, key: item }, item))
  const scopePills = previewData.brief.scope.map((item) => React.createElement("span", { style: pillStyle, key: item }, item))
  const deliverablePills = previewData.brief.deliverables.map((item) =>
    React.createElement("span", { style: pillStyle, key: item }, item)
  )

  return React.createElement(
    "div",
    { style: shellStyle },
    React.createElement(
      "div",
      { style: cardStyle },
      React.createElement("div", { style: mutedStyle }, "Browser runtime"),
      React.createElement("h1", { style: titleStyle }, previewData.title),
      React.createElement("p", { style: textStyle }, previewData.objective),
      React.createElement(
        "div",
        { style: { marginTop: "18px" } },
        React.createElement("span", { style: pillStyle }, previewData.stage),
        React.createElement("span", { style: pillStyle }, String(previewData.workspace.files.length) + " files"),
        React.createElement("span", { style: pillStyle }, String(previewData.workspace.folders.length) + " folders"),
        React.createElement("span", { style: pillStyle }, String(previewData.workspace.runtimeEntrypoints.length) + " entrypoints")
      ),
      React.createElement(
        "div",
        { style: statGridStyle },
        React.createElement(StatCard, { label: "Audience", value: previewData.brief.audience.length || "—" }),
        React.createElement(StatCard, { label: "Scope items", value: previewData.brief.scope.length || "—" }),
        React.createElement(StatCard, { label: "Artifacts", value: previewData.artifacts.length || "—" }),
        React.createElement(StatCard, { label: "Stage", value: previewData.stage })
      )
    ),
    React.createElement(
      "div",
      { style: gridStyle },
      React.createElement(
        Section,
        { eyebrow: "Brief", title: "Project context" },
        React.createElement("p", { style: textStyle }, "Aici vezi ce știe runtime-ul despre proiect înainte de codul real."),
        React.createElement("div", { style: { marginTop: "14px" } }, audiencePills.length > 0 ? audiencePills : React.createElement("span", { style: pillStyle }, "No audience")),
        React.createElement("div", { style: { marginTop: "8px" } }, scopePills.length > 0 ? scopePills : React.createElement("span", { style: pillStyle }, "No scope yet"))
      ),
      React.createElement(
        Section,
        { eyebrow: "Workspace", title: "Files and entrypoints" },
        React.createElement("p", { style: textStyle }, "Acesta este runtime-ul real al workspace-ului, nu un parser pe exporturi."),
        React.createElement("div", { style: { marginTop: "14px" } }, fileItems),
        React.createElement("div", { style: { marginTop: "14px" } }, previewData.workspace.runtimeEntrypoints.map((entrypoint) => React.createElement("span", { style: pillStyle, key: entrypoint }, entrypoint)))
      ),
      React.createElement(
        Section,
        { eyebrow: "Generated", title: "Artifacts" },
        React.createElement("p", { style: textStyle }, "Codul sau artefactele generate ulterior vor ajunge aici prin bundle-ul backend."),
        React.createElement("div", { style: { marginTop: "14px" } }, deliverablePills.length > 0 ? deliverablePills : React.createElement("span", { style: pillStyle }, "No artifacts yet"))
      )
    )
  )
}

const rootElement = document.getElementById("root")
if (!rootElement) {
  throw new Error("Preview root element not found.")
}

const root = createRoot(rootElement)
${layoutPath ? `root.render(React.createElement(Layout, null, React.createElement(App, null)))` : `root.render(React.createElement(App, null))`}
`
}

async function buildPreviewBundle(project: ProjectState): Promise<PreviewBundle> {
  const { build } = (await import("esbuild")) as {
    build: (options: Record<string, unknown>) => Promise<{
      outputFiles: Array<{ path: string; text: string }>
    }>
  }

  const workspaceFiles = getWorkspaceFiles(project)
  const filesByPath = new Map(workspaceFiles.map((file) => [normalizeWorkspacePath(file.path), file]))
  const { pagePath, layoutPath } = pickEntrypoints(project, filesByPath)

  async function compileBundle(input: { entrySource: string; entrypoint: string; mode: "workspace" | "fallback" }) {
    const result = await build({
      absWorkingDir: process.cwd(),
      stdin: {
        contents: input.entrySource,
        sourcefile: "preview-entry.tsx",
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      outfile: "preview-bundle.js",
      platform: "browser",
      format: "iife",
      target: ["es2020"],
      jsx: "automatic",
      jsxImportSource: "react",
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      plugins: [createPackageResolvePlugin(), createWorkspacePlugin(filesByPath)],
      logLevel: "silent",
      sourcemap: false,
      minify: false,
    })

    const jsOutput =
      result.outputFiles.find((file) => file.path.endsWith(".js")) ??
      result.outputFiles.find((file) => file.path === "<stdout>") ??
      result.outputFiles[0]
    const cssOutput = result.outputFiles.find((file) => file.path.endsWith(".css"))

    return {
      js: jsOutput?.text ?? "",
      css: cssOutput?.text ?? "",
      entrypoint: input.entrypoint,
      mode: input.mode,
    } satisfies PreviewBundle
  }

  if (pagePath !== null) {
    try {
      return await compileBundle({
        entrySource: buildWorkspaceRuntimeSource(pagePath, layoutPath),
        entrypoint: pagePath,
        mode: "workspace",
      })
    } catch {
      return compileBundle({
        entrySource: buildFallbackRuntimeSource(project, layoutPath),
        entrypoint: "virtual://fallback-preview",
        mode: "fallback",
      })
    }
  }

  return compileBundle({
    entrySource: buildFallbackRuntimeSource(project, layoutPath),
    entrypoint: "virtual://fallback-preview",
    mode: "fallback",
  })
}

function renderRuntimeShell(project: ProjectState, bundle: PreviewBundle) {
  const runtimeEntrypoints = getRuntimeEntrypoints(project)
  const runtimeEntrypointList = runtimeEntrypoints.length > 0 ? runtimeEntrypoints : [bundle.entrypoint]
  const runtimeFilesSource = getWorkspaceFiles(project)
  const runtimeFiles =
    runtimeFilesSource.length > 0
      ? runtimeFilesSource
          .filter((file) => file.path.startsWith("src/"))
          .sort((left, right) => left.path.localeCompare(right.path))
          .map(
            (file) => `
        <div class="runtime-file">
          <span>${escapePreviewHtml(file.path)}</span>
          <span>${file.content.split("\n").length} lines</span>
        </div>
      `
          )
          .join("")
      : ""
  const runtimeModeLabel = bundle.mode === "workspace" ? "Workspace runtime" : "Synthesized fallback runtime"
  const runtimeModeDescription =
    bundle.mode === "workspace"
      ? "Preview-ul rulează codul din workspace prin esbuild și montează direct componenta paginii."
      : "Workspace-ul este gol sau nu are încă `src/app/page.*`, așa că backend-ul a generat o aplicație fallback reală."

  const entrypointMarkup = runtimeEntrypointList.map((entrypoint) => `<span class="pill">${escapePreviewHtml(entrypoint)}</span>`).join("")

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapePreviewHtml(project.brief.title || "Live Preview")}</title>
      <style>
        :root { color-scheme: dark; --panel: rgba(15, 23, 34, 0.92); --line: rgba(148,163,184,0.18); --muted: #8aa0b8; --text: #e8f0f8; --accent: #34d399; --accent-soft: rgba(52,211,153,0.14); }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; background: radial-gradient(circle at top left, rgba(52,211,153,0.16), transparent 28%), radial-gradient(circle at top right, rgba(96,165,250,0.14), transparent 26%), linear-gradient(180deg, #091018 0%, #0b1118 100%); color: var(--text); font-family: Inter, system-ui, sans-serif; }
        body { min-height: 100vh; }
        .shell { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
        .viewport { position: relative; min-height: 100vh; display: flex; flex-direction: column; }
        .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); background: rgba(8,16,24,0.8); backdrop-filter: blur(18px); }
        .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
        .eyebrow::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 0 6px rgba(52,211,153,0.12); }
        .meta { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--accent-soft); color: #d8fff1; font-size: 11px; letter-spacing: 0.06em; }
        .canvas { position: relative; flex: 1; min-height: 0; padding: 20px; }
        #root { min-height: calc(100vh - 78px); border: 1px solid var(--line); border-radius: 22px; background: rgba(255,255,255,0.03); overflow: auto; box-shadow: 0 24px 70px rgba(0,0,0,0.26); }
        .sidebar { border-left: 1px solid var(--line); background: rgba(7,16,24,0.82); backdrop-filter: blur(18px); padding: 18px; display: grid; gap: 16px; align-content: start; }
        .card { border: 1px solid var(--line); border-radius: 18px; background: rgba(255,255,255,0.03); padding: 16px; }
        .card h2, .card h3 { margin: 0 0 10px; }
        .card p { margin: 0; color: #c5d3e0; line-height: 1.6; font-size: 13px; }
        .runtime-file { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; margin-top: 8px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.03); font-size: 12px; color: #dbeafe; }
        .runtime-file span:last-child { color: var(--muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
        .code { margin: 0; max-height: 260px; overflow: auto; padding: 14px; border-radius: 14px; background: #09131d; color: #dbeafe; font: 12px/1.6 "Roboto Mono", monospace; white-space: pre-wrap; word-break: break-word; }
        ${bundle.css}
        @media (max-width: 1060px) {
          .shell { grid-template-columns: 1fr; }
          .sidebar { border-left: 0; border-top: 1px solid var(--line); }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="viewport">
          <div class="toolbar">
            <div>
              <div class="eyebrow">Browser runtime</div>
              <div style="margin-top: 6px; font-size: 15px; font-weight: 700;">${escapePreviewHtml(project.brief.title || "Untitled project")}</div>
            </div>
            <div class="meta">${entrypointMarkup}</div>
          </div>
          <div class="canvas">
            <div id="root"></div>
          </div>
        </section>
        <aside class="sidebar">
          <section class="card">
            <div class="eyebrow">${escapePreviewHtml(runtimeModeLabel)}</div>
            <h3 style="margin-top: 10px;">${escapePreviewHtml(bundle.entrypoint)}</h3>
            <p>${escapePreviewHtml(runtimeModeDescription)}</p>
          </section>

          <section class="card">
            <div class="eyebrow">Runtime files</div>
            ${runtimeFiles || `<div class="runtime-file"><span>No runtime files found</span><span>empty</span></div>`}
          </section>

          <section class="card">
            <div class="eyebrow">Rendered bundle</div>
            <pre class="code">${escapePreviewHtml(bundle.js || "// Bundle unavailable")}</pre>
          </section>
        </aside>
      </main>
      <script>${escapeInlineScript(bundle.js)}</script>
    </body>
  </html>`
}

function renderPreviewErrorShell(project: ProjectState, errorMessage: string) {
  const runtimeFiles = getWorkspaceFiles(project)
    .filter((file) => file.path.startsWith("src/"))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(
      (file) => `
        <div class="runtime-file">
          <span>${escapePreviewHtml(file.path)}</span>
          <span>${file.content.split("\n").length} lines</span>
        </div>
      `
    )
    .join("")

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Preview Error</title>
      <style>
        :root { color-scheme: dark; --line: rgba(148,163,184,0.18); --muted: #8aa0b8; --text: #e8f0f8; }
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; background: linear-gradient(180deg, #08111a 0%, #071018 100%); color: var(--text); font-family: Inter, system-ui, sans-serif; }
        .shell { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 320px; }
        .panel { border: 1px solid var(--line); border-radius: 22px; background: rgba(255,255,255,0.03); padding: 18px; }
        .main { padding: 20px; }
        .sidebar { border-left: 1px solid var(--line); padding: 18px; display: grid; gap: 16px; align-content: start; background: rgba(7,16,24,0.82); }
        .eyebrow { color: var(--muted); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
        pre { margin: 12px 0 0; padding: 14px; overflow: auto; border-radius: 14px; background: #09131d; color: #ffe4ea; font: 12px/1.6 "Roboto Mono", monospace; white-space: pre-wrap; word-break: break-word; }
        .runtime-file { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; margin-top: 8px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.03); font-size: 12px; color: #dbeafe; }
        .runtime-file span:last-child { color: var(--muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
        @media (max-width: 1060px) { .shell { grid-template-columns: 1fr; } .sidebar { border-left: 0; border-top: 1px solid var(--line); } }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="main">
          <div class="panel" style="border-left: 3px solid #fb7185;">
            <div class="eyebrow">Preview bundle failed</div>
            <h1 style="margin: 10px 0 0;">${escapePreviewHtml(project.brief.title || "Untitled project")}</h1>
            <p style="margin: 10px 0 0; color: #c5d3e0; line-height: 1.6;">The runtime bundle could not be built from the current workspace. Fix the code and the preview will compile again automatically.</p>
            <pre>${escapePreviewHtml(errorMessage)}</pre>
          </div>
        </section>
        <aside class="sidebar">
          <section class="panel">
            <div class="eyebrow">Runtime files</div>
            ${runtimeFiles || `<div class="runtime-file"><span>No runtime files found</span><span>empty</span></div>`}
          </section>
        </aside>
      </main>
    </body>
  </html>`
}

function formatPreviewBuildError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message
  }

  if (typeof error === "object" && error && "errors" in error) {
    const buildError = error as {
      errors?: Array<{ text?: string; location?: { file?: string; line?: number; column?: number } }>
      message?: string
    }

    const formattedErrors =
      buildError.errors?.map((item) => {
        const location = item.location
        const prefix = location ? `${location.file ?? "unknown"}:${location.line ?? 0}:${location.column ?? 0}` : "esbuild"
        return `${prefix} - ${item.text ?? "Unknown build error"}`
      }) ?? []

    return formattedErrors.join("\n") || buildError.message || "Preview bundle failed."
  }

  return String(error)
}

export async function buildProjectPreviewDocument(project: ProjectState) {
  const previewProject = await resolvePreviewProject(project)
  const cacheKey = `${PREVIEW_CACHE_VERSION}:${previewProject.updatedAt}:${getWorkspaceFiles(previewProject).length}:${getRuntimeEntrypoints(previewProject).join(",")}`
  const cached = previewCache.get(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const bundle = await buildPreviewBundle(previewProject)
    const html = renderRuntimeShell(previewProject, bundle)
    previewCache.set(cacheKey, html)
    return html
  } catch (error) {
    const html = renderPreviewErrorShell(previewProject, formatPreviewBuildError(error))
    previewCache.set(cacheKey, html)
    return html
  }
}

export async function validateProjectPreview(project: ProjectState) {
  const previewProject = await resolvePreviewProject(project)
  await buildPreviewBundle(previewProject)
}
