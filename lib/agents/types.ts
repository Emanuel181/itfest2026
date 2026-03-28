export type AgentRole = "orchestrator" | "backend" | "frontend" | "security";
export type AgentStatus = "idle" | "running" | "done" | "error";
export type VariantId = "A" | "B" | "C";
export type TabId = "orchestrator" | "backend" | "frontend" | "security";
export type StoryStatus = "pending" | "implementing" | "evaluating" | "done";

export interface SecurityIssue {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  fix: string;
  fixed?: boolean;
}

export interface SecurityReport {
  vulnerabilities: number;
  complianceScore: number;
  issues: SecurityIssue[];
}

export interface AgentOutput {
  role: AgentRole;
  status: AgentStatus;
  content: string;
  timestamp: string;
}

export interface ImplementationVariant {
  id: VariantId;
  orchestrator: AgentOutput;
  backend: AgentOutput;
  frontend: AgentOutput;
  security: AgentOutput;
  securityReport?: SecurityReport;
  accepted?: boolean;
}

export interface UserStory {
  id: string;
  reqId: string;
  title: string;
  description: string;
  status: StoryStatus;
  variants: ImplementationVariant[];
  chosenVariant?: VariantId;
  // Jira-style metadata
  priority?: "critical" | "high" | "medium" | "low";
  type?: "feature" | "bug" | "tech-debt" | "spike";
  assignee?: string;
  sprint?: string;
  storyPoints?: number;
  labels?: string[];
  acceptanceCriteria?: string[];
  notes?: string;   // human briefing notes sent to the orchestrator
}

export interface ActivityLog {
  id: string;
  agent: string;
  agentColor: string;
  message: string;
  timestamp: string;
  progress?: number;
  type: "orchestrator" | "backend" | "frontend" | "security" | "evaluator";
}
