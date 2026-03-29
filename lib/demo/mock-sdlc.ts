import type { AgentOutput, ImplementationVariant, UserStory, VariantId } from "@/lib/agents/types"

export type DemoRequirement = {
  id: string
  title: string
  detail: string
  kind: "functional" | "non-functional"
  priority: "must-have" | "should-have" | "nice-to-have"
}

export type DemoSecurityIssue = {
  id: string
  severity: "critical" | "high" | "medium" | "low"
  category: string
  title: string
  description: string
  location: string
  recommendation: string
  effort: string
}

export type DemoSecurityReport = {
  overallScore: number
  summary: string
  criticalIssues: number
  highIssues: number
  mediumIssues: number
  lowIssues: number
  issues: DemoSecurityIssue[]
  recommendations: string[]
}

export type DemoPokerAgent = {
  role: "frontend_dev" | "backend_dev" | "tech_lead"
  label: string
  color: string
  icon: string
  apiRole: string
  estimate: number | null
  reasoning: string
  revealed: boolean
}

export type DemoPokerLog = {
  agent: string
  color: string
  text: string
  timestamp: string
}

export type DemoPokerSession = {
  storyId: string
  phase: "idle" | "estimating" | "revealing" | "debating" | "done"
  agents: DemoPokerAgent[]
  logs: DemoPokerLog[]
  consensusEstimate: number | null
  pokerContext: string
}

export const DEMO_PRODUCT_DOC = {
  title: "Luminescent IDE",
  objective:
    "Un IDE colaborativ AI-native care accelereaza SDLC-ul de la idee pana la merge final, cu agenti specializati si human approval la fiecare handoff critic.",
  audience: [
    "Tech leads si engineering managers",
    "Echipe de produs care au nevoie de discovery si planning mai rapide",
    "Developeri full-stack care vor varianta de implementare si preview rapid",
    "Juriu sau stakeholderi care au nevoie de demo coerent end-to-end",
  ],
  scope: [
    "Conversatii AI pentru produs si arhitectura tehnica",
    "Generare de requirements si user stories trasabile",
    "Planning poker si assignment pe user stories",
    "3 variante de implementare pentru fiecare story",
    "Merge, preview si security review",
  ],
  outOfScope: [
    "Deploy complet automat in productie",
    "Management enterprise multi-tenant complet in prima versiune",
    "Integrarea cu toate tool-urile externe din ecosistemul SDLC",
  ],
  deliverables: [
    "Documentatie de produs si tehnica aprobata",
    "Backlog complet cu stories estimate",
    "Implementare generata cu preview si evaluare",
    "Raport de securitate si integrare finala",
  ],
  risks: [
    "Convorbirile live pot dura prea mult intr-un demo limitat la cateva minute",
    "Unele ecrane legacy folosesc localStorage si trebuie mentinute coerente cu backend-ul nou",
    "Preview-ul poate pica daca workspace-ul este incomplet sau invalid",
  ],
  extraNotes: [
    "Pentru demo vrem mock completion controlat la fiecare etapa, fara sa inlocuim fluxul live.",
  ],
} satisfies Record<string, unknown>

export const DEMO_TECHNICAL_DOC = {
  techStack: [
    "Next.js App Router",
    "TypeScript",
    "Tailwind CSS",
    "OpenAI API",
    "AWS Bedrock",
    "esbuild preview runtime",
    "JSON local project store",
  ],
  architecture:
    "Frontend-ul ruleaza in Next.js si foloseste route handlers pentru orchestration. Persistenta proiectelor este locala, pe fisiere JSON. Preview-ul compileaza workspace-ul generat cu esbuild si shims pentru modulele Next, apoi monteaza pagina in browser ca runtime izolat.",
  database:
    "Modelul de date include brief, documentatie, requirements, stories, variante de implementare, activity feed, artefacte, workspace files/folders si rapoarte de securitate si health. Pentru demo, toate acestea sunt persistate local.",
  apis:
    "API-urile relevante sunt /api/project pentru state orchestration, /api/messages pentru discutii business/tech, /api/workspace/* pentru fisiere si /api/preview pentru runtime preview. Agentii specializati sunt apelati prin /api/agent.",
  authStrategy:
    "In demo autentificarea poate fi optionala, dar pentru productie sunt necesare roluri pe proiect, human approval audit trail si izolare stricta a resurselor.",
  deployment:
    "Pentru demo local se foloseste next dev. Pentru productie, aplicatia poate rula pe Amplify sau App Runner, cu timeout-uri configurabile pe route handlers si erori de preview tratate elegant.",
  infrastructure:
    "Aplicatia tinta foloseste hosting Next.js, storage pentru artefacte, persisenta de proiect si actualizari live pentru activitatea agentilor. In demo, aceste componente sunt simulate local pentru viteza si predictibilitate.",
  extraNotes: [
    "Fiecare etapa trebuie sa poata fi completata instant dintr-un buton de demo.",
  ],
} satisfies Record<string, unknown>

