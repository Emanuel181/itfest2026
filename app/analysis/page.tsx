"use client"

import { useState, useEffect } from "react"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type Requirement = {
  id: string
  title: string
  detail: string
  kind: "functional" | "non-functional"
  priority: "must-have" | "should-have" | "nice-to-have"
}

const MOCK_PRODUCT_DOC: Record<string, unknown> = {
  title: "ShieldCommerce",
  objective: "O platforma SaaS care scaneaza securitatea magazinelor online si genereaza campanii de ads diferentiatoare bazate pe incredere, ajutand comerciantii sa creasca vanzarile prin certificari de securitate vizibile si mesaje de marketing personalizate.",
  audience: [
    "Proprietari de magazine online (Shopify, WooCommerce, Magento)",
    "Agentii de marketing digital",
    "E-commerce managers din companii mid-market",
    "Echipe de securitate IT din retail online",
  ],
  scope: [
    "Dashboard centralizat cu scorul de securitate al magazinului",
    "Scanare automata de vulnerabilitati (SSL, headers, payment security)",
    "Generator de campanii ads bazate pe trust signals",
    "Integrare cu Google Ads si Meta Ads pentru export campanii",
    "Badge-uri de securitate embeddable pentru site-ul magazinului",
    "Rapoarte lunare de securitate si performanta campanii",
    "Sistem de alerte pentru vulnerabilitati noi detectate",
  ],
  outOfScope: [
    "Executarea efectiva a campaniilor de ads (doar generare)",
    "Remediere automata a vulnerabilitatilor gasite",
    "Suport pentru magazine fizice (doar e-commerce)",
    "Integrare cu platforme de ads non-Google/Meta",
    "Audit manual de securitate (doar scanare automata)",
  ],
  deliverables: [
    "MVP functional cu scanare + generare campanii",
    "Documentatie API publica",
    "Dashboard admin pentru managementul clientilor",
    "Widget embeddable pentru badge-uri de securitate",
    "Landing page + flow de onboarding",
  ],
  risks: [
    "Rate limiting de la platformele de ads la export",
    "False positives in scanarea de securitate pot eroda increderea",
    "Dependenta de API-urile Google/Meta care se schimba frecvent",
    "Competitie cu solutii existente de securitate (Sucuri, Cloudflare)",
    "Reglementari GDPR pentru stocarea datelor de scanare",
  ],
  extraNotes: [
    "Modelul de pricing va fi freemium: scanare gratuita, campanii generate pe plan platit",
    "Prioritate pe piata din Europa de Est initial, apoi expansiune globala",
  ],
}

