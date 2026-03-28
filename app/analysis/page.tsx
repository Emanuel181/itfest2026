"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";

import type {
  UserStory,
} from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// Streaming agent call helper
// ---------------------------------------------------------------------------
async function callAgentStream(
  params: {
    role: string;
    storyId: string;
    storyTitle: string;
    storyDescription: string;
    variantId?: string;
    context?: string;
  },
  onChunk: (delta: string) => void
): Promise<string> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok || !res.body) throw new Error(await res.text());

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = JSON.parse(line.slice(6));
      if (json.error) throw new Error(json.error);
      if (json.delta) { full += json.delta; onChunk(json.delta); }
    }
  }
  return full;
}

// ---------------------------------------------------------------------------
// No mock data — stories are loaded from localStorage (populated by the
// ideation pipeline).
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG = {
  critical: { color: "#ffb4ab", bg: "bg-[#ffb4ab]/10", border: "border-[#ffb4ab]/20", icon: "keyboard_double_arrow_up", label: "Critical" },
  high:     { color: "#ffd080", bg: "bg-[#ffd080]/10", border: "border-[#ffd080]/20", icon: "keyboard_arrow_up",        label: "High"     },
  medium:   { color: "#4edea3", bg: "bg-[#4edea3]/10", border: "border-[#4edea3]/20", icon: "drag_handle",              label: "Medium"   },
  low:      { color: "#86948a", bg: "bg-[#86948a]/10", border: "border-[#86948a]/20", icon: "keyboard_arrow_down",      label: "Low"      },
} as const;

const TYPE_CONFIG = {
  feature:    { color: "#4edea3", icon: "star",         label: "Feature"    },
  bug:        { color: "#ffb4ab", icon: "bug_report",   label: "Bug"        },
  "tech-debt":{ color: "#ffd080", icon: "build",        label: "Tech Debt"  },
  spike:      { color: "#c8c6c5", icon: "science",      label: "Spike"      },
} as const;

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending:      { color: "#86948a", bg: "bg-[#86948a]/10", border: "border-[#86948a]/20", label: "To Do"        },
  implementing: { color: "#4edea3", bg: "bg-[#4edea3]/10", border: "border-[#4edea3]/20", label: "In Progress"  },
  evaluating:   { color: "#ffd080", bg: "bg-[#ffd080]/10", border: "border-[#ffd080]/20", label: "In Review"    },
  done:         { color: "#4ae176", bg: "bg-[#4ae176]/10", border: "border-[#4ae176]/20", label: "Done"         },
};

// ---------------------------------------------------------------------------
// Planning Poker types
// ---------------------------------------------------------------------------
type PokerAgentRole = "frontend_dev" | "backend_dev" | "tech_lead";
type PokerAgent = {
  role: PokerAgentRole;
  label: string;
  color: string;
  icon: string;
  apiRole: string;
  estimate: number | null;
  reasoning: string;
  revealed: boolean;
};
type PokerLog = { agent: string; color: string; text: string; timestamp: string };
type PokerSession = {
  storyId: string;
  phase: "idle" | "estimating" | "revealing" | "debating" | "done";
  agents: PokerAgent[];
  logs: PokerLog[];
  consensusEstimate: number | null;
  pokerContext: string;
};

const POKER_AGENTS: Omit<PokerAgent, "estimate" | "reasoning" | "revealed">[] = [
  { role: "frontend_dev", label: "Frontend Agent", color: "#6ffbbe", icon: "web",   apiRole: "Frontend Agent" },
  { role: "backend_dev",  label: "Backend Agent",  color: "#4ae176", icon: "dns",   apiRole: "Backend Agent"  },
  { role: "tech_lead",    label: "Tech Lead Agent", color: "#4edea3", icon: "stars", apiRole: "Tech Lead Agent" },
];
const POKER_NUMBERS = [1, 2, 3, 5, 8, 13, 20, 40, 100] as const;

function makePokerSession(storyId: string): PokerSession {
  return {
    storyId, phase: "idle", consensusEstimate: null, pokerContext: "", logs: [],
    agents: POKER_AGENTS.map((a) => ({ ...a, estimate: null, reasoning: "", revealed: false })),
  };
}

function snapToPoker(n: number): number {
  const nums = [...POKER_NUMBERS];
  return nums.reduce((prev, curr) => (Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev));
}

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? sorted[mid - 1] : sorted[mid];
}

