-- ============================================================
-- Real Balance — Database Schema
-- Supabase PostgreSQL Migration
-- ============================================================

-- =========================
-- ENUMS
-- =========================

CREATE TYPE payment_method AS ENUM ('debit', 'credit', 'cash', 'pix');
CREATE TYPE account_type AS ENUM ('bank', 'cash', 'wallet', 'digital');
CREATE TYPE transaction_type AS ENUM ('expense', 'income', 'transfer');
CREATE TYPE transaction_status AS ENUM ('pending', 'paid');
CREATE TYPE card_network AS ENUM ('visa', 'mastercard', 'elo', 'amex', 'hipercard');
CREATE TYPE card_type AS ENUM ('credit', 'debit', 'hybrid');

-- =========================
-- TABLES
-- =========================

-- User profile (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income NUMERIC(12,2) DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
  locale TEXT NOT NULL DEFAULT 'pt' CHECK (locale IN ('pt', 'en', 'es', 'fr')),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank accounts, cash, digital wallets
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type account_type NOT NULL DEFAULT 'bank',
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'Wallet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit/debit cards
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  network card_network NOT NULL DEFAULT 'visa',
  card_type card_type NOT NULL DEFAULT 'credit',
  "limit" NUMERIC(12,2) NOT NULL DEFAULT 0,
  used NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT NOT NULL DEFAULT '#7c3aed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Month records (for grouping transactions)
CREATE TABLE months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month, year)
);

-- Financial transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type transaction_type NOT NULL DEFAULT 'expense',
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL DEFAULT '',
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method payment_method NOT NULL DEFAULT 'debit',
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  month_id UUID REFERENCES months(id) ON DELETE SET NULL,
  -- Installment fields (nullable — only set for installment purchases)
  installment_total INTEGER,
  installment_current INTEGER,
  installment_parent_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraints
  CONSTRAINT valid_installment CHECK (
    (installment_total IS NULL AND installment_current IS NULL)
    OR (installment_total >= 2 AND installment_current BETWEEN 1 AND installment_total)
  ),
  CONSTRAINT valid_credit_ref CHECK (
    (payment_method = 'credit' AND credit_card_id IS NOT NULL)
    OR (payment_method != 'credit')
  )
);

-- Savings goals
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  monthly_target NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline TIMESTAMPTZ,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_credit_cards_user ON credit_cards(user_id);
CREATE INDEX idx_months_user_period ON months(user_id, year, month);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_month ON transactions(month_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_account ON transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_transactions_card ON transactions(credit_card_id) WHERE credit_card_id IS NOT NULL;
CREATE INDEX idx_transactions_parent ON transactions(installment_parent_id) WHERE installment_parent_id IS NOT NULL;
CREATE INDEX idx_goals_user ON goals(user_id);

-- =========================
-- AUTO-UPDATE updated_at
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_accounts_updated BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_credit_cards_updated BEFORE UPDATE ON credit_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_goals_updated BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
