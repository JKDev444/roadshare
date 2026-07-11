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
      parcels: {
        Row: {
          address: string | null
          area_sqft: number | null
          community_id: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          effective_date: string | null
          frontage_ft: number | null
          id: string
          label: string
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
          id?: string
          label: string
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
          id?: string
          label?: string
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
      confidence_level: "high" | "medium" | "low"
      project_status: "planning" | "bidding" | "funded" | "complete"
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
      confidence_level: ["high", "medium", "low"],
      project_status: ["planning", "bidding", "funded", "complete"],
      verification_status: ["verified", "unverified", "disputed"],
    },
  },
} as const
