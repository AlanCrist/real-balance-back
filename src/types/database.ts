/**
 * Supabase Database Types
 *
 * In production, generate automatically with:
 *   npx supabase gen types typescript --local > src/types/database.ts
 */

export type PaymentMethod = 'debit' | 'credit' | 'cash' | 'pix'
export type AccountType = 'bank' | 'cash' | 'wallet' | 'digital'
export type TransactionType = 'expense' | 'income' | 'transfer'
export type TransactionStatus = 'pending' | 'paid'
export type CardNetwork = 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard'
export type CardTypeName = 'credit' | 'debit' | 'hybrid'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          monthly_income: number
          theme: string
          locale: string
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          monthly_income?: number
          theme?: string
          locale?: string
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          monthly_income?: number
          theme?: string
          locale?: string
          onboarding_completed?: boolean
        }
        Relationships: []
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          balance: number
          color: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type?: AccountType
          balance?: number
          color?: string
          icon?: string
        }
        Update: {
          name?: string
          type?: AccountType
          balance?: number
          color?: string
          icon?: string
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          id: string
          user_id: string
          name: string
          bank: string
          network: CardNetwork
          card_type: CardTypeName
          limit: number
          used: number
          closing_day: number
          due_day: number
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          bank: string
          network?: CardNetwork
          card_type?: CardTypeName
          limit?: number
          used?: number
          closing_day: number
          due_day: number
          color?: string
        }
        Update: {
          name?: string
          bank?: string
          network?: CardNetwork
          card_type?: CardTypeName
          limit?: number
          used?: number
          closing_day?: number
          due_day?: number
          color?: string
        }
        Relationships: []
      }
      months: {
        Row: {
          id: string
          user_id: string
          month: number
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: number
          year: number
        }
        Update: {
          month?: number
          year?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: TransactionType
          category: string
          description: string
          date: string
          payment_method: PaymentMethod
          account_id: string | null
          credit_card_id: string | null
          status: TransactionStatus
          is_recurring: boolean
          month_id: string | null
          installment_total: number | null
          installment_current: number | null
          installment_parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type?: TransactionType
          category?: string
          description?: string
          date?: string
          payment_method?: PaymentMethod
          account_id?: string | null
          credit_card_id?: string | null
          status?: TransactionStatus
          is_recurring?: boolean
          month_id?: string | null
          installment_total?: number | null
          installment_current?: number | null
          installment_parent_id?: string | null
        }
        Update: {
          amount?: number
          type?: TransactionType
          category?: string
          description?: string
          date?: string
          payment_method?: PaymentMethod
          account_id?: string | null
          credit_card_id?: string | null
          status?: TransactionStatus
          is_recurring?: boolean
          month_id?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          monthly_target: number
          deadline: string | null
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          monthly_target?: number
          deadline?: string | null
          color?: string
        }
        Update: {
          name?: string
          target_amount?: number
          current_amount?: number
          monthly_target?: number
          deadline?: string | null
          color?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      add_transaction: {
        Args: {
          p_amount: number
          p_type: TransactionType
          p_category: string
          p_description: string
          p_date: string
          p_payment_method: PaymentMethod
          p_account_id?: string | null
          p_credit_card_id?: string | null
          p_status?: TransactionStatus
          p_is_recurring?: boolean
          p_month_id?: string | null
          p_installment_count?: number
        }
        Returns: Database['public']['Tables']['transactions']['Row'][]
      }
      contribute_to_goal: {
        Args: { p_goal_id: string; p_amount: number }
        Returns: Database['public']['Tables']['goals']['Row']
      }
      duplicate_month: {
        Args: { p_from_month_id: string; p_mode?: string }
        Returns: string
      }
      get_monthly_summary: {
        Args: { p_month_id: string }
        Returns: {
          total_income: number
          total_expenses: number
          fixed_expenses: number
          variable_expenses: number
          transaction_count: number
        }[]
      }
    }
    Enums: {
      payment_method: PaymentMethod
      account_type: AccountType
      transaction_type: TransactionType
      transaction_status: TransactionStatus
      card_network: CardNetwork
      card_type: CardTypeName
    }
    CompositeTypes: Record<string, never>
  }
}
