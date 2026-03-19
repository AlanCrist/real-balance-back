import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const updateSchema = z.object({
  monthly_income: z.number().min(0).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  locale: z.enum(['pt', 'en', 'es', 'fr']).optional(),
  onboarding_completed: z.boolean().optional(),
})

// GET /api/profile — get current user profile
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// PATCH /api/profile — update profile
router.patch('/', validate(updateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('profiles')
    .update(req.body)
    .eq('id', req.userId)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// GET /api/profile/dashboard — aggregated dashboard data in one call
router.get('/dashboard', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)

  const [
    { data: accounts },
    { data: creditCards },
    { data: goals },
  ] = await Promise.all([
    sb.from('accounts').select('*').order('created_at'),
    sb.from('credit_cards').select('*').order('created_at'),
    sb.from('goals').select('*').order('created_at'),
  ])

  const totalBalance = (accounts ?? []).reduce((s, a) => s + Number(a.balance), 0)
  const totalCreditUsed = (creditCards ?? []).reduce((s, c) => s + Number(c.used), 0)
  const totalCreditLimit = (creditCards ?? []).reduce((s, c) => s + Number(c.limit), 0)

  res.json({
    accounts: accounts ?? [],
    credit_cards: creditCards ?? [],
    goals: goals ?? [],
    totals: {
      balance: totalBalance,
      credit_used: totalCreditUsed,
      credit_limit: totalCreditLimit,
      real_balance: totalBalance - totalCreditUsed,
    },
  })
})

export default router
