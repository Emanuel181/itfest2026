"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
// Sidebar (same shell as implementation page)
// ---------------------------------------------------------------------------
function Sidebar() {
  const navItems = [
    { label: "Ideation", icon: "lightbulb", href: "#" },
    { label: "Requirements", icon: "assignment", href: "#" },
    { label: "User Stories", icon: "group", href: "#" },
    { label: "Planning", icon: "event_note", href: "#" },
    { label: "Implementation", icon: "code", href: "/implementation" },
    { label: "Security", icon: "security", href: "#" },
    { label: "Merge", icon: "call_merge", href: "/merge" },
    { label: "Dashboard", icon: "dashboard", href: "#" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col p-4 z-40 bg-[#201f1f] w-64 border-r border-[#3c4a42]/20">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-[#353534] flex items-center justify-center text-[#4edea3]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>deployed_code</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white leading-tight font-serif">Core Engine</h3>
          <p className="text-[10px] text-[#4edea3]/70 font-mono tracking-wider">v2.4.0-stable</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-y-1">
        {navItems.map((item) => {
          const isActive = item.label === "Merge";
          return (
            <a
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isActive
                  ? "bg-[#353534] text-[#4edea3] border-l-4 border-[#10b981] translate-x-1"
                  : "text-[#c8c6c5] hover:bg-[#353534]/50"
              )}
            >
              <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider">{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 border-t border-[#3c4a42]/20 flex flex-col gap-1">
        <button className="mb-4 bg-[#4edea3]/10 text-[#4edea3] border border-[#4edea3]/20 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-[#4edea3]/20 transition-all">
          New Branch
        </button>
        <a className="flex items-center gap-3 text-[#c8c6c5] px-4 py-2 hover:bg-[#353534]/50 rounded-xl transition-all" href="#">
          <span className="material-symbols-outlined text-sm">help</span>
          <span className="text-[11px] font-medium uppercase tracking-wider">Support</span>
        </a>
        <a className="flex items-center gap-3 text-[#c8c6c5] px-4 py-2 hover:bg-[#353534]/50 rounded-xl transition-all" href="#">
          <span className="material-symbols-outlined text-sm">settings</span>
          <span className="text-[11px] font-medium uppercase tracking-wider">Settings</span>
        </a>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Merge sequence steps (mock)
// ---------------------------------------------------------------------------
const MERGE_STEPS: Array<Omit<ActivityEntry, "id" | "timestamp">> = [
  {
    agent: "MERGE AGENT",
    color: "text-[#4edea3]",
    borderColor: "border-[#4edea3]",
    message: "Integrating selected story implementations into main-stable branch...",
    progress: 30,
  },
  {
    agent: "MERGE AGENT",
    color: "text-[#4edea3]",
    borderColor: "border-[#4edea3]",
    message: "Resolved 2 non-critical logic overlaps in the data pipeline. Bundle optimization in progress.",
    progress: 65,
  },
  {
    agent: "SECURITY AUDITOR",
    color: "text-[#4ae176]",
    borderColor: "border-[#4ae176]",
    message: "Final verification passed. No vulnerabilities detected in new sub-modules.",
    done: true,
  },
  {
    agent: "MERGE AGENT",
    color: "text-[#4edea3]",
    borderColor: "border-[#4edea3]",
    message: "Merge complete. Final bundle size: 12.4 MB. 0 conflicts.",
    done: true,
  },
  {
    agent: "DEPLOYMENT BOT",
    color: "text-[#6ffbbe]",
    borderColor: "border-[#6ffbbe]",
    message: "Provisioning standalone container in Global Edge nodes...",
    progress: 85,
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function MergePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storiesParam = searchParams.get("stories") ?? "";

  const selections: StorySelection[] = storiesParam
    ? storiesParam.split(",").map((s) => {
        const [id, variant] = s.split(":");
        return { id, variant };
      })
    : [
        { id: "STORY-102", variant: "B" },
        { id: "STORY-105", variant: "A" },
      ];

  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [mergePhase, setMergePhase] = useState<"idle" | "running" | "done">("idle");
  const [deployProgress, setDeployProgress] = useState(0);
  const stepCounter = { current: 0 };

  const now = () =>
    new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  useEffect(() => {
    // Auto-start merge on mount
    const run = async () => {
      setMergePhase("running");
      for (let i = 0; i < MERGE_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 900 + i * 400));
        const step = MERGE_STEPS[i];
        setActivityLog((prev) => [
          { ...step, id: `step-${i}-${stepCounter.current++}`, timestamp: now() },
          ...prev,
        ]);
        if (step.agent === "DEPLOYMENT BOT") {
          // animate deploy progress
          for (let p = 0; p <= 100; p += 5) {
            await new Promise((r) => setTimeout(r, 60));
            setDeployProgress(p);
          }
        }
      }
      setMergePhase("done");
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyTitles: Record<string, string> = {
    "STORY-102": "Real-time Telemetry Processing",
    "STORY-105": "Adaptive Load Balancing",
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
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-[#4edea3] tracking-tight font-serif">Luminescent IDE</span>
          <nav className="hidden md:flex gap-6">
            {["Docs", "Architecture", "Logs"].map((l) => (
              <a key={l} className="text-[#c8c6c5] hover:text-white transition-colors text-sm" href="#">{l}</a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-[#353534] text-[#c8c6c5] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#474746] transition-colors">Share</button>
          <button className="primary-gradient text-[#003824] px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#4edea3]/10">Run Agents</button>
          <div className="flex gap-2 ml-2">
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">notifications</span>
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">settings</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#353534] border border-[#3c4a42]/30 flex items-center justify-center text-[#4edea3] text-xs font-bold">E</div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar />

        {/* Main content */}
        <main className="ml-64 mr-80 flex-1 p-8 overflow-y-auto bg-[#131313] ide-scroll">
          <div className="max-w-4xl mx-auto space-y-8">

            {/* Header */}
            <header>
              <h1 className="text-4xl font-bold text-[#e5e2e1] font-serif tracking-tight mb-2">Release Management</h1>
              <p className="text-[#c8c6c5] text-base">
                Merging{" "}
                {selections.map((s, i) => (
                  <span key={s.id}>
                    <span className="text-[#4edea3] font-medium">
                      {s.id}{storyTitles[s.id] ? ` — ${storyTitles[s.id]}` : ""} (Variant {s.variant})
                    </span>
                    {i < selections.length - 1 && <span className="text-[#474746]"> · </span>}
                  </span>
                ))}
              </p>
            </header>

            {/* Merge Canvas */}
            <section className="bg-[#1c1b1b] rounded-2xl p-6 border border-[#3c4a42]/20">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xs font-bold text-[#bbcabf] flex items-center gap-2 tracking-widest uppercase">
                  <span className="material-symbols-outlined text-[#4edea3]">account_tree</span>
                  Merge Canvas
                </h2>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded text-[10px] bg-[#4edea3]/10 text-[#4edea3] font-bold">
                    {selections.length * 3} COMPONENTS
                  </span>
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold",
                    mergePhase === "done" ? "bg-[#4ae176]/10 text-[#4ae176]" : "bg-[#474746]/50 text-[#c8c6c5]"
                  )}>
                    {mergePhase === "done" ? "MERGED" : mergePhase === "running" ? "MERGING..." : "READY"}
                  </span>
                </div>
              </div>

              {/* Component cards per story */}
              <div className="space-y-6">
                {selections.map((sel) => (
                  <div key={sel.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold">{sel.id}</span>
                      <span className="text-[#c8c6c5] text-xs">{storyTitles[sel.id] ?? sel.id}</span>
                      <span className="text-[9px] font-bold text-[#4edea3] bg-[#4edea3]/10 px-2 py-0.5 rounded ml-1">Variant {sel.variant}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { icon: "dns", label: "Backend Core", sub: "API & Logic Services", status: "SYNCED" },
                        { icon: "window", label: "Frontend UI", sub: "Component Bundle", status: "LINTED" },
                        { icon: "admin_panel_settings", label: "Security Patches", sub: "Auth Guardrails", status: "VERIFIED" },
                      ].map((card) => (
                        <div
                          key={card.label}
                          className="p-5 rounded-2xl bg-[#2a2a2a] border border-[#3c4a42]/20 hover:border-[#4edea3]/30 transition-all"
                        >
                          <span className="material-symbols-outlined text-[#4edea3] mb-3 block">{card.icon}</span>
                          <h3 className="text-sm font-bold text-white mb-1 font-serif">{card.label}</h3>
                          <p className="text-xs text-[#c8c6c5] mb-4">{card.sub}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#4ae176]">
                            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            {card.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Merge Agent Insight + Deployment Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Merge Agent Insight */}
              <section className="bg-[#353534]/40 rounded-2xl p-6 border border-[#4edea3]/10">
                <h3 className="text-xs font-bold text-[#4edea3] flex items-center gap-2 mb-4 tracking-widest uppercase">
                  <span className="material-symbols-outlined text-sm">smart_toy</span>
                  Merge Agent Insight
                </h3>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0e0e0e] border-l-2 border-[#4edea3]">
                    <p className="text-xs text-[#e5e2e1] leading-relaxed italic">
                      "The integration of{" "}
                      {selections.map((s, i) => (
                        <span key={s.id}>
                          <span className="text-[#4edea3] not-italic font-medium">{s.id}</span>
                          {i < selections.length - 1 && " and "}
                        </span>
                      ))}{" "}
                      successfully resolved 2 non-critical logic overlaps in the data pipeline. Final bundle optimization reduced artifact size by 4.2%."
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#201f1f]">
                      <span className="text-[10px] text-[#c8c6c5] block mb-1">Conflicts</span>
                      <span className="text-sm font-mono text-[#4edea3] font-bold">0 Clean</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#201f1f]">
                      <span className="text-[10px] text-[#c8c6c5] block mb-1">Bundle Size</span>
                      <span className="text-sm font-mono text-[#4edea3] font-bold">12.4 MB</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Deployment Status */}
              <section className="bg-[#1c1b1b] rounded-2xl p-6 border border-[#3c4a42]/20 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[#c8c6c5] flex items-center gap-2 mb-5 tracking-widest uppercase">
                    <span className="material-symbols-outlined text-sm">rocket_launch</span>
                    Deployment Status
                  </h3>
                  <ul className="space-y-3">
                    {[
                      { label: "Environment", value: "Production" },
                      { label: "Region", value: "Global Edge" },
                    ].map((row) => (
                      <li key={row.label} className="flex justify-between items-center text-xs">
                        <span className="text-[#c8c6c5]">{row.label}</span>
                        <span className="text-[#e5e2e1] font-medium bg-[#201f1f] px-2 py-0.5 rounded">{row.value}</span>
                      </li>
                    ))}
                    <li className="flex justify-between items-center text-xs">
                      <span className="text-[#c8c6c5]">Build Status</span>
                      <span className={cn("font-bold flex items-center gap-1", mergePhase === "done" ? "text-[#4ae176]" : "text-[#c8c6c5]")}>
                        <span className={cn("w-2 h-2 rounded-full", mergePhase === "done" ? "bg-[#4ae176] animate-pulse" : "bg-[#474746]")} />
                        {mergePhase === "done" ? "Ready" : "Building..."}
                      </span>
                    </li>
                    {mergePhase === "running" && (
                      <li>
                        <div className="mt-1 w-full bg-[#2a2a2a] h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full primary-gradient transition-all duration-300"
                            style={{ width: `${deployProgress}%` }}
                          />
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </section>
            </div>

            {/* Launch CTA */}
            <section className="flex flex-col items-center justify-center py-12 rounded-3xl bg-[#1c1b1b] border border-[#4edea3]/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-[#4edea3]/5 blur-3xl rounded-full scale-150 pointer-events-none" />
              <div className="relative z-10 text-center">
                <p className="text-[#c8c6c5] mb-6 text-sm font-medium tracking-wide">
                  {mergePhase === "done"
                    ? "Orchestration complete. All systems nominal."
                    : "Merge agent is integrating your implementations..."}
                </p>
                <button
                  disabled={mergePhase !== "done"}
                  className={cn(
                    "px-12 py-5 rounded-2xl font-bold text-xl flex items-center gap-4 transition-all",
                    mergePhase === "done"
                      ? "primary-gradient text-[#003824] shadow-[0_0_40px_-10px_rgba(78,222,163,0.5)] hover:scale-105 active:scale-95"
                      : "bg-[#2a2a2a] text-[#474746] cursor-not-allowed"
                  )}
                >
                  {mergePhase === "done" ? (
                    <>
                      Launch Standalone App
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    </>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-[#474746] border-t-[#4edea3] animate-spin" />
                      Merging...
                    </>
                  )}
                </button>
                {mergePhase === "done" && (
                  <>
                    <p className="mt-4 text-[10px] text-[#4edea3]/40 font-mono">
                      HASH: {selections.map((s) => `${s.id.replace("STORY-", "")}${s.variant}`).join("-")}-RELEASE
                    </p>
                    <button
                      onClick={() => router.push(`/dashboard?stories=${encodeURIComponent(storiesParam)}`)}
                      className="mt-4 flex items-center gap-2 text-sm font-bold text-[#4edea3] border border-[#4edea3]/20 px-6 py-2.5 rounded-xl hover:bg-[#4edea3]/10 transition-all"
                    >
                      <span className="material-symbols-outlined text-base">rate_review</span>
                      View Project Review
                    </button>
                  </>
                )}
              </div>
            </section>

          </div>
        </main>

        {/* Right panel: Agent Activity */}
        <aside className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 bg-[#1c1b1b] p-6 flex flex-col border-l border-[#3c4a42]/20">
          <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4edea3]">analytics</span>
            AGENT ACTIVITY
          </h2>

          <div className="flex-1 overflow-y-auto space-y-6 ide-scroll pr-1">
            {activityLog.length === 0 && (
              <div className="flex items-center gap-3 text-[#474746] text-xs">
                <span className="w-2 h-2 rounded-full bg-[#474746] animate-pulse" />
                Initializing merge sequence...
              </div>
            )}
            {activityLog.map((entry) => (
              <div key={entry.id} className="flex gap-4">
                <div className="relative flex-shrink-0">
                  <div className={cn(
                    "w-10 h-10 rounded-full bg-[#353534] flex items-center justify-center border",
                    entry.agent === "SECURITY AUDITOR" ? "border-[#4ae176]/20 text-[#4ae176]" :
                    entry.agent === "DEPLOYMENT BOT" ? "border-[#6ffbbe]/20 text-[#6ffbbe]" :
                    "border-[#4edea3]/20 text-[#4edea3]"
                  )}>
                    <span className="material-symbols-outlined text-sm">
                      {entry.agent === "SECURITY AUDITOR" ? "verified_user" :
                       entry.agent === "DEPLOYMENT BOT" ? "cloud_sync" : "call_merge"}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={cn("text-xs font-bold mb-1", entry.color)}>{entry.agent}</h4>
                  <p className="text-xs text-[#bbcabf] leading-relaxed">{entry.message}</p>
                  {entry.progress !== undefined && !entry.done && (
                    <div className="mt-2 w-full bg-[#2a2a2a] h-1 rounded-full overflow-hidden">
                      <div className="primary-gradient h-full rounded-full" style={{ width: `${entry.progress}%` }} />
                    </div>
                  )}
                  <span className="text-[10px] text-[#c8c6c5] mt-1 block">{entry.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pro tip */}
          <div className="mt-6 p-4 rounded-xl bg-[#4edea3]/5 border border-[#4edea3]/10">
            <p className="text-[11px] text-[#6ffbbe] leading-relaxed">
              <span className="font-bold">Pro Tip:</span> You can configure automated canary rollouts in{" "}
              <span className="underline cursor-pointer">Deployment Settings</span>.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

export default function MergePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#131313] text-[#4edea3] text-sm font-mono">
        Initializing merge agent...
      </div>
    }>
      <MergePageInner />
    </Suspense>
  );
}