export const DEMO_REQUIREMENTS: DemoRequirement[] = [
  {
    id: "REQ-001",
    title: "Conversatii AI structurate pentru discovery",
    detail: "Sistemul trebuie sa permita conversatii separate pentru business discovery si technical discovery, cu actualizare progresiva a documentatiei in UI.",
    kind: "functional",
    priority: "must-have",
  },
  {
    id: "REQ-002",
    title: "Generare trasabila de requirements si backlog",
    detail: "Aplicatia trebuie sa transforme documentatia aprobata in requirements, features si user stories ce pot fi urmarite pana la implementare.",
    kind: "functional",
    priority: "must-have",
  },
  {
    id: "REQ-003",
    title: "Planning poker cu agenti specializati",
    detail: "Pentru fiecare user story, sistemul trebuie sa simuleze estimare si consens intre agenti Frontend, Backend si Tech Lead.",
    kind: "functional",
    priority: "should-have",
  },
  {
    id: "REQ-004",
    title: "Generare de variante multiple de implementare",
    detail: "Fiecare user story trebuie sa poata produce trei variante distincte de implementare, fiecare cu reasoning, orchestrare, cod si audit de securitate.",
    kind: "functional",
    priority: "must-have",
  },
  {
    id: "REQ-005",
    title: "Preview executabil al aplicatiei generate",
    detail: "Workspace-ul rezultat trebuie sa poata fi previzualizat rapid intr-un runtime de browser care compileaza codul generat.",
    kind: "functional",
    priority: "must-have",
  },
  {
    id: "REQ-006",
    title: "Demo acceleration mode",
    detail: "Aplicatia trebuie sa ofere mock completion pe fiecare faza pentru demo-uri live, fara sa elimine flow-ul real de lucru.",
    kind: "functional",
    priority: "must-have",
  },
  {
    id: "REQ-007",
    title: "Rezistenta la timeout in etapele lente",
    detail: "Rutele care genereaza artefacte mari sau preview-uri trebuie sa suporte durate mai lungi si sa ofere fallback-uri clare in caz de esec.",
    kind: "non-functional",
    priority: "should-have",
  },
  {
    id: "REQ-008",
    title: "Audit si security review vizibil",
    detail: "Sistemul trebuie sa sintetizeze automat vulnerabilitati, severitate si remedieri inainte de merge final.",
    kind: "non-functional",
    priority: "should-have",
  },
]

export const DEMO_BACKLOG_STORIES: UserStory[] = [
  {
    id: "STORY-001",
    reqId: "REQ-001",
    title: "Discovery workspace cu chat-uri separate pentru business si technical",
    description:
      "As a tech lead, I want distinct AI conversations for product and technical discovery so that I can clarify the idea quickly and keep the resulting documentation structured.",
    status: "pending",
    variants: [],
    priority: "critical",
    type: "feature",
    labels: ["frontend", "backend", "ai", "documentation"],
    acceptanceCriteria: [
      "Business si technical chat sunt afisate separat si pot fi folosite independent.",
      "Documentatia vizuala se actualizeaza in functie de progresul conversatiilor.",
      "Utilizatorul poate sari rapid in Analysis dupa completarea documentatiei.",
    ],
  },
  {
    id: "STORY-002",
    reqId: "REQ-002",
    title: "Requirements si backlog generate din documentatie",
    description:
      "As a product manager, I want requirements and user stories generated from the approved docs so that the team can move from discovery to planning without retyping context.",
    status: "pending",
    variants: [],
    priority: "high",
    type: "feature",
    labels: ["planning", "requirements", "backlog"],
    acceptanceCriteria: [
      "Requirements sunt generate din documentatia de produs si cea tehnica.",
      "Backlog-ul rezultat include user stories clare si acceptance criteria.",
      "Stories pot fi estimate si folosite direct in Implementation.",
    ],
  },
  {
    id: "STORY-003",
    reqId: "REQ-004",
    title: "Pipeline de implementare cu 3 variante, evaluator si preview",
    description:
      "As a developer, I want three implementation variants plus evaluation and preview so that I can compare solutions quickly and present the best one live.",
    status: "pending",
    variants: [],
    priority: "critical",
    type: "feature",
    labels: ["implementation", "preview", "security"],
    acceptanceCriteria: [
      "Fiecare story produce variante A, B si C cu cod si audit.",
      "Evaluatorul compara variantele si permite alegerea uneia.",
      "Testing si Maintenance pot continua cu date coerente dupa selectie.",
    ],
  },
]

