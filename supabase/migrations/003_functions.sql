-- ============================================================
-- Real Balance — Database Functions
-- Server-side business logic for complex operations
-- ============================================================

-- =========================
-- Add transaction with balance side-effects
-- Handles: debit from account, credit card usage, income deposit
-- =========================

CREATE OR REPLACE FUNCTION add_transaction(
  p_amount NUMERIC,
  p_type transaction_type,
  p_category TEXT,
  p_description TEXT,
  p_date TIMESTAMPTZ,
  p_payment_method payment_method,
  p_account_id UUID DEFAULT NULL,
  p_credit_card_id UUID DEFAULT NULL,
  p_status transaction_status DEFAULT 'pending',
  p_is_recurring BOOLEAN DEFAULT false,
  p_month_id UUID DEFAULT NULL,
  p_installment_count INTEGER DEFAULT 1
)
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_first_id UUID;
  v_installment_amount NUMERIC;
  v_target_month_id UUID;
  v_install_date TIMESTAMPTZ;
  v_target_month INTEGER;
  v_target_year INTEGER;
  v_tx_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Single transaction (no installments)
  IF p_installment_count <= 1 THEN
    INSERT INTO transactions (
      user_id, amount, type, category, description, date,
      payment_method, account_id, credit_card_id, status,
      is_recurring, month_id
    ) VALUES (
      v_user_id, p_amount, p_type, p_category, p_description, p_date,
      p_payment_method, p_account_id, p_credit_card_id, p_status,
      p_is_recurring, p_month_id
    ) RETURNING id INTO v_first_id;

    -- Side effects on balances
    IF p_type = 'expense' AND p_payment_method != 'credit' AND p_account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id AND user_id = v_user_id;
    ELSIF p_type = 'expense' AND p_payment_method = 'credit' AND p_credit_card_id IS NOT NULL THEN
      UPDATE credit_cards SET used = used + p_amount WHERE id = p_credit_card_id AND user_id = v_user_id;
    ELSIF p_type = 'income' AND p_account_id IS NOT NULL THEN
      UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id AND user_id = v_user_id;
    END IF;

    RETURN QUERY SELECT * FROM transactions WHERE id = v_first_id;
    RETURN;
  END IF;

  -- Installment purchase (credit card only)
  v_installment_amount := ROUND(p_amount / p_installment_count, 2);
  v_first_id := gen_random_uuid();

  FOR i IN 1..p_installment_count LOOP
    v_install_date := p_date + ((i - 1) || ' months')::INTERVAL;
    v_target_month := EXTRACT(MONTH FROM v_install_date)::INTEGER - 1; -- 0-indexed
    v_target_year := EXTRACT(YEAR FROM v_install_date)::INTEGER;

    -- Ensure month record exists
    INSERT INTO months (user_id, month, year)
    VALUES (v_user_id, v_target_month, v_target_year)
    ON CONFLICT (user_id, month, year) DO NOTHING;

    SELECT id INTO v_target_month_id
    FROM months
    WHERE user_id = v_user_id AND month = v_target_month AND year = v_target_year;

    v_tx_id := CASE WHEN i = 1 THEN v_first_id ELSE gen_random_uuid() END;

    INSERT INTO transactions (
      id, user_id, amount, type, category, description, date,
      payment_method, credit_card_id, status, is_recurring, month_id,
      installment_total, installment_current, installment_parent_id
    ) VALUES (
      v_tx_id, v_user_id, v_installment_amount, p_type, p_category, p_description,
      v_install_date, p_payment_method, p_credit_card_id,
      CASE WHEN i = 1 THEN p_status ELSE 'pending' END,
      p_is_recurring, v_target_month_id,
      p_installment_count, i,
      CASE WHEN i > 1 THEN v_first_id ELSE NULL END
    );
  END LOOP;

  -- Only charge first installment to card
  IF p_credit_card_id IS NOT NULL THEN
    UPDATE credit_cards SET used = used + v_installment_amount
    WHERE id = p_credit_card_id AND user_id = v_user_id;
  END IF;

  RETURN QUERY SELECT * FROM transactions
    WHERE (id = v_first_id OR installment_parent_id = v_first_id)
    ORDER BY installment_current;
END;
$$;

-- =========================
-- Contribute to a goal
-- =========================

CREATE OR REPLACE FUNCTION contribute_to_goal(
  p_goal_id UUID,
  p_amount NUMERIC
)
RETURNS goals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal goals;
BEGIN
  UPDATE goals
  SET current_amount = LEAST(current_amount + p_amount, target_amount)
  WHERE id = p_goal_id AND user_id = auth.uid()
  RETURNING * INTO v_goal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found';
  END IF;

  RETURN v_goal;
END;
$$;

-- =========================
-- Duplicate month (all or recurring only)
-- =========================

CREATE OR REPLACE FUNCTION duplicate_month(
  p_from_month_id UUID,
  p_mode TEXT DEFAULT 'recurring' -- 'all' or 'recurring'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_from months;
  v_new_month INTEGER;
  v_new_year INTEGER;
  v_new_month_id UUID;
BEGIN
  SELECT * INTO v_from FROM months WHERE id = p_from_month_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Month not found';
  END IF;

  -- Calculate next month
  v_new_month := (v_from.month + 1) % 12;
  v_new_year := CASE WHEN v_from.month = 11 THEN v_from.year + 1 ELSE v_from.year END;

  -- Create or get next month
  INSERT INTO months (user_id, month, year)
  VALUES (v_user_id, v_new_month, v_new_year)
  ON CONFLICT (user_id, month, year) DO NOTHING;

  SELECT id INTO v_new_month_id
  FROM months WHERE user_id = v_user_id AND month = v_new_month AND year = v_new_year;

  -- Clone transactions
  INSERT INTO transactions (
    user_id, amount, type, category, description, date,
    payment_method, account_id, credit_card_id, status,
    is_recurring, month_id
  )
  SELECT
    user_id, amount, type, category, description,
    make_timestamptz(v_new_year, v_new_month + 1, EXTRACT(DAY FROM date)::INTEGER, 12, 0, 0),
    payment_method, account_id, credit_card_id, 'pending',
    is_recurring, v_new_month_id
  FROM transactions
  WHERE month_id = p_from_month_id
    AND user_id = v_user_id
    AND (p_mode = 'all' OR is_recurring = true);

  RETURN v_new_month_id;
END;
$$;

-- =========================
-- Get monthly summary (computed server-side)
-- =========================

CREATE OR REPLACE FUNCTION get_monthly_summary(p_month_id UUID)
RETURNS TABLE (
  total_income NUMERIC,
  total_expenses NUMERIC,
  fixed_expenses NUMERIC,
  variable_expenses NUMERIC,
  transaction_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS total_income,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS total_expenses,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND is_recurring = true), 0) AS fixed_expenses,
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND is_recurring = false), 0) AS variable_expenses,
    COUNT(*) AS transaction_count
  FROM transactions
  WHERE month_id = p_month_id AND user_id = auth.uid();
$$;
