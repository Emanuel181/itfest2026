"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { SDLCSidebar } from "@/components/sdlc-sidebar"
import { ChatPanel, type ChatMessage } from "@/components/planning/chat-panel"
import { DocSidePanel } from "@/components/planning/doc-side-panel"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProjectState } from "@/lib/backend/types"

type PlanningPageProps = {
  initialProject: ProjectState
  initialProjectId: string
}

const PRODUCT_SECTIONS = [
  { label: "Title", key: "title", type: "text" as const },
  { label: "Objective", key: "objective", type: "text" as const },
  { label: "Target Audience", key: "audience", type: "list" as const },
  { label: "Scope", key: "scope", type: "list" as const },
  { label: "Out of Scope", key: "outOfScope", type: "list" as const },
  { label: "Deliverables", key: "deliverables", type: "list" as const },
  { label: "Risks", key: "risks", type: "list" as const },
  { label: "Extra Notes", key: "extraNotes", type: "list" as const },
]

const TECHNICAL_SECTIONS = [
  { label: "Tech Stack", key: "techStack", type: "list" as const },
  { label: "Architecture", key: "architecture", type: "text" as const },
  { label: "Database", key: "database", type: "text" as const },
  { label: "APIs", key: "apis", type: "text" as const },
  { label: "Auth Strategy", key: "authStrategy", type: "text" as const },
  { label: "Deployment", key: "deployment", type: "text" as const },
  { label: "Infrastructure", key: "infrastructure", type: "text" as const },
  { label: "Extra Notes", key: "extraNotes", type: "list" as const },
]

const PRODUCT_QUESTIONS = [
  { key: "title", label: "Product Name" },
  { key: "objective", label: "Objective" },
  { key: "audience", label: "Target Audience" },
  { key: "scope", label: "Scope" },
  { key: "outOfScope", label: "Out of Scope" },
  { key: "deliverables", label: "Deliverables" },
  { key: "risks", label: "Risks" },
]

const TECHNICAL_QUESTIONS = [
  { key: "techStack", label: "Tech Stack" },
  { key: "architecture", label: "Architecture" },
  { key: "database", label: "Database" },
  { key: "apis", label: "APIs" },
  { key: "authStrategy", label: "Auth Strategy" },
  { key: "deployment", label: "Deployment" },
  { key: "infrastructure", label: "Infrastructure" },
]

const PRODUCT_STARTERS = [
  "Am o idee de aplicatie web",
  "Vreau sa construiesc un SaaS",
  "Am nevoie de un dashboard",
  "Vreau o platforma de e-commerce",
]

const TECHNICAL_STARTERS = [
  "Ce stack recomanzi?",
  "Vreau sa folosesc Next.js",
  "Am nevoie de o baza de date",
  "Cum ar trebui sa structurez API-ul?",
]

const MOCK_PRODUCT_DOC = {
  title: "Luminescent IDE",
  objective:
    "Un IDE web colaborativ, AI-native, care ghideaza echipele software prin toate etapele SDLC si produce artefacte clare, cod si preview-uri cu human approval la fiecare tranzitie importanta.",
  audience: [
    "Echipe de dezvoltare software din startup-uri si companii de produs",
    "Tech leads si engineering managers care coordoneaza livrarea",
    "Developeri full-stack care vor accelerare in discovery, planning si implementation",
    "Hackathoane si demo-uri unde viteza de trecere prin SDLC conteaza",
  ],
  scope: [
    "Convorbire AI structurata pentru business discovery si technical discovery",
    "Generare de requirements, features si user stories trasabile",
    "3 variante paralele de implementare pentru fiecare user story",
    "Security review, merge orchestration si project review",
    "Workspace cu preview live pentru aplicatia generata",
  ],
  outOfScope: [
    "Deploy automat in productie in prima versiune",
    "Integrare cu toate platformele externe de issue tracking din prima iteratie",
    "Editare colaborativa avansata in timp real pentru cod sursa final",
  ],
  deliverables: [
    "Brief de produs si documentatie tehnica aprobate",
    "Requirements, feature backlog si user stories aprobate",
    "Workspace generat cu preview functional",
    "Security report, merge log si project health report",
  ],
  risks: [
    "Conversatiile de discovery pot dura prea mult pentru demo-uri live",
    "Output-ul AI poate deveni inconsistent intre ecranele legacy si backend-ul nou",
    "Preview-ul poate esua daca workspace-ul generat contine cod invalid",
  ],
  extraNotes: [
    "Aplicatia trebuie sa aiba si un mod rapid pentru demo, fara a parcurge manual tot discovery-ul.",
  ],
} satisfies Record<string, unknown>

