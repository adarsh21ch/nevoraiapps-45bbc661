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
      admission_timeline: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_stage: string | null
          id: string
          lead_id: string | null
          metadata: Json
          registration_id: string | null
          remark: string | null
          student_id: string | null
          tenant_id: string
          to_stage: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_stage?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          registration_id?: string | null
          remark?: string | null
          student_id?: string | null
          tenant_id: string
          to_stage?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_stage?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          registration_id?: string | null
          remark?: string | null
          student_id?: string | null
          tenant_id?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admission_timeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_timeline_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_timeline_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_timeline_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_marks: {
        Row: {
          check_in_at: string | null
          check_in_meta: Json
          check_out_at: string | null
          check_out_meta: Json
          corrects_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          marked_by: string | null
          note: string | null
          session_id: string
          source: Database["public"]["Enums"]["attendance_source"]
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          superseded_by: string | null
          tenant_id: string
          updated_at: string
          visit_type: string | null
        }
        Insert: {
          check_in_at?: string | null
          check_in_meta?: Json
          check_out_at?: string | null
          check_out_meta?: Json
          corrects_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          marked_by?: string | null
          note?: string | null
          session_id: string
          source?: Database["public"]["Enums"]["attendance_source"]
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          superseded_by?: string | null
          tenant_id: string
          updated_at?: string
          visit_type?: string | null
        }
        Update: {
          check_in_at?: string | null
          check_in_meta?: Json
          check_out_at?: string | null
          check_out_meta?: Json
          corrects_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          marked_by?: string | null
          note?: string | null
          session_id?: string
          source?: Database["public"]["Enums"]["attendance_source"]
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          superseded_by?: string | null
          tenant_id?: string
          updated_at?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marks_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "attendance_marks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "attendance_visits"
            referencedColumns: ["mark_id"]
          },
          {
            foreignKeyName: "attendance_marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "attendance_marks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "attendance_visits"
            referencedColumns: ["mark_id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          session_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_deliveries: {
        Row: {
          adapter: string
          attempts: number
          channel: string
          created_at: string
          delivered_at: string | null
          duration_ms: number | null
          error: string | null
          event_id: string | null
          execution_id: string | null
          id: string
          message: string
          provider: string
          provider_message_id: string | null
          recipient_name: string | null
          recipient_number: string | null
          rule_id: string | null
          sent_at: string | null
          status: string
          student_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adapter?: string
          attempts?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          execution_id?: string | null
          id?: string
          message: string
          provider?: string
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_number?: string | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adapter?: string
          attempts?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          execution_id?: string | null
          id?: string
          message?: string
          provider?: string
          provider_message_id?: string | null
          recipient_name?: string | null
          recipient_number?: string | null
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          student_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_deliveries_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_deliveries_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          source_id: string | null
          source_module: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          source_id?: string | null
          source_module?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          action_type: string
          attempt: number
          created_at: string
          dedupe_key: string | null
          duration_ms: number | null
          error: string | null
          event_id: string | null
          event_type: string
          finished_at: string | null
          id: string
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          result: Json | null
          rule_id: string | null
          started_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          action_type: string
          attempt?: number
          created_at?: string
          dedupe_key?: string | null
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          event_type: string
          finished_at?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          result?: Json | null
          rule_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          action_type?: string
          attempt?: number
          created_at?: string
          dedupe_key?: string | null
          duration_ms?: number | null
          error?: string | null
          event_id?: string | null
          event_type?: string
          finished_at?: string | null
          id?: string
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          result?: Json | null
          rule_id?: string | null
          started_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_provider_configs: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          id: string
          provider_key: string
          secret_ref: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider_key: string
          secret_ref?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          provider_key?: string
          secret_ref?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_rule_templates: {
        Row: {
          actions: Json
          audience: string
          category: string
          conditions: Json
          created_at: string
          default_enabled: boolean
          description: string | null
          event_type: string
          id: string
          name: string
          priority: number
          template_key: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          audience?: string
          category: string
          conditions?: Json
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          event_type: string
          id?: string
          name: string
          priority?: number
          template_key: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          audience?: string
          category?: string
          conditions?: Json
          created_at?: string
          default_enabled?: boolean
          description?: string | null
          event_type?: string
          id?: string
          name?: string
          priority?: number
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          event_type: string
          id: string
          name: string
          priority: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_type: string
          id?: string
          name: string
          priority?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          event_type?: string
          id?: string
          name?: string
          priority?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_charges: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          period_end: string
          period_key: string
          period_start: string
          status: string
          student_id: string
          subscription_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          period_end: string
          period_key: string
          period_start: string
          status?: string
          student_id: string
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          period_end?: string
          period_key?: string
          period_start?: string
          status?: string
          student_id?: string
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_discounts: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          kind: string
          name: string
          notes: string | null
          starts_on: string
          subscription_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          kind: string
          name: string
          notes?: string | null
          starts_on?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          kind?: string
          name?: string
          notes?: string | null
          starts_on?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_discounts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          kind: string
          metadata: Json
          reason: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          kind: string
          metadata?: Json
          reason: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          kind?: string
          metadata?: Json
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_adjustments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_lines: {
        Row: {
          amount: number
          charge_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          invoice_id: string
          line_type: string
          period_end: string | null
          period_start: string | null
          quantity: number
          sort_order: number
          tenant_id: string
          unit_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          invoice_id: string
          line_type: string
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          sort_order?: number
          tenant_id: string
          unit_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_type?: string
          period_end?: string | null
          period_start?: string | null
          quantity?: number
          sort_order?: number
          tenant_id?: string
          unit_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_lines_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "billing_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount_paid: number
          balance: number
          created_at: string
          created_by: string | null
          currency: string
          discount_total: number
          due_date: string | null
          id: string
          issue_date: string | null
          issued_at: string | null
          notes: string | null
          number: string | null
          period_end: string | null
          period_start: string | null
          status: string
          student_id: string
          subscription_id: string | null
          subtotal: number
          tax_total: number
          tenant_id: string
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid?: number
          balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          issue_date?: string | null
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          student_id: string
          subscription_id?: string | null
          subtotal?: number
          tax_total?: number
          tenant_id: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          balance?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_total?: number
          due_date?: string | null
          id?: string
          issue_date?: string | null
          issued_at?: string | null
          notes?: string | null
          number?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          student_id?: string
          subscription_id?: string | null
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payment_allocations: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          payment_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          payment_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          payment_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount: number
          collected_at: string
          collected_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          gateway: string | null
          gateway_payload: Json | null
          gateway_reference: string | null
          id: string
          idempotency_key: string | null
          method: string
          reference_number: string | null
          remarks: string | null
          status: string
          student_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          collected_at?: string
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: string | null
          gateway_payload?: Json | null
          gateway_reference?: string | null
          id?: string
          idempotency_key?: string | null
          method: string
          reference_number?: string | null
          remarks?: string | null
          status?: string
          student_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          collected_at?: string
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: string | null
          gateway_payload?: Json | null
          gateway_reference?: string | null
          id?: string
          idempotency_key?: string | null
          method?: string
          reference_number?: string | null
          remarks?: string | null
          status?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          cycle_anchor_day: number
          end_date: string | null
          enrollment_id: string | null
          fee_plan_id: string | null
          id: string
          notes: string | null
          pause_end: string | null
          pause_start: string | null
          start_date: string
          status: string
          student_id: string
          tenant_id: string
          unit_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_cycle?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          cycle_anchor_day?: number
          end_date?: string | null
          enrollment_id?: string | null
          fee_plan_id?: string | null
          id?: string
          notes?: string | null
          pause_end?: string | null
          pause_start?: string | null
          start_date?: string
          status?: string
          student_id: string
          tenant_id: string
          unit_amount: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_cycle?: string
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          cycle_anchor_day?: number
          end_date?: string | null
          enrollment_id?: string | null
          fee_plan_id?: string | null
          id?: string
          notes?: string | null
          pause_end?: string | null
          pause_start?: string | null
          start_date?: string
          status?: string
          student_id?: string
          tenant_id?: string
          unit_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_fee_plan_id_fkey"
            columns: ["fee_plan_id"]
            isOneToOne: false
            referencedRelation: "fee_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_campaign_recipients: {
        Row: {
          campaign_id: string
          id: string
          notification_id: string | null
          recipient_user_id: string
          resolved_at: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          notification_id?: string | null
          recipient_user_id: string
          resolved_at?: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          notification_id?: string | null
          recipient_user_id?: string
          resolved_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "comm_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_campaigns: {
        Row: {
          audience: Json
          body: string | null
          category: Database["public"]["Enums"]["notification_category"]
          channels: Database["public"]["Enums"]["notification_channel"][]
          created_at: string
          created_by: string | null
          deep_link: string | null
          delivered_count: number
          failed_count: number
          id: string
          is_recurring: boolean
          last_error: string | null
          message_type: string
          name: string
          priority: Database["public"]["Enums"]["notification_priority"]
          recipient_count: number
          recurrence_rule: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          is_recurring?: boolean
          last_error?: string | null
          message_type?: string
          name: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_count?: number
          recurrence_rule?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          body?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          channels?: Database["public"]["Enums"]["notification_channel"][]
          created_at?: string
          created_by?: string | null
          deep_link?: string | null
          delivered_count?: number
          failed_count?: number
          id?: string
          is_recurring?: boolean
          last_error?: string | null
          message_type?: string
          name?: string
          priority?: Database["public"]["Enums"]["notification_priority"]
          recipient_count?: number
          recurrence_rule?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "comm_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      comm_templates: {
        Row: {
          body_template: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          created_by: string | null
          default_channels: Database["public"]["Enums"]["notification_channel"][]
          id: string
          name: string
          tenant_id: string
          title_template: string
          updated_at: string
          variables_used: Json
        }
        Insert: {
          body_template?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          created_by?: string | null
          default_channels?: Database["public"]["Enums"]["notification_channel"][]
          id?: string
          name: string
          tenant_id: string
          title_template: string
          updated_at?: string
          variables_used?: Json
        }
        Update: {
          body_template?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          created_by?: string | null
          default_channels?: Database["public"]["Enums"]["notification_channel"][]
          id?: string
          name?: string
          tenant_id?: string
          title_template?: string
          updated_at?: string
          variables_used?: Json
        }
        Relationships: [
          {
            foreignKeyName: "comm_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comm_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_plans: {
        Row: {
          active: boolean
          amount: number
          billing_cycle: string | null
          created_at: string
          currency: string
          cycle_anchor_day: number | null
          description: string | null
          id: string
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          active?: boolean
          amount: number
          billing_cycle?: string | null
          created_at?: string
          currency?: string
          cycle_anchor_day?: number | null
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          type: string
        }
        Update: {
          active?: boolean
          amount?: number
          billing_cycle?: string | null
          created_at?: string
          currency?: string
          cycle_anchor_day?: number | null
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
          {
            foreignKeyName: "fee_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          converted_registration_id: string | null
          converted_student_id: string | null
          counselling_at: string | null
          created_at: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string
          pipeline_stage: string
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          trial_at: string | null
          trial_rating: number | null
          trial_remarks: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          converted_registration_id?: string | null
          converted_student_id?: string | null
          counselling_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone: string
          pipeline_stage?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          trial_at?: string | null
          trial_rating?: number | null
          trial_remarks?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          converted_registration_id?: string | null
          converted_student_id?: string | null
          counselling_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string
          pipeline_stage?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
          trial_at?: string | null
          trial_rating?: number | null
          trial_remarks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_registration_id_fkey"
            columns: ["converted_registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_academy_records: {
        Row: {
          athlete_profile_id: string | null
          created_at: string
          id: string
          match_id: string | null
          metadata: Json
          record_key: string
          record_type: string
          team_id: string | null
          tenant_id: string
          tournament_id: string | null
          updated_at: string
          value: number
        }
        Insert: {
          athlete_profile_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          metadata?: Json
          record_key: string
          record_type: string
          team_id?: string | null
          tenant_id: string
          tournament_id?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          athlete_profile_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          metadata?: Json
          record_key?: string
          record_type?: string
          team_id?: string | null
          tenant_id?: string
          tournament_id?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "mc_academy_records_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_records_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_records_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_academy_timeline: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          image_url: string | null
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          image_url?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          image_url?: string | null
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_academy_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_academy_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_ai_reports: {
        Row: {
          academy_id: string
          created_at: string
          generated_at: string
          generated_by: string
          id: string
          key_findings: Json
          metadata: Json
          recommendations: Json
          reference_id: string | null
          reference_type: string
          report_type: string
          strengths: Json
          summary: string | null
          title: string
          updated_at: string
          weaknesses: Json
        }
        Insert: {
          academy_id: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          key_findings?: Json
          metadata?: Json
          recommendations?: Json
          reference_id?: string | null
          reference_type: string
          report_type: string
          strengths?: Json
          summary?: string | null
          title: string
          updated_at?: string
          weaknesses?: Json
        }
        Update: {
          academy_id?: string
          created_at?: string
          generated_at?: string
          generated_by?: string
          id?: string
          key_findings?: Json
          metadata?: Json
          recommendations?: Json
          reference_id?: string | null
          reference_type?: string
          report_type?: string
          strengths?: Json
          summary?: string | null
          title?: string
          updated_at?: string
          weaknesses?: Json
        }
        Relationships: []
      }
      mc_ai_settings: {
        Row: {
          academy_id: string
          auto_generate_match_reports: boolean
          auto_generate_monthly_reports: boolean
          auto_generate_player_reports: boolean
          auto_generate_tournament_reports: boolean
          coach_review_required: boolean
          created_at: string
          id: string
          language: string
          tone: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          auto_generate_match_reports?: boolean
          auto_generate_monthly_reports?: boolean
          auto_generate_player_reports?: boolean
          auto_generate_tournament_reports?: boolean
          coach_review_required?: boolean
          created_at?: string
          id?: string
          language?: string
          tone?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          auto_generate_match_reports?: boolean
          auto_generate_monthly_reports?: boolean
          auto_generate_player_reports?: boolean
          auto_generate_tournament_reports?: boolean
          coach_review_required?: boolean
          created_at?: string
          id?: string
          language?: string
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_athlete_achievements: {
        Row: {
          athlete_profile_id: string
          created_at: string
          description: string | null
          event_date: string | null
          id: string
          kind: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_profile_id: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          kind: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_profile_id?: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          kind?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_athlete_achievements_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_athlete_awards: {
        Row: {
          athlete_profile_id: string
          created_at: string
          description: string | null
          event_date: string | null
          id: string
          kind: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_profile_id: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          kind: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_profile_id?: string
          created_at?: string
          description?: string | null
          event_date?: string | null
          id?: string
          kind?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_athlete_awards_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_awards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_awards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_athlete_profiles: {
        Row: {
          created_at: string
          current_status: string
          dominant_hand: string | null
          emergency_notes: string | null
          fitness_status: string | null
          height_cm: number | null
          id: string
          joining_sport_date: string | null
          medical_notes: string | null
          primary_sport: string
          secondary_sports: Json
          student_id: string
          tenant_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          current_status?: string
          dominant_hand?: string | null
          emergency_notes?: string | null
          fitness_status?: string | null
          height_cm?: number | null
          id?: string
          joining_sport_date?: string | null
          medical_notes?: string | null
          primary_sport?: string
          secondary_sports?: Json
          student_id: string
          tenant_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          current_status?: string
          dominant_hand?: string | null
          emergency_notes?: string | null
          fitness_status?: string | null
          height_cm?: number | null
          id?: string
          joining_sport_date?: string | null
          medical_notes?: string | null
          primary_sport?: string
          secondary_sports?: Json
          student_id?: string
          tenant_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mc_athlete_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_athlete_timeline: {
        Row: {
          athlete_profile_id: string
          created_at: string
          description: string | null
          event_date: string
          id: string
          image_url: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_profile_id: string
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_profile_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          id?: string
          image_url?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_athlete_timeline_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_athlete_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_ball_events: {
        Row: {
          ball_number: number
          bowler_athlete_id: string | null
          bowler_name: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          dismissal_type: string | null
          dismissed_athlete_id: string | null
          dismissed_name: string | null
          extra_runs: number
          extra_type: string | null
          fielder_athlete_id: string | null
          fielder_name: string | null
          id: string
          innings_id: string
          is_legal_delivery: boolean
          match_id: string
          non_striker_athlete_id: string | null
          non_striker_name: string | null
          over_number: number
          runs_off_bat: number
          sequence_number: number
          striker_athlete_id: string | null
          striker_name: string | null
          tenant_id: string
        }
        Insert: {
          ball_number: number
          bowler_athlete_id?: string | null
          bowler_name?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          dismissal_type?: string | null
          dismissed_athlete_id?: string | null
          dismissed_name?: string | null
          extra_runs?: number
          extra_type?: string | null
          fielder_athlete_id?: string | null
          fielder_name?: string | null
          id?: string
          innings_id: string
          is_legal_delivery?: boolean
          match_id: string
          non_striker_athlete_id?: string | null
          non_striker_name?: string | null
          over_number: number
          runs_off_bat?: number
          sequence_number: number
          striker_athlete_id?: string | null
          striker_name?: string | null
          tenant_id: string
        }
        Update: {
          ball_number?: number
          bowler_athlete_id?: string | null
          bowler_name?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          dismissal_type?: string | null
          dismissed_athlete_id?: string | null
          dismissed_name?: string | null
          extra_runs?: number
          extra_type?: string | null
          fielder_athlete_id?: string | null
          fielder_name?: string | null
          id?: string
          innings_id?: string
          is_legal_delivery?: boolean
          match_id?: string
          non_striker_athlete_id?: string | null
          non_striker_name?: string | null
          over_number?: number
          runs_off_bat?: number
          sequence_number?: number
          striker_athlete_id?: string | null
          striker_name?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_ball_events_bowler_athlete_id_fkey"
            columns: ["bowler_athlete_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_dismissed_athlete_id_fkey"
            columns: ["dismissed_athlete_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_fielder_athlete_id_fkey"
            columns: ["fielder_athlete_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_innings_id_fkey"
            columns: ["innings_id"]
            isOneToOne: false
            referencedRelation: "mc_innings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_non_striker_athlete_id_fkey"
            columns: ["non_striker_athlete_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_striker_athlete_id_fkey"
            columns: ["striker_athlete_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_ball_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_certificate_templates: {
        Row: {
          background_image: string | null
          created_at: string
          id: string
          is_default: boolean
          logo: string | null
          name: string
          primary_color: string
          secondary_color: string
          signature_image: string | null
          signature_name: string | null
          template_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          background_image?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          logo?: string | null
          name: string
          primary_color?: string
          secondary_color?: string
          signature_image?: string | null
          signature_name?: string | null
          template_type?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          background_image?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          logo?: string | null
          name?: string
          primary_color?: string
          secondary_color?: string
          signature_image?: string | null
          signature_name?: string | null
          template_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_coach_remarks: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          created_at: string
          id: string
          remark: string
          student_id: string
          tenant_id: string
          updated_at: string
          visible_to_parents: boolean
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          created_at?: string
          id?: string
          remark: string
          student_id: string
          tenant_id: string
          updated_at?: string
          visible_to_parents?: boolean
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          created_at?: string
          id?: string
          remark?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string
          visible_to_parents?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mc_coach_remarks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_coach_remarks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_coach_remarks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_coach_remarks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_cricket_profiles: {
        Row: {
          athlete_profile_id: string
          batting_style: string | null
          bowling_style: string | null
          bowling_type: string | null
          career_status: string
          created_at: string
          dominant_hand: string | null
          favorite_delivery: string | null
          favorite_shot: string | null
          id: string
          jersey_number: number | null
          playing_role: string | null
          preferred_position: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          athlete_profile_id: string
          batting_style?: string | null
          bowling_style?: string | null
          bowling_type?: string | null
          career_status?: string
          created_at?: string
          dominant_hand?: string | null
          favorite_delivery?: string | null
          favorite_shot?: string | null
          id?: string
          jersey_number?: number | null
          playing_role?: string | null
          preferred_position?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          athlete_profile_id?: string
          batting_style?: string | null
          bowling_style?: string | null
          bowling_type?: string | null
          career_status?: string
          created_at?: string
          dominant_hand?: string | null
          favorite_delivery?: string | null
          favorite_shot?: string | null
          id?: string
          jersey_number?: number | null
          playing_role?: string | null
          preferred_position?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_cricket_profiles_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: true
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_cricket_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_cricket_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_custom_match_types: {
        Row: {
          created_at: string
          id: string
          label: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_custom_match_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_custom_match_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_hall_of_fame: {
        Row: {
          achievement_description: string | null
          achievement_title: string
          athlete_profile_id: string | null
          awarded_at: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          metadata: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          achievement_description?: string | null
          achievement_title: string
          athlete_profile_id?: string | null
          awarded_at?: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          achievement_description?: string | null
          achievement_title?: string
          athlete_profile_id?: string | null
          awarded_at?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_hall_of_fame_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_hall_of_fame_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_hall_of_fame_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_innings: {
        Row: {
          balls: number
          batting_team_id: string
          bowling_team_id: string
          completed_at: string | null
          created_at: string
          extras: number
          id: string
          innings_number: number
          match_id: string
          overs: number
          runs: number
          started_at: string | null
          status: string
          target: number | null
          tenant_id: string
          updated_at: string
          wickets: number
        }
        Insert: {
          balls?: number
          batting_team_id: string
          bowling_team_id: string
          completed_at?: string | null
          created_at?: string
          extras?: number
          id?: string
          innings_number: number
          match_id: string
          overs?: number
          runs?: number
          started_at?: string | null
          status?: string
          target?: number | null
          tenant_id: string
          updated_at?: string
          wickets?: number
        }
        Update: {
          balls?: number
          batting_team_id?: string
          bowling_team_id?: string
          completed_at?: string | null
          created_at?: string
          extras?: number
          id?: string
          innings_number?: number
          match_id?: string
          overs?: number
          runs?: number
          started_at?: string | null
          status?: string
          target?: number | null
          tenant_id?: string
          updated_at?: string
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "mc_innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_innings_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_innings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_innings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_match_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json
          id: string
          match_id: string
          reason: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json
          id?: string
          match_id: string
          reason?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json
          id?: string
          match_id?: string
          reason?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_match_audit_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_match_squads: {
        Row: {
          athlete_profile_id: string | null
          batting_order: number | null
          created_at: string
          external_player_name: string | null
          id: string
          is_captain: boolean
          is_keeper: boolean
          is_playing: boolean
          is_substitute: boolean
          is_vice_captain: boolean
          match_id: string
          role: string | null
          team_id: string
          tenant_id: string
        }
        Insert: {
          athlete_profile_id?: string | null
          batting_order?: number | null
          created_at?: string
          external_player_name?: string | null
          id?: string
          is_captain?: boolean
          is_keeper?: boolean
          is_playing?: boolean
          is_substitute?: boolean
          is_vice_captain?: boolean
          match_id: string
          role?: string | null
          team_id: string
          tenant_id: string
        }
        Update: {
          athlete_profile_id?: string | null
          batting_order?: number | null
          created_at?: string
          external_player_name?: string | null
          id?: string
          is_captain?: boolean
          is_keeper?: boolean
          is_playing?: boolean
          is_substitute?: boolean
          is_vice_captain?: boolean
          match_id?: string
          role?: string | null
          team_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_match_squads_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_squads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_squads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_squads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_squads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_match_timeline: {
        Row: {
          created_at: string
          event_type: string
          id: string
          label: string | null
          match_id: string
          occurred_at: string
          payload: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          label?: string | null
          match_id: string
          occurred_at?: string
          payload?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          label?: string | null
          match_id?: string
          occurred_at?: string
          payload?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_match_timeline_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_match_timeline_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_matches: {
        Row: {
          ball_type: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          finalized_at: string | null
          ground_id: string | null
          ground_name: string | null
          group_id: string | null
          id: string
          match_format: string
          match_locked: boolean
          match_type: string
          matchday_no: number | null
          notes: string | null
          overs: number
          pitch: string | null
          player_of_match_athlete_id: string | null
          public_slug: string | null
          result: string | null
          round_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          scorecard_generated: boolean
          scorer: string | null
          status: string
          streaming_url: string | null
          team_a_id: string
          team_b_id: string
          tenant_id: string
          toss_decision: string | null
          toss_winner: string | null
          tournament_id: string | null
          umpire: string | null
          updated_at: string
          venue_id: string | null
          victory_type: string | null
          visibility: string
          weather: string | null
          winner_team: string | null
          winning_margin: number | null
          winning_margin_type: string | null
        }
        Insert: {
          ball_type?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          ground_id?: string | null
          ground_name?: string | null
          group_id?: string | null
          id?: string
          match_format?: string
          match_locked?: boolean
          match_type?: string
          matchday_no?: number | null
          notes?: string | null
          overs?: number
          pitch?: string | null
          player_of_match_athlete_id?: string | null
          public_slug?: string | null
          result?: string | null
          round_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scorecard_generated?: boolean
          scorer?: string | null
          status?: string
          streaming_url?: string | null
          team_a_id: string
          team_b_id: string
          tenant_id: string
          toss_decision?: string | null
          toss_winner?: string | null
          tournament_id?: string | null
          umpire?: string | null
          updated_at?: string
          venue_id?: string | null
          victory_type?: string | null
          visibility?: string
          weather?: string | null
          winner_team?: string | null
          winning_margin?: number | null
          winning_margin_type?: string | null
        }
        Update: {
          ball_type?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          ground_id?: string | null
          ground_name?: string | null
          group_id?: string | null
          id?: string
          match_format?: string
          match_locked?: boolean
          match_type?: string
          matchday_no?: number | null
          notes?: string | null
          overs?: number
          pitch?: string | null
          player_of_match_athlete_id?: string | null
          public_slug?: string | null
          result?: string | null
          round_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          scorecard_generated?: boolean
          scorer?: string | null
          status?: string
          streaming_url?: string | null
          team_a_id?: string
          team_b_id?: string
          tenant_id?: string
          toss_decision?: string | null
          toss_winner?: string | null
          tournament_id?: string | null
          umpire?: string | null
          updated_at?: string
          venue_id?: string | null
          victory_type?: string | null
          visibility?: string
          weather?: string | null
          winner_team?: string | null
          winning_margin?: number | null
          winning_margin_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mc_matches_player_of_match_athlete_id_fkey"
            columns: ["player_of_match_athlete_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_matches_player_of_match_athlete_id_fkey"
            columns: ["player_of_match_athlete_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_matches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_matches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_parent_links: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          is_primary: boolean
          parent_user_id: string
          relationship: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_user_id: string
          relationship?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_user_id?: string
          relationship?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_player_careers: {
        Row: {
          athlete_profile_id: string
          average: number
          balls: number
          balls_bowled: number
          best_bowling: string
          best_bowling_runs: number
          best_bowling_wickets: number
          bowling_average: number
          bowling_strike_rate: number
          captain_losses: number
          captain_matches: number
          captain_wins: number
          catches: number
          created_at: string
          ducks: number
          economy: number
          fifties: number
          five_wicket_hauls: number
          fours: number
          golden_ducks: number
          highest_score: number
          highest_score_not_out: boolean
          hundreds: number
          id: string
          innings: number
          last_rebuilt_at: string
          maidens: number
          matches: number
          not_outs: number
          overs: number
          player_of_match: number
          run_outs: number
          runs: number
          runs_conceded: number
          silver_ducks: number
          sixes: number
          strike_rate: number
          stumpings: number
          ten_wicket_hauls: number
          tenant_id: string
          updated_at: string
          wickets: number
        }
        Insert: {
          athlete_profile_id: string
          average?: number
          balls?: number
          balls_bowled?: number
          best_bowling?: string
          best_bowling_runs?: number
          best_bowling_wickets?: number
          bowling_average?: number
          bowling_strike_rate?: number
          captain_losses?: number
          captain_matches?: number
          captain_wins?: number
          catches?: number
          created_at?: string
          ducks?: number
          economy?: number
          fifties?: number
          five_wicket_hauls?: number
          fours?: number
          golden_ducks?: number
          highest_score?: number
          highest_score_not_out?: boolean
          hundreds?: number
          id?: string
          innings?: number
          last_rebuilt_at?: string
          maidens?: number
          matches?: number
          not_outs?: number
          overs?: number
          player_of_match?: number
          run_outs?: number
          runs?: number
          runs_conceded?: number
          silver_ducks?: number
          sixes?: number
          strike_rate?: number
          stumpings?: number
          ten_wicket_hauls?: number
          tenant_id: string
          updated_at?: string
          wickets?: number
        }
        Update: {
          athlete_profile_id?: string
          average?: number
          balls?: number
          balls_bowled?: number
          best_bowling?: string
          best_bowling_runs?: number
          best_bowling_wickets?: number
          bowling_average?: number
          bowling_strike_rate?: number
          captain_losses?: number
          captain_matches?: number
          captain_wins?: number
          catches?: number
          created_at?: string
          ducks?: number
          economy?: number
          fifties?: number
          five_wicket_hauls?: number
          fours?: number
          golden_ducks?: number
          highest_score?: number
          highest_score_not_out?: boolean
          hundreds?: number
          id?: string
          innings?: number
          last_rebuilt_at?: string
          maidens?: number
          matches?: number
          not_outs?: number
          overs?: number
          player_of_match?: number
          run_outs?: number
          runs?: number
          runs_conceded?: number
          silver_ducks?: number
          sixes?: number
          strike_rate?: number
          stumpings?: number
          ten_wicket_hauls?: number
          tenant_id?: string
          updated_at?: string
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "mc_player_careers_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_player_careers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_player_careers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_public_matches: {
        Row: {
          academy_id: string
          allow_live_score: boolean
          allow_match_summary: boolean
          allow_player_profiles: boolean
          allow_scorecard: boolean
          created_at: string
          id: string
          is_public: boolean
          match_id: string
          public_slug: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          allow_live_score?: boolean
          allow_match_summary?: boolean
          allow_player_profiles?: boolean
          allow_scorecard?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          match_id: string
          public_slug: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          allow_live_score?: boolean
          allow_match_summary?: boolean
          allow_player_profiles?: boolean
          allow_scorecard?: boolean
          created_at?: string
          id?: string
          is_public?: boolean
          match_id?: string
          public_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_public_settings: {
        Row: {
          academy_id: string
          allow_ai_summary: boolean
          allow_download_scorecard: boolean
          allow_live_scores: boolean
          allow_public_links: boolean
          created_at: string
          default_match_visibility: string
          default_player_visibility: string
          id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          allow_ai_summary?: boolean
          allow_download_scorecard?: boolean
          allow_live_scores?: boolean
          allow_public_links?: boolean
          created_at?: string
          default_match_visibility?: string
          default_player_visibility?: string
          id?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          allow_ai_summary?: boolean
          allow_download_scorecard?: boolean
          allow_live_scores?: boolean
          allow_public_links?: boolean
          created_at?: string
          default_match_visibility?: string
          default_player_visibility?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_recognitions: {
        Row: {
          athlete_profile_id: string | null
          awarded_at: string | null
          awarded_by: string | null
          badge: string | null
          certificate_template: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          match_id: string | null
          metadata: Json
          period: string | null
          recognition_type: string
          status: string
          team_id: string | null
          tenant_id: string
          title: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          athlete_profile_id?: string | null
          awarded_at?: string | null
          awarded_by?: string | null
          badge?: string | null
          certificate_template?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          match_id?: string | null
          metadata?: Json
          period?: string | null
          recognition_type: string
          status?: string
          team_id?: string | null
          tenant_id: string
          title: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          athlete_profile_id?: string | null
          awarded_at?: string | null
          awarded_by?: string | null
          badge?: string | null
          certificate_template?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          match_id?: string | null
          metadata?: Json
          period?: string | null
          recognition_type?: string
          status?: string
          team_id?: string | null
          tenant_id?: string
          title?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_recognitions_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_recognitions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_recognitions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_recognitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_recognitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_recognitions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_scorers: {
        Row: {
          athlete_profile_id: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          id: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_scorers_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "mc_athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_scorers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_scorers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_team_players: {
        Row: {
          added_at: string
          batting_style: string | null
          bowling_style: string | null
          id: string
          is_captain: boolean
          is_keeper: boolean
          is_vice_captain: boolean
          jersey_number: number | null
          role: string | null
          student_id: string
          team_id: string
          tenant_id: string
        }
        Insert: {
          added_at?: string
          batting_style?: string | null
          bowling_style?: string | null
          id?: string
          is_captain?: boolean
          is_keeper?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          role?: string | null
          student_id: string
          team_id: string
          tenant_id: string
        }
        Update: {
          added_at?: string
          batting_style?: string | null
          bowling_style?: string | null
          id?: string
          is_captain?: boolean
          is_keeper?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          role?: string | null
          student_id?: string
          team_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_team_players_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_team_players_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_team_players_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_team_players_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_teams: {
        Row: {
          age_group: string | null
          age_group_custom: string | null
          assistant_coach_name: string | null
          captain_student_id: string | null
          city: string | null
          coach_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_external: boolean
          keeper_student_id: string | null
          logo_url: string | null
          name: string
          public_slug: string | null
          season: string | null
          short_name: string | null
          sport: string
          status: string
          team_color: string | null
          tenant_id: string
          updated_at: string
          vice_captain_student_id: string | null
        }
        Insert: {
          age_group?: string | null
          age_group_custom?: string | null
          assistant_coach_name?: string | null
          captain_student_id?: string | null
          city?: string | null
          coach_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_external?: boolean
          keeper_student_id?: string | null
          logo_url?: string | null
          name: string
          public_slug?: string | null
          season?: string | null
          short_name?: string | null
          sport?: string
          status?: string
          team_color?: string | null
          tenant_id: string
          updated_at?: string
          vice_captain_student_id?: string | null
        }
        Update: {
          age_group?: string | null
          age_group_custom?: string | null
          assistant_coach_name?: string | null
          captain_student_id?: string | null
          city?: string | null
          coach_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_external?: boolean
          keeper_student_id?: string | null
          logo_url?: string | null
          name?: string
          public_slug?: string | null
          season?: string | null
          short_name?: string | null
          sport?: string
          status?: string
          team_color?: string | null
          tenant_id?: string
          updated_at?: string
          vice_captain_student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mc_teams_captain_student_id_fkey"
            columns: ["captain_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_captain_student_id_fkey"
            columns: ["captain_student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_keeper_student_id_fkey"
            columns: ["keeper_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_keeper_student_id_fkey"
            columns: ["keeper_student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_vice_captain_student_id_fkey"
            columns: ["vice_captain_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_teams_vice_captain_student_id_fkey"
            columns: ["vice_captain_student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournament_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          qualify_count: number
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          qualify_count?: number
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          qualify_count?: number
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournament_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_groups_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournament_officials: {
        Row: {
          athlete_id: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          role: string
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          role: string
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          role?: string
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournament_officials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_officials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_officials_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournament_rounds: {
        Row: {
          advances_to_round_id: string | null
          created_at: string
          feeder_a_round_id: string | null
          feeder_b_round_id: string | null
          feeder_type: string
          id: string
          is_placeholder: boolean
          match_id: string | null
          name: string | null
          slot_index: number
          stage: string
          stage_order: number
          team_a_id: string | null
          team_b_id: string | null
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          advances_to_round_id?: string | null
          created_at?: string
          feeder_a_round_id?: string | null
          feeder_b_round_id?: string | null
          feeder_type?: string
          id?: string
          is_placeholder?: boolean
          match_id?: string | null
          name?: string | null
          slot_index?: number
          stage: string
          stage_order?: number
          team_a_id?: string | null
          team_b_id?: string | null
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          advances_to_round_id?: string | null
          created_at?: string
          feeder_a_round_id?: string | null
          feeder_b_round_id?: string | null
          feeder_type?: string
          id?: string
          is_placeholder?: boolean
          match_id?: string | null
          name?: string | null
          slot_index?: number
          stage?: string
          stage_order?: number
          team_a_id?: string | null
          team_b_id?: string | null
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournament_rounds_advances_to_round_id_fkey"
            columns: ["advances_to_round_id"]
            isOneToOne: false
            referencedRelation: "mc_tournament_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_feeder_a_round_id_fkey"
            columns: ["feeder_a_round_id"]
            isOneToOne: false
            referencedRelation: "mc_tournament_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_feeder_b_round_id_fkey"
            columns: ["feeder_b_round_id"]
            isOneToOne: false
            referencedRelation: "mc_tournament_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "mc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_rounds_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournament_teams: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          last_rebuilt_at: string
          lost: number
          net_run_rate: number
          no_result: number
          overs_bowled: number
          overs_faced: number
          played: number
          points: number
          position: number
          runs_conceded: number
          runs_scored: number
          seed: number | null
          team_id: string
          tenant_id: string
          tied: number
          tournament_id: string
          updated_at: string
          wickets_lost: number
          wickets_taken: number
          won: number
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          last_rebuilt_at?: string
          lost?: number
          net_run_rate?: number
          no_result?: number
          overs_bowled?: number
          overs_faced?: number
          played?: number
          points?: number
          position?: number
          runs_conceded?: number
          runs_scored?: number
          seed?: number | null
          team_id: string
          tenant_id: string
          tied?: number
          tournament_id: string
          updated_at?: string
          wickets_lost?: number
          wickets_taken?: number
          won?: number
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          last_rebuilt_at?: string
          lost?: number
          net_run_rate?: number
          no_result?: number
          overs_bowled?: number
          overs_faced?: number
          played?: number
          points?: number
          position?: number
          runs_conceded?: number
          runs_scored?: number
          seed?: number | null
          team_id?: string
          tenant_id?: string
          tied?: number
          tournament_id?: string
          updated_at?: string
          wickets_lost?: number
          wickets_taken?: number
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournament_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_teams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournament_venues: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          pitch_type: string | null
          tenant_id: string
          tournament_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          pitch_type?: string | null
          tenant_id: string
          tournament_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          pitch_type?: string | null
          tenant_id?: string
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournament_venues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_venues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournament_venues_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "mc_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_tournaments: {
        Row: {
          age_group: string | null
          banner_url: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          format: string
          ground_name: string | null
          has_groups: boolean
          has_knockout: boolean
          id: string
          location: string | null
          logo_url: string | null
          match_format_config: Json
          max_teams: number
          name: string
          overs: number
          points_for_loss: number
          points_for_no_result: number
          points_for_tie: number
          points_for_win: number
          published: boolean
          qualification_rules: Json
          season: string | null
          slug: string | null
          sponsors: Json
          start_date: string | null
          status: string
          tenant_id: string
          third_place_match: boolean
          tiebreak_rules: string[]
          tournament_type: string
          updated_at: string
          visibility: string
        }
        Insert: {
          age_group?: string | null
          banner_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          format?: string
          ground_name?: string | null
          has_groups?: boolean
          has_knockout?: boolean
          id?: string
          location?: string | null
          logo_url?: string | null
          match_format_config?: Json
          max_teams?: number
          name: string
          overs?: number
          points_for_loss?: number
          points_for_no_result?: number
          points_for_tie?: number
          points_for_win?: number
          published?: boolean
          qualification_rules?: Json
          season?: string | null
          slug?: string | null
          sponsors?: Json
          start_date?: string | null
          status?: string
          tenant_id: string
          third_place_match?: boolean
          tiebreak_rules?: string[]
          tournament_type?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          age_group?: string | null
          banner_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          format?: string
          ground_name?: string | null
          has_groups?: boolean
          has_knockout?: boolean
          id?: string
          location?: string | null
          logo_url?: string | null
          match_format_config?: Json
          max_teams?: number
          name?: string
          overs?: number
          points_for_loss?: number
          points_for_no_result?: number
          points_for_tie?: number
          points_for_win?: number
          published?: boolean
          qualification_rules?: Json
          season?: string | null
          slug?: string | null
          sponsors?: Json
          start_date?: string | null
          status?: string
          tenant_id?: string
          third_place_match?: boolean
          tiebreak_rules?: string[]
          tournament_type?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_tournaments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_tournaments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_website_analytics: {
        Row: {
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          metadata: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mc_website_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_website_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_website_config: {
        Row: {
          created_at: string
          featured_player_ids: Json
          featured_tournament_ids: Json
          hero: Json
          homepage_widget: string
          id: string
          is_published: boolean
          seo: Json
          tenant_id: string
          theme: string
          updated_at: string
          widgets: Json
        }
        Insert: {
          created_at?: string
          featured_player_ids?: Json
          featured_tournament_ids?: Json
          hero?: Json
          homepage_widget?: string
          id?: string
          is_published?: boolean
          seo?: Json
          tenant_id: string
          theme?: string
          updated_at?: string
          widgets?: Json
        }
        Update: {
          created_at?: string
          featured_player_ids?: Json
          featured_tournament_ids?: Json
          hero?: Json
          homepage_widget?: string
          id?: string
          is_published?: boolean
          seo?: Json
          tenant_id?: string
          theme?: string
          updated_at?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "mc_website_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mc_website_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempted_at: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delivered_at: string | null
          error: string | null
          id: string
          notification_id: string
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          attempted_at?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          notification_id: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          attempted_at?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          id?: string
          notification_id?: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempts: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          notification_id: string
          payload: Json
          scheduled_for: string
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notification_id: string
          payload?: Json
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          notification_id?: string
          payload?: Json
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["notification_category"]
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["notification_category"]
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string | null
          campaign_id: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          payload: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          recipient_user_id: string
          subtitle: string | null
          tenant_id: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          campaign_id?: string | null
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_user_id: string
          subtitle?: string | null
          tenant_id?: string | null
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_user_id?: string
          subtitle?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
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
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          ip: string | null
          target_id: string | null
          target_type: string
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      platform_comm_accounts: {
        Row: {
          created_at: string
          credentials_ref: string | null
          errors_today: number
          health: string
          id: string
          label: string
          last_activity_at: string | null
          messages_today: number
          metadata: Json
          notes: string | null
          provider_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials_ref?: string | null
          errors_today?: number
          health?: string
          id?: string
          label: string
          last_activity_at?: string | null
          messages_today?: number
          metadata?: Json
          notes?: string | null
          provider_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials_ref?: string | null
          errors_today?: number
          health?: string
          id?: string
          label?: string
          last_activity_at?: string | null
          messages_today?: number
          metadata?: Json
          notes?: string | null
          provider_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_comm_accounts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "platform_comm_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_comm_active: {
        Row: {
          account_id: string | null
          channel: string
          provider_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id?: string | null
          channel: string
          provider_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string | null
          channel?: string
          provider_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_comm_active_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "platform_comm_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_comm_active_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "platform_comm_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_comm_channels: {
        Row: {
          channel: string
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          metadata: Json
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          metadata?: Json
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      platform_comm_providers: {
        Row: {
          adapter_key: string
          channel: string
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          id: string
          metadata: Json
          priority: number
          ready: boolean
          role: string
          updated_at: string
        }
        Insert: {
          adapter_key: string
          channel: string
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          id?: string
          metadata?: Json
          priority?: number
          ready?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          channel?: string
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          metadata?: Json
          priority?: number
          ready?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_comm_templates: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          enabled: boolean
          id: string
          key: string
          name: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          channel: string
          created_at?: string
          enabled?: boolean
          id?: string
          key: string
          name: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          key?: string
          name?: string
          updated_at?: string
          variables?: Json
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
      platform_sports: {
        Row: {
          blurb: string | null
          created_at: string
          icon: string
          id: string
          key: string
          launch_date: string | null
          name: string
          sort_order: number
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          icon?: string
          id?: string
          key: string
          launch_date?: string | null
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
          version?: string
        }
        Update: {
          blurb?: string | null
          created_at?: string
          icon?: string
          id?: string
          key?: string
          launch_date?: string | null
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      platform_support_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          priority: string
          resolved_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_support_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_documents: {
        Row: {
          body_md: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          kind: Database["public"]["Enums"]["policy_kind"]
          published_at: string | null
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          kind: Database["public"]["Enums"]["policy_kind"]
          published_at?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_md?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          kind?: Database["public"]["Enums"]["policy_kind"]
          published_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      push_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          disabled_reason: string | null
          enabled: boolean
          expo_push_token: string
          id: string
          last_seen_at: string
          locale: string | null
          platform: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          disabled_reason?: string | null
          enabled?: boolean
          expo_push_token: string
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          disabled_reason?: string | null
          enabled?: boolean
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          locale?: string | null
          platform?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_hits: {
        Row: {
          bucket_key: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          address: string | null
          batch_id: string | null
          created_at: string
          dob: string | null
          fee_plan_id: string | null
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          name: string
          payment_ref: string | null
          payment_status: string
          phone: string
          photo_url: string | null
          policy_acceptances: Json
          status: string
          tenant_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name: string
          payment_ref?: string | null
          payment_status?: string
          phone: string
          photo_url?: string | null
          policy_acceptances?: Json
          status?: string
          tenant_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          dob?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          name?: string
          payment_ref?: string | null
          payment_status?: string
          phone?: string
          photo_url?: string | null
          policy_acceptances?: Json
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
          {
            foreignKeyName: "registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          amount: number | null
          channel: string
          created_at: string
          id: string
          message: string | null
          period: string
          phone: string | null
          sent_at: string | null
          sent_on: string
          status: string
          student_id: string
          tenant_id: string
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          amount?: number | null
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          period: string
          phone?: string | null
          sent_at?: string | null
          sent_on?: string
          status?: string
          student_id: string
          tenant_id: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          amount?: number | null
          channel?: string
          created_at?: string
          id?: string
          message?: string | null
          period?: string
          phone?: string | null
          sent_at?: string | null
          sent_on?: string
          status?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
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
          {
            foreignKeyName: "site_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      student_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
          student_id: string
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_status_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          archive_reason: string | null
          archived_at: string | null
          batch_id: string | null
          batting_style: string | null
          blood_group: string | null
          bowling_arm: string | null
          bowling_style: string | null
          city: string | null
          coach_name: string | null
          created_at: string
          custom_fee: number | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          fee_plan_id: string | null
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          guardian_whatsapp: string | null
          id: string
          joined_at: string
          medical_notes: string | null
          name: string
          notes: string | null
          parent_mobile: string | null
          parent_name: string | null
          parent_whatsapp: string | null
          phone: string
          photo_url: string | null
          pincode: string | null
          player_id: string | null
          playing_role: string | null
          preferred_notification_channel: string
          public_slug: string | null
          school_college: string | null
          state: string | null
          status: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          batch_id?: string | null
          batting_style?: string | null
          blood_group?: string | null
          bowling_arm?: string | null
          bowling_style?: string | null
          city?: string | null
          coach_name?: string | null
          created_at?: string
          custom_fee?: number | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_whatsapp?: string | null
          id?: string
          joined_at?: string
          medical_notes?: string | null
          name: string
          notes?: string | null
          parent_mobile?: string | null
          parent_name?: string | null
          parent_whatsapp?: string | null
          phone: string
          photo_url?: string | null
          pincode?: string | null
          player_id?: string | null
          playing_role?: string | null
          preferred_notification_channel?: string
          public_slug?: string | null
          school_college?: string | null
          state?: string | null
          status?: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          batch_id?: string | null
          batting_style?: string | null
          blood_group?: string | null
          bowling_arm?: string | null
          bowling_style?: string | null
          city?: string | null
          coach_name?: string | null
          created_at?: string
          custom_fee?: number | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          guardian_whatsapp?: string | null
          id?: string
          joined_at?: string
          medical_notes?: string | null
          name?: string
          notes?: string | null
          parent_mobile?: string | null
          parent_name?: string | null
          parent_whatsapp?: string | null
          phone?: string
          photo_url?: string | null
          pincode?: string | null
          player_id?: string | null
          playing_role?: string | null
          preferred_notification_channel?: string
          public_slug?: string | null
          school_college?: string | null
          state?: string | null
          status?: string
          tenant_id?: string
          user_id?: string | null
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
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
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
          {
            foreignKeyName: "tenant_price_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
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
          player_prefix: string | null
          primary_color: string
          secondary_color: string
          setup_fee: number
          short_name: string | null
          show_billing_to_parents: boolean
          slug: string
          sport_id: string | null
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
          player_prefix?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          short_name?: string | null
          show_billing_to_parents?: boolean
          slug: string
          sport_id?: string | null
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
          player_prefix?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          short_name?: string | null
          show_billing_to_parents?: boolean
          slug?: string
          sport_id?: string | null
          status?: string
          subscription_status?: string
          tagline?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "platform_sports"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      attendance_today: {
        Row: {
          batch_id: string | null
          check_in_at: string | null
          check_out_at: string | null
          current_state: string | null
          duration_minutes: number | null
          last_visit_type: string | null
          mark_id: string | null
          marked_by: string | null
          session_date: string | null
          session_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string | null
          tenant_id: string | null
          visit_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_visits: {
        Row: {
          batch_id: string | null
          check_in_at: string | null
          check_out_at: string | null
          created_at: string | null
          duration_minutes: number | null
          mark_id: string | null
          marked_by: string | null
          note: string | null
          session_date: string | null
          session_id: string | null
          source: Database["public"]["Enums"]["attendance_source"] | null
          status: Database["public"]["Enums"]["attendance_status"] | null
          student_id: string | null
          tenant_id: string | null
          visit_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_scorer_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      students_scorer_view: {
        Row: {
          id: string | null
          name: string | null
          photo_url: string | null
          player_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          photo_url?: string | null
          player_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          photo_url?: string | null
          player_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants_public_directory: {
        Row: {
          address: string | null
          custom_domain: string | null
          email: string | null
          features: Json | null
          fee_cycle: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          niche: string | null
          phone: string | null
          player_prefix: string | null
          primary_color: string | null
          secondary_color: string | null
          short_name: string | null
          slug: string | null
          status: string | null
          tagline: string | null
          upi_id: string | null
          upi_qr_url: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          custom_domain?: string | null
          email?: string | null
          features?: Json | null
          fee_cycle?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          niche?: string | null
          phone?: string | null
          player_prefix?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          slug?: string | null
          status?: string | null
          tagline?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          custom_domain?: string | null
          email?: string | null
          features?: Json | null
          fee_cycle?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          niche?: string | null
          phone?: string | null
          player_prefix?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          slug?: string | null
          status?: string | null
          tagline?: string | null
          upi_id?: string | null
          upi_qr_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _agg_assert_tenant: { Args: { _tenant_id: string }; Returns: undefined }
      acquire_match_scoring_lock: {
        Args: { _match_id: string }
        Returns: boolean
      }
      advance_lead_stage: {
        Args: { _lead_id: string; _new_stage: string; _remark?: string }
        Returns: string
      }
      approve_registration: {
        Args: { _registration_id: string }
        Returns: string
      }
      archive_notification: { Args: { _id: string }; Returns: undefined }
      attach_payment_ref: {
        Args: { _payment_ref: string; _registration_id: string }
        Returns: undefined
      }
      bulk_approve_registrations: {
        Args: { _ids: string[]; _tenant_id: string }
        Returns: number
      }
      bulk_enqueue_notification_recipients: {
        Args: { _campaign_id: string; _recipient_ids: string[] }
        Returns: number
      }
      bulk_mark_attendance: {
        Args: { _marks: Json; _session_id: string }
        Returns: number
      }
      cancel_campaign: { Args: { _campaign_id: string }; Returns: undefined }
      check_rate_limit: {
        Args: { _key: string; _max_hits: number; _window_seconds: number }
        Returns: boolean
      }
      claim_registration_payment: {
        Args: { p_payment_ref: string; p_registration_id: string }
        Returns: boolean
      }
      compute_player_prefix: { Args: { _tenant_id: string }; Returns: string }
      correct_attendance:
        | {
            Args: {
              _check_in_at: string
              _check_in_meta?: Json
              _check_out_at: string
              _check_out_meta?: Json
              _note?: string
              _original_id: string
              _status: Database["public"]["Enums"]["attendance_status"]
            }
            Returns: string
          }
        | {
            Args: {
              _check_in_at: string
              _check_in_meta?: Json
              _check_out_at: string
              _check_out_meta?: Json
              _note?: string
              _original_id: string
              _status: Database["public"]["Enums"]["attendance_status"]
              _visit_type?: string
            }
            Returns: string
          }
      create_billing_adjustment: {
        Args: {
          _amount: number
          _invoice_id: string
          _kind: string
          _reason: string
        }
        Returns: string
      }
      current_role: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_academy_health: { Args: { _tenant_id: string }; Returns: Json }
      get_academy_records_summary: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      get_ai_report_inputs: {
        Args: { _from?: string; _tenant_id: string; _to?: string }
        Returns: Json
      }
      get_attendance_summary: {
        Args: {
          _batch_id?: string
          _from?: string
          _tenant_id: string
          _to?: string
        }
        Returns: Json
      }
      get_communication_summary: {
        Args: { _from?: string; _tenant_id: string; _to?: string }
        Returns: Json
      }
      get_dashboard_summary: { Args: { _tenant_id: string }; Returns: Json }
      get_finance_summary: {
        Args: { _from?: string; _tenant_id: string; _to?: string }
        Returns: Json
      }
      get_my_student_context: {
        Args: never
        Returns: {
          athlete_profile_id: string
          email: string
          name: string
          photo_url: string
          player_id: string
          student_id: string
          tenant_id: string
        }[]
      }
      get_parent_child_summary: { Args: { _student_id: string }; Returns: Json }
      get_platform_stats: { Args: never; Returns: Json }
      get_points_table: { Args: { _tournament_id: string }; Returns: Json }
      get_public_academy_bundle: { Args: { _slug: string }; Returns: Json }
      get_public_match_bundle: { Args: { _slug: string }; Returns: Json }
      get_registration_summary: {
        Args: { _from?: string; _tenant_id: string; _to?: string }
        Returns: Json
      }
      get_report_admissions: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_report_attendance: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_report_billing: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_report_matches: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_report_players: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_report_website: {
        Args: { _from: string; _tenant_id: string; _to: string }
        Returns: Json
      }
      get_students_summary: { Args: { _tenant_id: string }; Returns: Json }
      get_top_performers: {
        Args: {
          _kind?: string
          _limit?: number
          _tenant_id: string
          _tournament_id?: string
        }
        Returns: Json
      }
      get_tournament_summary: {
        Args: { _tenant_id: string; _tournament_id?: string }
        Returns: Json
      }
      has_profile_role: {
        Args: { _role: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_match_scorer: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
      is_my_child: { Args: { _student_id: string }; Returns: boolean }
      is_my_student: { Args: { _student_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _uid: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
      is_tenant_owner: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
      issue_billing_invoice: { Args: { _invoice_id: string }; Returns: string }
      list_parent_children: {
        Args: never
        Returns: {
          academy_id: string
          is_primary: boolean
          link_id: string
          photo_url: string
          player_id: string
          relationship: string
          student_id: string
          student_name: string
        }[]
      }
      log_platform_action: {
        Args: {
          _action: string
          _after?: Json
          _before?: Json
          _target_id: string
          _target_type: string
          _tenant_id: string
        }
        Returns: string
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: { Args: { _id: string }; Returns: undefined }
      owner_delete_member: { Args: { _profile_id: string }; Returns: undefined }
      owner_delete_student: {
        Args: { _confirm_name: string; _student_id: string }
        Returns: undefined
      }
      platform_delete_tenant: {
        Args: { _confirm_name: string; _tenant_id: string }
        Returns: undefined
      }
      publish_notification:
        | {
            Args: {
              _body?: string
              _category: Database["public"]["Enums"]["notification_category"]
              _channels?: Database["public"]["Enums"]["notification_channel"][]
              _dedupe_key?: string
              _deep_link?: string
              _expires_at?: string
              _payload?: Json
              _priority?: Database["public"]["Enums"]["notification_priority"]
              _recipient_user_id: string
              _tenant_id?: string
              _title: string
              _type: string
            }
            Returns: string
          }
        | {
            Args: {
              _body?: string
              _campaign_id?: string
              _category: Database["public"]["Enums"]["notification_category"]
              _channels?: Database["public"]["Enums"]["notification_channel"][]
              _dedupe_key?: string
              _deep_link?: string
              _expires_at?: string
              _payload?: Json
              _priority?: Database["public"]["Enums"]["notification_priority"]
              _recipient_user_id: string
              _tenant_id?: string
              _title: string
              _type: string
            }
            Returns: string
          }
      record_billing_payment: {
        Args: {
          _allocations: Json
          _amount: number
          _collected_at?: string
          _gateway?: string
          _gateway_reference?: string
          _idempotency_key?: string
          _method: string
          _reference_number?: string
          _remarks?: string
          _status?: string
          _student_id: string
          _tenant_id: string
        }
        Returns: string
      }
      release_match_scoring_lock: {
        Args: { _match_id: string }
        Returns: boolean
      }
      render_template_preview: {
        Args: { _body: string; _title: string; _vars: Json }
        Returns: Json
      }
      schedule_campaign: {
        Args: { _campaign_id: string; _when: string }
        Returns: undefined
      }
      send_campaign: { Args: { _campaign_id: string }; Returns: Json }
      set_tenant_feature: {
        Args: { _enabled: boolean; _key: string; _tenant_id: string }
        Returns: undefined
      }
      slugify: { Args: { _input: string }; Returns: string }
      submit_lead: {
        Args: {
          _message?: string
          _name: string
          _phone: string
          _source?: string
          _tenant_id: string
        }
        Returns: string
      }
      submit_registration: {
        Args: {
          _batch_id?: string
          _dob?: string
          _fee_plan_id: string
          _guardian_name?: string
          _guardian_phone?: string
          _lead_id?: string
          _name: string
          _phone: string
          _policy_acceptances?: Json
          _tenant_id: string
          _whatsapp?: string
        }
        Returns: string
      }
      track_website_event: {
        Args: {
          _event_key?: string
          _event_type: string
          _metadata?: Json
          _slug: string
        }
        Returns: undefined
      }
      unread_notification_count: { Args: never; Returns: number }
      void_billing_invoice: {
        Args: { _invoice_id: string; _reason: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "platform_admin"
        | "student"
        | "coach"
        | "head_coach"
        | "assistant_coach"
        | "staff"
      attendance_source:
        | "manual"
        | "qr"
        | "face"
        | "gps"
        | "nfc"
        | "correction"
        | "auto"
      attendance_status: "present" | "absent" | "late"
      lead_status: "new" | "contacted" | "won" | "lost"
      notification_category:
        | "attendance"
        | "billing"
        | "registration"
        | "match"
        | "coach"
        | "achievement"
        | "system"
      notification_channel: "in_app" | "push" | "email" | "whatsapp"
      notification_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "skipped"
      notification_priority: "low" | "normal" | "high" | "urgent"
      policy_kind:
        | "terms"
        | "privacy"
        | "refund"
        | "fee"
        | "conduct"
        | "leave"
        | "medical"
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
    Enums: {
      app_role: [
        "owner",
        "admin",
        "platform_admin",
        "student",
        "coach",
        "head_coach",
        "assistant_coach",
        "staff",
      ],
      attendance_source: [
        "manual",
        "qr",
        "face",
        "gps",
        "nfc",
        "correction",
        "auto",
      ],
      attendance_status: ["present", "absent", "late"],
      lead_status: ["new", "contacted", "won", "lost"],
      notification_category: [
        "attendance",
        "billing",
        "registration",
        "match",
        "coach",
        "achievement",
        "system",
      ],
      notification_channel: ["in_app", "push", "email", "whatsapp"],
      notification_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "skipped",
      ],
      notification_priority: ["low", "normal", "high", "urgent"],
      policy_kind: [
        "terms",
        "privacy",
        "refund",
        "fee",
        "conduct",
        "leave",
        "medical",
      ],
    },
  },
} as const
