import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'cash', 'wallet', 'digital']),
  balance: z.number().default(0),
  color: z.string().default('#3b82f6'),
  icon: z.string().default('Wallet'),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['bank', 'cash', 'wallet', 'digital']).optional(),
  balance: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

// GET /api/accounts — list all accounts
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('accounts')
    .select('*')
    .order('created_at')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/accounts — create account
router.post('/', validate(createSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('accounts')
    .insert({ ...req.body, user_id: req.userId })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// PATCH /api/accounts/:id — update account
router.patch('/:id', validate(updateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('accounts')
    .update(req.body)
    .eq('id', req.params.id as string)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /api/accounts/:id — remove account
router.delete('/:id', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { error } = await sb
    .from('accounts')
    .delete()
    .eq('id', req.params.id as string)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).end()
})

export default router
