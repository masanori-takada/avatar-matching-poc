/**
 * 手書きの Supabase Database 型定義。
 * supabase/migrations/*.sql と一致させること。
 * Supabase プロジェクトが未作成のため `supabase gen types` では生成できない
 * (docs/06-implementation-plan.md フェーズ1)。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MatchStatusDb =
  | "pending"
  | "conversed"
  | "evaluated"
  | "notified"
  | "mutual"
  | "closed"
  | "failed";

export type InterviewQuestionKind = "choice" | "free";
export type MatchDecisionValue = "accept" | "decline";
export type NotificationKind = "match_found" | "report_ready" | "schedule_confirmed";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          display_label: string;
          anonymous_id_prefix: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_label: string;
          anonymous_id_prefix: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_label?: string;
          anonymous_id_prefix?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      invite_codes: {
        Row: {
          id: string;
          organization_id: string;
          code: string;
          max_uses: number;
          used_count: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          code: string;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          code?: string;
          max_uses?: number;
          used_count?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          anonymous_id: string;
          age_range: string | null;
          interview_completed_at: string | null;
          notifications_enabled: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          anonymous_id?: string;
          age_range?: string | null;
          interview_completed_at?: string | null;
          notifications_enabled?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        // 注意: `authenticated` の実際の UPDATE 権限は列限定
        // (`age_range`, `notifications_enabled` のみ。finding #2)。
        // `interview_completed_at` は complete_interview() RPC 経由でのみ、
        // `organization_id` / `anonymous_id` は変更不可。この型は DB 上の
        // 全カラムの形を表すのみで、実行時の権限は RLS 側の grant が決める。
        Update: {
          id?: string;
          organization_id?: string;
          anonymous_id?: string;
          age_range?: string | null;
          interview_completed_at?: string | null;
          notifications_enabled?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      identities: {
        Row: {
          profile_id: string;
          full_name: string;
          company_name: string;
          department: string | null;
          message: string | null;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          full_name: string;
          company_name: string;
          department?: string | null;
          message?: string | null;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          full_name?: string;
          company_name?: string;
          department?: string | null;
          message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      interview_questions: {
        Row: {
          id: string;
          code: string;
          sort_order: number;
          kind: InterviewQuestionKind;
          text: string;
          options: Json;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          sort_order: number;
          kind: InterviewQuestionKind;
          text: string;
          options?: Json;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          code?: string;
          sort_order?: number;
          kind?: InterviewQuestionKind;
          text?: string;
          options?: Json;
          is_active?: boolean;
        };
        Relationships: [];
      };
      interview_answers: {
        Row: {
          id: string;
          profile_id: string;
          question_id: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          question_id: string;
          answer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          question_id?: string;
          answer?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      personas: {
        Row: {
          profile_id: string;
          summary: string;
          traits: Json;
          speaking_style: string;
          model: string;
          generated_at: string;
        };
        Insert: {
          profile_id: string;
          summary: string;
          traits: Json;
          speaking_style: string;
          model: string;
          generated_at?: string;
        };
        Update: {
          profile_id?: string;
          summary?: string;
          traits?: Json;
          speaking_style?: string;
          model?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          profile_a_id: string;
          profile_b_id: string;
          status: MatchStatusDb;
          overall_score: number | null;
          attempt_count: number;
          last_error: string | null;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_a_id: string;
          profile_b_id: string;
          status?: MatchStatusDb;
          overall_score?: number | null;
          attempt_count?: number;
          last_error?: string | null;
          notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_a_id?: string;
          profile_b_id?: string;
          status?: MatchStatusDb;
          overall_score?: number | null;
          attempt_count?: number;
          last_error?: string | null;
          notified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      avatar_conversations: {
        Row: {
          match_id: string;
          turns: Json;
          time_label: string;
          model: string;
          generated_at: string;
        };
        Insert: {
          match_id: string;
          turns: Json;
          time_label: string;
          model: string;
          generated_at?: string;
        };
        Update: {
          match_id?: string;
          turns?: Json;
          time_label?: string;
          model?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      compatibility_reports: {
        Row: {
          match_id: string;
          overall_score: number;
          axes: Json;
          summary: string;
          model: string;
          generated_at: string;
        };
        Insert: {
          match_id: string;
          overall_score: number;
          axes: Json;
          summary: string;
          model: string;
          generated_at?: string;
        };
        Update: {
          match_id?: string;
          overall_score?: number;
          axes?: Json;
          summary?: string;
          model?: string;
          generated_at?: string;
        };
        Relationships: [];
      };
      match_decisions: {
        Row: {
          id: string;
          match_id: string;
          profile_id: string;
          decision: MatchDecisionValue;
          decided_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          profile_id: string;
          decision: MatchDecisionValue;
          decided_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          profile_id?: string;
          decision?: MatchDecisionValue;
          decided_at?: string;
        };
        Relationships: [];
      };
      meeting_slots: {
        Row: {
          id: string;
          match_id: string;
          starts_at: string;
          ends_at: string;
          place: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          match_id: string;
          starts_at: string;
          ends_at: string;
          place: string;
          sort_order: number;
        };
        Update: {
          id?: string;
          match_id?: string;
          starts_at?: string;
          ends_at?: string;
          place?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      slot_selections: {
        Row: {
          id: string;
          match_id: string;
          profile_id: string;
          slot_id: string;
          selected_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          profile_id: string;
          slot_id: string;
          selected_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          profile_id?: string;
          slot_id?: string;
          selected_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          kind: NotificationKind;
          title: string;
          body: string;
          match_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          kind: NotificationKind;
          title: string;
          body: string;
          match_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          kind?: NotificationKind;
          title?: string;
          body?: string;
          match_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // finding #7: 招待コード検証と実名(identities)登録を1トランザクションに
      // まとめた。profiles だけ作られて identities が欠けるという、ユーザー
      // 自身では修復不能な壊れた状態を防ぐため。
      consume_invite_code: {
        Args: {
          p_code: string;
          p_user_id: string;
          p_full_name: string;
          p_company_name: string;
          p_department?: string | null;
          p_message?: string | null;
        };
        Returns: { organization_id: string }[];
      };
      // finding #2: interview_completed_at は profiles の列限定 UPDATE 権限
      // (age_range, notifications_enabled のみ)からは変更できないため、この
      // RPC 経由でのみ完了処理を行う。全 is_active 設問への回答済みを検証する。
      complete_interview: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      // 開発・展示用リセット(NODE_ENV !== 'production' のみ呼び出し可能な
      // Server Action から使う)。auth.uid() 自身の行のみ操作する。
      reset_interview_dev: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      finalize_match_if_mutual: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      generate_slots: {
        Args: Record<string, never>;
        Returns: { starts_at: string; ends_at: string; place: string; ord: number }[];
      };
      is_match_participant: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      is_mutual_accept: {
        Args: { p_match_id: string };
        Returns: boolean;
      };
      is_revealed_partner: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// -----------------------------------------------------------------------------
// 利便のためのエイリアス
// -----------------------------------------------------------------------------

export type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];
export type InviteCodeRow = Database["public"]["Tables"]["invite_codes"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type IdentityRow = Database["public"]["Tables"]["identities"]["Row"];
export type InterviewQuestionRow = Database["public"]["Tables"]["interview_questions"]["Row"];
export type InterviewAnswerRow = Database["public"]["Tables"]["interview_answers"]["Row"];
export type PersonaRow = Database["public"]["Tables"]["personas"]["Row"];
export type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
export type AvatarConversationRow = Database["public"]["Tables"]["avatar_conversations"]["Row"];
export type CompatibilityReportRow = Database["public"]["Tables"]["compatibility_reports"]["Row"];
export type MatchDecisionRow = Database["public"]["Tables"]["match_decisions"]["Row"];
export type MeetingSlotRow = Database["public"]["Tables"]["meeting_slots"]["Row"];
export type SlotSelectionRow = Database["public"]["Tables"]["slot_selections"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type IdentityInsert = Database["public"]["Tables"]["identities"]["Insert"];
export type InterviewAnswerInsert = Database["public"]["Tables"]["interview_answers"]["Insert"];
export type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"];
export type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
export type AvatarConversationInsert =
  Database["public"]["Tables"]["avatar_conversations"]["Insert"];
export type CompatibilityReportInsert =
  Database["public"]["Tables"]["compatibility_reports"]["Insert"];
export type MatchDecisionInsert = Database["public"]["Tables"]["match_decisions"]["Insert"];
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
export type SlotSelectionInsert = Database["public"]["Tables"]["slot_selections"]["Insert"];
