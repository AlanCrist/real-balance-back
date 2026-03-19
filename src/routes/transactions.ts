import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import type { TransactionType } from '../types/database.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const createSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['expense', 'income', 'transfer']),
  category: z.string().default('other'),
  description: z.string().default(''),
  date: z.string().datetime(),
  payment_method: z.enum(['debit', 'credit', 'cash', 'pix']),
  account_id: z.string().uuid().nullable().optional(),
  credit_card_id: z.string().uuid().nullable().optional(),
  status: z.enum(['pending', 'paid']).default('pending'),
  is_recurring: z.boolean().default(false),
  month_id: z.string().uuid().nullable().optional(),
  installment_count: z.number().int().min(1).max(48).default(1),
})

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
  payment_method: z.enum(['debit', 'credit', 'cash', 'pix']).optional(),
  status: z.enum(['pending', 'paid']).optional(),
  is_recurring: z.boolean().optional(),
})

// GET /api/transactions — list transactions (with optional month filter)
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  let query = sb
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  // Filter by month
  if (req.query.month_id) {
    query = query.eq('month_id', req.query.month_id as string)
  }

  // Filter by type
  if (req.query.type) {
    query = query.eq('type', req.query.type as unknown as TransactionType)
  }

  // Filter by credit card (for statements)
  if (req.query.credit_card_id) {
    query = query.eq('credit_card_id', req.query.credit_card_id as string)
  }

  // Pagination
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ data, count })
})

// POST /api/transactions — create transaction (uses DB function for side-effects)
router.post('/', validate(createSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { installment_count, ...txData } = req.body

  // Use the DB function that handles balance updates + installments
  const { data, error } = await sb.rpc('add_transaction', {
    p_amount: txData.amount,
    p_type: txData.type,
    p_category: txData.category,
    p_description: txData.description,
    p_date: txData.date,
    p_payment_method: txData.payment_method,
    p_account_id: txData.account_id ?? null,
    p_credit_card_id: txData.credit_card_id ?? null,
    p_status: txData.status,
    p_is_recurring: txData.is_recurring,
    p_month_id: txData.month_id ?? null,
    p_installment_count: installment_count,
  })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// PATCH /api/transactions/:id — update transaction
router.patch('/:id', validate(updateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('transactions')
    .update(req.body)
    .eq('id', req.params.id as string)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /api/transactions/:id — remove transaction
router.delete('/:id', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { error } = await sb
    .from('transactions')
    .delete()
    .eq('id', req.params.id as string)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).end()
})

export default router
