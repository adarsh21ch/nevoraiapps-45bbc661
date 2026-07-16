/**
 * Built-in agent definitions.
 *
 * PHASE 11.1: registry only. UIs land in later phases and consume these
 * definitions via `getAgent(...)`. Business logic remains in existing
 * server functions / RPCs; agents only orchestrate.
 */

import type { AgentDef } from "./types";

export const OWNER_AGENT: AgentDef = {
  id: "owner",
  name: "Owner Assistant",
  description: "Day-to-day academy operations: fees, attendance, admissions, comms.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "ownerAssistant",
  allowedTools: [
    "dashboard_summary",
    "finance_summary",
    "attendance_summary",
    "admissions_summary",
    "communications_summary",
    "subscription_status",
    "automation_status",
    "send_fee_reminder",
  ],
  temperature: 0.3,
  memory: { persist: true, maxTurns: 20, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "professional", preferTables: true },
  futureCapabilities: ["daily_brief", "weekly_reports", "smart_notifications"],
};

export const FOUNDER_AGENT: AgentDef = {
  id: "founder",
  name: "Founder Intelligence",
  description: "Platform-wide analytics for platform admins: MRR, churn, tenant health.",
  allowedRoles: ["platform_admin"],
  systemPrompt: "founderIntelligence",
  allowedTools: ["founder_intelligence"],
  temperature: 0.2,
  memory: { persist: true, maxTurns: 20, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "concise", preferTables: true },
  futureCapabilities: ["daily_brief", "growth_signals", "tenant_health_scores"],
};

export const FINANCE_AGENT: AgentDef = {
  id: "finance",
  name: "Finance Agent",
  description: "Billing, collections, reminders.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "ownerAssistant",
  allowedTools: ["finance_summary", "fee_summary", "send_fee_reminder"],
  temperature: 0.2,
  memory: { persist: true, maxTurns: 15, summarize: true },
  confirmation: { requireForWrites: true, alwaysConfirm: ["send_fee_reminder"] },
  responseStyle: { tone: "professional", preferTables: true },
};

export const ADMISSIONS_AGENT: AgentDef = {
  id: "admissions",
  name: "Admissions Agent",
  description: "Admissions pipeline overview and drafting.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "ownerAssistant",
  allowedTools: ["admissions_summary"],
  temperature: 0.3,
  memory: { persist: true, maxTurns: 15, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "professional" },
};

export const ATTENDANCE_AGENT: AgentDef = {
  id: "attendance",
  name: "Attendance Agent",
  description: "Attendance snapshots and trends.",
  allowedRoles: ["owner", "admin", "coach"],
  systemPrompt: "coachAssistant",
  allowedTools: ["attendance_summary"],
  temperature: 0.2,
  memory: { persist: true, maxTurns: 10, summarize: false },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "concise", preferTables: true },
};

export const COMMUNICATIONS_AGENT: AgentDef = {
  id: "communications",
  name: "Communications Agent",
  description: "Broadcasts and campaign drafting.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "ownerAssistant",
  allowedTools: ["communications_summary"],
  temperature: 0.5,
  memory: { persist: true, maxTurns: 20, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "friendly" },
};

export const MARKETING_AGENT: AgentDef = {
  id: "marketing",
  name: "Marketing Agent",
  description: "Site copy, campaigns, growth suggestions.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "ownerAssistant",
  allowedTools: [],
  temperature: 0.7,
  memory: { persist: true, maxTurns: 20, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "friendly" },
  futureCapabilities: ["crm_ai", "campaign_generator"],
};

export const COACH_AGENT: AgentDef = {
  id: "coach",
  name: "Coach Assistant",
  description: "Assigned batches — attendance, player development.",
  allowedRoles: ["coach"],
  systemPrompt: "coachAssistant",
  allowedTools: ["attendance_summary", "player_profile"],
  temperature: 0.3,
  memory: { persist: true, maxTurns: 15, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "friendly" },
};

export const PARENT_AGENT: AgentDef = {
  id: "parent",
  name: "Parent Assistant",
  description: "Answers about the parent's own child only.",
  allowedRoles: ["parent"],
  systemPrompt: "parentSummary",
  allowedTools: ["player_profile", "fee_summary"],
  temperature: 0.4,
  memory: { persist: true, maxTurns: 10, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "friendly" },
};

export const PLAYER_AGENT: AgentDef = {
  id: "player",
  name: "Player Assistant",
  description: "The signed-in player's own attendance, schedule, fees.",
  allowedRoles: ["student"],
  systemPrompt: "playerSummary",
  allowedTools: ["player_profile", "fee_summary"],
  temperature: 0.4,
  memory: { persist: true, maxTurns: 10, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "friendly" },
};

export const REPORTS_AGENT: AgentDef = {
  id: "reports",
  name: "Reports Agent",
  description: "Turns questions into report specs and summarises outputs.",
  allowedRoles: ["owner", "admin"],
  systemPrompt: "reports",
  allowedTools: ["dashboard_summary", "finance_summary", "attendance_summary"],
  temperature: 0.2,
  memory: { persist: true, maxTurns: 15, summarize: true },
  confirmation: { requireForWrites: true },
  responseStyle: { tone: "concise", preferTables: true },
};

export const ALL_AGENTS: AgentDef[] = [
  OWNER_AGENT,
  FOUNDER_AGENT,
  FINANCE_AGENT,
  ADMISSIONS_AGENT,
  ATTENDANCE_AGENT,
  COMMUNICATIONS_AGENT,
  MARKETING_AGENT,
  COACH_AGENT,
  PARENT_AGENT,
  PLAYER_AGENT,
  REPORTS_AGENT,
];
