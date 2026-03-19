import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  target_amount: z.number().positive(),
  current_amount: z.number().min(0).default(0),
  monthly_target: z.number().min(0).default(0),
  deadline: z.string().datetime().nullable().optional(),
  color: z.string().default('#3b82f6'),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  target_amount: z.number().positive().optional(),
  current_amount: z.number().min(0).optional(),
  monthly_target: z.number().min(0).optional(),
  deadline: z.string().datetime().nullable().optional(),
  color: z.string().optional(),
})

const contributeSchema = z.object({
  amount: z.number().positive(),
})

// GET /api/goals
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .order('created_at')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/goals
router.post('/', validate(createSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('goals')
    .insert({ ...req.body, user_id: req.userId })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// POST /api/goals/:id/contribute — uses DB function
router.post('/:id/contribute', validate(contributeSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb.rpc('contribute_to_goal', {
    p_goal_id: req.params.id as string,
    p_amount: req.body.amount,
  })

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// PATCH /api/goals/:id
router.patch('/:id', validate(updateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('goals')
    .update(req.body)
    .eq('id', req.params.id as string)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { error } = await sb
    .from('goals')
    .delete()
    .eq('id', req.params.id as string)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).end()
})

export default router