const MOCK_TECHNICAL_DOC = {
  techStack: [
    "Next.js 16 App Router",
    "TypeScript",
    "Tailwind CSS",
    "OpenAI API",
    "AWS Bedrock",
    "esbuild runtime preview",
    "Local JSON project store",
  ],
  architecture:
    "Aplicatia foloseste un frontend Next.js cu route handlers server-side pentru orchestration. Un backend local persistent pastreaza proiectele, artefactele si workspace-ul. Preview-ul compileaza fisierele generate din workspace cu esbuild si monteaza pagina intr-un runtime de browser izolat.",
  database:
    "Pentru demo si dezvoltare folosim persistenta locala in fisiere JSON pe proiect. Modelul de date contine brief, requirements, features, user stories, variante, artefacte, activity feed, workspace files/folders, security report, merge report si project health.",
  apis:
    "API-urile principale sunt /api/project pentru orchestration state, /api/messages pentru conversatii business/tech, /api/workspace/* pentru fisiere si foldere, /api/preview pentru runtime preview si /api/agent pentru streaming de output de la agenti specializati.",
  authStrategy:
    "Pentru demo autentificarea este optionala. Pentru productie recomandam autentificare cu Cognito sau NextAuth, roluri pe proiect si audit trail pentru toate aprobarile dintre etapele SDLC.",
  deployment:
    "Frontend-ul poate rula pe Amplify sau App Runner. Pentru demo local folosim next dev. Etapele lente trebuie sa aiba timeout configurabil, iar preview-ul trebuie sa poata esua elegant fara sa blocheze proiectul.",
  infrastructure:
    "Arhitectura target include hosting Next.js, storage pentru artefacte, persistenta pentru proiecte si WebSockets pentru activity feed live. In demo, aceste responsabilitati sunt emulate local pentru viteza si predictibilitate.",
  extraNotes: [
    "Pentru prezentari avem nevoie de un buton de mock conversation care umple instant documentatia si deblocheaza etapa urmatoare.",
  ],
} satisfies Record<string, unknown>

const MOCK_PRODUCT_MESSAGES: ChatMessage[] = [
  {
    id: "mock-product-human-1",
    author: "You",
    role: "human",
    text: "Vreau un IDE web AI-native pentru echipe software, unde agentii participa in fiecare etapa din SDLC si oamenii aproba tranzitiile critice.",
  },
  {
    id: "mock-product-ai-1",
    author: "Product AI",
    role: "ai",
    text: "Am inteles: produsul este un workspace colaborativ orientat pe SDLC complet, nu doar un chat cu AI. Accentul cade pe orchestrare, trasabilitate si handoff-uri clare intre ideation, planning, implementation si review.",
  },
  {
    id: "mock-product-human-2",
    author: "You",
    role: "human",
    text: "Pentru demo vreau sa pot genera rapid brief, requirements, user stories, cod si preview, fara sa stau prea mult in discovery.",
  },
  {
    id: "mock-product-ai-2",
    author: "Product AI",
    role: "ai",
    text: "Perfect. Pentru prezentare, produsul trebuie sa sustina atat flow-ul complet, cat si un fast-forward controlat pentru demo-uri live.",
  },
]

const MOCK_TECHNICAL_MESSAGES: ChatMessage[] = [
  {
    id: "mock-tech-human-1",
    author: "You",
    role: "human",
    text: "Vreau frontend in Next.js, preview runtime pentru workspace si agenti care genereaza artefacte si variante de implementare.",
  },
  {
    id: "mock-tech-ai-1",
    author: "Tech AI",
    role: "ai",
    text: "Directia tehnica buna este un backend orchestrat prin route handlers, persistenta locala pe proiect si runtime preview care bundle-uieste fisierele generate. Astfel demo-ul ramane rapid, iar proiectul pastreaza trasabilitatea.",
  },
  {
    id: "mock-tech-human-2",
    author: "You",
    role: "human",
    text: "Mai vreau un shortcut pentru demo care sa precompleteze conversatiile business si technical si sa ne lase sa trecem imediat la Analysis.",
  },
  {
    id: "mock-tech-ai-2",
    author: "Tech AI",
    role: "ai",
    text: "Atunci trebuie sa populam instant documentatia, progresul intrebarilor si brief-ul minim necesar in backend, plus persistenta locala pentru ecranele legacy.",
  },
]

