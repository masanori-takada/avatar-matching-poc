/**
 * アプリケーションのドメイン型。
 * DB の生の行 (types/database.ts) とは分離し、JSONB カラムの中身に型を与える。
 */

import type { MatchStatusDb } from "./database";

// -----------------------------------------------------------------------------
// Server Action の統一戻り値型 (docs/04-api-contract.md)
// -----------------------------------------------------------------------------

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

// -----------------------------------------------------------------------------
// ペルソナ (docs/03-data-model.md §5.1, docs/05-ai-pipeline.md §3)
// -----------------------------------------------------------------------------

export type SocialEnergy = "outgoing" | "reserved" | "balanced";
export type ConversationStyle = "initiator" | "listener" | "adaptive";
export type ComfortPreference = "humor" | "shared_values" | "new_perspectives";
export type FutureOrientation = "concrete" | "vague" | "open";

export interface PersonaTraits {
  social_energy: SocialEnergy;
  conversation_style: ConversationStyle;
  values_keywords: string[];
  comfort_preference: ComfortPreference;
  future_orientation: FutureOrientation;
  must_know: string;
}

export interface Persona {
  profileId: string;
  summary: string;
  traits: PersonaTraits;
  speakingStyle: string;
  model: string;
  generatedAt: string;
}

// -----------------------------------------------------------------------------
// アバター間会話 (docs/03-data-model.md §2.9, §5)
// -----------------------------------------------------------------------------

export type ConversationSpeaker = "a" | "b";

export interface ConversationTurn {
  speaker: ConversationSpeaker;
  text: string;
}

export interface AvatarConversation {
  matchId: string;
  turns: ConversationTurn[];
  timeLabel: string;
  model: string;
  generatedAt: string;
}

// -----------------------------------------------------------------------------
// 相性レポート (docs/03-data-model.md §2.3, §5.2)
// -----------------------------------------------------------------------------

export type AxisKey = "flow" | "values" | "humor" | "interest" | "conflict";

export interface ReportAxis {
  key: AxisKey;
  label: string;
  score: number;
  invertedGood: boolean;
  comment: string;
  quote: string;
}

export interface AxisDefinition {
  key: AxisKey;
  label: string;
  invertedGood: boolean;
  weight: number;
}

export interface CompatibilityReport {
  matchId: string;
  overallScore: number;
  axes: ReportAxis[];
  summary: string;
  model: string;
  generatedAt: string;
}

// -----------------------------------------------------------------------------
// マッチ状態 (docs/02-architecture.md §5.3)
// -----------------------------------------------------------------------------

export type MatchStatus = MatchStatusDb;
export type MatchDecisionValue = "accept" | "decline";

export interface MatchSummary {
  id: string;
  status: MatchStatus;
  overallScore: number | null;
  notifiedAt: string | null;
  createdAt: string;
  partnerLabel: string;
}

// -----------------------------------------------------------------------------
// 通知
// -----------------------------------------------------------------------------

export type NotificationKind = "match_found" | "report_ready" | "schedule_confirmed";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  matchId: string | null;
  readAt: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// インタビュー
// -----------------------------------------------------------------------------

export type InterviewQuestionKind = "choice" | "free";

export interface InterviewQuestion {
  id: string;
  code: string;
  sortOrder: number;
  kind: InterviewQuestionKind;
  text: string;
  options: string[];
  isActive: boolean;
}

export interface InterviewAnswerItem {
  questionId: string;
  questionText: string;
  kind: InterviewQuestionKind;
  answer: string;
}

// -----------------------------------------------------------------------------
// 面談日程
// -----------------------------------------------------------------------------

export interface MeetingSlot {
  id: string;
  matchId: string;
  startsAt: string;
  endsAt: string;
  place: string;
  sortOrder: number;
}

export interface SlotSelection {
  id: string;
  matchId: string;
  profileId: string;
  slotId: string;
  selectedAt: string;
}

// -----------------------------------------------------------------------------
// プロフィール / 実名開示
// -----------------------------------------------------------------------------

export interface Profile {
  id: string;
  organizationId: string;
  anonymousId: string;
  ageRange: string | null;
  interviewCompletedAt: string | null;
  notificationsEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface RevealedIdentity {
  fullName: string;
  companyName: string;
  department: string | null;
  message: string | null;
  ageRange: string | null;
}
