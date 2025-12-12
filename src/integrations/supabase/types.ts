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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      etfs: {
        Row: {
          aum: number | null
          canary_health: string | null
          created_at: string | null
          death_clock_years: number | null
          dividends_last_12mo: number | null
          dividends_since_inception: number | null
          dividends_ytd: number | null
          expense_ratio: number | null
          headline_yield_ttm: number | null
          id: string
          inception_date: string | null
          latest_adj_close: number | null
          latest_date: string | null
          name: string | null
          price_1y_ago: number | null
          price_at_inception: number | null
          price_ytd_start: number | null
          roc_date: string | null
          roc_latest: number | null
          spent_dividends_return_1y: number | null
          spent_dividends_return_inception: number | null
          spent_dividends_return_ytd: number | null
          take_home_cash_return_1y: number | null
          take_home_cash_return_inception: number | null
          take_home_cash_return_ytd: number | null
          take_home_return_1y: number | null
          take_home_return_inception: number | null
          take_home_return_ytd: number | null
          ticker: string
          total_return_1y: number | null
          total_return_inception: number | null
          total_return_ytd: number | null
          true_income_yield: number | null
          updated_at: string | null
        }
        Insert: {
          aum?: number | null
          canary_health?: string | null
          created_at?: string | null
          death_clock_years?: number | null
          dividends_last_12mo?: number | null
          dividends_since_inception?: number | null
          dividends_ytd?: number | null
          expense_ratio?: number | null
          headline_yield_ttm?: number | null
          id?: string
          inception_date?: string | null
          latest_adj_close?: number | null
          latest_date?: string | null
          name?: string | null
          price_1y_ago?: number | null
          price_at_inception?: number | null
          price_ytd_start?: number | null
          roc_date?: string | null
          roc_latest?: number | null
          spent_dividends_return_1y?: number | null
          spent_dividends_return_inception?: number | null
          spent_dividends_return_ytd?: number | null
          take_home_cash_return_1y?: number | null
          take_home_cash_return_inception?: number | null
          take_home_cash_return_ytd?: number | null
          take_home_return_1y?: number | null
          take_home_return_inception?: number | null
          take_home_return_ytd?: number | null
          ticker: string
          total_return_1y?: number | null
          total_return_inception?: number | null
          total_return_ytd?: number | null
          true_income_yield?: number | null
          updated_at?: string | null
        }
        Update: {
          aum?: number | null
          canary_health?: string | null
          created_at?: string | null
          death_clock_years?: number | null
          dividends_last_12mo?: number | null
          dividends_since_inception?: number | null
          dividends_ytd?: number | null
          expense_ratio?: number | null
          headline_yield_ttm?: number | null
          id?: string
          inception_date?: string | null
          latest_adj_close?: number | null
          latest_date?: string | null
          name?: string | null
          price_1y_ago?: number | null
          price_at_inception?: number | null
          price_ytd_start?: number | null
          roc_date?: string | null
          roc_latest?: number | null
          spent_dividends_return_1y?: number | null
          spent_dividends_return_inception?: number | null
          spent_dividends_return_ytd?: number | null
          take_home_cash_return_1y?: number | null
          take_home_cash_return_inception?: number | null
          take_home_cash_return_ytd?: number | null
          take_home_return_1y?: number | null
          take_home_return_inception?: number | null
          take_home_return_ytd?: number | null
          ticker?: string
          total_return_1y?: number | null
          total_return_inception?: number | null
          total_return_ytd?: number | null
          true_income_yield?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notices_19a1: {
        Row: {
          created_at: string | null
          effective_date: string | null
          id: string
          last_updated: string | null
          notice_date: string | null
          roc_percent: number | null
          ticker_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          last_updated?: string | null
          notice_date?: string | null
          roc_percent?: number | null
          ticker_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          id?: string
          last_updated?: string | null
          notice_date?: string | null
          roc_percent?: number | null
          ticker_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notices_19a1_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "etfs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_paid: boolean | null
          plan: string | null
          tax_rate: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          is_paid?: boolean | null
          plan?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_paid?: boolean | null
          plan?: string | null
          tax_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      weekly_data: {
        Row: {
          adj_close: number
          created_at: string | null
          date: string
          dividend: number | null
          id: string
          ticker_id: string
        }
        Insert: {
          adj_close: number
          created_at?: string | null
          date: string
          dividend?: number | null
          id?: string
          ticker_id: string
        }
        Update: {
          adj_close?: number
          created_at?: string | null
          date?: string
          dividend?: number | null
          id?: string
          ticker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_data_ticker_id_fkey"
            columns: ["ticker_id"]
            isOneToOne: false
            referencedRelation: "etfs"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          username: string | null
          is_paid: boolean | null
          subscription_tier: string | null
          subscription_start: string | null
          subscription_end: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tax_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          username?: string | null
          is_paid?: boolean | null
          subscription_tier?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tax_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          username?: string | null
          is_paid?: boolean | null
          subscription_tier?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tax_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
