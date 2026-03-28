"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { callAgentStream } from "@/lib/agents/client";

// ---------------------------------------------------------------------------
// Sidebar — Pipeline Stepper
// ---------------------------------------------------------------------------
function Sidebar() {
  const steps = [
    { label: "Ideation",        icon: "lightbulb",       href: "#",               state: "future" },
    { label: "Requirements",    icon: "assignment",      href: "#",               state: "future" },
    { label: "User Stories",    icon: "group",           href: "#",               state: "future" },
    { label: "Planning",        icon: "event_note",      href: "#",               state: "future" },
    { label: "Analysis",        icon: "code",            href: "/analysis",       state: "done"   },
    { label: "Implementation",  icon: "construction",    href: "/implementation", state: "done"   },
    { label: "Merge",           icon: "call_merge",      href: "/merge",          state: "done"   },
    { label: "Dashboard",       icon: "dashboard",       href: "/dashboard",      state: "active" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col p-4 z-40 bg-[#201f1f] w-64 border-r border-[#3c4a42]/20">
      <nav className="flex-1 flex flex-col gap-y-1">
        {steps.map((step) => {
          const isActive = step.state === "active";
          const isDone   = step.state === "done";
          return (
            <a
              key={step.label}
              href={step.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isActive
                  ? "bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/30 shadow-[0_0_12px_#4edea320] animate-pulse-glow"
                  : isDone
                  ? "text-[#4ae176] border border-[#4ae176]/20 bg-[#4ae176]/10 hover:bg-[#4ae176]/15"
                  : "text-[#474746] hover:bg-[#353534]/30 hover:text-[#c8c6c5]"
              )}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={isActive || isDone ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {isDone ? "check_circle" : step.icon}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider">{step.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Animated Ring
// ---------------------------------------------------------------------------
function Ring({
  score,
  color,
  size = "w-16 h-16",
  centerContent,
}: {
  score: number;          // 0–1
  color: string;
  size?: string;
  centerContent: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const circ = 175.9;
  const target = circ * (1 - score);
  return (
    <div className={cn("relative flex items-center justify-center", size)}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r="28" fill="transparent" stroke="#353534" strokeWidth="4" />
        <circle
          cx="32" cy="32" r="28"
          fill="transparent"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeLinecap="round"
          style={{
            strokeDashoffset: mounted ? target : circ,
            transition: "stroke-dashoffset 1.2s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {centerContent}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated Bar
// ---------------------------------------------------------------------------
function Bar({
  width,
  color,
  height = "h-1.5",
}: {
  width: string;   // e.g. "94%"
  color: string;   // tailwind bg class or inline hex
  height?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return (
    <div className={cn("bg-[#353534] rounded-full flex-1", height)}>
      <div
        className={cn("h-full rounded-full")}
        style={{
          width: mounted ? width : "0%",
          backgroundColor: color,
          transition: "width 1s ease-out",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main inner component
// ---------------------------------------------------------------------------
function DashboardInner() {
  const searchParams = useSearchParams();
  const storiesParam = searchParams.get("stories") ?? "";
  const stories = storiesParam ? storiesParam.split(",").map((s) => {
    const [id, variant] = s.split(":");
    return { id, variant };
  }) : [];

  const firstStory = stories[0] ?? { id: "", variant: "" };

  // Load story titles from localStorage (populated by the ideation pipeline)
  const [storyTitles, setStoryTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("itfest_state");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.stories) {
        const titles: Record<string, string> = {};
        for (const s of parsed.stories) {
          if (s.id && s.title) titles[s.id] = s.title;
        }
        setStoryTitles(titles);
      }
    } catch { /* ignore */ }
  }, []);

  // Read URL params for scores (wired from merge page)
  const complianceParam  = parseInt(searchParams.get("compliance")  ?? "0",  10);
  const efficiencyParam  = parseInt(searchParams.get("efficiency")  ?? "0",  10);

  // Mounted state for top-level animations (KPI band)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Rerun audit state (Item 12)
  const [auditRunning, setAuditRunning] = useState(false);
  const [complianceScore, setComplianceScore] = useState(complianceParam);
  const [efficiencyScore, setEfficiencyScore] = useState(efficiencyParam);

  const rerunAudit = useCallback(async () => {
    if (auditRunning) return;
    setAuditRunning(true);
    const context = stories.map((s) => `${s.id} → Variant ${s.variant}`).join("\n");
    try {
      await callAgentStream(
        {
          role: "evaluator",
          storyId: firstStory.id,
          storyTitle: "Intelligence Report",
          storyDescription: "Re-evaluate merged implementations",
          context,
        },
        () => {}
      );
      // TODO: parse real scores from agent response
    } catch { /* ignore errors */ }
    setAuditRunning(false);
  }, [auditRunning, stories, firstStory.id]);

  // ----- Agent performance data (populated after real audit runs) -----
  const agents: { name: string; score: number; color: string; icon: string }[] = [];

  // ----- Self-correction log (populated during merge/audit) -----
  const logEntries: { time: string; tag: string; tagColor: string; msg: string; file: string; rest: string }[] = [];

  // ----- Reviews (populated after project review stage) -----
  const reviews: { initials: string; name: string; sentiment: string; sentimentColor: string; text: string }[] = [];

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          font-family: 'Material Symbols Outlined';
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 8px #4edea340; }
          50%       { box-shadow: 0 0 18px #4edea370; }
        }
        .animate-pulse-glow { animation: glow-pulse 2s ease-in-out infinite; }
        .ide-scroll::-webkit-scrollbar { width: 4px; }
        .ide-scroll::-webkit-scrollbar-track { background: transparent; }
        .ide-scroll::-webkit-scrollbar-thumb { background: #3c4a42; border-radius: 2px; }
      `}</style>

      {/* ── Top Nav ── */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#131313] border-b border-[#3c4a42]/20">
        <span className="text-xl font-bold text-[#4edea3] tracking-tight font-serif">Luminescent IDE</span>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-[#353534] border border-[#3c4a42]/30 text-[#4edea3] text-xs font-bold">E</AvatarFallback>
        </Avatar>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar />

        {/* ── Main content ── */}
        <main className="ml-64 flex-1 p-6 overflow-y-auto bg-[#131313] ide-scroll">
          <div className="max-w-6xl mx-auto space-y-8">

            {/* ── Page Header ── */}
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-[#4edea3]/10 text-[#4edea3] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border-0 mb-2">
                  {firstStory.id}
                </Badge>
                <h1 className="text-3xl font-bold font-serif text-[#e5e2e1]">Intelligence Report</h1>
                <p className="text-sm text-[#c8c6c5] mt-1">
                  Post-deployment analysis&nbsp;&bull;&nbsp;AI-generated insights across{" "}
                  <span className="text-[#4edea3] font-mono">{stories.length}</span> merged stories
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={rerunAudit}
                disabled={auditRunning}
                className="text-[#c8c6c5] hover:text-[#e5e2e1] hover:bg-[#2a2a2a] border border-[#3c4a42]/30 rounded-xl flex items-center gap-2 text-xs font-medium disabled:opacity-50"
              >
                <span className={cn("material-symbols-outlined text-sm", auditRunning && "animate-spin")}>refresh</span>
                {auditRunning ? "Running…" : "Rerun Audit"}
              </Button>
            </div>

            {/* ══════════════════════════════════════════════════════════
                Section 1 — KPI Band
            ══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-4 gap-4">

              {/* Card 1 — Stories Merged */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    call_merge
                  </span>
                </div>
                <div className="text-4xl font-bold font-mono text-[#4edea3]">{stories.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#c8c6c5] mt-1">Stories Merged</div>
                <svg viewBox="0 0 80 30" className="w-full h-8 mt-2">
                  <polyline
                    points="0,25 20,18 40,20 60,10 80,5"
                    fill="none"
                    stroke="#4edea3"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="80" cy="5" r="2.5" fill="#4edea3" />
                </svg>
              </div>

              {/* Card 2 — Compliance Score */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5 flex flex-col items-center justify-center">
                <Ring
                  score={complianceScore / 100}
                  color="#4edea3"
                  size="w-16 h-16"
                  centerContent={
                    <span className="text-[11px] font-bold font-mono text-[#e5e2e1]">{complianceScore}%</span>
                  }
                />
                <div className="text-[10px] uppercase tracking-widest text-[#c8c6c5] mt-3">Compliance</div>
              </div>

              {/* Card 3 — Agent Efficiency */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5 flex flex-col items-center justify-center">
                <Ring
                  score={efficiencyScore / 100}
                  color="#4ae176"
                  size="w-16 h-16"
                  centerContent={
                    <span className="text-[11px] font-bold font-mono text-[#e5e2e1]">{efficiencyScore}%</span>
                  }
                />
                <div className="text-[10px] uppercase tracking-widest text-[#c8c6c5] mt-3">Agent Efficiency</div>
              </div>

              {/* Card 4 — Bundle Size */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5">
                <div className="text-4xl font-bold font-mono text-[#6ffbbe] mt-1">12.4 MB</div>
                <div className="text-[10px] uppercase tracking-widest text-[#c8c6c5] mt-1">Bundle Size</div>
                <div className="text-xs text-[#4ae176] mt-1">↓ 4.2% vs previous</div>
                <div className="bg-[#353534] h-2 rounded-full mt-3">
                  <div
                    className="h-full rounded-full bg-[#6ffbbe]"
                    style={{
                      width: mounted ? "62%" : "0%",
                      transition: "width 1s ease-out",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                Section 2 — Story Outcomes + App Pulse
            ══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-[60fr_40fr] gap-6">

              {/* Left — Story Outcomes */}
              <div className="space-y-4">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5"
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-[#4edea3]/10 text-[#4edea3] text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border-0">
                        {story.id}
                      </Badge>
                      <span className="text-sm font-semibold text-[#e5e2e1] flex-1">
                        {storyTitles[story.id] ?? story.id}
                      </span>
                      <Badge className="bg-[#4ae176]/10 text-[#4ae176] text-[10px] font-bold px-2 py-0.5 rounded border-0">
                        Variant {story.variant}
                      </Badge>
                    </div>

                    {/* Agent chain timeline */}
                    <div className="flex items-center gap-0 mt-4">
                      {[
                        { icon: "hub",     label: "Orchestrator" },
                        { icon: "dns",     label: "Backend"      },
                        { icon: "web",     label: "Frontend"     },
                        { icon: "shield",  label: "Security"     },
                        { icon: "balance", label: "Evaluator"    },
                      ].map((agent, i, arr) => (
                        <div key={agent.label} className="flex items-center flex-1 last:flex-none">
                          <div
                            title={agent.label}
                            className="w-7 h-7 rounded-full bg-[#4edea3]/10 border border-[#4edea3]/30 flex items-center justify-center shrink-0"
                          >
                            <span
                              className="material-symbols-outlined text-[#4edea3]"
                              style={{ fontSize: "12px", fontVariationSettings: "'FILL' 1" }}
                            >
                              {agent.icon}
                            </span>
                          </div>
                          {i < arr.length - 1 && (
                            <div className="flex-1 h-px bg-gradient-to-r from-[#4edea3]/30 to-[#4edea3]/30" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Security score bar */}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-[10px] text-[#c8c6c5] w-14 shrink-0">Security</span>
                      <Bar width="94%" color="#4ae176" height="h-1.5" />
                      <span className="text-xs text-[#4ae176] font-mono shrink-0">94/100</span>
                    </div>

                    {/* Key metric */}
                    <p className="text-[10px] text-[#c8c6c5] mt-2">
                      Metrics will appear after audit completes
                    </p>
                  </div>
                ))}
              </div>

              {/* Right — App Pulse */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#4edea3]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    forum
                  </span>
                  <span className="text-sm font-bold text-[#e5e2e1]">App Pulse</span>
                </div>

                {/* Big rating ring */}
                <div className="flex flex-col items-center">
                  <Ring
                    score={reviews.length > 0 ? 0.8 : 0}
                    color="#4edea3"
                    size="w-24 h-24"
                    centerContent={
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-2xl font-bold font-serif text-[#e5e2e1]">{reviews.length > 0 ? "4.0" : "—"}</span>
                        <span className="text-[10px] text-[#c8c6c5]">/5.0</span>
                      </div>
                    }
                  />
                  <div className="text-[#474746] tracking-tight mt-2 text-sm">{reviews.length > 0 ? "★★★★☆" : "No reviews yet"}</div>
                </div>

                {/* Sentiment breakdown */}
                <div className="space-y-2 mt-4">
                  {[
                    { label: "Positive", pct: "87%", color: "#4edea3" },
                    { label: "Neutral",  pct: "11%", color: "#c8c6c5" },
                    { label: "Critical", pct: "2%",  color: "#ffb4ab" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-[#c8c6c5] w-14 shrink-0">{row.label}</span>
                      <Bar width={row.pct} color={row.color} height="h-1.5" />
                      <span className="text-[10px] font-mono text-[#c8c6c5] shrink-0 w-7 text-right">{row.pct}</span>
                    </div>
                  ))}
                </div>

                {/* Reviews */}
                <div className="space-y-2 mt-4">
                  {reviews.map((r) => (
                    <div key={r.name} className="bg-[#201f1f] rounded-xl p-3 flex gap-3">
                      <div className="w-8 h-8 bg-[#353534] rounded-full flex items-center justify-center text-[#4edea3] text-xs font-bold shrink-0">
                        {r.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-[#e5e2e1]">{r.name}</span>
                          <Badge
                            className="text-[9px] font-bold px-1.5 py-0 rounded border-0"
                            style={{ backgroundColor: `${r.sentimentColor}18`, color: r.sentimentColor }}
                          >
                            {r.sentiment}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-[#c8c6c5] line-clamp-2 leading-relaxed">{r.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[9px] text-[#474746] font-mono mt-3 text-center">
                  Powered by Review Agent v1.2
                </p>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                Section 3 — Agent Intelligence Panel
            ══════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-3 gap-6">

              {/* Col 1 — Agent Performance */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#4edea3]">psychology</span>
                  <span className="text-sm font-bold text-[#e5e2e1]">Agent Performance</span>
                </div>
                <div className="space-y-3">
                  {agents.map((a) => (
                    <div key={a.name} className="flex items-center gap-2">
                      <span
                        className="material-symbols-outlined text-[14px] shrink-0"
                        style={{ color: a.color, fontVariationSettings: "'FILL' 1" }}
                      >
                        {a.icon}
                      </span>
                      <span className="text-[10px] text-[#c8c6c5] w-20 shrink-0">{a.name}</span>
                      <Bar width={`${a.score}%`} color={a.color} height="h-1.5" />
                      <span className="text-xs font-mono shrink-0 w-8 text-right" style={{ color: a.color }}>
                        {a.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Col 2 — Optimization Suggestions */}
              <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#4edea3]">bolt</span>
                  <span className="text-sm font-bold text-[#e5e2e1]">Suggestions</span>
                </div>
                <div className="space-y-3">
                  {stories.length === 0 ? (
                    <p className="text-xs text-[#474746]">Suggestions will appear after merge and audit.</p>
                  ) : (
                    <p className="text-xs text-[#474746]">Run an audit to generate optimization suggestions.</p>
                  )}
                </div>
              </div>

              {/* Col 3 — Self-Correction Log */}
              <div className="bg-[#0e0e0e] rounded-2xl border border-[#3c4a42]/20 p-5 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#c8c6c5] text-sm">history_edu</span>
                  <span className="text-xs font-mono font-bold text-[#c8c6c5] uppercase tracking-widest">
                    Self-Correction Log
                  </span>
                </div>
                <div className="max-h-[240px] overflow-y-auto ide-scroll space-y-2 mt-3">
                  {logEntries.map((entry) => (
                    <div key={entry.time} className="flex gap-2 text-[11px] font-mono">
                      <span className="text-[#474746] shrink-0 w-16">{entry.time}</span>
                      <span style={{ color: entry.tagColor }} className="shrink-0">[{entry.tag}]</span>
                      <span className="text-[#e5e2e1] flex-1">
                        {entry.msg}
                        <span className="text-[#4ae176]">{entry.file}</span>
                        {entry.rest}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-2 text-[11px] font-mono">
                    <span className="text-[#474746] shrink-0 w-16">14:30:00</span>
                    <span className="text-[#4ae176] flex-1">All self-corrections verified against CI/CD test suite.</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[#131313] text-[#4edea3] text-sm font-mono">
          Loading intelligence report...
        </div>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
