// Generado desde Supabase live: no editar a mano.
// Actualizar con: npx supabase gen types --linked --lang typescript --schema public

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
      account_invites: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          kind: string
          target_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          kind: string
          target_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          kind?: string
          target_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          added_at: string
          conversation_id: string
          display_name: string | null
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          added_at?: string
          conversation_id: string
          display_name?: string | null
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          added_at?: string
          conversation_id?: string
          display_name?: string | null
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string
          order_id: string | null
          subject: string | null
          subject_order_title: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          order_id?: string | null
          subject?: string | null
          subject_order_title?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          order_id?: string | null
          subject?: string | null
          subject_order_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          lng: number | null
          neighborhood: string | null
          postal_code: string | null
        }
        Insert: {
          address_line: string
          city?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          postal_code?: string | null
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          neighborhood?: string | null
          postal_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_admin_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_admin_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_admin_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_order_drafts: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          payload: Json
          payment_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payload: Json
          payment_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payload?: Json
          payment_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_order_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_order_drafts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          created_at: string
          customer_number: number
          email: string
          id: string
          name: string
          neighborhood: string
          notes: string | null
          phone: string
          profile_id: string | null
          province: string | null
        }
        Insert: {
          address?: string
          created_at?: string
          customer_number?: number
          email?: string
          id?: string
          name: string
          neighborhood?: string
          notes?: string | null
          phone?: string
          profile_id?: string | null
          province?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          customer_number?: number
          email?: string
          id?: string
          name?: string
          neighborhood?: string
          notes?: string | null
          phone?: string
          profile_id?: string | null
          province?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_checkout_drafts: {
        Row: {
          amount: number
          created_at: string
          guest_access_token: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          payload: Json
          payment_type: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          guest_access_token?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payload: Json
          payment_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          guest_access_token?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          payload?: Json
          payment_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: Database["public"]["Enums"]["material_category"]
          cost_estimate: number
          created_at: string
          id: string
          name: string
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["material_category"]
          cost_estimate?: number
          created_at?: string
          id?: string
          name: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["material_category"]
          cost_estimate?: number
          created_at?: string
          id?: string
          name?: string
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          profile_id: string
          read_at: string
        }
        Insert: {
          id?: string
          message_id: string
          profile_id: string
          read_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          profile_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_internal: boolean
          sender_id: string | null
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id?: string | null
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_id?: string | null
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          priority: string
          read_at: string | null
          recipient_profile_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string
          read_at?: string | null
          recipient_profile_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: string
          read_at?: string | null
          recipient_profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          label: string
          order_id: string
          sort_order: number
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          label: string
          order_id: string
          sort_order?: number
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          label?: string
          order_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_checklist_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_diagnosis_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          order_id: string
          quote_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          order_id: string
          quote_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          order_id?: string
          quote_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_diagnosis_photos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_diagnosis_photos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          author: string
          created_at: string
          description: string
          id: string
          order_id: string
          type: Database["public"]["Enums"]["order_event_type"]
        }
        Insert: {
          author?: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          type: Database["public"]["Enums"]["order_event_type"]
        }
        Update: {
          author?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          type?: Database["public"]["Enums"]["order_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_materials_used: {
        Row: {
          added_at: string
          id: string
          material_id: string | null
          material_name: string
          note: string | null
          order_id: string
          quantity: number
          unit: string
        }
        Insert: {
          added_at?: string
          id?: string
          material_id?: string | null
          material_name: string
          note?: string | null
          order_id: string
          quantity: number
          unit?: string
        }
        Update: {
          added_at?: string
          id?: string
          material_id?: string | null
          material_name?: string
          note?: string | null
          order_id?: string
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_materials_used_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_materials_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author: string
          created_at: string
          id: string
          order_id: string
          text: string
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          order_id: string
          text: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          order_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quote_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          id: string
          item_type: string
          notes: string | null
          quantity: number
          quote_id: string
          service_id: string | null
          sort_order: number
          subtotal: number | null
          unit: string
          unit_price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description: string
          id?: string
          item_type: string
          notes?: string | null
          quantity?: number
          quote_id: string
          service_id?: string | null
          sort_order?: number
          subtotal?: number | null
          unit?: string
          unit_price: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          notes?: string | null
          quantity?: number
          quote_id?: string
          service_id?: string | null
          sort_order?: number
          subtotal?: number | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_quote_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          order_id: string
          rejected_at: string | null
          remaining_amount: number
          sent_at: string | null
          status: string
          subtotal_labor: number
          subtotal_materials: number
          total_amount: number
          updated_at: string
          valid_until: string | null
          version: number
          visit_deposit_credit: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          order_id: string
          rejected_at?: string | null
          remaining_amount?: number
          sent_at?: string | null
          status?: string
          subtotal_labor?: number
          subtotal_materials?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          version: number
          visit_deposit_credit?: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          order_id?: string
          rejected_at?: string | null
          remaining_amount?: number
          sent_at?: string | null
          status?: string
          subtotal_labor?: number
          subtotal_materials?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
          visit_deposit_credit?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_signatures: {
        Row: {
          comments: string | null
          id: string
          order_id: string
          signature_data_url: string
          signed_at: string
          signer_name: string
        }
        Insert: {
          comments?: string | null
          id?: string
          order_id: string
          signature_data_url: string
          signed_at?: string
          signer_name: string
        }
        Update: {
          comments?: string | null
          id?: string
          order_id?: string
          signature_data_url?: string
          signed_at?: string
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_signatures_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_time_logs: {
        Row: {
          created_at: string
          id: string
          minutes: number
          note: string
          order_id: string
          technician_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          minutes: number
          note?: string
          order_id: string
          technician_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          minutes?: number
          note?: string
          order_id?: string
          technician_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_time_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          mp_fee_amount: number
          mp_installments: number | null
          mp_payment_id: string | null
          mp_payment_method: string | null
          mp_preference_id: string | null
          order_id: string
          paid_at: string | null
          payment_type: string
          provider: string
          provider_payload: Json | null
          quote_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          mp_fee_amount?: number
          mp_installments?: number | null
          mp_payment_id?: string | null
          mp_payment_method?: string | null
          mp_preference_id?: string | null
          order_id: string
          paid_at?: string | null
          payment_type: string
          provider?: string
          provider_payload?: Json | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          mp_fee_amount?: number
          mp_installments?: number | null
          mp_payment_id?: string | null
          mp_payment_method?: string | null
          mp_preference_id?: string | null
          order_id?: string
          paid_at?: string | null
          payment_type?: string
          provider?: string
          provider_payload?: Json | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "order_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      price_adjustments_log: {
        Row: {
          applied_at: string
          applied_by: string | null
          category_filter: string | null
          id: string
          percentage: number
          rounding_mode: string
          services_affected: number
        }
        Insert: {
          applied_at?: string
          applied_by?: string | null
          category_filter?: string | null
          id?: string
          percentage: number
          rounding_mode: string
          services_affected?: number
        }
        Update: {
          applied_at?: string
          applied_by?: string | null
          category_filter?: string | null
          id?: string
          percentage?: number
          rounding_mode?: string
          services_affected?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_adjustments_log_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_text: string | null
          avatar_url: string | null
          created_at: string
          customer_id: string | null
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_text?: string | null
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_text?: string | null
          avatar_url?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      rubro_matricula_config: {
        Row: {
          display_name: string
          id: string
          requires_matricula: boolean
          rubro_key: string
          updated_at: string
        }
        Insert: {
          display_name: string
          id?: string
          requires_matricula?: boolean
          rubro_key: string
          updated_at?: string
        }
        Update: {
          display_name?: string
          id?: string
          requires_matricula?: boolean
          rubro_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean
          materials_included: boolean
          name: string
          rubro_id: string
          slug: string
          sort_order: number
          unit: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          materials_included?: boolean
          name: string
          rubro_id: string
          slug: string
          sort_order?: number
          unit?: string
          unit_type?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean
          materials_included?: boolean
          name?: string
          rubro_id?: string
          slug?: string
          sort_order?: number
          unit?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "service_rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          admin_exception_closed_at: string | null
          admin_exception_closed_by: string | null
          admin_exception_reason: string | null
          admin_incident_opened_at: string | null
          admin_incident_opened_by: string | null
          admin_incident_reason: string | null
          admin_incident_resolved_at: string | null
          admin_incident_resolved_by: string | null
          admin_incident_status: string
          archived_at: string | null
          assigned_technician_id: string | null
          assigned_technician_name: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          client_address: string
          client_address_id: string | null
          client_city: string | null
          client_lat: number | null
          client_lng: number | null
          client_name: string
          client_neighborhood: string
          client_phone: string
          client_postal_code: string | null
          client_province: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          declined_technician_ids: string[]
          description: string
          extra_amount: number
          fixed_price_quantity: number | null
          fixed_price_service_id: string | null
          guest_access_token: string | null
          hidden_from_customer_at: string | null
          id: string
          pause_reason: string | null
          payment_status: string
          priority: Database["public"]["Enums"]["order_priority"]
          quote_status: string
          scheduled_date: string
          service_status: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["order_status"]
          technician_response_due_at: string | null
          technician_response_status: string
          title: string
          total_paid_amount: number
          total_quoted_amount: number
          visit_deposit_amount: number
          work_elapsed_seconds: number
          work_mode: string
          work_started_at: string | null
        }
        Insert: {
          admin_exception_closed_at?: string | null
          admin_exception_closed_by?: string | null
          admin_exception_reason?: string | null
          admin_incident_opened_at?: string | null
          admin_incident_opened_by?: string | null
          admin_incident_reason?: string | null
          admin_incident_resolved_at?: string | null
          admin_incident_resolved_by?: string | null
          admin_incident_status?: string
          archived_at?: string | null
          assigned_technician_id?: string | null
          assigned_technician_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_address?: string
          client_address_id?: string | null
          client_city?: string | null
          client_lat?: number | null
          client_lng?: number | null
          client_name: string
          client_neighborhood?: string
          client_phone?: string
          client_postal_code?: string | null
          client_province?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          declined_technician_ids?: string[]
          description?: string
          extra_amount?: number
          fixed_price_quantity?: number | null
          fixed_price_service_id?: string | null
          guest_access_token?: string | null
          hidden_from_customer_at?: string | null
          id?: string
          pause_reason?: string | null
          payment_status?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          quote_status?: string
          scheduled_date: string
          service_status: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          technician_response_due_at?: string | null
          technician_response_status?: string
          title: string
          total_paid_amount?: number
          total_quoted_amount?: number
          visit_deposit_amount?: number
          work_elapsed_seconds?: number
          work_mode?: string
          work_started_at?: string | null
        }
        Update: {
          admin_exception_closed_at?: string | null
          admin_exception_closed_by?: string | null
          admin_exception_reason?: string | null
          admin_incident_opened_at?: string | null
          admin_incident_opened_by?: string | null
          admin_incident_reason?: string | null
          admin_incident_resolved_at?: string | null
          admin_incident_resolved_by?: string | null
          admin_incident_status?: string
          archived_at?: string | null
          assigned_technician_id?: string | null
          assigned_technician_name?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          client_address?: string
          client_address_id?: string | null
          client_city?: string | null
          client_lat?: number | null
          client_lng?: number | null
          client_name?: string
          client_neighborhood?: string
          client_phone?: string
          client_postal_code?: string | null
          client_province?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          declined_technician_ids?: string[]
          description?: string
          extra_amount?: number
          fixed_price_quantity?: number | null
          fixed_price_service_id?: string | null
          guest_access_token?: string | null
          hidden_from_customer_at?: string | null
          id?: string
          pause_reason?: string | null
          payment_status?: string
          priority?: Database["public"]["Enums"]["order_priority"]
          quote_status?: string
          scheduled_date?: string
          service_status?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["order_status"]
          technician_response_due_at?: string | null
          technician_response_status?: string
          title?: string
          total_paid_amount?: number
          total_quoted_amount?: number
          visit_deposit_amount?: number
          work_elapsed_seconds?: number
          work_mode?: string
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_admin_exception_closed_by_fkey"
            columns: ["admin_exception_closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_admin_incident_opened_by_fkey"
            columns: ["admin_incident_opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_admin_incident_resolved_by_fkey"
            columns: ["admin_incident_resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_client_address_id_fkey"
            columns: ["client_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_fixed_price_service_id_fkey"
            columns: ["fixed_price_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_rubros: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
          visit_deposit: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
          visit_deposit?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
          visit_deposit?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string
          category_id: string | null
          created_at: string
          description: string
          estimated_duration_minutes: number
          features: string[]
          id: string
          name: string
          price: number
          subcategoria: string | null
          subcategory_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string
          estimated_duration_minutes?: number
          features?: string[]
          id?: string
          name: string
          price?: number
          subcategoria?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          category_id?: string | null
          created_at?: string
          description?: string
          estimated_duration_minutes?: number
          features?: string[]
          id?: string
          name?: string
          price?: number
          subcategoria?: string | null
          subcategory_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_case_history: {
        Row: {
          case_id: string
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_value: string | null
          notes: string | null
          previous_value: string | null
        }
        Insert: {
          case_id: string
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          previous_value?: string | null
        }
        Update: {
          case_id?: string
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_case_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_case_messages: {
        Row: {
          case_id: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_internal: boolean
          message: string
          sender_type: string
        }
        Insert: {
          case_id: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          message: string
          sender_type?: string
        }
        Update: {
          case_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_internal?: boolean
          message?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "support_cases_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_case_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          case_number: string | null
          case_type: string
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          description: string | null
          id: string
          opened_at: string
          opened_by: string | null
          order_id: string | null
          priority: string
          resolution_amount: number | null
          resolution_notes: string | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          settlement_id: string | null
          settlement_paused: boolean
          status: string
          subject: string
          technician_id: string | null
          technician_name: string | null
          updated_at: string
        }
        Insert: {
          case_number?: string | null
          case_type: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          order_id?: string | null
          priority?: string
          resolution_amount?: number | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          settlement_paused?: boolean
          status?: string
          subject: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Update: {
          case_number?: string | null
          case_type?: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          order_id?: string | null
          priority?: string
          resolution_amount?: number | null
          resolution_notes?: string | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          settlement_id?: string | null
          settlement_paused?: boolean
          status?: string
          subject?: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          value_type: string
          version: number
          visibility: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          value_type?: string
          version?: number
          visibility?: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          value_type?: string
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          key: string
          new_value: Json | null
          old_value: Json | null
          version: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key: string
          new_value?: Json | null
          old_value?: Json | null
          version: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key?: string
          new_value?: Json | null
          old_value?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_applications: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          specialty: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_coverage_areas: {
        Row: {
          city: string
          created_at: string
          id: string
          province: string
          technician_id: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          province: string
          technician_id: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          province?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_coverage_areas_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_coverage_areas_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_documents: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_current: boolean
          issued_at: string | null
          issuer_name: string | null
          label: string
          storage_path: string
          technician_id: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string
          version: number
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_current?: boolean
          issued_at?: string | null
          issuer_name?: string | null
          label: string
          storage_path: string
          technician_id: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
          version?: number
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_current?: boolean
          issued_at?: string | null
          issuer_name?: string | null
          label?: string
          storage_path?: string
          technician_id?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "technician_documents_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_documents_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_documents_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_enablement_checklist: {
        Row: {
          identity_verified: boolean
          is_ready: boolean
          payment_account_valid: boolean
          professional_license_valid: boolean
          profile_complete: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          tax_document_approved: boolean
          technician_id: string
          updated_at: string
        }
        Insert: {
          identity_verified?: boolean
          is_ready?: boolean
          payment_account_valid?: boolean
          professional_license_valid?: boolean
          profile_complete?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          tax_document_approved?: boolean
          technician_id: string
          updated_at?: string
        }
        Update: {
          identity_verified?: boolean
          is_ready?: boolean
          payment_account_valid?: boolean
          professional_license_valid?: boolean
          profile_complete?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          tax_document_approved?: boolean
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_enablement_checklist_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_enablement_checklist_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_enablement_checklist_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_goals: {
        Row: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          target_amount: number | null
          target_count: number | null
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          goal_type: string
          id?: string
          is_active?: boolean
          target_amount?: number | null
          target_count?: number | null
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          goal_type?: string
          id?: string
          is_active?: boolean
          target_amount?: number | null
          target_count?: number | null
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_goals_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_goals_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_matriculas: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          issuing_entity: string
          license_number: string
          specialty: string | null
          technician_id: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issuing_entity: string
          license_number: string
          specialty?: string | null
          technician_id: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issuing_entity?: string
          license_number?: string
          specialty?: string | null
          technician_id?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_matriculas_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_matriculas_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_matriculas_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          read_at: string | null
          technician_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message: string
          read_at?: string | null
          technician_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          read_at?: string | null
          technician_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_notifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_notifications_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_payment_accounts: {
        Row: {
          account_holder: string
          alias: string | null
          cbu_cvu: string
          id: string
          provider: string
          technician_id: string
          updated_at: string
          validation_notes: string | null
          validation_status: string
        }
        Insert: {
          account_holder: string
          alias?: string | null
          cbu_cvu: string
          id?: string
          provider?: string
          technician_id: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string
        }
        Update: {
          account_holder?: string
          alias?: string | null
          cbu_cvu?: string
          id?: string
          provider?: string
          technician_id?: string
          updated_at?: string
          validation_notes?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_payment_accounts_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payment_accounts_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: true
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_payout_batch_audit: {
        Row: {
          action: string
          batch_id: string
          created_at: string
          detail: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          batch_id: string
          created_at?: string
          detail?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          batch_id?: string
          created_at?: string
          detail?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_payout_batch_audit_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "technician_payout_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_payout_batches: {
        Row: {
          admin_notes: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          destination_last4: string | null
          id: string
          receipt_uploaded_at: string | null
          receipt_url: string | null
          scheduled_date: string | null
          settlement_count: number
          status: string
          technician_id: string
          total_amount: number
          transfer_method: string | null
          transfer_reference: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          destination_last4?: string | null
          id?: string
          receipt_uploaded_at?: string | null
          receipt_url?: string | null
          scheduled_date?: string | null
          settlement_count: number
          status?: string
          technician_id: string
          total_amount: number
          transfer_method?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          destination_last4?: string | null
          id?: string
          receipt_uploaded_at?: string | null
          receipt_url?: string | null
          scheduled_date?: string | null
          settlement_count?: number
          status?: string
          technician_id?: string
          total_amount?: number
          transfer_method?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_payout_batches_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payout_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payout_batches_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_payout_batches_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_requirements: {
        Row: {
          id: string
          is_required: boolean
          requirement_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_required?: boolean
          requirement_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_required?: boolean
          requirement_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_requirements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_requirements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_requirements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_review_history: {
        Row: {
          action: string
          created_at: string
          id: string
          reason: string | null
          requirement_type: string | null
          reviewed_by: string | null
          technician_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          reason?: string | null
          requirement_type?: string | null
          reviewed_by?: string | null
          technician_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          reason?: string | null
          requirement_type?: string | null
          reviewed_by?: string | null
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_review_history_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_review_history_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_review_history_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_settlements: {
        Row: {
          admin_notes: string | null
          created_at: string
          dispute_reason: string | null
          gross_amount: number
          id: string
          net_amount: number
          order_id: string
          paid_at: string | null
          payment_fee_amount: number
          payment_transaction_id: string | null
          payout_batch_id: string | null
          platform_commission_amount: number
          receipt_url: string | null
          release_at: string | null
          release_date: string | null
          released_at: string | null
          resolved_at: string | null
          scheduled_date: string | null
          settlement_type: string
          status: string
          technician_id: string
          transfer_reference: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          dispute_reason?: string | null
          gross_amount: number
          id?: string
          net_amount: number
          order_id: string
          paid_at?: string | null
          payment_fee_amount: number
          payment_transaction_id?: string | null
          payout_batch_id?: string | null
          platform_commission_amount: number
          receipt_url?: string | null
          release_at?: string | null
          release_date?: string | null
          released_at?: string | null
          resolved_at?: string | null
          scheduled_date?: string | null
          settlement_type: string
          status?: string
          technician_id: string
          transfer_reference?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          dispute_reason?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          order_id?: string
          paid_at?: string | null
          payment_fee_amount?: number
          payment_transaction_id?: string | null
          payout_batch_id?: string | null
          platform_commission_amount?: number
          receipt_url?: string | null
          release_at?: string | null
          release_date?: string | null
          released_at?: string | null
          resolved_at?: string | null
          scheduled_date?: string | null
          settlement_type?: string
          status?: string
          technician_id?: string
          transfer_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_payment_transaction_id_fkey"
            columns: ["payment_transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "technician_payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_specialties: {
        Row: {
          category_id: string
          created_at: string
          technician_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          technician_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_specialties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_specialties_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_specialties_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          active_orders_count: number
          address: string
          avatar_bg: string
          bio: string | null
          can_receive_orders: boolean
          completed_orders_count: number
          created_at: string
          degree_title: string | null
          education_level: string | null
          email: string
          id: string
          institution_name: string | null
          is_enabled: boolean
          name: string
          phone: string
          profile_id: string | null
          province: string
          public_avatar_path: string | null
          rating: number
          specialty: string
          technician_number: number
          validated_at: string | null
          validated_by: string | null
          validation_notes: string | null
          validation_status: string
          work_phone: string | null
          zone: string
        }
        Insert: {
          active_orders_count?: number
          address?: string
          avatar_bg?: string
          bio?: string | null
          can_receive_orders?: boolean
          completed_orders_count?: number
          created_at?: string
          degree_title?: string | null
          education_level?: string | null
          email?: string
          id?: string
          institution_name?: string | null
          is_enabled?: boolean
          name: string
          phone?: string
          profile_id?: string | null
          province?: string
          public_avatar_path?: string | null
          rating?: number
          specialty?: string
          technician_number?: number
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
          work_phone?: string | null
          zone?: string
        }
        Update: {
          active_orders_count?: number
          address?: string
          avatar_bg?: string
          bio?: string | null
          can_receive_orders?: boolean
          completed_orders_count?: number
          created_at?: string
          degree_title?: string | null
          education_level?: string | null
          email?: string
          id?: string
          institution_name?: string | null
          is_enabled?: boolean
          name?: string
          phone?: string
          profile_id?: string | null
          province?: string
          public_avatar_path?: string | null
          rating?: number
          specialty?: string
          technician_number?: number
          validated_at?: string | null
          validated_by?: string | null
          validation_notes?: string | null
          validation_status?: string
          work_phone?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "technicians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technicians_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_settlement_reconciliation: {
        Row: {
          batch_completed_at: string | null
          batch_status: string | null
          batch_transfer_reference: string | null
          created_at: string | null
          dispute_reason: string | null
          gross_amount: number | null
          net_amount: number | null
          order_id: string | null
          paid_at: string | null
          payment_fee_amount: number | null
          payout_batch_id: string | null
          platform_commission_amount: number | null
          release_at: string | null
          release_date: string | null
          released_at: string | null
          scheduled_date: string | null
          settlement_id: string | null
          settlement_type: string | null
          status: string | null
          technician_id: string | null
          technician_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_payout_batch_id_fkey"
            columns: ["payout_batch_id"]
            isOneToOne: false
            referencedRelation: "technician_payout_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technician_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_settlements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_unread_counts: {
        Row: {
          conversation_id: string | null
          unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_summary: {
        Row: {
          active_warranties: number | null
          completed_orders: number | null
          email: string | null
          full_name: string | null
          id: string | null
          last_order_date: string | null
          phone: string | null
          profile_id: string | null
          total_orders: number | null
          total_spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases_summary: {
        Row: {
          case_number: string | null
          case_type: string | null
          closed_at: string | null
          customer_name: string | null
          id: string | null
          message_count: number | null
          opened_at: string | null
          order_id: string | null
          priority: string | null
          resolved_at: string | null
          settlement_paused: boolean | null
          status: string | null
          subject: string | null
          technician_name: string | null
        }
        Insert: {
          case_number?: string | null
          case_type?: string | null
          closed_at?: string | null
          customer_name?: string | null
          id?: string | null
          message_count?: never
          opened_at?: string | null
          order_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          settlement_paused?: boolean | null
          status?: string | null
          subject?: string | null
          technician_name?: string | null
        }
        Update: {
          case_number?: string | null
          case_type?: string | null
          closed_at?: string | null
          customer_name?: string | null
          id?: string | null
          message_count?: never
          opened_at?: string | null
          order_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          settlement_paused?: boolean | null
          status?: string | null
          subject?: string | null
          technician_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_public_view: {
        Row: {
          bio: string | null
          completed_orders_count: number | null
          degree_title: string | null
          education_level: string | null
          id: string | null
          institution_name: string | null
          name: string | null
          public_avatar_path: string | null
          rating: number | null
          specialty: string | null
          validated_licenses: Json | null
          validation_status: string | null
        }
        Insert: {
          bio?: string | null
          completed_orders_count?: number | null
          degree_title?: string | null
          education_level?: string | null
          id?: string | null
          institution_name?: string | null
          name?: string | null
          public_avatar_path?: string | null
          rating?: number | null
          specialty?: never
          validated_licenses?: never
          validation_status?: string | null
        }
        Update: {
          bio?: string | null
          completed_orders_count?: number | null
          degree_title?: string | null
          education_level?: string | null
          id?: string | null
          institution_name?: string | null
          name?: string | null
          public_avatar_path?: string | null
          rating?: number | null
          specialty?: never
          validated_licenses?: never
          validation_status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      close_payout_batch: {
        Args: {
          p_batch_id: string
          p_destination_last4?: string
          p_receipt_url?: string
          p_transfer_reference?: string
        }
        Returns: {
          batch_recorded_total: number
          closed: boolean
          settlement_count: number
          total_amount: number
        }[]
      }
      create_notification: {
        Args: {
          p_body: string
          p_dedupe_key: string
          p_entity_id: string
          p_entity_type: string
          p_priority: string
          p_recipient_profile_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      enforce_max_length: { Args: { p_text: string }; Returns: undefined }
      expire_stale_technician_offers: { Args: never; Returns: undefined }
      get_account_invite: {
        Args: { p_token: string }
        Returns: {
          already_used: boolean
          email: string
          expires_at: string
          full_name: string
          kind: string
        }[]
      }
      hide_own_cancelled_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      notify_case_stakeholders: {
        Args: {
          p_body: string
          p_case_id: string
          p_dedupe_prefix: string
          p_exclude_profile: string
          p_priority: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      offer_to_next_eligible_technician: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      profile_id_for_customer: {
        Args: { p_customer_id: string }
        Returns: string
      }
      profile_id_for_technician: {
        Args: { p_technician_id: string }
        Returns: string
      }
      redeem_account_invite: { Args: { p_token: string }; Returns: Json }
      register_material_usage: {
        Args: {
          p_material_id: string
          p_note?: string
          p_order_id: string
          p_quantity: number
        }
        Returns: string
      }
      release_due_technician_settlements: { Args: never; Returns: number }
      respond_to_technician_assignment: {
        Args: { p_order_id: string; p_response: string }
        Returns: undefined
      }
      run_scheduled_settlement_release: { Args: never; Returns: undefined }
      self_register_technician:
        | {
            Args: {
              p_address: string
              p_category_ids: string[]
              p_full_name: string
              p_phone: string
            }
            Returns: string
          }
        | {
            Args: {
              p_address: string
              p_category_ids: string[]
              p_full_name: string
              p_message?: string
              p_phone: string
            }
            Returns: string
          }
      set_technician_goal: {
        Args: {
          p_goal_type: string
          p_target_amount?: number
          p_target_count?: number
        }
        Returns: {
          created_at: string
          goal_type: string
          id: string
          is_active: boolean
          target_amount: number | null
          target_count: number | null
          technician_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "technician_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_order_conversation: {
        Args: { p_order_id: string; p_subject?: string }
        Returns: string
      }
      technician_assigned_to_customer: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
    }
    Enums: {
      material_category:
        | "Fijaciones"
        | "Electricidad"
        | "Plomería"
        | "Ferretería"
        | "Insumos"
      order_event_type:
        | "assigned"
        | "started"
        | "paused"
        | "resumed"
        | "material_added"
        | "checklist_updated"
        | "time_logged"
        | "note_added"
        | "signed"
        | "completed"
        | "cancelled"
        | "reassigned"
      order_priority: "baja" | "media" | "alta" | "urgente"
      order_status:
        | "assigned"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      service_type:
        | "Plomería"
        | "Electricidad"
        | "Reparaciones del hogar"
        | "Mantenimiento general"
        | "Instalación de equipos"
        | "Cerrajería"
        | "Refrigeración"
        | "Soldadura"
      user_role: "admin" | "technician" | "customer"
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
      material_category: [
        "Fijaciones",
        "Electricidad",
        "Plomería",
        "Ferretería",
        "Insumos",
      ],
      order_event_type: [
        "assigned",
        "started",
        "paused",
        "resumed",
        "material_added",
        "checklist_updated",
        "time_logged",
        "note_added",
        "signed",
        "completed",
        "cancelled",
        "reassigned",
      ],
      order_priority: ["baja", "media", "alta", "urgente"],
      order_status: [
        "assigned",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      service_type: [
        "Plomería",
        "Electricidad",
        "Reparaciones del hogar",
        "Mantenimiento general",
        "Instalación de equipos",
        "Cerrajería",
        "Refrigeración",
        "Soldadura",
      ],
      user_role: ["admin", "technician", "customer"],
    },
  },
} as const