// List-type fields where semicolon-separated values become arrays
const LIST_FIELDS = new Set(["audience", "scope", "outOfScope", "deliverables", "risks", "techStack", "extraNotes"])

/**
 * Parse [DOC:field]content[/DOC] tags from agent response
 */
function parseDocTags(text: string): Record<string, unknown> | null {
  const regex = /\[DOC:(\w+)\]([\s\S]*?)\[\/DOC\]/g
  const result: Record<string, unknown> = {}
  let match: RegExpExecArray | null
  let found = false

  while ((match = regex.exec(text)) !== null) {
    found = true
    const field = match[1]
    const content = match[2].trim()

    if (LIST_FIELDS.has(field)) {
      result[field] = content.split(";").map((s) => s.trim()).filter(Boolean)
    } else {
      result[field] = content
    }
  }

  return found ? result : null
}

/**
 * Strip [DOC:field]...[/DOC] tags from display text
 */
function stripDocTags(text: string): string {
  return text.replace(/\[DOC:\w+\][\s\S]*?\[\/DOC\]/g, "").trim()
}

function withProjectQuery(url: string, projectId: string) {
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}project=${projectId}`
}

/**
 * Stream response from /api/agent-chat endpoint
 */
async function callAgentChatStream(
  agent: "product" | "technical",
  message: string,
  onChunk: (delta: string) => void
): Promise<string> {
  const res = await fetch("/api/agent-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, message }),
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
      const json = JSON.parse(line.slice(6))
      if (json.error) throw new Error(json.error)
      if (json.delta) { full += json.delta; onChunk(json.delta) }
    }
  }
  return full
}

/**
 * Call /api/summarize-doc for AI-powered document extraction
 */
async function callSummarizeDoc(
  type: "product" | "technical",
  messages: Array<{ role: string; text: string }>,
  currentDoc: Record<string, unknown>,
  productDoc?: Record<string, unknown>
): Promise<{
  doc: Record<string, unknown>
  completedFields: string[]
  allQuestionsAnswered: boolean
}> {
  const res = await fetch("/api/summarize-doc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, messages, currentDoc, productDoc }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/**
 * Derive question progress from doc state
 */
function deriveProgress(doc: Record<string, unknown>, questions: typeof PRODUCT_QUESTIONS): Record<string, boolean> {
  const progress: Record<string, boolean> = {}
  for (const q of questions) {
    const val = doc[q.key]
    if (Array.isArray(val)) {
      progress[q.key] = val.length > 0
    } else if (typeof val === "string") {
      progress[q.key] = val.trim().length > 0
    } else {
      progress[q.key] = false
    }
  }
  return progress
}

export function PlanningPage({ initialProject, initialProjectId }: PlanningPageProps) {
  const [activeChannel, setActiveChannel] = useState<"product" | "technical">("product")
  const [productMessages, setProductMessages] = useState<ChatMessage[]>(() => {
    return initialProject.messages.business.map((m) => ({
      id: m.id,
      author: m.author,
      role: m.role,
      text: m.text,
    }))
  })
  const [technicalMessages, setTechnicalMessages] = useState<ChatMessage[]>(() => {
    return initialProject.messages.tech.map((m) => ({
      id: m.id,
      author: m.author,
      role: m.role,
      text: m.text,
    }))
  })
  const [productDoc, setProductDoc] = useState<Record<string, unknown>>(() => {
    if (initialProject.productDocumentation) {
      try { return JSON.parse(initialProject.productDocumentation) } catch { return {} }
    }
    const b = initialProject.brief
    if (b.title || b.objective) {
      return {
        title: b.title,
        objective: b.objective,
        audience: b.audience,
        scope: b.scope,
        deliverables: b.deliverables,
        risks: b.risks,
      }
    }
    return {}
  })
  const [technicalDoc, setTechnicalDoc] = useState<Record<string, unknown>>(() => {
    if (initialProject.technicalDocumentation) {
      try { return JSON.parse(initialProject.technicalDocumentation) } catch { return {} }
    }
    const b = initialProject.brief
    if (b.techStack?.length || b.architecture) {
      return {
        techStack: b.techStack,
        architecture: b.architecture,
        database: b.dbSchema,
      }
    }
    return {}
  })
  const [isSending, setIsSending] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [productProgress, setProductProgress] = useState<Record<string, boolean>>({})
  const [technicalProgress, setTechnicalProgress] = useState<Record<string, boolean>>({})
  const [isHydrated, setIsHydrated] = useState(false)
  const projectIdRef = useRef(initialProjectId)
  const handleSendProductRef = useRef<(text: string) => void>(() => {})
  const handleSendTechnicalRef = useRef<(text: string) => void>(() => {})
  const [cycleStarted, setCycleStarted] = useState(false)
  const [productComplete, setProductComplete] = useState(false)
  const [technicalComplete, setTechnicalComplete] = useState(false)
  const technicalAutoStarted = useRef(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Derive initial progress from existing docs
  useEffect(() => {
    if (isHydrated) {
      setProductProgress(deriveProgress(productDoc, PRODUCT_QUESTIONS))
      setTechnicalProgress(deriveProgress(technicalDoc, TECHNICAL_QUESTIONS))
      // Auto-detect if cycle was already started (has messages)
      if (productMessages.length > 0 || technicalMessages.length > 0) {
        setCycleStarted(true)
      }
      // Auto-detect if product was already complete
      const pProg = deriveProgress(productDoc, PRODUCT_QUESTIONS)
      if (PRODUCT_QUESTIONS.every((q) => pProg[q.key])) {
        setProductComplete(true)
      }
      // Auto-detect if technical was already complete
      const tProg = deriveProgress(technicalDoc, TECHNICAL_QUESTIONS)
      if (TECHNICAL_QUESTIONS.every((q) => tProg[q.key])) {
        setTechnicalComplete(true)
      }
      // If technical already has messages, mark auto-start as done
      if (technicalMessages.length > 0) {
        technicalAutoStarted.current = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated])

  const handleReset = useCallback(() => {
    setProductMessages([])
    setTechnicalMessages([])
    setProductDoc({})
    setTechnicalDoc({})
    setProductProgress({})
    setTechnicalProgress({})
    setActiveChannel("product")
    setCycleStarted(false)
    setProductComplete(false)
    setTechnicalComplete(false)
    technicalAutoStarted.current = false
    setIsSending(false)
    setIsSummarizing(false)
    // Clear localStorage
    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem("itfest_state", JSON.stringify({
        ...existing,
        productDocumentation: "{}",
        technicalDocumentation: "{}",
        productMessages: [],
        technicalMessages: [],
      }))
    } catch { /* ignore */ }
    // Reset backend project
    fetch(withProjectQuery("/api/project", projectIdRef.current), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "update-brief",
        brief: { title: "", objective: "", audience: [], scope: [], deliverables: [], risks: [], techStack: [], architecture: "", dbSchema: "" },
        productDocumentation: "{}",
        technicalDocumentation: "{}",
      }),
    }).catch(() => {})
  }, [])

  const handleStart = useCallback(() => {
    setCycleStarted(true)
    // Send an initial greeting to kick off the structured question flow
    // Use setTimeout to ensure handleSendProduct is available
    setTimeout(() => {
      const starter = "Salut! Vreau sa incep un proiect nou."
      handleSendProductRef.current(starter)
    }, 0)
  }, [])

  const handleMockConversation = useCallback(() => {
    const nextProductProgress = deriveProgress(MOCK_PRODUCT_DOC, PRODUCT_QUESTIONS)
    const nextTechnicalProgress = deriveProgress(MOCK_TECHNICAL_DOC, TECHNICAL_QUESTIONS)

    setCycleStarted(true)
    setProductMessages(MOCK_PRODUCT_MESSAGES)
    setTechnicalMessages(MOCK_TECHNICAL_MESSAGES)
    setProductDoc(MOCK_PRODUCT_DOC)
    setTechnicalDoc(MOCK_TECHNICAL_DOC)
    setProductProgress(nextProductProgress)
    setTechnicalProgress(nextTechnicalProgress)
    setProductComplete(true)
    setTechnicalComplete(true)
    setActiveChannel("technical")
    technicalAutoStarted.current = true

    const nextBrief = {
      ...initialProject.brief,
      title: String(MOCK_PRODUCT_DOC.title),
      objective: String(MOCK_PRODUCT_DOC.objective),
      audience: Array.isArray(MOCK_PRODUCT_DOC.audience) ? [...MOCK_PRODUCT_DOC.audience] : [],
      scope: Array.isArray(MOCK_PRODUCT_DOC.scope) ? [...MOCK_PRODUCT_DOC.scope] : [],
      deliverables: Array.isArray(MOCK_PRODUCT_DOC.deliverables) ? [...MOCK_PRODUCT_DOC.deliverables] : [],
      risks: Array.isArray(MOCK_PRODUCT_DOC.risks) ? [...MOCK_PRODUCT_DOC.risks] : [],
      techStack: Array.isArray(MOCK_TECHNICAL_DOC.techStack) ? [...MOCK_TECHNICAL_DOC.techStack] : [],
      architecture: String(MOCK_TECHNICAL_DOC.architecture),
      dbSchema: String(MOCK_TECHNICAL_DOC.database),
    }

    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem(
        "itfest_state",
        JSON.stringify({
          ...existing,
          productDocumentation: JSON.stringify(MOCK_PRODUCT_DOC),
          technicalDocumentation: JSON.stringify(MOCK_TECHNICAL_DOC),
          productMessages: MOCK_PRODUCT_MESSAGES,
          technicalMessages: MOCK_TECHNICAL_MESSAGES,
        })
      )
    } catch {
      // Ignore local persistence failures in demo mode.
    }

    void fetch(withProjectQuery("/api/project", projectIdRef.current), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "update-brief",
        brief: nextBrief,
        productDocumentation: JSON.stringify(MOCK_PRODUCT_DOC),
        technicalDocumentation: JSON.stringify(MOCK_TECHNICAL_DOC),
      }),
    }).catch(() => undefined)
  }, [initialProject.brief])

  // Save docs to localStorage for cross-page access
  useEffect(() => {
    if (!isHydrated) return
    try {
      const existing = JSON.parse(localStorage.getItem("itfest_state") || "{}")
      localStorage.setItem("itfest_state", JSON.stringify({
        ...existing,
        productDocumentation: JSON.stringify(productDoc),
        technicalDocumentation: JSON.stringify(technicalDoc),
        productMessages,
        technicalMessages,
      }))
    } catch { /* quota */ }
  }, [productDoc, technicalDoc, productMessages, technicalMessages, isHydrated])

  // All 7 product fields must be filled for product to be "ready"
  const productDocReady = PRODUCT_QUESTIONS.every((q) => productProgress[q.key])
  const technicalDocReady = TECHNICAL_QUESTIONS.every((q) => technicalProgress[q.key])

  // Next unanswered question for context injection
  const nextProductQuestion = PRODUCT_QUESTIONS.find((q) => !productProgress[q.key])
  const nextTechnicalQuestion = TECHNICAL_QUESTIONS.find((q) => !technicalProgress[q.key])

  // Current question label for the chat panel indicator
  const currentQuestionLabel = activeChannel === "product"
    ? productComplete ? "Extra Notes" : (nextProductQuestion?.label ?? "All topics covered")
    : technicalComplete ? "Extra Notes" : (nextTechnicalQuestion?.label ?? "All topics covered")

  const handleSendProduct = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      author: "You",
      role: "human",
      text,
    }
    setProductMessages((prev) => [...prev, userMsg])
    setIsSending(true)

    try {
      // Persist message to backend
      await fetch(withProjectQuery("/api/messages", projectIdRef.current), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "business", author: "You", text }),
      })

      // Build context string with history + current doc state + question progress
      const history = [...productMessages, userMsg].map(m =>
        `${m.role === "human" ? "User" : "AI"}: ${m.text}`
      ).join("\n")

      const currentDocStr = Object.keys(productDoc).length > 0
        ? `\n\nCurrent documentation state:\n${JSON.stringify(productDoc)}`
        : ""

      const progressStr = `\n\nQuestion progress: ${JSON.stringify(productProgress)}`
      const nextQ = PRODUCT_QUESTIONS.find((q) => !productProgress[q.key])
      const nextHint = nextQ
        ? `\nNext topic to cover: ${nextQ.key} (${nextQ.label})`
        : `\nAll 7 topics covered. Summarize and confirm with the user.`

      const fullInput = `Conversation history:\n${history}${currentDocStr}${progressStr}${nextHint}\n\nUser message: ${text}`

      let fullResponse = ""
      await callAgentChatStream("product", fullInput, (delta) => {
        fullResponse += delta
        const displayText = stripDocTags(fullResponse)
        setProductMessages((prev) => {
          const existing = prev.find((m) => m.id === "ai-streaming")
          if (existing) {
            return prev.map((m) => m.id === "ai-streaming" ? { ...m, text: displayText } : m)
          }
          return [...prev, { id: "ai-streaming", author: "Product AI", role: "ai", text: displayText }]
        })
      })

      // Parse doc updates from [DOC:field] tags (fast, immediate)
      const docUpdate = parseDocTags(fullResponse)
      if (docUpdate) {
        setProductDoc((prev) => {
          const merged = { ...prev }
          for (const [key, value] of Object.entries(docUpdate)) {
            if (value && (typeof value === "string" ? value.trim() : Array.isArray(value) && value.length)) {
              merged[key] = value
            }
          }
          return merged
        })
      }

      // When product doc is already complete, append user messages to extraNotes
      if (productComplete) {
        setProductDoc((prev) => {
          const existing = Array.isArray(prev.extraNotes) ? prev.extraNotes as string[] : []
          return { ...prev, extraNotes: [...existing, text] }
        })
      }

      // Finalize the streaming message
      const finalText = stripDocTags(fullResponse)
      setProductMessages((prev) =>
        prev.map((m) => m.id === "ai-streaming" ? { ...m, id: `msg-ai-${Date.now()}`, text: finalText } : m)
      )

      // AI-powered summarization (thorough extraction)
      setIsSummarizing(true)
      try {
        const allMessages = [...productMessages, userMsg, { id: "ai-final", author: "Product AI", role: "ai" as const, text: finalText }]
        const summaryResult = await callSummarizeDoc(
          "product",
          allMessages.map((m) => ({ role: m.role, text: m.text })),
          docUpdate ? { ...productDoc, ...docUpdate } : productDoc
        )

        // Merge summarized doc (additive — keep existing fields, update with new)
        if (summaryResult.doc && Object.keys(summaryResult.doc).length > 0) {
          setProductDoc((prev) => {
            const merged = { ...prev }
            for (const [key, value] of Object.entries(summaryResult.doc)) {
              if (value && (typeof value === "string" ? value.trim() : Array.isArray(value) && value.length)) {
                merged[key] = value
              }
            }
            return merged
          })
        }

        // Update question progress
        const newProgress: Record<string, boolean> = { ...productProgress }
        for (const field of summaryResult.completedFields) {
          newProgress[field] = true
        }
        setProductProgress(newProgress)

        // Notify user when all product questions are answered
        if (summaryResult.allQuestionsAnswered && !productComplete) {
          setProductComplete(true)
          // Add a system notification message in the chat
          setProductMessages((prev) => [
            ...prev,
            {
              id: `msg-complete-${Date.now()}`,
              author: "System",
              role: "ai",
              text: "**Documentatia de produs este completa!** Toate cele 7 sectiuni au fost acoperite.\n\nPoti continua sa discuti aici daca ai informatii suplimentare de adaugat — acestea vor fi salvate in sectiunea **Note Aditionale**.\n\nCand esti gata, apasa pe tab-ul **Technical** pentru a trece la documentatia tehnica.",
            },
          ])
        }
      } catch {
        // Summarization failed — fall back to DOC tag extraction progress
        setProductProgress(deriveProgress(docUpdate ? { ...productDoc, ...docUpdate } : productDoc, PRODUCT_QUESTIONS))
      } finally {
        setIsSummarizing(false)
      }

      // Persist updated doc
      const docStr = JSON.stringify(docUpdate ? { ...productDoc, ...docUpdate } : productDoc)
      await fetch(withProjectQuery("/api/project", projectIdRef.current), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update-brief",
          brief: {
            ...initialProject.brief,
            title: (docUpdate as Record<string, string>)?.title || productDoc.title || initialProject.brief.title,
          },
          productDocumentation: docStr,
        }),
      }).catch(() => {})
    } catch (err) {
      setProductMessages((prev) => [
        ...prev.filter((m) => m.id !== "ai-streaming"),
        { id: `msg-err-${Date.now()}`, author: "System", role: "ai", text: `Error: ${err}` },
      ])
    } finally {
      setIsSending(false)
    }
  }, [productMessages, productDoc, productProgress, productComplete, initialProject.brief])

  // Keep ref in sync for handleStart
  handleSendProductRef.current = handleSendProduct

  const handleSendTechnical = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      author: "You",
      role: "human",
      text,
    }
    setTechnicalMessages((prev) => [...prev, userMsg])
    setIsSending(true)

    try {
      await fetch(withProjectQuery("/api/messages", projectIdRef.current), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "tech", author: "You", text }),
      })

      const history = [...technicalMessages, userMsg].map(m =>
        `${m.role === "human" ? "User" : "AI"}: ${m.text}`
      ).join("\n")

      const productDocContext = Object.keys(productDoc).length > 0
        ? `\n\nProduct documentation:\n${JSON.stringify(productDoc)}`
        : ""
      const currentDocStr = Object.keys(technicalDoc).length > 0
        ? `\n\nCurrent technical documentation:\n${JSON.stringify(technicalDoc)}`
        : ""

      const progressStr = `\n\nQuestion progress: ${JSON.stringify(technicalProgress)}`
      const nextQ = TECHNICAL_QUESTIONS.find((q) => !technicalProgress[q.key])
      const nextHint = nextQ
        ? `\nNext topic to cover: ${nextQ.key} (${nextQ.label})`
        : `\nAll 7 topics covered. Summarize and confirm with the user.`

      const fullInput = `Conversation history:\n${history}${productDocContext}${currentDocStr}${progressStr}${nextHint}\n\nUser message: ${text}`

      let fullResponse = ""
      await callAgentChatStream("technical", fullInput, (delta) => {
        fullResponse += delta
        const displayText = stripDocTags(fullResponse)
        setTechnicalMessages((prev) => {
          const existing = prev.find((m) => m.id === "ai-streaming")
          if (existing) {
            return prev.map((m) => m.id === "ai-streaming" ? { ...m, text: displayText } : m)
          }
          return [...prev, { id: "ai-streaming", author: "Tech AI", role: "ai", text: displayText }]
        })
      })

      const docUpdate = parseDocTags(fullResponse)
      if (docUpdate) {
        setTechnicalDoc((prev) => {
          const merged = { ...prev }
          for (const [key, value] of Object.entries(docUpdate)) {
            if (value && (typeof value === "string" ? value.trim() : Array.isArray(value) && value.length)) {
              merged[key] = value
            }
          }
          return merged
        })
      }

      // When technical doc is already complete, append user messages to extraNotes
      if (technicalComplete) {
        setTechnicalDoc((prev) => {
          const existing = Array.isArray(prev.extraNotes) ? prev.extraNotes as string[] : []
          return { ...prev, extraNotes: [...existing, text] }
        })
      }

      const finalText = stripDocTags(fullResponse)
      setTechnicalMessages((prev) =>
        prev.map((m) => m.id === "ai-streaming" ? { ...m, id: `msg-ai-${Date.now()}`, text: finalText } : m)
      )

      // AI-powered summarization
      setIsSummarizing(true)
      try {
        const allMessages = [...technicalMessages, userMsg, { id: "ai-final", author: "Tech AI", role: "ai" as const, text: finalText }]
        const summaryResult = await callSummarizeDoc(
          "technical",
          allMessages.map((m) => ({ role: m.role, text: m.text })),
          docUpdate ? { ...technicalDoc, ...docUpdate } : technicalDoc,
          productDoc
        )

        if (summaryResult.doc && Object.keys(summaryResult.doc).length > 0) {
          setTechnicalDoc((prev) => {
            const merged = { ...prev }
            for (const [key, value] of Object.entries(summaryResult.doc)) {
              if (value && (typeof value === "string" ? value.trim() : Array.isArray(value) && value.length)) {
                merged[key] = value
              }
            }
            return merged
          })
        }

        const newProgress: Record<string, boolean> = { ...technicalProgress }
        for (const field of summaryResult.completedFields) {
          newProgress[field] = true
        }
        setTechnicalProgress(newProgress)

        // Notify user when all technical questions are answered
        if (summaryResult.allQuestionsAnswered && !technicalComplete) {
          setTechnicalComplete(true)
          setTechnicalMessages((prev) => [
            ...prev,
            {
              id: `msg-complete-${Date.now()}`,
              author: "System",
              role: "ai",
              text: "**Documentatia tehnica este completa!** Toate cele 7 sectiuni au fost acoperite.\n\nPoti continua sa discuti aici daca ai informatii suplimentare — acestea vor fi salvate in sectiunea **Note Aditionale** a documentatiei tehnice.\n\nCand esti gata, apasa **Go to Analysis** pentru a trece la urmatoarea faza.",
            },
          ])
        }
      } catch {
        setTechnicalProgress(deriveProgress(docUpdate ? { ...technicalDoc, ...docUpdate } : technicalDoc, TECHNICAL_QUESTIONS))
      } finally {
        setIsSummarizing(false)
      }

      const docStr = JSON.stringify(docUpdate ? { ...technicalDoc, ...docUpdate } : technicalDoc)
      await fetch(withProjectQuery("/api/project", projectIdRef.current), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update-brief",
          brief: initialProject.brief,
          technicalDocumentation: docStr,
        }),
      }).catch(() => {})
    } catch (err) {
      setTechnicalMessages((prev) => [
        ...prev.filter((m) => m.id !== "ai-streaming"),
        { id: `msg-err-${Date.now()}`, author: "System", role: "ai", text: `Error: ${err}` },
      ])
    } finally {
      setIsSending(false)
    }
  }, [technicalMessages, technicalDoc, technicalProgress, technicalComplete, productDoc, initialProject.brief])

  // Keep refs in sync for auto-start
  handleSendTechnicalRef.current = handleSendTechnical

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const activeProgress = activeChannel === "product" ? productProgress : technicalProgress

  return (
    <div className="flex h-screen bg-background text-foreground">
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

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/20 px-6 py-2.5">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-lg font-bold text-foreground">Planning</h1>
            <Badge variant="secondary" className="text-[10px]">PHASE 1</Badge>
          </div>

          {/* Channel tabs — shadcn */}
          <Tabs
            value={activeChannel}
            onValueChange={(v) => {
              if (v === "technical" && !productDocReady) return
              setActiveChannel(v as "product" | "technical")
              // Auto-send product doc to technical agent on first switch
              if (v === "technical" && !technicalAutoStarted.current) {
                technicalAutoStarted.current = true
                setTimeout(() => {
                  handleSendTechnicalRef.current(
                    "Documentatia de produs este finalizata. Analizeaz-o si propune arhitectura tehnica, tehnologiile recomandate, schema bazei de date, structura API-ului si strategia de securitate potrivite pentru aceasta aplicatie."
                  )
                }, 300)
              }
            }}
          >
            <TabsList>
              <TabsTrigger value="product" className="gap-1.5">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lightbulb</span>
                Product
                {productDocReady && (
                  <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: 14 }}>check_circle</span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="technical"
                disabled={!productDocReady}
                className="gap-1.5"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>terminal</span>
                Technical
                {!productDocReady && (
                  <span className="material-symbols-outlined text-muted-foreground/30" style={{ fontSize: 12 }}>lock</span>
                )}
                {technicalDocReady && (
                  <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: 14 }}>check_circle</span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {/* Start Discovery / Reset toggle — same position */}
            {!cycleStarted ? (
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>
                Start Discovery
              </button>
            ) : (
              <button
                onClick={handleReset}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>restart_alt</span>
                Reset
              </button>
            )}

            <button
              onClick={handleMockConversation}
              disabled={isSending || isSummarizing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
              Mock Conversation
            </button>

            {technicalDocReady && (
              <a
                href={`/analysis?project=${initialProjectId}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Analysis
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
              </a>
            )}
          </div>
        </header>

        {/* Content area: chat + doc panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div className="flex-1 overflow-hidden border-r border-border/10">
            {activeChannel === "product" ? (
              <ChatPanel
                messages={productMessages}
                onSend={handleSendProduct}
                isSending={isSending}
                placeholder="Describe your product idea..."
                agentName="Product Discovery AI"
                agentIcon="lightbulb"
                starterPrompts={PRODUCT_STARTERS}
                currentTopic={currentQuestionLabel}
              />
            ) : (
              <ChatPanel
                messages={technicalMessages}
                onSend={handleSendTechnical}
                isSending={isSending}
                placeholder="Discuss architecture and tech stack..."
                agentName="Solutions Architect AI"
                agentIcon="terminal"
                starterPrompts={TECHNICAL_STARTERS}
                currentTopic={currentQuestionLabel}
              />
            )}
          </div>

          {/* Documentation side panel */}
          <div className="w-1/2 shrink-0 overflow-hidden border-l border-border/10 bg-card/10">
            {activeChannel === "product" ? (
              <DocSidePanel
                title="Product Documentation"
                icon="description"
                sections={PRODUCT_SECTIONS}
                parsedDoc={productDoc}
                variant="product"
                questionProgress={activeProgress}
                isSummarizing={isSummarizing}
              />
            ) : (
              <DocSidePanel
                title="Technical Documentation"
                icon="architecture"
                sections={TECHNICAL_SECTIONS}
                parsedDoc={technicalDoc}
                variant="technical"
                questionProgress={activeProgress}
                isSummarizing={isSummarizing}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
