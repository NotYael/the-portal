// Generated from the Supabase project "the-portal" — do not edit by hand.
// Regenerate after each migration (Supabase MCP generate_typescript_types or
// `supabase gen types typescript --project-id dpbioilargqxniuhdvfw`).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          candidates: number
          error: string | null
          fetched: number
          id: string
          matched: number
          ran_at: string
          status: string
          triggered_by: string
          user_id: string
        }
        Insert: {
          candidates?: number
          error?: string | null
          fetched?: number
          id?: string
          matched?: number
          ran_at?: string
          status: string
          triggered_by?: string
          user_id: string
        }
        Update: {
          candidates?: number
          error?: string | null
          fetched?: number
          id?: string
          matched?: number
          ran_at?: string
          status?: string
          triggered_by?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insight_cache: {
        Row: {
          data_hash: string
          generated_at: string
          insights: Json
          month: string
          user_id: string
        }
        Insert: {
          data_hash: string
          generated_at?: string
          insights: Json
          month: string
          user_id: string
        }
        Update: {
          data_hash?: string
          generated_at?: string
          insights?: Json
          month?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_history: {
        Row: {
          category_budgets: Json
          created_at: string
          effective_month: string
          monthly_budget: number
          user_id: string
        }
        Insert: {
          category_budgets?: Json
          created_at?: string
          effective_month: string
          monthly_budget: number
          user_id?: string
        }
        Update: {
          category_budgets?: Json
          created_at?: string
          effective_month?: string
          monthly_budget?: number
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          is_fixed: boolean
          label: string
          monthly_budget: number | null
          slug: string
          sort_order: number
          user_id: string
        }
        Insert: {
          archived?: boolean
          color: string
          created_at?: string
          id?: string
          is_fixed?: boolean
          label: string
          monthly_budget?: number | null
          slug: string
          sort_order?: number
          user_id?: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          is_fixed?: boolean
          label?: string
          monthly_budget?: number | null
          slug?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      digest_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          is_test: boolean
          resend_id: string | null
          sent_at: string | null
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          resend_id?: string | null
          sent_at?: string | null
          status: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      expense_settings: {
        Row: {
          ai_insights_enabled: boolean
          alert_threshold_pct: number
          cycle_start_day: number
          default_payment_method: string
          include_in_digest: boolean
          monthly_budget: number
          rollover_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_insights_enabled?: boolean
          alert_threshold_pct?: number
          cycle_start_day?: number
          default_payment_method?: string
          include_in_digest?: boolean
          monthly_budget?: number
          rollover_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          ai_insights_enabled?: boolean
          alert_threshold_pct?: number
          cycle_start_day?: number
          default_payment_method?: string
          include_in_digest?: boolean
          monthly_budget?: number
          rollover_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          description: string
          id: string
          payment_method: string
          source: string
          spent_on: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          description: string
          id?: string
          payment_method: string
          source?: string
          spent_on?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          description?: string
          id?: string
          payment_method?: string
          source?: string
          spent_on?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_milestones: {
        Row: {
          goal_id: string
          id: string
          label: string
          quarter: number
          state: string
          user_id: string
        }
        Insert: {
          goal_id: string
          id?: string
          label?: string
          quarter: number
          state?: string
          user_id?: string
        }
        Update: {
          goal_id?: string
          id?: string
          label?: string
          quarter?: number
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_subgoals: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          goal_id: string
          id: string
          sort_order: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          goal_id: string
          id?: string
          sort_order?: number
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          goal_id?: string
          id?: string
          sort_order?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_subgoals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          area: string
          created_at: string
          id: string
          next_step: string
          progress_pct: number
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          next_step?: string
          progress_pct?: number
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id?: string
          year: number
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          next_step?: string
          progress_pct?: number
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          company: string
          found_at: string
          hq: string | null
          id: string
          job_type: string | null
          location: string
          match_pct: number
          posted_at: string | null
          reason: string
          salary: string | null
          source: string
          source_id: string
          status: string
          status_changed_at: string | null
          title: string
          url: string
          user_id: string
          work_mode: string | null
        }
        Insert: {
          company?: string
          found_at?: string
          hq?: string | null
          id?: string
          job_type?: string | null
          location?: string
          match_pct: number
          posted_at?: string | null
          reason?: string
          salary?: string | null
          source: string
          source_id: string
          status?: string
          status_changed_at?: string | null
          title: string
          url: string
          user_id: string
          work_mode?: string | null
        }
        Update: {
          company?: string
          found_at?: string
          hq?: string | null
          id?: string
          job_type?: string | null
          location?: string
          match_pct?: number
          posted_at?: string | null
          reason?: string
          salary?: string | null
          source?: string
          source_id?: string
          status?: string
          status_changed_at?: string | null
          title?: string
          url?: string
          user_id?: string
          work_mode?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string
          created_at: string
          entry_date: string
          goal_id: string | null
          id: string
          prompt: string
          tag: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          entry_date?: string
          goal_id?: string | null
          id?: string
          prompt?: string
          tag?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          entry_date?: string
          goal_id?: string | null
          id?: string
          prompt?: string
          tag?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          journal_ai_summary_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          journal_ai_summary_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          journal_ai_summary_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          done_at: string | null
          due_on: string
          id: string
          notes: string
          repeat_every: number | null
          repeat_unit: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          due_on: string
          id?: string
          notes?: string
          repeat_every?: number | null
          repeat_unit?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          due_on?: string
          id?: string
          notes?: string
          repeat_every?: number | null
          repeat_unit?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_expense_settings: {
        Args: {
          p_ai_insights_enabled: boolean
          p_alert_threshold_pct: number
          p_category_budgets: Json
          p_cycle_start_day: number
          p_default_payment_method: string
          p_include_in_digest: boolean
          p_monthly_budget: number
          p_rollover_enabled: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