const MOCK_TECHNICAL_DOC: Record<string, unknown> = {
  techStack: [
    "Next.js 15 (App Router)",
    "TypeScript 5",
    "Tailwind CSS v4",
    "PostgreSQL 16",
    "Redis (caching & job queues)",
    "Prisma ORM",
    "BullMQ (background jobs)",
    "Docker + Kubernetes",
    "AWS (ECS, RDS, ElastiCache, S3)",
    "NextAuth.js (OAuth2 + JWT)",
    "OpenAI API (generare campanii)",
    "Puppeteer (scanare securitate)",
  ],
  architecture: `Arhitectura bazata pe microservicii containerizate cu urmatoarele componente:

**API Gateway (Next.js)**
Serveste frontend-ul si expune API-ul REST. Gestioneaza autentificarea si rutarea.

**Scanner Service**
Microserviciu dedicat care ruleaza scanari de securitate asincrone folosind Puppeteer si biblioteci specializate. Scanarile sunt distribuite prin BullMQ.

**Campaign Generator**
Serviciu care analizeaza rezultatele scanarii si genereaza campanii de ads folosind OpenAI API. Include template engine pentru diferite platforme de ads.

**Notification Service**
Gestioneaza alertele email/webhook pentru vulnerabilitati noi si rapoarte periodice.

**Widget Service**
Serveste badge-urile de securitate embeddable ca CDN static cu invalidare automata.

Comunicarea intre servicii se face prin event bus (Redis Pub/Sub) si REST APIs interne.`,
  database: `Schema principala PostgreSQL:

**users** - id, email, name, avatar_url, plan (free/pro/enterprise), created_at
**stores** - id, user_id (FK), platform (shopify/woocommerce/magento), url, name, created_at
**scans** - id, store_id (FK), status (pending/running/completed/failed), score (0-100), started_at, completed_at
**vulnerabilities** - id, scan_id (FK), type (ssl/headers/xss/injection), severity (low/medium/high/critical), description, remediation
**campaigns** - id, store_id (FK), scan_id (FK), platform (google/meta), title, description, audience_config (JSONB), status (draft/exported), created_at
**badges** - id, store_id (FK), type (shield/score/certified), config (JSONB), embed_code, active (boolean)
**subscriptions** - id, user_id (FK), plan, stripe_customer_id, stripe_subscription_id, status, current_period_end

Indexuri pe: stores.user_id, scans.store_id, vulnerabilities.scan_id, campaigns.store_id
Relatii: users -> stores (1:N), stores -> scans (1:N), scans -> vulnerabilities (1:N), stores -> campaigns (1:N)`,
  apis: `API Design - REST cu versionare /api/v1/:

**Authentication**
POST /api/v1/auth/register - Creare cont
POST /api/v1/auth/login - Login (returneaza JWT)
POST /api/v1/auth/refresh - Refresh token
GET /api/v1/auth/me - Profil utilizator

**Stores**
GET /api/v1/stores - Lista magazinelor utilizatorului
POST /api/v1/stores - Adauga magazin nou
GET /api/v1/stores/:id - Detalii magazin
DELETE /api/v1/stores/:id - Sterge magazin

**Scans**
POST /api/v1/stores/:id/scans - Initiaza scanare noua
GET /api/v1/stores/:id/scans - Istoric scanari
GET /api/v1/scans/:id - Detalii scanare + vulnerabilitati

**Campaigns**
POST /api/v1/campaigns/generate - Genereaza campanie din scanare
GET /api/v1/campaigns - Lista campanii
POST /api/v1/campaigns/:id/export - Export catre Google/Meta Ads

**Badges**
POST /api/v1/stores/:id/badges - Creaza badge
GET /api/v1/badges/:id/embed - Returneaza embed code

**Webhooks**
POST /api/v1/webhooks - Configurare webhooks pentru alerte`,
  authStrategy: `Autentificare hibrida OAuth2 + JWT:

**Login Flow**: OAuth2 cu Google/GitHub ca primary, email/password ca fallback. NextAuth.js gestioneaza sesiunile.
**Token Management**: JWT cu access token (15min TTL) + refresh token (7 zile). Stocat in httpOnly cookies.
**API Keys**: Pentru integrari externe, fiecare user poate genera API keys cu scope-uri limitate (read:scans, write:campaigns).
**RBAC**: 3 roluri - owner (full access), member (read + scan), viewer (read only). Permisiunile sunt evaluate middleware-level.
**Multi-tenant Isolation**: Fiecare query este scoped la organizatia utilizatorului prin middleware. Row-level security in PostgreSQL ca layer suplimentar.
**Rate Limiting**: 100 req/min pentru free, 1000 req/min pentru pro, unlimited enterprise. Implementat cu Redis sliding window.`,
  deployment: `CI/CD Pipeline cu GitHub Actions:

**Build Stage**: Lint + TypeScript check + Unit tests (Vitest) + Build Docker images
**Test Stage**: Integration tests contra PostgreSQL + Redis in containers. E2E tests cu Playwright.
**Staging**: Auto-deploy pe push la main. Ruleaza pe AWS ECS Fargate. Database migrations automate cu Prisma.
**Production**: Manual approval required. Blue-green deployment pe ECS. Rollback automat daca health checks fail.
**Monitoring**: Datadog pentru APM + logs. Sentry pentru error tracking. PagerDuty pentru alerting.

Environments: dev (local Docker Compose), staging (AWS, date sintetice), production (AWS, multi-AZ).`,
  infrastructure: `Cloud Infrastructure pe AWS:

**Compute**: ECS Fargate pentru toate serviciile. Auto-scaling bazat pe CPU/memory (min 2, max 20 tasks).
**Database**: RDS PostgreSQL 16 Multi-AZ cu read replicas. Automated backups daily, retention 30 zile.
**Cache**: ElastiCache Redis cluster pentru sesiuni, rate limiting si job queues BullMQ.
**Storage**: S3 pentru rapoarte generate, scan artifacts si static assets (badge images).
**CDN**: CloudFront pentru widget service si badge delivery. TTL 1h cu invalidare on-demand.
**Networking**: VPC cu public/private subnets. ALB pentru load balancing. WAF pentru protectie DDoS.
**Secrets**: AWS Secrets Manager pentru API keys, database credentials si OAuth secrets.
**IaC**: Terraform pentru toata infrastructura. State stocat in S3 cu DynamoDB locking.`,
  extraNotes: [
    "Consideram adaugarea unui AI chatbot in dashboard pentru suport tehnic",
    "Posibila integrare cu Stripe pentru billing automat in Q2",
  ],
}

