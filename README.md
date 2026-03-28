# Luminescent IDE

Aplicatia este pregatita acum cu un backend local pentru proiect, workflow SDLC, workspace de cod si mesaje AI prin OpenAI.

## Pornire

1. Creeaza fisierul de env:

```bash
cp .env.example .env.local
```

2. Completeaza cheia OpenAI:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
```

3. Ruleaza aplicatia:

```bash
npm install
npm run dev
```

Aplicatia porneste pe `http://localhost:3000`.

## Ce este deja pregatit

- store local persistent in `.data/project-state.json`
- backend Next App Router pentru proiect, workflow si workspace
- endpoint AI pregatit pentru OpenAI
- fallback local daca lipseste cheia OpenAI

## Endpoint-uri principale

- `GET /api/health`
- `GET /api/project`
- `PATCH /api/project`
- `POST /api/messages`
- `POST /api/ai/respond`
- `GET /api/workspace/files`
- `POST /api/workspace/files`
- `PATCH /api/workspace/files/:fileId`
- `POST /api/workspace/folders`

## Exemple rapide

Obtine starea proiectului:

```bash
curl http://localhost:3000/api/project
```

Trimite un mesaj catre Business AI:

```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"channel":"business","author":"Alex","text":"Vreau approval gates clare pentru fiecare etapa."}'
```

Creeaza un fisier nou in workspace:

```bash
curl -X POST http://localhost:3000/api/workspace/files \
  -H "Content-Type: application/json" \
  -d '{"parentPath":"src/app","name":"review/page.tsx"}'
```

## Structura backend

- [lib/backend/types.ts](/home/chiriac-alexandru/Github/itfest2026/lib/backend/types.ts)
- [lib/backend/defaults.ts](/home/chiriac-alexandru/Github/itfest2026/lib/backend/defaults.ts)
- [lib/backend/store.ts](/home/chiriac-alexandru/Github/itfest2026/lib/backend/store.ts)
- [lib/backend/service.ts](/home/chiriac-alexandru/Github/itfest2026/lib/backend/service.ts)
- [lib/backend/openai.ts](/home/chiriac-alexandru/Github/itfest2026/lib/backend/openai.ts)

## Observatie

Frontend-ul actual este inca un demo bogat de UI si nu consuma complet acest backend in toate ecranele. Dar backend-ul este deja pregatit pentru rulare locala si pentru integrarea completa a UI-ului peste el.
