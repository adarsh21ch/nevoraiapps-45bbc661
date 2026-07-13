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
      attendance_marks: {
        Row: {
          created_at: string
          id: string
          note: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          tenant_id?: string
          updated_at?: string
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
            foreignKeyName: "attendance_marks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
        ]
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
      leads: {
        Row: {
          created_at: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "mc_athlete_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          id: string
          match_format: string
          match_locked: boolean
          match_type: string
          notes: string | null
          overs: number
          pitch: string | null
          player_of_match_athlete_id: string | null
          result: string | null
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
          id?: string
          match_format?: string
          match_locked?: boolean
          match_type?: string
          notes?: string | null
          overs?: number
          pitch?: string | null
          player_of_match_athlete_id?: string | null
          result?: string | null
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
          id?: string
          match_format?: string
          match_locked?: boolean
          match_type?: string
          notes?: string | null
          overs?: number
          pitch?: string | null
          player_of_match_athlete_id?: string | null
          result?: string | null
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
            foreignKeyName: "mc_teams_keeper_student_id_fkey"
            columns: ["keeper_student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
            foreignKeyName: "mc_teams_vice_captain_student_id_fkey"
            columns: ["vice_captain_student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
            foreignKeyName: "reminder_logs_tenant_id_fkey"
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
          address: string | null
          batch_id: string | null
          created_at: string
          custom_fee: number | null
          dob: string | null
          fee_plan_id: string | null
          gender: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          joined_at: string
          name: string
          notes: string | null
          phone: string
          photo_url: string | null
          player_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          custom_fee?: number | null
          dob?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          joined_at?: string
          name: string
          notes?: string | null
          phone: string
          photo_url?: string | null
          player_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          custom_fee?: number | null
          dob?: string | null
          fee_plan_id?: string | null
          gender?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          joined_at?: string
          name?: string
          notes?: string | null
          phone?: string
          photo_url?: string | null
          player_id?: string | null
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
          player_prefix: string | null
          primary_color: string
          secondary_color: string
          setup_fee: number
          short_name: string | null
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
          player_prefix?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          short_name?: string | null
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
          player_prefix?: string | null
          primary_color?: string
          secondary_color?: string
          setup_fee?: number
          short_name?: string | null
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
      claim_registration_payment: {
        Args: { p_payment_ref: string; p_registration_id: string }
        Returns: boolean
      }
      compute_player_prefix: { Args: { _tenant_id: string }; Returns: string }
      is_platform_admin: { Args: { _uid: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant: string; _uid: string }
        Returns: boolean
      }
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
          _name: string
          _phone: string
          _tenant_id: string
          _whatsapp?: string
        }
        Returns: string
      }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late"
      lead_status: "new" | "contacted" | "won" | "lost"
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
      attendance_status: ["present", "absent", "late"],
      lead_status: ["new", "contacted", "won", "lost"],
    },
  },
} as const
