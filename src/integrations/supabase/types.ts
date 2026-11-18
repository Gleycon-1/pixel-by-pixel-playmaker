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
      addresses: {
        Row: {
          cep: string
          city: string
          complement: string | null
          created_at: string
          customer_id: string
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          neighborhood: string | null
          number: string
          reference: string | null
          state: string
          street: string
        }
        Insert: {
          cep: string
          city: string
          complement?: string | null
          created_at?: string
          customer_id: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number: string
          reference?: string | null
          state: string
          street: string
        }
        Update: {
          cep?: string
          city?: string
          complement?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          number?: string
          reference?: string | null
          state?: string
          street?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_config: {
        Row: {
          failed_attempts: number
          id: number
          locked_until: string | null
          password_hash: string
        }
        Insert: {
          failed_attempts?: number
          id?: number
          locked_until?: string | null
          password_hash: string
        }
        Update: {
          failed_attempts?: number
          id?: number
          locked_until?: string | null
          password_hash?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      couriers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          plate: string | null
          whatsapp: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          plate?: string | null
          whatsapp: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          plate?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cashback_cents: number
          created_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          name: string
          phone: string
          pin_hash: string
        }
        Insert: {
          cashback_cents?: number
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          name: string
          phone: string
          pin_hash: string
        }
        Update: {
          cashback_cents?: number
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          name?: string
          phone?: string
          pin_hash?: string
        }
        Relationships: []
      }
      geocode_cache: {
        Row: {
          created_at: string
          lat: number
          lng: number
          query: string
        }
        Insert: {
          created_at?: string
          lat: number
          lng: number
          query: string
        }
        Update: {
          created_at?: string
          lat?: number
          lng?: number
          query?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          id?: string
          name: string
          order_id: string
          product_id?: string | null
          quantity: number
          unit_price_cents: number
        }
        Update: {
          id?: string
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: Json | null
          billed_km: number | null
          cancelled_at: string | null
          card_type: string | null
          cash_change_for_cents: number | null
          cashback_credited: boolean
          cashback_earned_cents: number
          cashback_refunded: boolean
          cashback_used_cents: number
          change_due_cents: number
          code: number
          courier_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_fee_cents: number
          dispatched_at: string | null
          distance_km: number | null
          eta_minutes: number | null
          fulfillment: string
          id: string
          mp_order_id: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string
          pix_qr_base64: string | null
          pix_qr_code: string | null
          source: string
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          address?: Json | null
          billed_km?: number | null
          cancelled_at?: string | null
          card_type?: string | null
          cash_change_for_cents?: number | null
          cashback_credited?: boolean
          cashback_earned_cents?: number
          cashback_refunded?: boolean
          cashback_used_cents?: number
          change_due_cents?: number
          code?: never
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivered_at?: string | null
          delivery_fee_cents?: number
          dispatched_at?: string | null
          distance_km?: number | null
          eta_minutes?: number | null
          fulfillment?: string
          id?: string
          mp_order_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method: string
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          source?: string
          status?: string
          subtotal_cents: number
          total_cents: number
          updated_at?: string
        }
        Update: {
          address?: Json | null
          billed_km?: number | null
          cancelled_at?: string | null
          card_type?: string | null
          cash_change_for_cents?: number | null
          cashback_credited?: boolean
          cashback_earned_cents?: number
          cashback_refunded?: boolean
          cashback_used_cents?: number
          change_due_cents?: number
          code?: never
          courier_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_fee_cents?: number
          dispatched_at?: string | null
          distance_km?: number | null
          eta_minutes?: number | null
          fulfillment?: string
          id?: string
          mp_order_id?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          source?: string
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          barcode: string | null
          category_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          image_url: string | null
          name: string
          position: number
          price_cents: number
          stock: number | null
        }
        Insert: {
          available?: boolean
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name: string
          position?: number
          price_cents: number
          stock?: number | null
        }
        Update: {
          available?: boolean
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          name?: string
          position?: number
          price_cents?: number
          stock?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accept_card: boolean
          accept_cash: boolean
          accept_pix: boolean
          address_text: string | null
          allow_pickup: boolean
          cashback_percent: number
          close_time: string
          eta_minutes: number
          featured_enabled: boolean
          free_delivery_min_cents: number
          google_maps_url: string | null
          id: number
          instagram_url: string | null
          instagram_user: string | null
          limite_km_taxa_fixa: number
          open_time: string
          origin_cep: string
          origin_lat: number | null
          origin_lng: number | null
          pix_test_mode: boolean
          raio_maximo_km: number
          store_mode: string
          store_name: string | null
          store_open: boolean
          tagline: string | null
          updated_at: string
          valor_por_km_adicional_cents: number
          valor_taxa_fixa_cents: number
          whatsapp_display: string | null
          whatsapp_number: string | null
        }
        Insert: {
          accept_card?: boolean
          accept_cash?: boolean
          accept_pix?: boolean
          address_text?: string | null
          allow_pickup?: boolean
          cashback_percent?: number
          close_time?: string
          eta_minutes?: number
          featured_enabled?: boolean
          free_delivery_min_cents?: number
          google_maps_url?: string | null
          id?: number
          instagram_url?: string | null
          instagram_user?: string | null
          limite_km_taxa_fixa?: number
          open_time?: string
          origin_cep?: string
          origin_lat?: number | null
          origin_lng?: number | null
          pix_test_mode?: boolean
          raio_maximo_km?: number
          store_mode?: string
          store_name?: string | null
          store_open?: boolean
          tagline?: string | null
          updated_at?: string
          valor_por_km_adicional_cents?: number
          valor_taxa_fixa_cents?: number
          whatsapp_display?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          accept_card?: boolean
          accept_cash?: boolean
          accept_pix?: boolean
          address_text?: string | null
          allow_pickup?: boolean
          cashback_percent?: number
          close_time?: string
          eta_minutes?: number
          featured_enabled?: boolean
          free_delivery_min_cents?: number
          google_maps_url?: string | null
          id?: number
          instagram_url?: string | null
          instagram_user?: string | null
          limite_km_taxa_fixa?: number
          open_time?: string
          origin_cep?: string
          origin_lat?: number | null
          origin_lng?: number | null
          pix_test_mode?: boolean
          raio_maximo_km?: number
          store_mode?: string
          store_name?: string | null
          store_open?: boolean
          tagline?: string | null
          updated_at?: string
          valor_por_km_adicional_cents?: number
          valor_taxa_fixa_cents?: number
          whatsapp_display?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_stock: { Args: { p_product: string; p_qty: number }; Returns: number }
      adjust_cashback: {
        Args: { p_customer: string; p_delta: number }
        Returns: number
      }
      admin_set_password: { Args: { p_password: string }; Returns: undefined }
      admin_verify_password: { Args: { p_password: string }; Returns: Json }
      customer_register: {
        Args: { p_name: string; p_phone: string; p_pin: string }
        Returns: string
      }
      customer_verify_pin: {
        Args: { p_phone: string; p_pin: string }
        Returns: Json
      }
      decrement_stock: {
        Args: { p_product: string; p_qty: number }
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