export default function AnalysisPage() {
  const [productDoc, setProductDoc] = useState<Record<string, unknown>>({})
  const [technicalDoc, setTechnicalDoc] = useState<Record<string, unknown>>({})
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamContent, setStreamContent] = useState("")
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    try {
      const raw = localStorage.getItem("itfest_state")
      if (raw) {
        const parsed = JSON.parse(raw)
        let pDoc = {}
        let tDoc = {}
        if (parsed.productDocumentation) {
          try { pDoc = JSON.parse(parsed.productDocumentation) } catch { /* ignore */ }
        }
        if (parsed.technicalDocumentation) {
          try { tDoc = JSON.parse(parsed.technicalDocumentation) } catch { /* ignore */ }
        }
        // Use real data if available, otherwise fall back to mock
        setProductDoc(Object.keys(pDoc).length > 0 ? pDoc : MOCK_PRODUCT_DOC)
        setTechnicalDoc(Object.keys(tDoc).length > 0 ? tDoc : MOCK_TECHNICAL_DOC)
        if (parsed.requirements) setRequirements(parsed.requirements)
      } else {
        // No localStorage data — use mock
        setProductDoc(MOCK_PRODUCT_DOC)
        setTechnicalDoc(MOCK_TECHNICAL_DOC)
      }
    } catch {
      setProductDoc(MOCK_PRODUCT_DOC)
      setTechnicalDoc(MOCK_TECHNICAL_DOC)
    }
  }, [])

  // Persist requirements
  useEffect(() => {
    if (!isHydrated || requirements.length === 0) return
    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem("itfest_state", JSON.stringify({ ...existing, requirements }))
    } catch { /* quota */ }
  }, [requirements, isHydrated])

  const hasProductDoc = Boolean(productDoc.title && productDoc.objective)
  const hasTechnicalDoc = Boolean((technicalDoc.techStack as string[] | undefined)?.length)
  const hasDocs = hasProductDoc || hasTechnicalDoc

  async function generateRequirements() {
    setIsGenerating(true)
    setStreamContent("")
    setRequirements([])

    try {
      const res = await fetch("/api/generate-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productDoc, technicalDoc }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.error) throw new Error(json.error)
            if (json.delta) {
              full += json.delta
              setStreamContent((prev) => prev + json.delta)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      // Parse JSON from response
      const jsonMatch = full.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as Requirement[]
          setRequirements(parsed)
        } catch {
          setRequirements([])
        }
      }
    } catch (err) {
      setStreamContent(`Error: ${err}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const priorityConfig = {
    "must-have": { color: "#ffb4ab", icon: "priority_high", bg: "bg-[#ffb4ab]/10" },
    "should-have": { color: "#ffd080", icon: "arrow_upward", bg: "bg-[#ffd080]/10" },
    "nice-to-have": { color: "#86948a", icon: "arrow_downward", bg: "bg-[#86948a]/10" },
  }

  if (!isHydrated) {
    return <div className="flex h-screen items-center justify-center bg-background"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />

      {/* Sidebar */}
      <aside className="hidden w-[264px] shrink-0 border-r border-border/20 bg-sidebar lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5 border-b border-border/20 px-5 py-3">
          <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
            <span className="material-symbols-outlined text-primary-foreground" style={{ fontSize: 14 }}>code</span>
          </div>
          <span className="font-brand text-sm font-bold tracking-tight text-foreground">AgenticSDLC</span>
        </div>
        <SDLCSidebar />
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/20 px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-foreground">Analysis</h1>
            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">PHASE 2</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-1 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Planning
            </a>
            {requirements.length > 0 && (
              <a
                href="/design"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Design
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </a>
            )}
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
            {/* Documentation Summary */}
            <div className="grid grid-cols-2 gap-4">
              {/* Product Doc Summary */}
              <div className="rounded-xl border border-border/20 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>description</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Product Documentation</span>
                  {hasProductDoc && <span className="ml-auto size-2 rounded-full bg-emerald-500" />}
                </div>
                {hasProductDoc ? (
                  <div className="space-y-2">
                    {productDoc.title ? <p className="text-sm font-semibold text-foreground">{String(productDoc.title)}</p> : null}
                    {productDoc.objective ? <p className="text-xs text-muted-foreground line-clamp-3">{String(productDoc.objective)}</p> : null}
                    {(productDoc.scope as string[] | undefined)?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {(productDoc.scope as string[]).slice(0, 4).map((s, i) => (
                          <span key={i} className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">{s}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/40">No product documentation yet. Go back to Planning.</p>
                )}
              </div>

              {/* Technical Doc Summary */}
              <div className="rounded-xl border border-border/20 bg-card/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>architecture</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Technical Documentation</span>
                  {hasTechnicalDoc && <span className="ml-auto size-2 rounded-full bg-emerald-500" />}
                </div>
                {hasTechnicalDoc ? (
                  <div className="space-y-2">
                    {technicalDoc.architecture ? <p className="text-xs text-muted-foreground line-clamp-2">{String(technicalDoc.architecture)}</p> : null}
                    {(technicalDoc.techStack as string[] | undefined)?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {(technicalDoc.techStack as string[]).map((t, i) => (
                          <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground/40">No technical documentation yet. Go back to Planning.</p>
                )}
              </div>
            </div>

            {/* Generate Requirements Button */}
            {hasDocs && requirements.length === 0 && !isGenerating && (
              <button
                onClick={generateRequirements}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                Generate Requirements from Documentation
              </button>
            )}

            {/* Streaming Output */}
            {isGenerating && (
              <div className="rounded-xl border border-primary/20 bg-card/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Generating requirements...</span>
                </div>
                <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {streamContent || "Analyzing documentation..."}
                </pre>
              </div>
            )}

            {/* Requirements List */}
            {requirements.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">Requirements</span>
                  <div className="flex-1 h-px bg-border/20" />
                  <span className="font-mono text-[9px] text-muted-foreground/40">{requirements.length} items</span>
                </div>

                {/* Stats */}
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-card/40 border border-border/20 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60">Functional</span>
                    <span className="font-mono text-xs font-bold text-primary">{requirements.filter(r => r.kind === "functional").length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-card/40 border border-border/20 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground/60">Non-functional</span>
                    <span className="font-mono text-xs font-bold text-amber-500">{requirements.filter(r => r.kind === "non-functional").length}</span>
                  </div>
                </div>

                {/* Requirement Cards */}
                <div className="space-y-2">
                  {requirements.map((req, i) => {
                    const pConfig = priorityConfig[req.priority] || priorityConfig["nice-to-have"]
                    return (
                      <div
                        key={req.id || i}
                        className="rounded-xl border border-border/20 bg-card/30 p-4 transition-colors hover:bg-card/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <span className="font-mono text-[9px] font-bold text-muted-foreground/40">{req.id}</span>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground">{req.title}</h3>
                              <span className={cn(
                                "rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                req.kind === "functional" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-500"
                              )}>
                                {req.kind}
                              </span>
                              <span className={cn("flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold", pConfig.bg)} style={{ color: pConfig.color }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{pConfig.icon}</span>
                                {req.priority}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{req.detail}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Regenerate button */}
                <button
                  onClick={generateRequirements}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                  Regenerate
                </button>
              </div>
            )}

            {/* Empty state */}
            {!hasDocs && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <span className="material-symbols-outlined text-muted-foreground/20" style={{ fontSize: 48 }}>assignment</span>
                <p className="text-sm text-muted-foreground/40">No documentation available. Go back to Planning to create your product and technical documentation.</p>
                <a href="/" className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
                  Go to Planning
                </a>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
