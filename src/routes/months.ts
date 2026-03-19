import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const createSchema = z.object({
  month: z.number().int().min(0).max(11),
  year: z.number().int().min(2020).max(2100),
})

const duplicateSchema = z.object({
  mode: z.enum(['all', 'recurring']).default('recurring'),
})

// GET /api/months
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/months
router.post('/', validate(createSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('months')
    .insert({ ...req.body, user_id: req.userId })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation (month already exists)
    if (error.code === '23505') {
      const { data: existing } = await sb
        .from('months')
        .select('*')
        .eq('month', req.body.month)
        .eq('year', req.body.year)
        .single()
      res.json(existing)
      return
    }
    res.status(500).json({ error: error.message }); return
  }
  res.status(201).json(data)
})

// POST /api/months/:id/duplicate — uses DB function
router.post('/:id/duplicate', validate(duplicateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb.rpc('duplicate_month', {
    p_from_month_id: req.params.id as string,
    p_mode: req.body.mode,
  })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json({ month_id: data })
})

// GET /api/months/:id/summary — uses DB function
router.get('/:id/summary', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb.rpc('get_monthly_summary', {
    p_month_id: req.params.id as string,
  })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data?.[0] ?? { total_income: 0, total_expenses: 0, fixed_expenses: 0, variable_expenses: 0, transaction_count: 0 })
})

export default router
