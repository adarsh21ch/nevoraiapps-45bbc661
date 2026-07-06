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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batches: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          tenant_id: string
          timing: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          timing?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_plans: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          type: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          note: string | null
          period: string | null
          receipt_no: number
          recorded_by: string | null
          student_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          period?: string | null
          receipt_no?: number
          recorded_by?: string | null
          student_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          period?: string | null
          receipt_no?: number
          recorded_by?: string | null
          student_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          contact_email: string
          contact_whatsapp: string
          id: boolean
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_whatsapp?: string
          id?: boolean
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_whatsapp?: string
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          batch_id: string | null
          created_at: string
          dob: string | null
          fee_plan_id: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          name: string
          payment_ref: string | null
          payment_status: string
          phone: string
          status: string
          tenant_id: string
          whatsapp: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name: string
          payment_ref?: string | null
          payment_status?: string
          phone: string
          status?: string
          tenant_id: string
          whatsapp?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name?: string
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          status?: string
          tenant_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_fee_plan_id_fkey"
            columns: ["fee_plan_id"]
            isOneToOne: false
            referencedRelation: "fee_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          section: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          section: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          section?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          batch_id: string | null
          created_at: string
          dob: string | null
          fee_plan_id: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          joined_at: string
          name: string
          notes: string | null
          phone: string
          photo_url: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          joined_at?: string
          name: string
          notes?: string | null
          phone: string
          photo_url?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          joined_at?: string
          name?: string
          notes?: string | null
          phone?: string
          photo_url?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_fee_plan_id_fkey"
            columns: ["fee_plan_id"]
            isOneToOne: false
            referencedRelation: "fee_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_price_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_price: number
          note: string | null
          old_price: number
          tenant_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price: number
          note?: string | null
          old_price: number
          tenant_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number
          note?: string | null
          old_price?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_price_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          billing_day: number
          created_at: string
          custom_domain: string | null
          email: string | null
          features: Json
          fee_cycle: string
          id: string
          last_paid_date: string | null
          logo_url: string | null
          monthly_price: number
          name: string
          niche: string
          phone: string | null
          platform_notes: string | null
          primary_color: string
          secondary_color: string
          setup_fee: number
          slug: string
          status: string
          subscription_status: string
          tagline: string | null
          upi_id: string | null
          upi_qr_url: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          billing_day?: number
          created_at?: string
          custom_domain?: string | null
          email?: string | null
          features?: Json
          fee_cycle?: string
          id?: string
          last_paid_date?: string | null
          logo_url?: string | null
          monthly_price?: number
          name: string
          niche?: string
          phone?: string | null
          platform_notes?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          slug: string
          status?: string
          subscription_status?: string
          tagline?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          billing_day?: number
          created_at?: string
          custom_domain?: string | null
          email?: string | null
          features?: Json
          fee_cycle?: string
          id?: string
          last_paid_date?: string | null
          logo_url?: string | null
          monthly_price?: number
          name?: string
          niche?: string
          phone?: string | null
          platform_notes?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          slug?: string
          status?: string
          subscription_status?: string
          tagline?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_registration: {
        Args: { _registration_id: string }
        Returns: string
      }
      attach_payment_ref: {
        Args: { _payment_ref: string; _registration_id: string }
        Returns: undefined
      }
      is_platform_admin: { Args: { _uid: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
      submit_registration: {
        Args: {
          _batch_id?: string
          _dob?: string
          _fee_plan_id: string
          _guardian_name?: string
          _guardian_phone?: string
          _name: string
          _phone: string
          _tenant_id: string
          _whatsapp?: string
        }
        Returns: string
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
