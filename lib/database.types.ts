// Auto-generated types matching supabase/schema.sql

export type ProjectStatus =
  | 'ideation'
  | 'requirements'
  | 'stories'
  | 'implementation'
  | 'security'
  | 'merge'
  | 'done'

export type MessageStage =
  | 'ideation'
  | 'requirements'
  | 'stories'
  | 'implementation'
  | 'security'
  | 'merge'

export type RequirementType   = 'functional' | 'non-functional'
export type RequirementStatus = 'draft' | 'approved'
export type FeatureStatus     = 'draft' | 'approved'
export type StoryStatus       = 'draft' | 'approved' | 'in_progress' | 'done'
export type Complexity        = 'S' | 'M' | 'L' | 'XL'
export type ImplStatus        = 'draft' | 'selected' | 'rejected'
export type Severity          = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus       = 'open' | 'resolved'

// ── Row types ────────────────────────────────────────────────

export interface Project {
  id:           string
  user_id:      string
  title:        string
  objective:    string | null
  audience:     string[]
  scope:        string[]
  deliverables: string[]
  risks:        string[]
  tech_stack:   string[]
  architecture: string | null
  db_schema:    string | null
  status:       ProjectStatus
  created_at:   string
  updated_at:   string
}

export interface Message {
  id:         string
  project_id: string
  stage:      MessageStage
  author:     string
  role:       'human' | 'ai'
  content:    string
  created_at: string
}

export interface Requirement {
  id:          string
  project_id:  string
  ref_id:      string | null
  title:       string
  description: string | null
  type:        RequirementType
  status:      RequirementStatus
  created_at:  string
  updated_at:  string
}

export interface Feature {
  id:                  string
  project_id:          string
  requirement_id:      string | null
  title:               string
  summary:             string | null
  acceptance_criteria: string[]
  status:              FeatureStatus
  created_at:          string
}

export interface UserStory {
  id:                  string
  project_id:          string
  feature_id:          string | null
  as_a:                string
  i_want:              string
  so_that:             string | null
  acceptance_criteria: string[]
  complexity:          Complexity
  status:              StoryStatus
  created_at:          string
  updated_at:          string
}

export interface Implementation {
  id:             string
  story_id:       string
  variant_number: 1 | 2 | 3
  title:          string
  code:           string | null
  architecture:   string | null
  tradeoffs_pro:  string[]
  tradeoffs_con:  string[]
  status:         ImplStatus
  created_at:     string
}

export interface SecurityIssue {
  id:          string
  project_id:  string
  story_id:    string | null
  title:       string
  description: string | null
  severity:    Severity
  owasp:       string | null
  status:      IssueStatus
  created_at:  string
}

export interface Activity {
  id:         string
  project_id: string
  agent:      string
  action:     string
  detail:     string | null
  created_at: string
}

export interface WorkspaceFile {
  id:         string
  project_id: string
  name:       string
  content:    string | null
  created_at: string
  updated_at: string
}

// ── Insert types (omit server-generated fields) ───────────────

export type InsertProject = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>
export type InsertMessage = Omit<Message, 'id' | 'created_at'>
export type InsertRequirement = Omit<Requirement, 'id' | 'created_at' | 'updated_at'>
export type InsertFeature = Omit<Feature, 'id' | 'created_at'>
export type InsertUserStory = Omit<UserStory, 'id' | 'created_at' | 'updated_at'>
export type InsertImplementation = Omit<Implementation, 'id' | 'created_at'>
export type InsertSecurityIssue = Omit<SecurityIssue, 'id' | 'created_at'>
export type InsertActivity = Omit<Activity, 'id' | 'created_at'>
export type InsertWorkspaceFile = Omit<WorkspaceFile, 'id' | 'created_at' | 'updated_at'>