const DEMO_POKER_AGENT_TEMPLATES: Omit<DemoPokerAgent, "estimate" | "reasoning" | "revealed">[] = [
  { role: "frontend_dev", label: "Frontend Agent", color: "#6ffbbe", icon: "web", apiRole: "Frontend Agent" },
  { role: "backend_dev", label: "Backend Agent", color: "#4ae176", icon: "dns", apiRole: "Backend Agent" },
  { role: "tech_lead", label: "Tech Lead Agent", color: "#4edea3", icon: "stars", apiRole: "Tech Lead Agent" },
]

const DEMO_ESTIMATE_MATRIX: Record<string, { frontend: number; backend: number; lead: number; consensus: number; assignee: string }> = {
  "STORY-001": { frontend: 5, backend: 8, lead: 5, consensus: 5, assignee: "Backend Agent" },
  "STORY-002": { frontend: 3, backend: 5, lead: 5, consensus: 5, assignee: "Backend Agent" },
  "STORY-003": { frontend: 8, backend: 8, lead: 13, consensus: 8, assignee: "Tech Lead Agent" },
}

function makeOutput(role: AgentOutput["role"], content: string): AgentOutput {
  return {
    role,
    status: "done",
    content,
    timestamp: "10:00:00",
  }
}

function makeSecurityContent(title: string) {
  return `PATCHED_BACKEND:
\`\`\`typescript
// Patched backend for ${title}
export async function run${title.replace(/[^a-z0-9]/gi, "")}Flow() {
  return { ok: true, source: "security-patched-backend" }
}
\`\`\`

PATCHED_FRONTEND:
\`\`\`typescript
export function ${title.replace(/[^a-z0-9]/gi, "")}Panel() {
  return <section data-demo="security-patched-frontend">Ready</section>
}
\`\`\`

AUDIT:
{"vulnerabilities":1,"complianceScore":96,"issues":[{"id":"SEC-101","severity":"low","title":"Input validation strengthened","description":"Added safer defaults and stricter validation in the generated path.","agentAction":"Patched frontend and backend demo code.","agentResult":"Variant is safe for demo flow.","source":"backend"}]}`
}

function makeVariant(variantId: VariantId, title: string, focus: string): ImplementationVariant {
  return {
    id: variantId,
    orchestrator: makeOutput(
      "orchestrator",
      `Status: ready-for-review
Mapping: Backend orchestration and UI flow are aligned for ${title.toLowerCase()}.
Completed:
- Defined the runtime path for ${title.toLowerCase()}
Pending:
- Human review and merge selection`
    ),
    backend: makeOutput(
      "backend",
      `export async function ${title.replace(/[^a-z0-9]/gi, "")}${variantId}Handler() {
  return {
    status: "ok",
    variant: "${variantId}",
    focus: ${JSON.stringify(focus)},
  }
}`
    ),
    frontend: makeOutput(
      "frontend",
      `export default function ${title.replace(/[^a-z0-9]/gi, "")}${variantId}View() {
  return (
    <main>
      <h1>${title} · Variant ${variantId}</h1>
      <p>${focus}</p>
    </main>
  )
}`
    ),
    security: makeOutput("security", makeSecurityContent(`${title}${variantId}`)),
  }
}

