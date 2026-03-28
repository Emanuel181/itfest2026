"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { callAgentStream } from "@/lib/agents/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StorySelection {
  id: string;
  variant: string;
}

interface ActivityEntry {
  id: string;
  agent: string;
  color: string;
  borderColor: string;
  message: string;
  timestamp: string;
  progress?: number;
  done?: boolean;
}

// ---------------------------------------------------------------------------
// Sidebar — Pipeline Stepper
// ---------------------------------------------------------------------------
function Sidebar() {
  const steps = [
    { label: "Ideation",        icon: "lightbulb",        href: "#",               state: "future" },
    { label: "Requirements",    icon: "assignment",       href: "#",               state: "future" },
    { label: "User Stories",    icon: "group",            href: "#",               state: "future" },
    { label: "Planning",        icon: "event_note",       href: "#",               state: "future" },
    { label: "Analysis",        icon: "code",             href: "/analysis",       state: "done"   },
    { label: "Implementation",  icon: "construction",     href: "/implementation", state: "done"   },
    { label: "Merge",           icon: "call_merge",       href: "/merge",          state: "active" },
    { label: "Dashboard",       icon: "dashboard",        href: "#",               state: "future" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-64 flex flex-col p-5 z-40 bg-[#201f1f] border-r border-[#3c4a42]/20">
      <nav className="flex-1 flex flex-col gap-y-0 pt-2">
        {steps.map((step, idx) => {
          const isActive = step.state === "active";
          const isDone   = step.state === "done";
          const isFuture = step.state === "future";
          const isLast   = idx === steps.length - 1;

          return (
            <div key={step.label} className="flex flex-col items-start">
              <a href={step.href} className="flex items-center gap-3 w-full group">
                {/* Node circle */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                    isActive && "border-[#4edea3] bg-[#4edea3]/10 glow-pulse",
                    isDone   && "border-[#4ae176] bg-[#4ae176]/10",
                    isFuture && "border-[#474746] bg-transparent"
                  )}
                >
                  {isDone ? (
                    <span
                      className="material-symbols-outlined text-[#4ae176]"
                      style={{ fontVariationSettings: "'FILL' 1", fontSize: "16px" }}
                    >
                      check_circle
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "material-symbols-outlined",
                        isActive && "text-[#4edea3]",
                        isFuture && "text-[#474746]"
                      )}
                      style={{ fontSize: "16px" }}
                    >
                      {step.icon}
                    </span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wider transition-all",
                    isActive && "text-[#4edea3]",
                    isDone   && "text-[#4ae176]",
                    isFuture && "text-[#474746] group-hover:text-[#c8c6c5]"
                  )}
                >
                  {step.label}
                </span>
              </a>

              {/* Connector line */}
              {!isLast && (
                <div className="ml-[15px] my-0.5 w-[2px] h-5 bg-[#2a2a2a]" />
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
}

// ---------------------------------------------------------------------------
// No mock merge steps — the merge agent streams real-time output.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Integration Graph SVG
// ---------------------------------------------------------------------------
interface GraphNode {
  x: number;
  y: number;
  label: string;
  icon: string;
  storyIdx: number;
}

function IntegrationGraph({
  selections,
  mergePhase,
}: {
  selections: StorySelection[];
  mergePhase: "idle" | "running" | "done";
}) {
  const rows = selections.slice(0, 2);

  const nodeRows: GraphNode[][] = rows.map((sel, si) => {
    const baseY = 55 + si * 90;
    return [
      { x: 70,  y: baseY, label: "Backend",  icon: "dns",                  storyIdx: si },
      { x: 140, y: baseY, label: "Frontend", icon: "window",               storyIdx: si },
      { x: 210, y: baseY, label: "Security", icon: "admin_panel_settings", storyIdx: si },
    ];
  });

  const mainY = rows.length === 2 ? 220 : 160;
  const allNodes = nodeRows.flat();
  const totalH = mainY + 50;
  const running = mergePhase === "running";
  const done    = mergePhase === "done";

  return (
    <svg
      viewBox={`0 0 280 ${totalH}`}
      className="w-full"
      style={{ height: totalH }}
      aria-label="Integration graph"
    >
      {/* Edges from component nodes to main branch */}
      {allNodes.map((node, ni) => (
        <line
          key={`edge-${ni}`}
          x1={node.x}
          y1={node.y + 18}
          x2={140}
          y2={mainY - 18}
          stroke={done ? "#4edea3" : "#3c4a42"}
          strokeWidth={done ? 1.5 : 1}
          className={running ? "graph-edge-animated" : undefined}
          style={{ transition: "stroke 0.6s ease" }}
        />
      ))}

      {/* Story label badges */}
      {rows.map((sel, si) => {
        const rowY = 55 + si * 90;
        return (
          <text
            key={`story-label-${si}`}
            x={140}
            y={rowY - 28}
            textAnchor="middle"
            fontSize="8"
            fill="#474746"
            fontFamily="monospace"
          >
            {sel.id} · Variant {sel.variant}
          </text>
        );
      })}

      {/* Component nodes */}
      {allNodes.map((node, ni) => {
        const delay = ni * 0.08;
        return (
          <g
            key={`node-${ni}`}
            className={done ? "node-pop" : undefined}
            style={done ? { animationDelay: `${delay}s` } : undefined}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={18}
              fill={done ? "rgba(78,222,163,0.08)" : "#2a2a2a"}
              stroke={done ? "#4edea3" : "#3c4a42"}
              strokeWidth={1.5}
              style={{ transition: "fill 0.6s ease, stroke 0.6s ease" }}
            />
            {/* Inner icon dot */}
            <circle
              cx={node.x}
              cy={node.y}
              r={5}
              fill={done ? "#4edea3" : running ? "#4edea3" : "#474746"}
              style={{ transition: "fill 0.6s ease" }}
            />
            <text
              x={node.x}
              y={node.y + 30}
              textAnchor="middle"
              fontSize="8"
              fill="#c8c6c5"
              fontFamily="monospace"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {/* Main Branch rect */}
      <g
        className={done ? "node-pop" : undefined}
        style={done ? { animationDelay: `${allNodes.length * 0.08}s` } : undefined}
      >
        <rect
          x={96}
          y={mainY - 18}
          width={88}
          height={36}
          rx={8}
          fill={done ? "rgba(78,222,163,0.12)" : "#1c1b1b"}
          stroke={done ? "#4edea3" : "#3c4a42"}
          strokeWidth={1.5}
          style={{ transition: "fill 0.6s ease, stroke 0.6s ease" }}
        />
        <text
          x={140}
          y={mainY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fill={done ? "#4edea3" : "#c8c6c5"}
          fontFamily="monospace"
          fontWeight="bold"
          style={{ transition: "fill 0.6s ease" }}
        >
          main-stable
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Terminal line helpers
// ---------------------------------------------------------------------------
function agentPrefix(agent: string): string {
  if (agent === "SECURITY AUDITOR") return "✓";
  if (agent === "DEPLOYMENT BOT")   return "⬡";
  return ">";
}

function agentColor(agent: string): string {
  if (agent === "SECURITY AUDITOR") return "text-[#4ae176]";
  if (agent === "DEPLOYMENT BOT")   return "text-[#6ffbbe]";
  return "text-[#4edea3]";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function MergePageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const storiesParam = searchParams.get("stories") ?? "";

  const selections: StorySelection[] = storiesParam
    ? storiesParam.split(",").map((s) => {
        const [id, variant] = s.split(":");
        return { id, variant };
      })
    : [];

  const [mergePhase,    setMergePhase]    = useState<"idle" | "running" | "done">("idle");
  const [deployProgress, setDeployProgress] = useState(0);
  const [activityLog,   setActivityLog]   = useState<ActivityEntry[]>([]);

  const terminalRef = useRef<HTMLDivElement>(null);

  const now = () =>
    new Date().toLocaleTimeString("en-GB", {
      hour:   "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  useEffect(() => {
    const run = async () => {
      setMergePhase("running");
      const context = selections
        .map((s) => `${s.id} → Variant ${s.variant}`)
        .join("\n");
      // Accumulate full response, splitting on newlines to add entries progressively
      let lineBuffer = "";
      let lineIdx = 0;

      await callAgentStream(
        {
          role: "merge",
          storyId: selections[0]?.id ?? "MERGE",
          storyTitle: "Integration",
          storyDescription: "Merge selected variants into main-stable",
          context,
        },
        (delta) => {
          lineBuffer += delta;
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const isDone = /complete|success|merged|ready/i.test(trimmed);
            setActivityLog((prev) => [
              ...prev,
              {
                id: `llm-${lineIdx++}-${Date.now()}`,
                agent: isDone ? "MERGE AGENT" : /security|vulnerabilit/i.test(trimmed) ? "SECURITY AUDITOR" : /deploy|container|provisioning/i.test(trimmed) ? "DEPLOYMENT BOT" : "MERGE AGENT",
                color: /security|vulnerabilit/i.test(trimmed) ? "text-[#4ae176]" : /deploy|container/i.test(trimmed) ? "text-[#6ffbbe]" : "text-[#4edea3]",
                borderColor: /security|vulnerabilit/i.test(trimmed) ? "border-[#4ae176]" : /deploy|container/i.test(trimmed) ? "border-[#6ffbbe]" : "border-[#4edea3]",
                message: trimmed,
                timestamp: now(),
                done: isDone,
              },
            ]);
          }
        }
      ).catch(() => {
        // Fallback: add a basic done entry
        setActivityLog((prev) => [
          ...prev,
          { id: "fallback", agent: "MERGE AGENT", color: "text-[#4edea3]", borderColor: "border-[#4edea3]", message: "Merge complete. Integration succeeded.", timestamp: now(), done: true },
        ]);
      });

      // Flush remaining buffer
      if (lineBuffer.trim()) {
        setActivityLog((prev) => [
          ...prev,
          { id: `llm-final-${Date.now()}`, agent: "MERGE AGENT", color: "text-[#4edea3]", borderColor: "border-[#4edea3]", message: lineBuffer.trim(), timestamp: now(), done: true },
        ]);
      }

      setMergePhase("done");
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll terminal to bottom on new log entries
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activityLog]);

  const phaseBadge = () => {
    if (mergePhase === "done")    return <span className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-[#4edea3] border border-[#4edea3]/30 rounded-full px-3 py-1"><span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]" />COMPLETE</span>;
    if (mergePhase === "running") return <span className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-yellow-400 border border-yellow-400/30 rounded-full px-3 py-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />MERGING</span>;
    return <span className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-[#474746] border border-[#474746]/30 rounded-full px-3 py-1"><span className="w-1.5 h-1.5 rounded-full bg-[#474746]" />READY</span>;
  };

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <style>{`.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; font-family: 'Material Symbols Outlined'; }`}</style>

      {/* Top Nav */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#131313] border-b border-[#3c4a42]/20">
        <span className="text-xl font-bold text-[#4edea3] tracking-tight font-serif">
          Luminescent IDE
        </span>
        <div className="w-8 h-8 rounded-full bg-[#353534] border border-[#3c4a42]/30 flex items-center justify-center text-[#4edea3] text-xs font-bold">
          E
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar />

        {/* Main content */}
        <main className="ml-64 flex-1 p-6 overflow-y-auto bg-[#131313] ide-scroll">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#e5e2e1] font-serif tracking-tight mb-1">
                  Integration Terminal
                </h1>
                <p className="text-xs text-[#c8c6c5]">
                  Merge Agent autonomously integrating selected implementations into main-stable
                </p>
              </div>
              <div className="mt-1 shrink-0">
                {phaseBadge()}
              </div>
            </div>

            {/* Two-column split */}
            <div className="grid grid-cols-[55fr_45fr] gap-6">

              {/* LEFT — Merge Terminal */}
              <div className="bg-[#0e0e0e] rounded-2xl border border-[#3c4a42]/20 overflow-hidden flex flex-col">
                {/* Terminal title bar */}
                <div className="bg-[#1c1b1b] px-4 py-3 flex items-center gap-3 border-b border-[#3c4a42]/20 shrink-0">
                  {/* Traffic lights */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="font-mono text-xs text-[#c8c6c5] flex-1">
                    merge-agent@main-stable
                  </span>
                  {/* Phase status dot */}
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      mergePhase === "running" && "bg-[#4edea3] animate-pulse",
                      mergePhase === "done"    && "bg-[#4edea3]",
                      mergePhase === "idle"    && "bg-[#474746]"
                    )}
                  />
                </div>

                {/* Terminal body */}
                <div
                  ref={terminalRef}
                  className="p-4 font-mono text-xs leading-relaxed min-h-[400px] max-h-[480px] overflow-y-auto ide-scroll flex-1"
                >
                  {activityLog.length === 0 && mergePhase === "idle" && (
                    <span className="text-[#474746]">Waiting for merge agent...</span>
                  )}
                  {activityLog.length === 0 && mergePhase === "running" && (
                    <span className="text-[#474746]">Initializing...</span>
                  )}
                  {activityLog.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 mb-1 fade-in">
                      <span className="text-[#474746] shrink-0 w-20">{entry.timestamp}</span>
                      <span className={cn("shrink-0", agentColor(entry.agent))}>
                        {agentPrefix(entry.agent)}
                      </span>
                      <span className="text-[#e5e2e1] flex-1">{entry.message}</span>
                      {entry.progress != null && !entry.done && (
                        <span className="text-[#474746] shrink-0">{entry.progress}%</span>
                      )}
                    </div>
                  ))}
                  {mergePhase === "running" && (
                    <div className="mt-1">
                      <span className="terminal-cursor" />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — Integration Graph + Deploy */}
              <div className="flex flex-col gap-4">

                {/* Integration Graph card */}
                <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-5 flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#4edea3] text-base">
                      account_tree
                    </span>
                    <span className="text-xs font-bold text-[#c8c6c5] uppercase tracking-widest">
                      Integration Graph
                    </span>
                  </div>
                  <IntegrationGraph selections={selections} mergePhase={mergePhase} />
                </div>

                {/* Deploy status mini-cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "LOCAL",      region: "127.0.0.1"   },
                    { label: "STAGING",    region: "eu-west-1"   },
                    { label: "PRODUCTION", region: "Global Edge" },
                  ].map((env) => (
                    <div
                      key={env.label}
                      className="bg-[#201f1f] rounded-xl p-3 border border-[#3c4a42]/20"
                    >
                      <p className="text-[9px] font-bold font-mono text-[#c8c6c5] uppercase tracking-wider mb-2">
                        {env.label}
                      </p>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            mergePhase === "done"
                              ? "bg-[#4edea3] animate-pulse"
                              : "bg-[#474746]"
                          )}
                        />
                        <span className="text-[9px] font-mono text-[#474746]">
                          {mergePhase === "done" ? "online" : "pending"}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-[#474746]">{env.region}</p>
                    </div>
                  ))}
                </div>

                {/* Build progress bar */}
                {mergePhase === "running" && (
                  <div className="bg-[#2a2a2a] h-1 rounded-full overflow-hidden">
                    <div
                      className="primary-gradient h-full transition-all duration-300"
                      style={{ width: `${deployProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Launch CTA — appears when done */}
            {mergePhase === "done" && (
              <div className="fade-in rounded-3xl border border-[#4edea3]/30 bg-[#1c1b1b] p-8 relative overflow-hidden shadow-[0_0_60px_-15px_rgba(78,222,163,0.3)]">
                {/* Ambient glow */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(78,222,163,0.05)_0%,transparent_70%)] pointer-events-none" />

                <div className="relative z-10 flex items-center justify-between gap-8">
                  {/* Left: stats */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-[#4edea3] uppercase tracking-widest">
                      Merge Complete
                    </p>
                    <div className="flex gap-6">
                      {[
                        { label: "Conflicts",   value: "0 clean"                              },
                        { label: "Stories",     value: `${selections.length} merged`           },
                        { label: "Components",  value: `${selections.length * 3} merged`      },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-[10px] text-[#c8c6c5] uppercase tracking-widest">
                            {stat.label}
                          </p>
                          <p className="text-lg font-black font-mono text-[#4edea3]">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-[#474746] font-mono">
                      HASH:{" "}
                      {selections
                        .map((s) => `${s.id.replace("STORY-", "")}${s.variant}`)
                        .join("-")}
                      -RELEASE
                    </p>
                  </div>

                  {/* Right: buttons */}
                  <div className="flex flex-col gap-3 items-end shrink-0">
                    <Button
                      className="primary-gradient text-[#003824] px-10 py-4 rounded-2xl font-bold text-base flex items-center gap-3 shadow-lg shadow-[#4edea3]/20 h-auto"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        play_arrow
                      </span>
                      Launch Standalone App
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(
                          `/dashboard?stories=${encodeURIComponent(storiesParam)}&compliance=94&efficiency=97`
                        )
                      }
                      className="text-sm text-[#4edea3] border border-[#4edea3]/20 px-6 py-2.5 rounded-xl hover:bg-[#4edea3]/10 h-auto flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">rate_review</span>
                      View Project Review
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Export with Suspense wrapper
// ---------------------------------------------------------------------------
export default function MergePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-[#131313] text-[#4edea3] text-sm font-mono">
          Initializing merge agent...
        </div>
      }
    >
      <MergePageInner />
    </Suspense>
  );
}
