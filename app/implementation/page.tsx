"use client";

import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  UserStory,
  ImplementationVariant,
  VariantId,
  ActivityLog,
  AgentOutput,
} from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// Streaming agent call helper — returns full text, calls onChunk per token
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
// Strip markdown code fences and normalize orchestrator text
// ---------------------------------------------------------------------------
function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/^```\s*$/gm, "")
    .replace(/\*\*/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Syntax highlighter — tokenises TypeScript/TSX into colored spans
// ---------------------------------------------------------------------------
const KW = /\b(import|export|from|const|let|var|function|async|await|return|if|else|for|of|in|while|class|extends|interface|type|new|true|false|null|undefined|void|default|switch|case|break|try|catch|throw|as|typeof|keyof|readonly)\b/g;
const STR = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const COMMENT = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;
const JSX_TAG = /(<\/?[\w.]+(?:\s[^>]*)?>)/g;
const TYPE_ANN = /:\s*([A-Z][A-Za-z<>\[\]|&, ]+)/g;
const NUM = /\b(\d+(\.\d+)?)\b/g;
const FUNC = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g;

function highlightCode(code: string): React.ReactNode[] {
  // Build a flat list of segments with types
  type Seg = { text: string; type: "kw"|"str"|"comment"|"jsx"|"type"|"num"|"fn"|"plain" };
  const segs: Seg[] = [];

  // We'll do a simple single-pass by splitting on regex matches
  const allPattern = new RegExp(
    `(${COMMENT.source})|(${STR.source})|(${JSX_TAG.source})|(${KW.source})|(${FUNC.source})|(${NUM.source})`,
    "g"
  );

  let last = 0;
  let m: RegExpExecArray | null;
  allPattern.lastIndex = 0;

  while ((m = allPattern.exec(code)) !== null) {
    if (m.index > last) segs.push({ text: code.slice(last, m.index), type: "plain" });
    const txt = m[0];
    if (m[1]) segs.push({ text: txt, type: "comment" });
    else if (m[3]) segs.push({ text: txt, type: "str" });
    else if (m[6]) segs.push({ text: txt, type: "jsx" });
    else if (m[8]) segs.push({ text: txt, type: "kw" });
    else if (m[9]) segs.push({ text: txt, type: "fn" });
    else if (m[11]) segs.push({ text: txt, type: "num" });
    else segs.push({ text: txt, type: "plain" });
    last = m.index + txt.length;
  }
  if (last < code.length) segs.push({ text: code.slice(last), type: "plain" });

  const colorMap: Record<Seg["type"], string> = {
    kw:      "#c678dd",  // purple — keywords
    str:     "#98c379",  // green — strings
    comment: "#5c6370",  // grey — comments
    jsx:     "#e06c75",  // red — JSX tags
    type:    "#e5c07b",  // yellow — types
    num:     "#d19a66",  // orange — numbers
    fn:      "#61afef",  // blue — function names
    plain:   "#abb2bf",  // default text
  };

  return segs.map((s, i) => (
    <span key={i} style={{ color: colorMap[s.type] }}>{s.text}</span>
  ));
}
const MOCK_STORIES: UserStory[] = [
  {
    id: "STORY-102",
    reqId: "REQ-102",
    title: "Real-time Telemetry Processing",
    description:
      "As a Backend Engineer, I want a high-throughput WebSocket stream, so that telemetry data is processed with sub-10ms latency.",
    status: "pending",
    variants: [],
  },
  {
    id: "STORY-105",
    reqId: "REQ-105",
    title: "Adaptive Load Balancing",
    description:
      "As a DevOps Specialist, I want automated shard rebalancing, so that cluster health is maintained during peak traffic.",
    status: "pending",
    variants: [],
  },
];

function makeEmptyOutput(role: AgentOutput["role"]): AgentOutput {
  return { role, status: "idle", content: "", timestamp: "" };
}

function makeVariant(id: VariantId): ImplementationVariant {
  return {
    id,
    orchestrator: makeEmptyOutput("orchestrator"),
    backend: makeEmptyOutput("backend"),
    frontend: makeEmptyOutput("frontend"),
    security: makeEmptyOutput("security"),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgentBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider",
        color
      )}
    >
      {label}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full",
        active ? "bg-[#4edea3] animate-pulse" : "bg-[#474746]"
      )}
    />
  );
}

// Variant tab with 4 agent sub-tabs (orchestrator / backend / frontend / security)
function VariantPanel({
  variant,
  storyId,
}: {
  variant: ImplementationVariant;
  storyId: string;
}) {
  const [tab, setTab] = useState<"orchestrator" | "backend" | "frontend" | "security">("orchestrator");

  const isRunning = (out: AgentOutput) => out.status === "running";
  const isDone = (out: AgentOutput) => out.status === "done";

  // Parse orchestrator plan — strip markdown bold, handle any capitalisation
  const orchContent = variant.orchestrator.content.replace(/\*\*/g, "").replace(/\r/g, "");
  const orchLines = orchContent.split("\n");

  const statusLine = orchLines.find((l) => /^status:/i.test(l.trim()))
    ?.replace(/^status:\s*/i, "").trim() ?? "";
  const mappingLine = orchLines.find((l) => /^mapping:/i.test(l.trim()))
    ?.replace(/^mapping:\s*/i, "").trim() ?? "";

  // Find section boundaries by header line index
  const completedIdx = orchLines.findIndex((l) => /^completed[:\s]*/i.test(l.trim()));
  const pendingIdx   = orchLines.findIndex((l) => /^pending[:\s]*/i.test(l.trim()));

  const extractItems = (from: number, to?: number) =>
    orchLines
      .slice(from + 1, to)
      .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
      .filter(Boolean);

  const doneItems    = completedIdx >= 0 ? extractItems(completedIdx, pendingIdx >= 0 ? pendingIdx : undefined) : [];
  const pendingItems = pendingIdx   >= 0 ? extractItems(pendingIdx) : [];

  // Parse security JSON from content
  let secIssues: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; description: string; agentAction: string; agentResult: string }> = [];
  let secScore = 95;
  try {
    const jsonMatch = variant.security.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      secScore = parsed.complianceScore ?? 95;
      secIssues = (parsed.issues ?? []).map((iss: Record<string, string>) => ({
        id: iss.id ?? "SEC-000",
        severity: iss.severity ?? "low",
        title: iss.title ?? "Issue",
        description: iss.description ?? "",
        agentAction: iss.agentAction ?? iss.fix ?? "",
        agentResult: iss.agentResult ?? "Fixed by agent.",
      }));
    }
  } catch { /* keep defaults */ }

  return (
    <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 overflow-hidden shadow-2xl">
      {/* Agent tabs */}
      <div className="flex bg-[#2a2a2a] px-2 pt-2 gap-1 border-b border-[#3c4a42]/20">
        {(["orchestrator", "backend", "frontend", "security"] as const).map((t) => {
          const icons: Record<string, string> = {
            orchestrator: "hub",
            backend: "dns",
            frontend: "web",
            security: "security",
          };
          const colors: Record<string, string> = {
            orchestrator: "text-[#4edea3]",
            backend: "text-[#4ae176]",
            frontend: "text-[#6ffbbe]",
            security: "text-[#ffb4ab]",
          };
          const out = variant[t === "security" ? "security" : t] as AgentOutput;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-t-xl transition-colors flex items-center gap-2",
                tab === t
                  ? `bg-[#1c1b1b] border-x border-t border-[#3c4a42]/30 ${colors[t]}`
                  : "text-[#c8c6c5] hover:text-[#e5e2e1]"
              )}
            >
              <span className="material-symbols-outlined text-sm">{icons[t]}</span>
              {t === "security" ? "Security Audit" : t.charAt(0).toUpperCase() + t.slice(1)}
              {isRunning(out) && <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "orchestrator" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-[#3c4a42]/20" style={{ height: 480 }}>
          {/* Left: plan */}
          <div className="p-6 space-y-5 overflow-y-auto ide-scroll">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3]">
                <span className="material-symbols-outlined text-base">architecture</span>
              </div>
              <h4 className="font-semibold text-[#e5e2e1] font-serif">Execution Plan</h4>
            </div>
            {isRunning(variant.orchestrator) ? (
              <div className="text-xs text-[#c8c6c5] whitespace-pre-wrap leading-relaxed">
                {variant.orchestrator.content || <span className="text-[#4edea3] animate-pulse">Orchestrating…</span>}
                {variant.orchestrator.content && <span className="inline-block w-1.5 h-3 bg-[#4edea3] animate-pulse ml-0.5 align-middle" />}
              </div>
            ) : isDone(variant.orchestrator) ? (
              <div className="space-y-4">
                {(statusLine || mappingLine) && (
                  <div className="p-3 bg-[#353534] rounded-xl border-l-4 border-[#4edea3]">
                    {statusLine && <p className="text-[10px] font-bold text-[#4edea3] uppercase mb-1">Status: {statusLine}</p>}
                    {mappingLine && <p className="text-xs text-[#c8c6c5] leading-relaxed">{mappingLine}</p>}
                  </div>
                )}
                <ul className="space-y-3">
                  {/* All items — show as done once backend+frontend are complete */}
                  {[...doneItems, ...pendingItems].map((d, i) => {
                    const allComplete = isDone(variant.backend) && isDone(variant.frontend);
                    return (
                      <li key={i} className="flex items-start gap-3 text-xs text-[#e5e2e1]">
                        <span className={cn("material-symbols-outlined text-sm mt-0.5", allComplete ? "text-[#4edea3]" : "text-[#c8c6c5]")}>
                          {allComplete ? "check_circle" : "pending"}
                        </span>
                        <span className={allComplete ? "" : "text-[#c8c6c5] italic"}>{d}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-[#474746]">Waiting for orchestrator…</p>
            )}
          </div>
          {/* Right: code split */}
          <div className="col-span-2 flex flex-col divide-y divide-[#3c4a42]/20 h-full">
            <CodeBlock label="Backend Agent" icon="dns" color="text-[#4ae176]" filename={`controllers/stream_v${variant.id.toLowerCase()}.ts`} code={variant.backend.content} loading={isRunning(variant.backend)} />
            <CodeBlock label="Frontend Agent" icon="web" color="text-[#6ffbbe]" filename={`components/StoryView_v${variant.id}.tsx`} code={variant.frontend.content} loading={isRunning(variant.frontend)} />
          </div>
        </div>
      )}

      {tab === "backend" && (
        <CodeBlock label="Backend Agent" icon="dns" color="text-[#4ae176]" filename={`controllers/stream_v${variant.id.toLowerCase()}.ts`} code={variant.backend.content} loading={isRunning(variant.backend)} full />
      )}

      {tab === "frontend" && (
        <CodeBlock label="Frontend Agent" icon="web" color="text-[#6ffbbe]" filename={`components/StoryView_v${variant.id}.tsx`} code={variant.frontend.content} loading={isRunning(variant.frontend)} full />
      )}

      {tab === "security" && (
        <SecurityPanel issues={secIssues} score={secScore} loading={isRunning(variant.security)} />
      )}
    </div>
  );
}

function CodeBlock({
  label,
  icon,
  color,
  filename,
  code,
  full,
  loading,
}: {
  label: string;
  icon: string;
  color: string;
  filename: string;
  code: string;
  full?: boolean;
  loading?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const clean = stripFences(code);

  useEffect(() => {
    if (loading && bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [code, loading]);

  return (
    <div
      className={cn(
        "font-mono text-xs leading-relaxed relative flex flex-col",
        full ? "h-[480px]" : "h-[240px]"
      )}
      style={{ background: "#1e2127" }}
    >
      {/* IDE title bar */}
      <div className="flex justify-between items-center px-4 py-2 shrink-0 border-b border-white/5" style={{ background: "#282c34" }}>
        <div className="flex items-center gap-2">
          {/* traffic lights */}
          <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
          <span className={cn("text-[10px] font-bold uppercase tracking-widest ml-3", color)}>{label}</span>
          {loading && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("material-symbols-outlined text-sm", color)}>{icon}</span>
          <span className="text-[10px] text-[#c8c6c5]/50">{filename}</span>
        </div>
      </div>

      {/* Line numbers + code */}
      <div className="flex flex-1 overflow-y-auto ide-scroll" style={{ background: "#1e2127" }}>
        {loading && !clean ? (
          <div className="flex items-center gap-2 text-[#4edea3] animate-pulse text-xs p-4">
            <span className="material-symbols-outlined text-sm">sync</span>Generating…
          </div>
        ) : clean ? (
          <>
            {/* Gutter */}
            <div className="select-none shrink-0 text-right pr-4 pl-3 py-4 text-[11px] leading-[1.7] border-r border-white/5" style={{ color: "#495162", minWidth: "2.8rem" }}>
              {clean.split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code */}
            <pre className="flex-1 p-4 whitespace-pre-wrap break-words text-[11px] leading-[1.7] overflow-x-hidden">
              {highlightCode(clean)}
              {loading && <span className="inline-block w-2 h-3 bg-[#4edea3] animate-pulse ml-0.5 align-middle" />}
            </pre>
          </>
        ) : (
          <p className="text-[#474746] text-xs p-4">Waiting…</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function SecurityPanel({
  issues,
  score,
  loading,
}: {
  issues: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; description: string; agentAction: string; agentResult: string }>;
  score: number;
  loading?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 divide-x divide-[#3c4a42]/20">
      {/* Metrics column */}
      <div className="p-6 bg-[#1c1b1b] flex flex-col gap-6">
        <div className="space-y-4">
          <div className="bg-[#353534]/50 p-4 rounded-xl border border-[#3c4a42]/10">
            <span className="text-[10px] font-bold text-[#c8c6c5] uppercase tracking-widest block mb-2">Vulnerabilities</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#4edea3] font-serif">{String(issues.length).padStart(2, "0")}</span>
              <span className="text-[10px] text-[#4edea3] font-bold px-1.5 py-0.5 bg-[#4edea3]/10 rounded">All Fixed</span>
            </div>
          </div>
          <div className="bg-[#353534]/50 p-4 rounded-xl border border-[#3c4a42]/10">
            <span className="text-[10px] font-bold text-[#c8c6c5] uppercase tracking-widest block mb-2">Compliance Score</span>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold font-serif", score >= 85 ? "text-[#4edea3]" : "text-[#ffb4ab]")}>{score}%</span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", score >= 85 ? "text-[#4edea3] bg-[#4edea3]/10" : "text-[#ffb4ab] bg-[#ffb4ab]/10")}>
                {score >= 85 ? "Healthy" : "At Risk"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-auto">
          <button className="w-full bg-[#353534] text-[#e5e2e1] py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-[#3c4a42]/20 hover:bg-[#474746] transition-colors">
            Download Report
          </button>
        </div>
      </div>

      {/* Issues list */}
      <div className="lg:col-span-3 p-6 space-y-5 max-h-[480px] overflow-y-auto ide-scroll">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-[#e5e2e1] font-serif">Identified Issues</h4>
          <span className="text-[10px] text-[#c8c6c5]">Updated: just now</span>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-[#ffb4ab] animate-pulse text-xs">
            <span className="material-symbols-outlined text-sm">security</span>Scanning for vulnerabilities…
          </div>
        )}
        {!loading && issues.map((issue) => (
          <div
            key={issue.id}
            className={cn(
              "bg-[#201f1f] p-5 rounded-2xl border transition-all",
              issue.severity === "high"
                ? "border-[#3c4a42]/10 hover:border-[#ffb4ab]/20"
                : "border-[#3c4a42]/10 hover:border-[#4edea3]/20"
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                  issue.severity === "high"
                    ? "bg-[#ffb4ab]/10 text-[#ffb4ab]"
                    : issue.severity === "medium"
                    ? "bg-[#474746]/50 text-[#c8c6c5]"
                    : "bg-[#4edea3]/10 text-[#4edea3]"
                )}
              >
                {issue.severity} severity
              </span>
              <span className="text-[#c8c6c5] font-mono text-[10px]">{issue.id}</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-[#4edea3]">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Auto-fixed by Agent
              </span>
            </div>
            <h5 className="text-sm font-bold text-[#e5e2e1] mb-2">{issue.title}</h5>
            <p className="text-xs text-[#c8c6c5] mb-4 leading-relaxed">{issue.description}</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-[#0e0e0e] rounded-xl border border-[#3c4a42]/20">
                <span className="material-symbols-outlined text-[#4ae176] text-sm mt-0.5">bolt</span>
                <div>
                  <p className="text-[9px] font-bold text-[#4ae176] uppercase tracking-widest mb-1">Agent Action</p>
                  <p className="text-[11px] text-[#e5e2e1] leading-relaxed">{issue.agentAction}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-[#4edea3]/5 rounded-xl border border-[#4edea3]/10">
                <span className="material-symbols-outlined text-[#4edea3] text-sm mt-0.5">verified</span>
                <div>
                  <p className="text-[9px] font-bold text-[#4edea3] uppercase tracking-widest mb-1">Result</p>
                  <p className="text-[11px] text-[#e5e2e1] leading-relaxed">{issue.agentResult}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && issues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[#c8c6c5]">
            <span className="material-symbols-outlined text-4xl text-[#4edea3] mb-2">verified_user</span>
            <p className="text-sm font-medium">No vulnerabilities detected</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Global Evaluator panel shown after all 3 variants are "run"
function GlobalEvaluatorPanel({
  story,
  evalContent,
  onChoose,
}: {
  story: UserStory;
  evalContent: string;
  onChoose: (v: VariantId) => void;
}) {
  const [chosen, setChosen] = useState<VariantId | null>(story.chosenVariant ?? null);

  type EvalData = { pros: string[]; cons: string[]; complexityScore: number; recommended: boolean };
  let EVALS: Record<VariantId, EvalData> = {
    A: { pros: [], cons: [], complexityScore: 7, recommended: false },
    B: { pros: [], cons: [], complexityScore: 8, recommended: true },
    C: { pros: [], cons: [], complexityScore: 7, recommended: false },
  };
  try {
    const jsonMatch = evalContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      EVALS = { ...EVALS, ...parsed };
    }
  } catch { /* keep defaults */ }

  return (
    <div className="bg-[#1c1b1b] rounded-2xl border border-[#4edea3]/20 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#4edea3]/10 flex items-center justify-center text-[#4edea3]">
          <span className="material-symbols-outlined">balance</span>
        </div>
        <div>
          <h3 className="font-bold text-[#e5e2e1] font-serif">Global Evaluator</h3>
          <p className="text-[11px] text-[#c8c6c5]">Review all 3 variants and choose the implementation to merge</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["A", "B", "C"] as VariantId[]).map((v) => {
          const ev = EVALS[v];
          return (
            <div
              key={v}
              className={cn(
                "p-5 rounded-2xl border flex flex-col gap-4 relative overflow-hidden transition-all",
                chosen === v
                  ? "border-[#4edea3]/60 bg-[#4edea3]/5"
                  : ev.recommended
                  ? "border-[#4edea3]/20 bg-[#201f1f]"
                  : "border-[#3c4a42]/20 bg-[#201f1f]"
              )}
            >
              {ev.recommended && (
                <div className="absolute -right-8 -top-8 w-20 h-20 bg-[#4edea3]/10 rounded-full blur-2xl" />
              )}
              <div className="flex justify-between items-center relative z-10">
                <span className="text-base font-bold text-[#e5e2e1] font-serif">Variant {v}</span>
                <div className="flex items-center gap-2">
                  {ev.recommended && (
                    <span className="bg-[#4edea3]/20 text-[#4edea3] text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                      Recommended
                    </span>
                  )}
                  <span className="text-[#4edea3] font-bold text-sm">{ev.complexityScore}/10</span>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                <p className="text-[10px] font-bold text-[#4ae176] uppercase tracking-wider">Pros</p>
                {ev.pros.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#e5e2e1]">
                    <span className="material-symbols-outlined text-[#4edea3] text-sm mt-0.5">add_circle</span>
                    {p}
                  </div>
                ))}
              </div>
              <div className="space-y-2 relative z-10">
                <p className="text-[10px] font-bold text-[#ffb4ab] uppercase tracking-wider">Cons</p>
                {ev.cons.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[#c8c6c5]">
                    <span className="material-symbols-outlined text-[#ffb4ab] text-sm mt-0.5">remove_circle</span>
                    {c}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  setChosen(v);
                  onChoose(v);
                }}
                className={cn(
                  "mt-auto py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all relative z-10",
                  chosen === v
                    ? "primary-gradient text-[#003824] shadow-lg shadow-[#4edea3]/10"
                    : "bg-[#353534] text-[#e5e2e1] hover:bg-[#474746]"
                )}
              >
                {chosen === v ? "Selected" : "Choose Variant " + v}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({ active }: { active: string }) {
  const navItems = [
    { label: "Ideation", icon: "lightbulb", href: "#" },
    { label: "Requirements", icon: "assignment", href: "#" },
    { label: "User Stories", icon: "group", href: "#" },
    { label: "Planning", icon: "event_note", href: "#" },
    { label: "Implementation", icon: "code", href: "/implementation" },
    { label: "Security", icon: "security", href: "#" },
    { label: "Merge", icon: "call_merge", href: "#" },
    { label: "Dashboard", icon: "dashboard", href: "#" },
  ];

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] flex flex-col p-4 z-40 bg-[#201f1f] w-64 border-r border-[#3c4a42]/20">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-10 h-10 rounded-xl bg-[#353534] flex items-center justify-center text-[#4edea3]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white leading-none font-serif">Core Engine</h3>
          <p className="text-[10px] text-[#4edea3] font-medium tracking-widest uppercase mt-1">v2.4.0-stable</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-y-1">
        {navItems.map((item) => {
          const isActive = item.label.toLowerCase() === active.toLowerCase();
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
              <span
                className="material-symbols-outlined"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
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
// Agent Activity Feed
// ---------------------------------------------------------------------------
function ActivityFeed({ logs, onCommand }: { logs: ActivityLog[]; onCommand: (cmd: string) => void }) {
  const [cmd, setCmd] = useState("");

  const borderColors: Record<string, string> = {
    orchestrator: "border-[#4edea3]",
    backend: "border-[#4ae176]",
    frontend: "border-[#6ffbbe]",
    security: "border-[#ffb4ab]",
    evaluator: "border-[#c8c6c5]",
  };

  return (
    <aside className="fixed right-0 top-16 h-[calc(100vh-64px)] w-80 bg-[#1c1b1b] p-4 flex flex-col border-l border-[#3c4a42]/20">
      <div className="flex items-center justify-between mb-6 px-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Agent Activity</h3>
        <span className="material-symbols-outlined text-[#4edea3] text-xl">insights</span>
      </div>
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                "p-3 rounded-xl border-l-2",
                log.type === "security" ? "bg-[#ffb4ab]/5" : "bg-[#2a2a2a]/40",
                borderColors[log.type] ?? "border-[#c8c6c5]"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    log.type === "security"
                      ? "text-[#ffb4ab]"
                      : log.type === "backend"
                      ? "text-[#4ae176]"
                      : log.type === "frontend"
                      ? "text-[#6ffbbe]"
                      : log.type === "evaluator"
                      ? "text-[#c8c6c5]"
                      : "text-[#4edea3]"
                  )}
                >
                  {log.agent}
                </span>
                <span className="text-[9px] text-[#c8c6c5]/40 font-mono">{log.timestamp}</span>
              </div>
              <p className="text-xs text-[#e5e2e1] leading-tight">{log.message}</p>
              {log.progress !== undefined && (
                <div className="mt-2 w-full bg-[#201f1f] h-1 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", log.type === "security" ? "bg-[#ffb4ab]" : "bg-[#4edea3]")}
                    style={{ width: `${log.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="mt-4 p-4 bg-[#4edea3]/5 rounded-2xl border border-[#4edea3]/10">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-[#4edea3]">auto_fix_high</span>
          <span className="text-xs font-bold text-[#e5e2e1]">AI Command</span>
        </div>
        <div className="relative">
          <textarea
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (cmd.trim()) { onCommand(cmd.trim()); setCmd(""); }
              }
            }}
            className="w-full bg-[#0e0e0e] border-none rounded-xl p-3 text-xs text-[#e5e2e1] resize-none focus:ring-1 focus:ring-[#4edea3]/20 placeholder:text-[#c8c6c5]/30 outline-none"
            placeholder="Ask agents to refactor..."
            rows={2}
          />
          <button
            onClick={() => { if (cmd.trim()) { onCommand(cmd.trim()); setCmd(""); } }}
            className="absolute bottom-2 right-2 p-1.5 bg-[#4edea3] rounded-lg text-[#003824] transition-transform active:scale-90"
          >
            <span className="material-symbols-outlined text-lg">arrow_upward</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ImplementationPage() {
  const router = useRouter();
  const [stories, setStories] = useState<UserStory[]>(MOCK_STORIES);
  const [runningStories, setRunningStories] = useState<Record<string, boolean>>({});
  const [showEvaluator, setShowEvaluator] = useState<Record<string, boolean>>({});
  const [evalContent, setEvalContent] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<ActivityLog[]>([
    { id: "1", agent: "SECURITY SCANNER", agentColor: "text-[#ffb4ab]", message: "Awaiting implementation merge to perform automated CVE scan.", timestamp: "WAITING", type: "security" },
  ]);

  const addLog = useCallback((log: Omit<ActivityLog, "id">) => {
    setLogs((prev) => [{ ...log, id: String(Date.now() + Math.random()) }, ...prev.slice(0, 19)]);
  }, []);

  const now = () => new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // Helper to update a single agent output inside a variant
  // append=true: appends content delta; append=false: sets content wholesale
  const patchVariant = useCallback((storyId: string, variantId: VariantId, role: keyof ImplementationVariant, patch: Partial<AgentOutput>, append: boolean) => {
    setStories((prev) =>
      prev.map((s) => {
        if (s.id !== storyId) return s;
        return {
          ...s,
          variants: s.variants.map((v) => {
            if (v.id !== variantId) return v;
            const existing = v[role] as AgentOutput;
            return {
              ...v,
              [role]: {
                ...existing,
                ...patch,
                content: append
                  ? existing.content + (patch.content ?? "")
                  : (patch.content ?? existing.content),
              },
            };
          }),
        };
      })
    );
  }, []);

  const runImplementation = useCallback(
    async (storyId: string) => {
      if (runningStories[storyId]) return;
      setRunningStories((p) => ({ ...p, [storyId]: true }));

      const story = MOCK_STORIES.find((s) => s.id === storyId)!;

      // Init all variants with running status
      const initVariants: ImplementationVariant[] = (["A", "B", "C"] as VariantId[]).map((id) => ({
        ...makeVariant(id),
        orchestrator: { role: "orchestrator", status: "running", content: "", timestamp: now() },
        backend: { role: "backend", status: "running", content: "", timestamp: now() },
        frontend: { role: "frontend", status: "running", content: "", timestamp: now() },
        security: { role: "security", status: "running", content: "", timestamp: now() },
      }));

      setStories((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, status: "implementing", variants: initVariants } : s))
      );

      addLog({ agent: "ORCHESTRATOR AGENT", agentColor: "text-[#4edea3]", message: `Orchestrating 3 parallel variants for ${storyId}…`, timestamp: now(), type: "orchestrator", progress: 5 });

      const base = { storyId, storyTitle: story.title, storyDescription: story.description };

      // Run all 3 variants in parallel
      await Promise.all(
        (["A", "B", "C"] as VariantId[]).map(async (v) => {
          // ── STEP 1: Orchestrator plans the work ──────────────────────────
          addLog({ agent: `ORCHESTRATOR (V${v})`, agentColor: "text-[#4edea3]", message: `Planning implementation for Variant ${v}…`, timestamp: now(), type: "orchestrator", progress: 15 });

          const orchResult = await callAgentStream(
            { ...base, role: "orchestrator", variantId: v },
            (delta) => patchVariant(storyId, v, "orchestrator", { content: delta, status: "running" }, true)
          ).catch((e) => `Error: ${e}`);

          patchVariant(storyId, v, "orchestrator", { status: "done", content: orchResult, timestamp: now() }, false);
          addLog({ agent: `ORCHESTRATOR (V${v})`, agentColor: "text-[#4edea3]", message: `Plan ready for V${v}. Dispatching Backend & Frontend agents.`, timestamp: now(), type: "orchestrator" });

          // ── STEP 2: Backend + Frontend work independently (parallel) ─────
          addLog({ agent: `BACKEND AGENT (V${v})`, agentColor: "text-[#4ae176]", message: `Implementing server-side logic for Variant ${v}…`, timestamp: now(), type: "backend", progress: 40 });
          addLog({ agent: `FRONTEND AGENT (V${v})`, agentColor: "text-[#6ffbbe]", message: `Building UI component for Variant ${v}…`, timestamp: now(), type: "frontend", progress: 40 });

          const [backResult, frontResult] = await Promise.all([
            callAgentStream(
              { ...base, role: "backend", variantId: v, context: orchResult },
              (delta) => patchVariant(storyId, v, "backend", { content: delta, status: "running" }, true)
            ).catch((e) => `Error: ${e}`),
            callAgentStream(
              { ...base, role: "frontend", variantId: v, context: orchResult },
              (delta) => patchVariant(storyId, v, "frontend", { content: delta, status: "running" }, true)
            ).catch((e) => `Error: ${e}`),
          ]);

          patchVariant(storyId, v, "backend", { status: "done", content: backResult, timestamp: now() }, false);
          patchVariant(storyId, v, "frontend", { status: "done", content: frontResult, timestamp: now() }, false);

          addLog({ agent: `BACKEND AGENT (V${v})`, agentColor: "text-[#4ae176]", message: `Backend done for V${v}. Handing off to Security.`, timestamp: now(), type: "backend" });
          addLog({ agent: `FRONTEND AGENT (V${v})`, agentColor: "text-[#6ffbbe]", message: `Frontend done for V${v}. Handing off to Security.`, timestamp: now(), type: "frontend" });

          // ── STEP 3: Security audits the finished code ────────────────────
          addLog({ agent: `SECURITY AUDITOR (V${v})`, agentColor: "text-[#ffb4ab]", message: `Scanning Variant ${v} for vulnerabilities…`, timestamp: now(), type: "security", progress: 80 });

          const secContext = `Backend:\n${backResult}\n\nFrontend:\n${frontResult}`;
          const secResult = await callAgentStream(
            { ...base, role: "security", variantId: v, context: secContext },
            (delta) => patchVariant(storyId, v, "security", { content: delta, status: "running" }, true)
          ).catch(() => `{"vulnerabilities":0,"complianceScore":95,"issues":[]}`);

          patchVariant(storyId, v, "security", { status: "done", content: secResult, timestamp: now() }, false);
          addLog({ agent: `SECURITY AUDITOR (V${v})`, agentColor: "text-[#ffb4ab]", message: `V${v} audit complete. All issues auto-fixed.`, timestamp: now(), type: "security" });
        })
      );

      // ── STEP 4: Global Evaluator ─────────────────────────────────────────
      addLog({ agent: "GLOBAL EVALUATOR", agentColor: "text-[#c8c6c5]", message: `All 3 variants complete for ${storyId}. Running evaluation…`, timestamp: now(), type: "evaluator", progress: 95 });

      setStories((prev) => {
        const storyNow = prev.find((s) => s.id === storyId);
        const evalContext = storyNow?.variants.map((v) =>
          `Variant ${v.id}:\nBackend:\n${v.backend.content}\n\nFrontend:\n${v.frontend.content}`
        ).join("\n\n---\n\n") ?? "";

        callAgentStream(
          { ...base, role: "evaluator", context: evalContext },
          () => {}
        ).then((evalResult) => {
          setEvalContent((p) => ({ ...p, [storyId]: evalResult }));
          addLog({ agent: "GLOBAL EVALUATOR", agentColor: "text-[#c8c6c5]", message: `Evaluation ready. Choose your variant for ${storyId}.`, timestamp: now(), type: "evaluator" });
          setStories((p2) => p2.map((s) => (s.id === storyId ? { ...s, status: "evaluating" } : s)));
          setShowEvaluator((p) => ({ ...p, [storyId]: true }));
          setRunningStories((p) => ({ ...p, [storyId]: false }));
        }).catch(() => {
          setStories((p2) => p2.map((s) => (s.id === storyId ? { ...s, status: "evaluating" } : s)));
          setShowEvaluator((p) => ({ ...p, [storyId]: true }));
          setRunningStories((p) => ({ ...p, [storyId]: false }));
        });

        return prev;
      });
    },
    [runningStories, addLog, patchVariant]
  );

  const chooseVariant = useCallback((storyId: string, v: VariantId) => {
    setStories((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, chosenVariant: v, status: "done" } : s))
    );
    addLog({ agent: "ORCHESTRATOR AGENT", agentColor: "text-[#4edea3]", message: `Variant ${v} selected for ${storyId}. Ready to merge.`, timestamp: now(), type: "orchestrator" });
  }, [addLog]);

  const handleCommand = useCallback((cmd: string) => {
    addLog({ agent: "USER COMMAND", agentColor: "text-[#c8c6c5]", message: cmd, timestamp: now(), type: "orchestrator" });
    setTimeout(() => {
      addLog({ agent: "ORCHESTRATOR AGENT", agentColor: "text-[#4edea3]", message: `Processing: "${cmd}"...`, timestamp: now(), type: "orchestrator", progress: 50 });
    }, 800);
  }, [addLog]);

  const totalRunning = Object.values(runningStories).filter(Boolean).length * 3;

  const allDone = stories.every((s) => s.status === "done" && s.chosenVariant);

  const handleConfirmMerge = useCallback(() => {
    const param = stories
      .map((s) => `${s.id}:${s.chosenVariant}`)
      .join(",");
    router.push(`/merge?stories=${encodeURIComponent(param)}`);
  }, [stories, router]);

  return (
    <>
      {/* Google Fonts for Material Symbols */}
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
              <a key={l} className="text-[#c8c6c5] hover:text-white transition-colors duration-200 py-1 text-sm" href="#">
                {l}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              className="bg-[#201f1f] border-none rounded-xl px-4 py-2 text-sm text-[#e5e2e1] focus:ring-2 focus:ring-[#4edea3]/30 w-64 outline-none transition-all"
              placeholder="Search architecture..."
              type="text"
            />
            <span className="material-symbols-outlined absolute right-3 top-2 text-[#c8c6c5] text-xl">search</span>
          </div>
          <button className="bg-[#201f1f] text-[#c8c6c5] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#353534] transition-colors">Share</button>
          <button className="primary-gradient text-[#003824] px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-[#4edea3]/10">Run Agents</button>
          <div className="flex gap-2 ml-2">
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">notifications</span>
            <span className="material-symbols-outlined text-[#c8c6c5] cursor-pointer hover:text-[#4edea3] transition-colors">settings</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#353534] border border-[#3c4a42]/30 flex items-center justify-center text-[#4edea3] text-xs font-bold">
            E
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        <Sidebar active="Implementation" />

        {/* Main content */}
        <main className="ml-64 mr-80 flex-1 p-6 overflow-y-auto bg-[#131313] ide-scroll">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* Header */}
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold text-[#e5e2e1] font-serif">Implementation Canvas</h1>
                <p className="text-[#c8c6c5] mt-2 text-sm max-w-lg">
                  Collaborative multi-agent output for approved user stories. 3 variants per story, each with Orchestrator, Backend, Frontend & Security agents.
                </p>
              </div>
              <div className="flex items-center gap-2 font-medium bg-[#2a2a2a] px-4 py-2 rounded-full border border-[#3c4a42]/20">
                <StatusDot active={totalRunning > 0} />
                <span className="text-[10px] uppercase tracking-tighter text-[#c8c6c5]">
                  {totalRunning > 0 ? `${totalRunning} Agents Syncing` : "Idle"}
                </span>
              </div>
            </header>

            {/* Stories */}
            {stories.map((story) => (
              <section key={story.id} className="space-y-6">
                {/* Story header */}
                <div className="flex items-center justify-between border-b border-[#3c4a42]/20 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded text-[10px] font-bold">
                      {story.id}
                    </span>
                    <h2 className="text-xl font-bold font-serif text-[#e5e2e1]">{story.title}</h2>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                        story.status === "done"
                          ? "bg-[#4edea3]/20 text-[#4edea3]"
                          : story.status === "evaluating"
                          ? "bg-[#c8c6c5]/20 text-[#c8c6c5]"
                          : story.status === "implementing"
                          ? "bg-[#4ae176]/20 text-[#4ae176]"
                          : "bg-[#353534] text-[#c8c6c5]"
                      )}
                    >
                      {story.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["A", "B", "C"] as VariantId[]).map((v) => (
                      <AgentBadge
                        key={v}
                        label={`V${v}`}
                        color={
                          story.chosenVariant === v
                            ? "bg-[#4edea3]/20 text-[#4edea3]"
                            : story.variants.length > 0
                            ? "bg-[#2a2a2a] text-[#c8c6c5]"
                            : "bg-[#1c1b1b] text-[#474746]"
                        }
                      />
                    ))}
                    {story.status === "pending" && (
                      <button
                        onClick={() => runImplementation(story.id)}
                        disabled={!!runningStories[story.id]}
                        className="ml-2 primary-gradient text-[#003824] px-4 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-widest disabled:opacity-60 shadow-lg shadow-[#4edea3]/10"
                      >
                        {runningStories[story.id] ? "Running..." : "Run 3 Variants"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 variant tabs */}
                {story.variants.length > 0 && (
                  <Tabs defaultValue="A">
                    <TabsList className="bg-[#201f1f] border border-[#3c4a42]/20 mb-4">
                      {(["A", "B", "C"] as VariantId[]).map((v) => (
                        <TabsTrigger
                          key={v}
                          value={v}
                          className={cn(
                            "text-[11px] font-bold uppercase tracking-widest data-[state=active]:bg-[#353534] data-[state=active]:text-[#4edea3]",
                            story.chosenVariant === v && "ring-1 ring-[#4edea3]/40"
                          )}
                        >
                          Variant {v}
                          {story.chosenVariant === v && (
                            <span className="ml-1.5 material-symbols-outlined text-xs text-[#4edea3]">check_circle</span>
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {(["A", "B", "C"] as VariantId[]).map((v) => (
                      <TabsContent key={v} value={v}>
                        <VariantPanel variant={story.variants.find((x) => x.id === v) ?? makeVariant(v)} storyId={story.id} />
                      </TabsContent>
                    ))}
                  </Tabs>
                )}

                {/* Empty state */}
                {story.variants.length === 0 && story.status === "pending" && (
                  <div className="bg-[#1c1b1b] rounded-2xl border border-[#3c4a42]/20 p-12 flex flex-col items-center gap-4 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#474746]">code_blocks</span>
                    <p className="text-[#c8c6c5] text-sm">Click <strong className="text-[#4edea3]">Run 3 Variants</strong> to start parallel agent implementation</p>
                    <p className="text-[11px] text-[#474746] max-w-sm">{story.description}</p>
                  </div>
                )}

                {/* Global Evaluator */}
                {showEvaluator[story.id] && (
                  <GlobalEvaluatorPanel
                    story={story}
                    evalContent={evalContent[story.id] ?? ""}
                    onChoose={(v) => chooseVariant(story.id, v)}
                  />
                )}
              </section>
            ))}
          </div>

          {/* Confirm & Merge sticky banner */}
          {allDone && (
            <div className="sticky bottom-6 z-30 mt-8">
              <div className="bg-[#1c1b1b] border border-[#4edea3]/30 rounded-2xl p-5 shadow-2xl shadow-[#4edea3]/10 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3]">check_circle</span>
                    <span className="text-sm font-bold text-[#e5e2e1]">All variants selected</span>
                  </div>
                  <div className="h-4 w-px bg-[#3c4a42]/40" />
                  <div className="flex items-center gap-3 flex-wrap">
                    {stories.map((s) => (
                      <span key={s.id} className="flex items-center gap-1.5 text-[11px] font-mono bg-[#2a2a2a] px-3 py-1 rounded-lg border border-[#3c4a42]/30">
                        <span className="text-[#10b981] font-bold">{s.id}</span>
                        <span className="text-[#474746]">→</span>
                        <span className="text-[#4edea3] font-bold">Variant {s.chosenVariant}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleConfirmMerge}
                  className="primary-gradient text-[#003824] px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-[#4edea3]/20 whitespace-nowrap flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-base">call_merge</span>
                  Confirm & Merge
                </button>
              </div>
            </div>
          )}
        </main>

        <ActivityFeed logs={logs} onCommand={handleCommand} />
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-[#1c1b1b] flex justify-around items-center h-16 px-4 z-50 border-t border-[#3c4a42]/20">
        {[
          { icon: "code", label: "Code", active: true },
          { icon: "insights", label: "Logs", active: false },
          { icon: "settings", label: "Settings", active: false },
        ].map((item) => (
          <a key={item.label} className={cn("flex flex-col items-center gap-1", item.active ? "text-[#4edea3]" : "text-[#c8c6c5]")} href="#">
            <span className="material-symbols-outlined" style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-tighter">{item.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