export function createDemoImplementedStories(): UserStory[] {
  return DEMO_BACKLOG_STORIES.map((story, index) => {
    const variantA = makeVariant("A", story.title, "Fastest path with integrated UI and orchestration.")
    const variantB = makeVariant("B", story.title, "Balanced structure with clearer boundaries and safer review flow.")
    const variantC = makeVariant("C", story.title, "Most modular path, optimized for extension and future scale.")

    return {
      ...story,
      status: "done",
      variants: [variantA, variantB, variantC],
      chosenVariant: (index === 1 ? "A" : "B") as VariantId,
    }
  })
}

export function createDemoPokerSessions(): Record<string, DemoPokerSession> {
  const result: Record<string, DemoPokerSession> = {}

  for (const story of DEMO_BACKLOG_STORIES) {
    const estimate = DEMO_ESTIMATE_MATRIX[story.id]
    result[story.id] = {
      storyId: story.id,
      phase: "done",
      consensusEstimate: estimate.consensus,
      pokerContext: [
        `Planning Poker Result: Consensus = ${estimate.consensus} pts`,
        `Frontend Agent estimated ${estimate.frontend} based on UI coordination and interface polish.`,
        `Backend Agent estimated ${estimate.backend} based on orchestration complexity and data flow.`,
        `Tech Lead Agent estimated ${estimate.lead} based on cross-phase coupling and review effort.`,
      ].join("\n"),
      logs: [
        {
          agent: "Frontend Agent",
          color: "#6ffbbe",
          text: `I estimate ${estimate.frontend} pts because the UI needs strong presentation quality and structured flows.`,
          timestamp: "10:01:00",
        },
        {
          agent: "Backend Agent",
          color: "#4ae176",
          text: `I estimate ${estimate.backend} pts due to orchestration, persistence, and compatibility with the legacy state model.`,
          timestamp: "10:01:08",
        },
        {
          agent: "Tech Lead Agent",
          color: "#4edea3",
          text: `Consensus should converge near ${estimate.consensus} pts so the team can demo fast without underestimating coordination overhead.`,
          timestamp: "10:01:16",
        },
      ],
      agents: DEMO_POKER_AGENT_TEMPLATES.map((agent) => ({
        ...agent,
        estimate:
          agent.role === "frontend_dev"
            ? estimate.frontend
            : agent.role === "backend_dev"
              ? estimate.backend
              : estimate.lead,
        reasoning:
          agent.role === "frontend_dev"
            ? "UI and interaction polish drive the estimate."
            : agent.role === "backend_dev"
              ? "State sync and orchestration make the backend slightly heavier."
              : "This estimate balances delivery speed with demo reliability.",
        revealed: true,
      })),
    }
  }

  return result
}

export function createDemoStoryAssignees(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(DEMO_ESTIMATE_MATRIX).map(([storyId, value]) => [storyId, value.assignee])
  )
}

export function createDemoReasoningContent() {
  const result: Record<string, string> = {}

  for (const story of DEMO_BACKLOG_STORIES) {
    for (const variantId of ["A", "B", "C"] as VariantId[]) {
      result[`${story.id}:${variantId}`] = `Story Analysis:
This story covers ${story.title.toLowerCase()} and is already decomposed for demo presentation.

Needs Frontend: yes

Backend Tasks:
- Expose the route and orchestration path for ${story.id}
- Return deterministic demo data for the selected variant

Frontend Tasks:
- Render the ${story.id} experience in the UI

Security Tasks:
- Validate generated input and keep the demo state isolated`
    }
  }

  return result
}

export function createDemoEvalContent() {
  const result: Record<string, string> = {}

  for (const story of DEMO_BACKLOG_STORIES) {
    result[story.id] = JSON.stringify({
      A: {
        pros: ["Fastest runtime path", "Compact implementation surface"],
        cons: ["Tighter coupling", "Less room for extension"],
        complexityScore: 5,
        recommended: false,
      },
      B: {
        pros: ["Best demo balance", "Clear architecture and readable output"],
        cons: ["Slightly more code than A"],
        complexityScore: 6,
        recommended: true,
      },
      C: {
        pros: ["Strongest extensibility", "Best long-term isolation"],
        cons: ["Highest complexity for a live demo"],
        complexityScore: 8,
        recommended: false,
      },
    })
  }

  return result
}

