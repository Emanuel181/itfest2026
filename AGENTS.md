<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know





# APP Context
Proiect: AI-Native IDE pentru SDLC colaborativ

  Viziune

  Un IDE web unde echipele de software colaborează cu agenți AI în fiecare etapă a SDLC — de la idee până la merge final
   — cu review uman la fiecare tranziție critică.

  ---
  Features

  1. Modulul de Ideatizare (Ideation Agent)

  - Agent interactiv care pune întrebări structurate pentru a clarifica ideea proiectului
  - Generează un Project Brief: obiectiv, target audience, scope, out-of-scope
  - Chat-based: omul discută cu agentul, agentul propune, omul aprobă sau modifică
  - Output: document de idee aprobat, salvat în proiect

  2. Modulul de Requirements (Requirements Agent)

  - Preia Project Brief-ul aprobat
  - Generează lista de functional & non-functional requirements
  - Omul poate edita, adăuga, șterge requirements direct în UI (rich text editor inline)
  - Fiecare requirement primește un ID unic și status (draft / approved)

  3. Modulul de User Stories (User Story Agent)

  - Transformă fiecare requirement aprobat într-unul sau mai multe user stories (format: As a... I want... So that...)
  - Acceptance criteria generate automat pentru fiecare story
  - Story-urile pot fi editate și aprobate de om

  4. Modulul de Assignment & Planning (Orchestrator Agent)

  - Asignează fiecare user story la un set de agenți: Frontend Agent + Backend Agent + Technical Lead Agent
  - Estimează complexitate (S/M/L/XL)
  - Generează dependency graph între user stories

  5. Modulul de Implementare — Triple Variant (Implementation Agents)

  - Pentru fiecare user story, 3 echipe paralele de agenți generează câte o variantă de implementare:
    - Fiecare echipă: Frontend Agent + Backend Agent + Orchestrator Agent (care coordonează frontend/backend)
    - Output per variantă: cod, arhitectură propusă, tradeoffs
  - Global Evaluator Agent prezintă pros & cons pentru fiecare din cele 3 variante
  - Developerul alege varianta finală (sau cere o nouă rundă)

  6. Modulul de Security Review (Security Agent)

  - Analizează toate user story-urile alese pentru merge
  - Identifică vulnerabilități (OWASP Top 10, secrets exposure, dependency issues)
  - Propune remedieri concrete
  - Output: Security Report cu severitate per issue
  - Omul aprobă remedierea înainte de merge

  7. Modulul de Merge & Integration (Merge Agent)

  - Face merge ordonat al fiecare user story (post-security fix)
  - Rezolvă conflicte automat unde posibil, escaladează unde nu
  - Menține un changelog automat

  8. Project Review Agent

  - Rulează după fiecare merge de user story
  - Generează un Project Health Report: progres, coverage, technical debt acumulat
  - Dashboard vizual cu status per user story, per agent, per etapă

  9. UI — IDE Shell

  - Canvas-based workspace: fiecare etapă SDLC e un panel/tab separat
  - Agent Activity Feed: log în timp real cu ce face fiecare agent
  - Human-in-the-loop gates: la fiecare tranziție între etape, omul aprobă explicit
  - Collaborative editing: mai mulți oameni pot edita simultan (Yjs / operational transforms)
  - Notifications: când un agent termină și așteaptă input uman
  - Project timeline: vizualizare Gantt-like a progresului SDLC

  10. Infrastructure & Auth

  - AWS Bedrock pentru toți agenții LLM (Claude 3 Sonnet/Opus via Bedrock)
  - AWS Amplify sau App Runner pentru hosting Next.js
  - DynamoDB pentru persistența proiectelor, documentelor, task-urilor
  - S3 pentru storage artefacte (cod generat, rapoarte)
  - Cognito pentru autentificare și management echipe
  - WebSockets (API Gateway) pentru live updates din agenți



This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