// ---------------------------------------------------------------------------
// PokerCard — single playing card with flip animation
// ---------------------------------------------------------------------------
function PokerCard({ value, revealed, color, animationDelay = 0 }: {
  value: number | null;
  revealed: boolean;
  color: string;
  animationDelay?: number;
}) {
  return (
    <div style={{ perspective: "600px" }}>
      <div
        className={cn(
          "w-12 h-16 rounded-lg border-2 flex items-center justify-center font-bold font-mono text-xl select-none",
          revealed ? "card-flip" : "card-waiting"
        )}
        style={{
          animationDelay: revealed ? `${animationDelay}ms` : undefined,
          borderColor: revealed ? color : "#3c4a42",
          background: revealed ? `${color}15` : "#201f1f",
          color: revealed ? color : "#474746",
        }}
      >
        {revealed && value !== null ? (
          value
        ) : (
          <span className="material-symbols-outlined" style={{ color: "#474746", fontSize: "16px" }}>casino</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Sidebar — Pipeline Stepper (Analysis active)
// ---------------------------------------------------------------------------
function Sidebar() {
  const steps = [
    { label: "Ideation",        icon: "lightbulb",        href: "#"                },
    { label: "Requirements",    icon: "assignment",       href: "#"                },
    { label: "User Stories",    icon: "group",            href: "#"                },
    { label: "Planning",        icon: "event_note",       href: "#"                },
    { label: "Analysis",        icon: "code",             href: "/analysis"        },
    { label: "Implementation",  icon: "construction",     href: "/implementation"  },
    { label: "Merge",           icon: "call_merge",       href: "#"                },
    { label: "Dashboard",       icon: "dashboard",        href: "#"                },
  ];
  const activeIdx = 4; // Analysis

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#201f1f] border-r border-[#3c4a42]/20 z-40 flex flex-col py-6 px-4">
      <div className="flex flex-col flex-1">
        {steps.map((step, idx) => {
          const isActive = idx === activeIdx;
          return (
            <div key={step.label} className="flex flex-col">
              <a href={step.href} className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm shrink-0 transition-all",
                    isActive
                      ? "border-[#4edea3] bg-[#4edea3]/10 text-[#4edea3] glow-pulse"
                      : "border-[#474746] bg-transparent text-[#474746]"
                  )}
                >
                  <span className="material-symbols-outlined text-sm">{step.icon}</span>
                </div>
                <span
                  className={cn(
                    "text-xs uppercase tracking-widest font-bold transition-colors",
                    isActive ? "text-[#4edea3]" : "text-[#474746]"
                  )}
                >
                  {step.label}
                </span>
              </a>
              {idx < steps.length - 1 && (
                <div className="w-0.5 h-6 mx-auto bg-[#3c4a42]/40 my-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AnalysisPage() {
  const router = useRouter();

  // Stories state — loaded from localStorage (populated by the ideation pipeline)
  const [stories, setStories] = useState<UserStory[]>([]);
  // Per-story poker sessions
  const [pokerSessions, setPokerSessions] = useState<Record<string, PokerSession>>({});
  // Ref always holds latest value — avoids stale closures in async poker logic
  const pokerSessionsRef = useRef<Record<string, PokerSession>>({});
  useEffect(() => { pokerSessionsRef.current = pokerSessions; }, [pokerSessions]);
  // Per-story assigned agent label (set after poker completes)
  const [storyAssignees, setStoryAssignees] = useState<Record<string, string>>({});
  // Running state (for UI feedback during poker)
  const [runningStories, setRunningStories] = useState<Record<string, boolean>>({});
  // Which story's poker drawer is open
  const [drawerStoryId, setDrawerStoryId] = useState<string | null>(null);

  // True when every story has a completed poker session
  const allDonePoker = stories.every((s) => pokerSessions[s.id]?.phase === "done");

  // ---------------------------------------------------------------------------
  // localStorage read
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("itfest_state");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.stories) setStories(parsed.stories);
      }
    } catch { /* corrupt data — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("itfest_poker");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.pokerSessions)  setPokerSessions(parsed.pokerSessions);
      if (parsed.storyAssignees) setStoryAssignees(parsed.storyAssignees);
    } catch { /* corrupt data — ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // localStorage write
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("itfest_poker", JSON.stringify({ pokerSessions, storyAssignees }));
    } catch { /* quota — ignore */ }
  }, [pokerSessions, storyAssignees]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Persist stories (includes notes) so implementation page picks them up
      const existing = localStorage.getItem("itfest_state");
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem("itfest_state", JSON.stringify({ ...parsed, stories }));
    } catch { /* quota — ignore */ }
  }, [stories]);

  // ---------------------------------------------------------------------------
  // Planning Poker — per-story session
  // ---------------------------------------------------------------------------
  const runPokerSession = useCallback(async (storyId: string) => {
    const existing = pokerSessionsRef.current[storyId];
    if (existing && (existing.phase === "estimating" || existing.phase === "revealing" || existing.phase === "debating")) return;

    const storyObj = stories.find((s) => s.id === storyId);
    if (!storyObj) return;

    const base = { storyId, storyTitle: storyObj.title, storyDescription: storyObj.description };

    setPokerSessions((p) => ({ ...p, [storyId]: { ...makePokerSession(storyId), phase: "estimating" } }));
    setRunningStories((p) => ({ ...p, [storyId]: true }));

    // Phase 1: all agents estimate in parallel
    const estimateResults = await Promise.all(
      POKER_AGENTS.map(async (agentDef) => {
        let fullText = "";
        try {
          fullText = await callAgentStream(
            { ...base, role: "poker_estimate", context: agentDef.apiRole },
            () => {}
          );
        } catch { fullText = "Card: 5\nReasoning: Estimate unavailable."; }
        const cardMatch = fullText.match(/Card:\s*(\d+)/i);
        const reasoningMatch = fullText.match(/Reasoning:\s*(.+)/i);
        const estimate = snapToPoker(cardMatch ? parseInt(cardMatch[1], 10) : 5);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "";
        return { role: agentDef.role, estimate, reasoning };
      })
    );

    // Store estimates, move to revealing
    setPokerSessions((p) => ({
      ...p,
      [storyId]: {
        ...p[storyId],
        phase: "revealing",
        agents: p[storyId].agents.map((a) => {
          const res = estimateResults.find((r) => r.role === a.role);
          return res ? { ...a, estimate: res.estimate, reasoning: res.reasoning, revealed: false } : a;
        }),
      },
    }));

    // Phase 2: reveal cards one-by-one
    for (let i = 0; i < POKER_AGENTS.length; i++) {
      await new Promise<void>((res) => setTimeout(res, 600));
      const role = POKER_AGENTS[i].role;
      setPokerSessions((p) => ({
        ...p,
        [storyId]: { ...p[storyId], agents: p[storyId].agents.map((a) => (a.role === role ? { ...a, revealed: true } : a)) },
      }));
    }

    // Build snapAgents from estimateResults directly
    const snapAgents: PokerAgent[] = POKER_AGENTS.map((agentDef) => {
      const base2 = { role: agentDef.role, label: agentDef.label, color: agentDef.color, icon: agentDef.icon, apiRole: agentDef.apiRole };
      const res = estimateResults.find((r) => r.role === agentDef.role);
      return { ...base2, estimate: res?.estimate ?? 5, reasoning: res?.reasoning ?? "", revealed: true };
    });
    const estimates = snapAgents.map((a) => a.estimate ?? 5);
    const estimatesSummary = snapAgents
      .map((a) => `${a.label} estimated: ${a.estimate} pts. Reasoning: ${a.reasoning}`)
      .join("\n");

    const finalize = (consensus: number, pokerContext: string) => {
      const topAgent = snapAgents.reduce((a, b) => (b.estimate ?? 0) > (a.estimate ?? 0) ? b : a);
      setStoryAssignees((p) => ({ ...p, [storyId]: topAgent.label }));
      setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "done", consensusEstimate: consensus, pokerContext } }));
      setRunningStories((p) => ({ ...p, [storyId]: false }));
    };

    // Phase 3: debate
    setPokerSessions((p) => ({ ...p, [storyId]: { ...p[storyId], phase: "debating" } }));

    const debateResponses: string[] = [];
    let cumulativeContext = `Initial estimates:\n${estimatesSummary}\n\nDebate so far:`;

    for (const agentDef of POKER_AGENTS) {
      const agent = snapAgents.find((a) => a.role === agentDef.role)!;
      setPokerSessions((p) => ({
        ...p,
        [storyId]: {
          ...p[storyId],
          logs: [...p[storyId].logs, { agent: agent.label, color: agent.color, text: "", timestamp: new Date().toLocaleTimeString() }],
        },
      }));

      let debateText = "";
      try {
        debateText = await callAgentStream(
          { ...base, role: "poker_debate", context: cumulativeContext, variantId: agentDef.apiRole },
          (delta) => {
            setPokerSessions((p) => {
              const sess = p[storyId];
              if (!sess) return p;
              const logs = [...sess.logs];
              logs[logs.length - 1] = { ...logs[logs.length - 1], text: logs[logs.length - 1].text + delta };
              return { ...p, [storyId]: { ...sess, logs } };
            });
          }
        );
      } catch { debateText = "My estimate: 5\nArgument: Unable to respond.\nConsensus proposal: none yet"; }

      debateResponses.push(debateText);
      cumulativeContext += `\n\n${agent.label}: ${debateText}`;
      await new Promise<void>((res) => setTimeout(res, 300));
    }

    // Final consensus
    const proposals = debateResponses.map((text) => {
      const m = text.match(/Consensus proposal:\s*(\d+)/i);
      return m ? snapToPoker(parseInt(m[1], 10)) : null;
    }).filter((v): v is number => v !== null);

    const consensus = proposals.length > 0 ? medianOf(proposals) : medianOf(estimates);

    const debateTranscript = snapAgents
      .map((a, i) => `${a.label}:\n${debateResponses[i] ?? ""}`)
      .join("\n\n---\n\n");

    finalize(consensus, [
      `Planning Poker Result: Consensus = ${consensus} pts`,
      `\nInitial Estimates:\n${estimatesSummary}`,
      `\nDebate:\n${debateTranscript}`,
    ].join("\n"));
  }, [stories]);

  // Derived state for display
  const storiesDone    = stories.filter((s) => pokerSessions[s.id]?.phase === "done").length;
  const anyPokerActive = stories.some((s) => { const ph = pokerSessions[s.id]?.phase; return ph === "estimating" || ph === "revealing" || ph === "debating"; });
  const totalPoints    = stories.reduce((acc, s) => acc + (pokerSessions[s.id]?.consensusEstimate ?? 0), 0);

  // Agent roster — the standing team for this sprint
  const AGENT_ROSTER = [
    { label: "Orchestrator", icon: "hub",         color: "#4edea3", role: "Plans & coordinates each story variant" },
    { label: "Backend",      icon: "dns",          color: "#4ae176", role: "API, data layer, server-side logic"     },
    { label: "Frontend",     icon: "web",          color: "#6ffbbe", role: "UI components, interactions, styling"   },
    { label: "Security",     icon: "shield",       color: "#4edea3", role: "Vulnerability scan, compliance audit"   },
    { label: "Evaluator",    icon: "balance",      color: "#c8c6c5", role: "Selects the best variant per story"     },
  ];

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <style>{`
        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; font-family:'Material Symbols Outlined'; }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(78,222,163,0.4)}50%{box-shadow:0 0 0 6px rgba(78,222,163,0)} }
        .glow-pulse { animation: glowPulse 2s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .terminal-cursor { display:inline-block;width:8px;height:14px;background:#4edea3;margin-left:2px;vertical-align:middle;animation:blink 1s step-end infinite; }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
        .mission-scan::after { content:'';position:absolute;inset-x-0;height:1px;background:linear-gradient(90deg,transparent,#4edea320,transparent);animation:scanline 3s linear infinite; }
        @keyframes agentPing { 0%{transform:scale(1);opacity:1} 70%{transform:scale(2.2);opacity:0} 100%{transform:scale(1);opacity:0} }
        .agent-ping::before { content:'';position:absolute;inset:0;border-radius:9999px;background:currentColor;animation:agentPing 2s ease-out infinite; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-in-up { animation: fadeIn 0.3s ease-out forwards; }
        .ide-scroll::-webkit-scrollbar{width:4px} .ide-scroll::-webkit-scrollbar-track{background:transparent} .ide-scroll::-webkit-scrollbar-thumb{background:#353534;border-radius:2px}
      `}</style>

      {/* ── TOP NAV ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 h-16 flex items-center justify-between px-6 bg-[#131313] border-b border-[#3c4a42]/20">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-[#4edea3] tracking-tight font-serif">Luminescent IDE</span>
          <span className="text-[10px] font-mono text-[#474746] bg-[#1c1b1b] border border-[#3c4a42]/30 rounded px-2 py-0.5">
            Sprint 1 · {stories.length} missions
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-[#353534] border border-[#3c4a42]/30 flex items-center justify-center text-[#4edea3] text-xs font-bold">E</div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar />

        <main className="ml-64 flex-1 bg-[#131313] overflow-hidden">
          <ScrollArea className="h-[calc(100vh-64px)] ide-scroll">
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

              {/* ── SPRINT COMMAND HEADER ─────────────────────────────────── */}
              <div className="relative rounded-2xl bg-[#1c1b1b] border border-[#3c4a42]/25 overflow-hidden p-5 mission-scan">
                {/* Ambient gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(78,222,163,0.04)_0%,transparent_60%)] pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4edea3] mb-1">Agent Mission Board</p>
                      <h1 className="text-2xl font-bold font-serif text-[#e5e2e1] leading-tight">Sprint Backlog</h1>
                      <p className="text-[12px] text-[#86948a] mt-1">Estimate user stories with AI agents before implementing.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── AGENT ROSTER ─────────────────────────────────────────── */}
              <div className="rounded-2xl bg-[#1c1b1b] border border-[#3c4a42]/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[#4edea3] text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>groups</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#86948a]">Agentic Team — On Standby</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="relative w-1.5 h-1.5 rounded-full bg-[#4edea3] agent-ping" style={{ color: "#4edea3" }} />
                    <span className="text-[9px] font-mono text-[#4edea3]">5 agents ready</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {AGENT_ROSTER.map((agent) => (
                    <div key={agent.label} className="flex-1 flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-[#131313] border border-[#3c4a42]/20 group hover:border-[#4edea3]/20 transition-all">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: `${agent.color}10`, borderColor: `${agent.color}25` }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: agent.color, fontVariationSettings: "'FILL' 1" }}>{agent.icon}</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#c8c6c5]">{agent.label}</span>
                      <span className="text-[8px] text-[#474746] text-center leading-tight hidden group-hover:block">{agent.role}</span>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-[#4ae176]" />
                        <span className="text-[8px] font-mono text-[#4ae176]">idle</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── BRIEF AGENTS BUTTON ───────────────────────────────────── */}
              {!allDonePoker && (
                <button
                  onClick={() => {
                    stories
                      .filter((s) => !pokerSessions[s.id] || pokerSessions[s.id].phase === "idle")
                      .reduce((chain, s) => chain.then(() => runPokerSession(s.id)), Promise.resolve());
                  }}
                  disabled={anyPokerActive}
                  className={cn(
                    "w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] border transition-all",
                    anyPokerActive
                      ? "bg-[#4edea3]/5 border-[#4edea3]/20 text-[#4edea3] cursor-wait"
                      : "bg-[#4edea3]/8 border-[#4edea3]/25 text-[#4edea3] hover:bg-[#4edea3]/14 hover:border-[#4edea3]/40 hover:shadow-[0_0_20px_rgba(78,222,163,0.08)]"
                  )}
                >
                  {anyPokerActive ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#4edea3]/30 border-t-[#4edea3] rounded-full animate-spin" />
                      Briefing agents…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>casino</span>
                      Brief Agents — Run Estimation Poker
                      <span className="text-[9px] font-mono opacity-50 border border-current/30 rounded px-1 py-0.5 ml-1">⌘B</span>
                    </>
                  )}
                </button>
              )}

              {/* ── MISSION CARDS ────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#474746]">Mission Queue</span>
                  <div className="flex-1 h-px bg-[#3c4a42]/20" />
                  <span className="text-[9px] font-mono text-[#474746]">{stories.length} missions</span>
                </div>

                {stories.map((story, storyIdx) => {
                  const poker   = pokerSessions[story.id];
                  const estimate = poker?.consensusEstimate ?? null;
                  const prio    = story.priority ? PRIORITY_CONFIG[story.priority] : null;
                  const type    = story.type ? TYPE_CONFIG[story.type] : null;
                  const isPokerRunning = !!runningStories[story.id];
                  const pokerDone = poker?.phase === "done";
                  const pokerActive = poker && (poker.phase === "estimating" || poker.phase === "revealing" || poker.phase === "debating");

                  return (
                    <div
                      key={story.id}
                      className={cn(
                        "fade-in-up relative rounded-2xl border overflow-hidden transition-all",
                        pokerDone
                          ? "bg-[#1c1b1b] border-[#4edea3]/20 shadow-[0_0_0_1px_rgba(78,222,163,0.05)]"
                          : pokerActive
                          ? "bg-[#1c1b1b] border-[#4edea3]/15"
                          : "bg-[#1c1b1b] border-[#3c4a42]/20"
                      )}
                      style={{ animationDelay: `${storyIdx * 60}ms` }}
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl"
                        style={{ background: pokerDone ? "#4ae176" : pokerActive ? "#4edea3" : prio?.color ?? "#3c4a42" }}
                      />

                      <div className="pl-4 pr-4 pt-4 pb-3 space-y-3">

                        {/* ── Row 1: mission id + type + priority + effort ── */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Mission number */}
                          <span className="text-[9px] font-bold font-mono uppercase tracking-[0.2em] text-[#474746]">
                            #{String(storyIdx + 1).padStart(2, "0")}
                          </span>
                          <div className="w-px h-3 bg-[#3c4a42]/40" />
                          {/* Story ID */}
                          <span className="text-[9px] font-bold font-mono uppercase tracking-widest" style={{ color: prio?.color ?? "#86948a" }}>
                            {story.id}
                          </span>
                          {/* Type chip */}
                          {type && (
                            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#2a2a2a] border border-[#3c4a42]/25 text-[9px] font-bold uppercase tracking-wider" style={{ color: type.color }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>{type.icon}</span>
                              {type.label}
                            </div>
                          )}
                          {/* Priority chip */}
                          {prio && (
                            <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider", prio.bg, prio.border)} style={{ color: prio.color }}>
                              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>{prio.icon}</span>
                              {prio.label}
                            </div>
                          )}
                          <div className="flex-1" />
                          {/* Effort estimate */}
                          {estimate != null ? (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#4edea3]/10 border border-[#4edea3]/25">
                              <span className="material-symbols-outlined text-[#4edea3]" style={{ fontSize: "10px", fontVariationSettings:"'FILL' 1" }}>bolt</span>
                              <span className="text-[10px] font-bold font-mono text-[#4edea3]">{estimate} pts</span>
                              <span className="text-[9px] text-[#86948a]">
                                · ~{estimate * 30 >= 60 ? `${Math.round(estimate * 30 / 60 * 10) / 10}h` : `${estimate * 30}min`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2a2a2a] border border-[#3c4a42]/20">
                              <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "10px" }}>schedule</span>
                              <span className="text-[9px] font-mono text-[#474746]">TBD</span>
                            </div>
                          )}
                        </div>

                        {/* ── Row 2: title ── */}
                        <p className="text-[14px] font-semibold font-serif leading-snug text-[#e5e2e1]">
                          {story.title}
                        </p>

                        {/* ── Row 3: description ── */}
                        <p className="text-[11px] text-[#86948a] leading-relaxed line-clamp-2">{story.description}</p>

                        {/* ── Row 4: acceptance criteria count + labels ── */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                            <div className="flex items-center gap-1 text-[9px] text-[#474746] bg-[#131313] border border-[#3c4a42]/20 rounded-md px-1.5 py-0.5">
                              <span className="material-symbols-outlined" style={{ fontSize: "10px" }}>checklist</span>
                              {story.acceptanceCriteria.length} criteria
                            </div>
                          )}
                          {story.labels?.map((lbl) => (
                            <span key={lbl} className="text-[9px] font-mono text-[#86948a] bg-[#2a2a2a] border border-[#3c4a42]/25 rounded px-1.5 py-0.5">
                              {lbl}
                            </span>
                          ))}
                        </div>

                        {/* ── Row 5: agent team + status ── */}
                        <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#3c4a42]/15">
                          {/* Agent team avatars */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase tracking-widest text-[#474746] mr-1">Team</span>
                            {AGENT_ROSTER.slice(0, 4).map((agent) => (
                              <div
                                key={agent.label}
                                title={agent.label}
                                className="w-5 h-5 rounded-full border flex items-center justify-center"
                                style={{ background: `${agent.color}12`, borderColor: `${agent.color}30` }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "11px", color: agent.color, fontVariationSettings: "'FILL' 1" }}>{agent.icon}</span>
                              </div>
                            ))}
                            <span className="text-[9px] font-mono text-[#474746] ml-0.5">+1</span>
                          </div>

                          {/* Lead agent */}
                          {storyAssignees[story.id] ? (
                            <div className="flex items-center gap-1 text-[9px] text-[#4edea3]">
                              <span className="material-symbols-outlined" style={{ fontSize: "11px", fontVariationSettings:"'FILL' 1" }}>smart_toy</span>
                              <span className="font-bold">{storyAssignees[story.id]}</span>
                              <span className="text-[#474746]">leads</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[9px] text-[#474746]">
                              <span className="material-symbols-outlined" style={{ fontSize: "11px" }}>smart_toy</span>
                              Awaiting briefing
                            </div>
                          )}

                          {/* Status pill */}
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                            pokerDone   ? "bg-[#4ae176]/10 border-[#4ae176]/25 text-[#4ae176]" :
                            pokerActive ? "bg-[#4edea3]/10 border-[#4edea3]/25 text-[#4edea3]" :
                                          "bg-[#2a2a2a] border-[#3c4a42]/25 text-[#474746]"
                          )}>
                            {pokerActive && <span className="w-1 h-1 rounded-full bg-[#4edea3] animate-pulse" />}
                            {pokerDone   && <span className="material-symbols-outlined" style={{ fontSize: "9px", fontVariationSettings:"'FILL' 1" }}>check_circle</span>}
                            {pokerDone ? "Briefed" : pokerActive ? "Briefing…" : "Queued"}
                          </div>
                        </div>
                      </div>

                      {/* ── Briefing notes ── */}
                      <div className="px-4 pb-3 pt-2 border-t border-[#3c4a42]/15">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "11px" }}>edit_note</span>
                          <span className="text-[9px] uppercase tracking-[0.15em] text-[#474746]">Briefing notes — sent to orchestrator</span>
                        </div>
                        <textarea
                          value={story.notes ?? ""}
                          onChange={(e) => setStories((prev) => prev.map((s) => s.id === story.id ? { ...s, notes: e.target.value } : s))}
                          placeholder="Add context, constraints, or technical requirements for the agent team…"
                          rows={2}
                          className="w-full bg-[#131313] border border-[#3c4a42]/25 rounded-lg px-3 py-2 text-[11px] text-[#c8c6c5] placeholder:text-[#474746] font-mono outline-none focus:border-[#4edea3]/30 transition-colors resize-none leading-relaxed ide-scroll"
                        />
                      </div>

                      {/* ── Poker result footer (click → opens drawer) ── */}
                      {poker && poker.phase !== "idle" && (
                        <button
                          onClick={() => setDrawerStoryId(story.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-4 py-2.5 border-t transition-colors group/poker text-left",
                            pokerDone
                              ? "border-[#4ae176]/15 bg-[#4ae176]/5 hover:bg-[#4ae176]/10"
                              : "border-[#4edea3]/10 bg-[#4edea3]/3 hover:bg-[#4edea3]/8"
                          )}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "13px", color: pokerDone ? "#4ae176" : "#4edea3", fontVariationSettings: "'FILL' 1" }}>casino</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: pokerDone ? "#4ae176" : "#4edea3" }}>
                            {pokerDone ? "Estimation complete" : `${poker.phase}…`}
                          </span>
                          {pokerDone && estimate != null && (
                            <span className="text-[10px] font-mono" style={{ color: "#4ae176" }}>· {estimate} story points</span>
                          )}
                          {pokerActive && <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] glow-pulse ml-1" />}
                          <span className="ml-auto text-[9px] text-[#474746] group-hover/poker:text-[#4edea3] transition-colors flex items-center gap-1">
                            View details
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>chevron_right</span>
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── DISPATCH CTA ──────────────────────────────────────────── */}
              <div className="pt-2 pb-4">
                {!allDonePoker ? (
                  <div className="rounded-2xl border border-[#3c4a42]/20 bg-[#1c1b1b] p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#2a2a2a] border border-[#3c4a42]/30 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "20px" }}>lock</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[12px] font-bold text-[#c8c6c5]">Briefing required before implementation</p>
                      <p className="text-[10px] text-[#474746] mt-0.5">
                        {anyPokerActive ? "Agent briefing in progress…" : `${stories.length - storiesDone} stor${stories.length - storiesDone !== 1 ? "ies" : "y"} still need estimation`}
                      </p>
                    </div>
                    <Button
                      disabled
                      className="primary-gradient text-[#003824] px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest opacity-30 h-auto border-transparent cursor-not-allowed"
                    >
                      Start Implementing
                    </Button>
                  </div>
                ) : (
                  <div className="relative rounded-2xl border border-[#4edea3]/25 bg-[#1c1b1b] overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(78,222,163,0.04)_0%,transparent_70%)] pointer-events-none" />
                    <div className="relative z-10 p-5 flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#4edea3]/10 border border-[#4edea3]/20 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[#4edea3]" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-[#e5e2e1]">All stories estimated — ready to implement</p>
                          <p className="text-[10px] text-[#86948a] mt-0.5">
                            {stories.length} stories · {totalPoints} pts total · {AGENT_ROSTER.length} agents on standby
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => router.push(`/implementation?story=${encodeURIComponent(stories[0].id)}&autorun=1`)}
                        className="primary-gradient text-[#003824] px-6 py-3 rounded-xl text-[12px] font-bold uppercase tracking-widest shadow-lg shadow-[#4edea3]/15 h-auto border-transparent flex items-center gap-2 shrink-0 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                        Start Implementing
                      </Button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </ScrollArea>
        </main>
      </div>

      {/* Planning Poker Drawer */}
      {(() => {
        const drawerSession = drawerStoryId ? pokerSessions[drawerStoryId] : null;
        const drawerStory = drawerStoryId ? stories.find((s) => s.id === drawerStoryId) : null;
        return (
          <Drawer
            direction="right"
            open={drawerStoryId !== null}
            onOpenChange={(open) => { if (!open) setDrawerStoryId(null); }}
          >
            <DrawerContent className="bg-[#131313] border-l border-[#3c4a42]/40 flex flex-col p-0 overflow-hidden !max-w-none" style={{ width: "min(960px, 95vw)" }}>
              <DrawerHeader className="flex items-center justify-between px-8 py-5 border-b border-[#3c4a42]/30 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#4edea3]" style={{ fontSize: "28px" }}>casino</span>
                  <div>
                    <DrawerTitle style={{ fontSize: "20px", fontWeight: 700, color: "#e5e2e1", lineHeight: 1 }}>Planning Poker</DrawerTitle>
                    {drawerStory && (
                      <p style={{ fontSize: "14px", fontFamily: "monospace", color: "#474746", marginTop: "4px" }}>{drawerStory.id} · {drawerStory.title}</p>
                    )}
                  </div>
                </div>
                <DrawerClose className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2a2a2a] border border-[#3c4a42]/30 hover:bg-[#333] transition-colors">
                  <span className="material-symbols-outlined text-[#86948a]" style={{ fontSize: "18px" }}>close</span>
                </DrawerClose>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto ide-scroll px-8 py-6 space-y-6">
                {drawerSession && (
                  <>
                    {/* Agent cards — 3 columns */}
                    <div className="grid grid-cols-3 gap-5">
                      {drawerSession.agents.map((agent, i) => (
                        <div key={agent.role} className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-[#1a1a1a] border border-[#3c4a42]/25">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 shrink-0" style={{ background: `${agent.color}12`, borderColor: `${agent.color}30` }}>
                            <span className="material-symbols-outlined" style={{ fontSize: "32px", color: agent.color }}>{agent.icon}</span>
                          </div>
                          <PokerCard value={agent.estimate} revealed={agent.revealed} color={agent.color} animationDelay={i * 180} />
                          <span style={{ fontSize: "17px", fontWeight: 700, color: agent.color, textAlign: "center" }}>{agent.label}</span>
                          {agent.revealed && agent.reasoning && (
                            <p style={{ fontSize: "15px", color: "#86948a", textAlign: "center", lineHeight: 1.6 }}>{agent.reasoning}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Debate transcript */}
                    {drawerSession.logs.length > 0 && (
                      <div className="rounded-xl bg-[#0e0e0e] border border-[#3c4a42]/20 overflow-hidden">
                        <div className="px-5 py-4 border-b border-[#3c4a42]/20 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#474746]" style={{ fontSize: "18px" }}>forum</span>
                          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#474746" }}>Debate transcript</span>
                          <span className="ml-auto" style={{ fontSize: "13px", fontFamily: "monospace", color: "#474746" }}>{drawerSession.logs.length} turns</span>
                        </div>
                        <div className="p-5 space-y-4">
                          {drawerSession.logs.map((log, i) => (
                            <div key={i} className="rounded-xl bg-[#131313] border border-[#3c4a42]/15 overflow-hidden">
                              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#3c4a42]/10" style={{ background: `${log.color}08` }}>
                                <div className="w-2 h-6 rounded-full shrink-0" style={{ background: log.color }} />
                                <span style={{ fontSize: "17px", fontWeight: 700, color: log.color }}>{log.agent}</span>
                                <span className="ml-auto" style={{ fontSize: "13px", fontFamily: "monospace", color: "#474746" }}>{log.timestamp}</span>
                              </div>
                              <div className="px-5 py-5">
                                <span style={{ fontSize: "15px", fontFamily: "monospace", color: "#c8c6c5", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", display: "block" }}>
                                  {log.text}
                                  {i === drawerSession.logs.length - 1 && drawerSession.phase === "debating" && (
                                    <span className="terminal-cursor" />
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Consensus */}
                    {drawerSession.phase === "done" && drawerSession.consensusEstimate !== null && (
                      <div className="flex items-center justify-between rounded-xl bg-[#4edea3]/8 border border-[#4edea3]/25 px-8 py-6">
                        <div className="flex items-center gap-4">
                          <span className="material-symbols-outlined text-[#4ae176]" style={{ fontSize: "32px" }}>check_circle</span>
                          <div>
                            <p style={{ fontSize: "18px", fontWeight: 700, color: "#4ae176", textTransform: "uppercase", letterSpacing: "0.05em" }}>Consensus reached</p>
                            <p style={{ fontSize: "15px", color: "#86948a", marginTop: "4px" }}>All agents have agreed on an estimate</p>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-3">
                          <span style={{ fontSize: "64px", fontWeight: 700, fontFamily: "monospace", color: "#4edea3", lineHeight: 1 }}>{drawerSession.consensusEstimate}</span>
                          <div className="flex flex-col">
                            <span style={{ fontSize: "18px", fontWeight: 700, color: "#4edea3" }}>pts</span>
                            <span style={{ fontSize: "15px", color: "#86948a" }}>
                              ~{drawerSession.consensusEstimate * 30 >= 60
                                ? `${Math.round(drawerSession.consensusEstimate * 30 / 60 * 10) / 10}h`
                                : `${drawerSession.consensusEstimate * 30}min`} delivery
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* In-progress state */}
                    {drawerSession.phase !== "done" && (
                      <div className="flex items-center gap-3 px-6 py-5 rounded-xl bg-[#4edea3]/5 border border-[#4edea3]/15">
                        <span className="w-3 h-3 rounded-full bg-[#4edea3] glow-pulse shrink-0" />
                        <span style={{ fontSize: "16px", color: "#4edea3", fontWeight: 500, textTransform: "capitalize" }}>{drawerSession.phase}…</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        );
      })()}
    </>
  );
}