export function createDemoNoFrontend() {
  const result: Record<string, boolean> = {}

  for (const story of DEMO_BACKLOG_STORIES) {
    for (const variantId of ["A", "B", "C"] as VariantId[]) {
      result[`${story.id}:${variantId}`] = false
    }
  }

  return result
}

export function createDemoChatMessages() {
  const result: Record<string, Array<{ id: string; role: "user" | "agent"; content: string; timestamp: string }>> = {}

  for (const story of DEMO_BACKLOG_STORIES) {
    for (const variantId of ["A", "B", "C"] as VariantId[]) {
      result[`${story.id}:${variantId}`] = [
        {
          id: `${story.id}-${variantId}-chat-1`,
          role: "user",
          content: "Refine this variant so it is easier to explain in the live demo.",
          timestamp: "10:02:00",
        },
        {
          id: `${story.id}-${variantId}-chat-2`,
          role: "agent",
          content: "Variant updated with cleaner responsibilities and clearer UI messaging.",
          timestamp: "10:02:12",
        },
      ]
    }
  }

  return result
}

export const DEMO_TESTING_SELECTIONS = [
  { id: "STORY-001", variant: "B" },
  { id: "STORY-002", variant: "A" },
  { id: "STORY-003", variant: "B" },
]

export const DEMO_MERGED_CODE: Record<string, string> = {
  "/package.json": JSON.stringify(
    {
      name: "luminescent-demo",
      private: true,
      dependencies: {
        next: "^16.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
      },
    },
    null,
    2
  ),
  "/src/app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
  "/src/app/page.tsx": `const stories = [
  "Discovery workspace",
  "Requirements and backlog",
  "Implementation preview",
]

export default function Page() {
  return (
    <main style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Luminescent IDE Demo Runtime</h1>
      <p>All major SDLC phases were completed through guided mock data.</p>
      <ul>
        {stories.map((story) => <li key={story}>{story}</li>)}
      </ul>
    </main>
  )
}`,
  "/src/lib/project-metadata.ts": `export const projectMetadata = {
  title: "Luminescent IDE",
  mode: "demo-merge",
  mergedStories: ${JSON.stringify(DEMO_TESTING_SELECTIONS.map((item) => item.id), null, 2)},
}`,
}

export const DEMO_SECURITY_REPORT: DemoSecurityReport = {
  overallScore: 94,
  summary:
    "The demo project is in a strong state for presentation. No critical findings remain, and the visible issues are mostly hardening tasks for a production rollout.",
  criticalIssues: 0,
  highIssues: 1,
  mediumIssues: 1,
  lowIssues: 2,
  issues: [
    {
      id: "SEC-201",
      severity: "high",
      category: "Authorization",
      title: "Project-scoped access control should be enforced everywhere",
      description: "The demo flow assumes trusted users. A production version should enforce project-level scoping in all state-changing operations.",
      location: "/api/project and /api/workspace/*",
      recommendation: "Add per-project authorization checks before mutations and preview access.",
      effort: "M",
    },
    {
      id: "SEC-202",
      severity: "medium",
      category: "Validation",
      title: "Generated payloads should be schema-validated at boundaries",
      description: "The system accepts AI-generated shapes in several flows and would benefit from stricter runtime validation.",
      location: "route handlers for generation and persistence",
      recommendation: "Introduce schema validation for incoming request bodies and AI outputs.",
      effort: "M",
    },
    {
      id: "SEC-203",
      severity: "low",
      category: "Observability",
      title: "Preview build failures should be logged centrally",
      description: "Preview errors are rendered well in UI, but centralized operational logging would improve incident analysis.",
      location: "preview runtime pipeline",
      recommendation: "Ship preview build failures to a shared telemetry sink.",
      effort: "S",
    },
    {
      id: "SEC-204",
      severity: "low",
      category: "Rate limiting",
      title: "Agent-heavy routes would benefit from explicit rate limits",
      description: "Demo traffic is safe, but production should protect long-running AI routes from burst abuse.",
      location: "/api/agent and generation routes",
      recommendation: "Apply route-level rate limiting and concurrency caps.",
      effort: "S",
    },
  ],
  recommendations: [
    "Add explicit authorization for project-scoped mutations before production.",
    "Validate AI-generated JSON and user input at route boundaries.",
    "Introduce route-level rate limiting for expensive generation endpoints.",
    "Add centralized telemetry for preview bundle failures and merge failures.",
  ],
}
