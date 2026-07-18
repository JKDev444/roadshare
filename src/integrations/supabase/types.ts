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
      clauses: {
        Row: {
          ai_confidence: number | null
          ai_suggested_category:
            | Database["public"]["Enums"]["clause_category"]
            | null
          ai_summary: string | null
          category: Database["public"]["Enums"]["clause_category"]
          clause_text: string
          community_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          created_by: string | null
          document_id: string | null
          effective_date: string | null
          id: string
          source: string | null
          status: Database["public"]["Enums"]["clause_status"]
          supersedes_id: string | null
          title: string
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["clause_category"]
            | null
          ai_summary?: string | null
          category?: Database["public"]["Enums"]["clause_category"]
          clause_text?: string
          community_id: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["clause_status"]
          supersedes_id?: string | null
          title: string
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["clause_category"]
            | null
          ai_summary?: string | null
          category?: Database["public"]["Enums"]["clause_category"]
          clause_text?: string
          community_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          effective_date?: string | null
          id?: string
          source?: string | null
          status?: Database["public"]["Enums"]["clause_status"]
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clauses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clauses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clauses_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "clauses"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decision_votes: {
        Row: {
          choice: string
          comment: string | null
          community_id: string
          created_at: string
          decision_id: string
          household_label: string
          id: string
        }
        Insert: {
          choice: string
          comment?: string | null
          community_id: string
          created_at?: string
          decision_id: string
          household_label: string
          id?: string
        }
        Update: {
          choice?: string
          comment?: string | null
          community_id?: string
          created_at?: string
          decision_id?: string
          household_label?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_votes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decision_votes_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          description: string | null
          evidence: Json
          id: string
          notice_date: string | null
          options: Json
          outcome: string | null
          question: string | null
          quorum: number
          rationale: string | null
          rationale_version: number
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          evidence?: Json
          id?: string
          notice_date?: string | null
          options?: Json
          outcome?: string | null
          question?: string | null
          quorum?: number
          rationale?: string | null
          rationale_version?: number
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          description?: string | null
          evidence?: Json
          id?: string
          notice_date?: string | null
          options?: Json
          outcome?: string | null
          question?: string | null
          quorum?: number
          rationale?: string | null
          rationale_version?: number
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_confidence: number | null
          ai_suggested_type: Database["public"]["Enums"]["doc_type"] | null
          ai_summary: string | null
          community_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"] | null
          effective_date: string | null
          extracted_text: string | null
          file_path: string
          id: string
          mime_type: string | null
          notes: string | null
          owner_id: string
          size_bytes: number | null
          source: string | null
          status: Database["public"]["Enums"]["doc_status"]
          title: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_suggested_type?: Database["public"]["Enums"]["doc_type"] | null
          ai_summary?: string | null
          community_id: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"] | null
          effective_date?: string | null
          extracted_text?: string | null
          file_path: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          owner_id?: string
          size_bytes?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          title: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_suggested_type?: Database["public"]["Enums"]["doc_type"] | null
          ai_summary?: string | null
          community_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"] | null
          effective_date?: string | null
          extracted_text?: string | null
          file_path?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          owner_id?: string
          size_bytes?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          title?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_jobs: {
        Row: {
          document_paths: string[]
          error_message: string | null
          filenames: string[]
          finished_at: string | null
          id: string
          progress: number
          result: Json | null
          stage: string | null
          stage_index: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          document_paths?: string[]
          error_message?: string | null
          filenames?: string[]
          finished_at?: string | null
          id?: string
          progress?: number
          result?: Json | null
          stage?: string | null
          stage_index?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          document_paths?: string[]
          error_message?: string | null
          filenames?: string[]
          finished_at?: string | null
          id?: string
          progress?: number
          result?: Json | null
          stage?: string | null
          stage_index?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_state: {
        Row: {
          checklist_dismissed: boolean
          created_at: string
          dismissed_hints: string[]
          report_generated: boolean
          updated_at: string
          user_id: string
          wizard_completed: boolean
          wizard_skipped: boolean
        }
        Insert: {
          checklist_dismissed?: boolean
          created_at?: string
          dismissed_hints?: string[]
          report_generated?: boolean
          updated_at?: string
          user_id: string
          wizard_completed?: boolean
          wizard_skipped?: boolean
        }
        Update: {
          checklist_dismissed?: boolean
          created_at?: string
          dismissed_hints?: string[]
          report_generated?: boolean
          updated_at?: string
          user_id?: string
          wizard_completed?: boolean
          wizard_skipped?: boolean
        }
        Relationships: []
      }
      parcels: {
        Row: {
          address: string | null
          area_sqft: number | null
          community_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          effective_date: string | null
          frontage_ft: number | null
          geojson: Json | null
          id: string
          label: string
          lat: number | null
          lng: number | null
          owner_id: string
          owner_name: string | null
          pos_x: number
          pos_y: number
          source: string | null
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          address?: string | null
          area_sqft?: number | null
          community_id: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          effective_date?: string | null
          frontage_ft?: number | null
          geojson?: Json | null
          id?: string
          label: string
          lat?: number | null
          lng?: number | null
          owner_id?: string
          owner_name?: string | null
          pos_x?: number
          pos_y?: number
          source?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          address?: string | null
          area_sqft?: number | null
          community_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          effective_date?: string | null
          frontage_ft?: number | null
          geojson?: Json | null
          id?: string
          label?: string
          lat?: number | null
          lng?: number | null
          owner_id?: string
          owner_name?: string | null
          pos_x?: number
          pos_y?: number
          source?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "parcels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          organization?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_allocations: {
        Row: {
          benefits: boolean
          created_at: string
          id: string
          override_amount: number | null
          owner_id: string
          parcel_id: string
          project_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          benefits?: boolean
          created_at?: string
          id?: string
          override_amount?: number | null
          owner_id?: string
          parcel_id: string
          project_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          benefits?: boolean
          created_at?: string
          id?: string
          override_amount?: number | null
          owner_id?: string
          parcel_id?: string
          project_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_allocations_parcel_id_fkey"
            columns: ["parcel_id"]
            isOneToOne: false
            referencedRelation: "parcels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_line_items: {
        Row: {
          amount: number
          category: string | null
          contractor: string | null
          created_at: string
          id: string
          is_bid: boolean
          label: string
          owner_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          contractor?: string | null
          created_at?: string
          id?: string
          is_bid?: boolean
          label: string
          owner_id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          contractor?: string | null
          created_at?: string
          id?: string
          is_bid?: boolean
          label?: string
          owner_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_scenarios: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          owner_id: string
          project_id: string
          summary: Json
          updated_at: string
          version: number
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          project_id: string
          summary?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          project_id?: string
          summary?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          allocation_method: Database["public"]["Enums"]["allocation_method"]
          base_amount: number
          community_id: string
          contingency_pct: number
          created_at: string
          description: string | null
          entrance_x: number | null
          entrance_y: number | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          reserve_target: number
          status: Database["public"]["Enums"]["project_status"]
          total_cost: number
          updated_at: string
        }
        Insert: {
          allocation_method?: Database["public"]["Enums"]["allocation_method"]
          base_amount?: number
          community_id: string
          contingency_pct?: number
          created_at?: string
          description?: string | null
          entrance_x?: number | null
          entrance_y?: number | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          reserve_target?: number
          status?: Database["public"]["Enums"]["project_status"]
          total_cost?: number
          updated_at?: string
        }
        Update: {
          allocation_method?: Database["public"]["Enums"]["allocation_method"]
          base_amount?: number
          community_id?: string
          contingency_pct?: number
          created_at?: string
          description?: string | null
          entrance_x?: number | null
          entrance_y?: number | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          reserve_target?: number
          status?: Database["public"]["Enums"]["project_status"]
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_answers: {
        Row: {
          abstained: boolean
          answer: string
          citations: Json
          community_id: string
          confidence: number
          created_at: string
          created_by: string | null
          high_risk: boolean
          id: string
          question: string
          risk_reason: string | null
          updated_at: string
        }
        Insert: {
          abstained?: boolean
          answer?: string
          citations?: Json
          community_id: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          high_risk?: boolean
          id?: string
          question: string
          risk_reason?: string | null
          updated_at?: string
        }
        Update: {
          abstained?: boolean
          answer?: string
          citations?: Json
          community_id?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          high_risk?: boolean
          id?: string
          question?: string
          risk_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_answers_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      record_events: {
        Row: {
          action: string
          community_id: string
          created_at: string
          entity_label: string | null
          entity_type: string
          id: string
          note: string | null
          owner_id: string
        }
        Insert: {
          action: string
          community_id: string
          created_at?: string
          entity_label?: string | null
          entity_type: string
          id?: string
          note?: string | null
          owner_id?: string
        }
        Update: {
          action?: string
          community_id?: string
          created_at?: string
          entity_label?: string | null
          entity_type?: string
          id?: string
          note?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      road_segments: {
        Row: {
          community_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          geometry: Json
          id: string
          length_ft: number | null
          name: string
          owner_id: string
          responsibility: string
          source: string | null
          surface: string | null
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          community_id: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          geometry?: Json
          id?: string
          length_ft?: number | null
          name: string
          owner_id?: string
          responsibility?: string
          source?: string | null
          surface?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          community_id?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          geometry?: Json
          id?: string
          length_ft?: number | null
          name?: string
          owner_id?: string
          responsibility?: string
          source?: string | null
          surface?: string | null
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "road_segments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          community_id: string
          created_at: string
          household_label: string
          id: string
          survey_id: string
        }
        Insert: {
          answers?: Json
          community_id: string
          created_at?: string
          household_label: string
          id?: string
          survey_id: string
        }
        Update: {
          answers?: Json
          community_id?: string
          created_at?: string
          household_label?: string
          id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          community_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_report_threshold: number
          questions: Json
          status: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at: string
        }
        Insert: {
          community_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_report_threshold?: number
          questions?: Json
          status?: Database["public"]["Enums"]["survey_status"]
          title: string
          updated_at?: string
        }
        Update: {
          community_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_report_threshold?: number
          questions?: Json
          status?: Database["public"]["Enums"]["survey_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      allocation_method:
        | "equal"
        | "frontage"
        | "area"
        | "segment_benefit"
        | "base_plus_use"
        | "custom"
        | "distance"
      app_role: "admin" | "member"
      clause_category:
        | "maintenance_responsibility"
        | "cost_sharing"
        | "access_rights"
        | "easement"
        | "use_restriction"
        | "enforcement"
        | "dispute_resolution"
        | "amendment_process"
        | "insurance"
        | "other"
      clause_status: "proposed" | "active" | "superseded" | "void"
      confidence_level: "high" | "medium" | "low"
      decision_status:
        | "draft"
        | "discussion"
        | "voting"
        | "decided"
        | "withdrawn"
      doc_status: "processing" | "needs_review" | "verified" | "rejected"
      doc_type:
        | "deed"
        | "plat"
        | "agreement"
        | "amendment"
        | "bylaws"
        | "bid"
        | "invoice"
        | "correspondence"
        | "other"
      project_status: "planning" | "bidding" | "funded" | "complete"
      survey_status: "draft" | "open" | "closed"
      verification_status: "verified" | "unverified" | "disputed"
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
      allocation_method: [
        "equal",
        "frontage",
        "area",
        "segment_benefit",
        "base_plus_use",
        "custom",
        "distance",
      ],
      app_role: ["admin", "member"],
      clause_category: [
        "maintenance_responsibility",
        "cost_sharing",
        "access_rights",
        "easement",
        "use_restriction",
        "enforcement",
        "dispute_resolution",
        "amendment_process",
        "insurance",
        "other",
      ],
      clause_status: ["proposed", "active", "superseded", "void"],
      confidence_level: ["high", "medium", "low"],
      decision_status: [
        "draft",
        "discussion",
        "voting",
        "decided",
        "withdrawn",
      ],
      doc_status: ["processing", "needs_review", "verified", "rejected"],
      doc_type: [
        "deed",
        "plat",
        "agreement",
        "amendment",
        "bylaws",
        "bid",
        "invoice",
        "correspondence",
        "other",
      ],
      project_status: ["planning", "bidding", "funded", "complete"],
      survey_status: ["draft", "open", "closed"],
      verification_status: ["verified", "unverified", "disputed"],
    },
  },
} as const
