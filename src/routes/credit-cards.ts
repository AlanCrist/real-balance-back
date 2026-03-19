import { Router } from 'express'
import { z } from 'zod'
import { createSupabaseClient } from '../lib/supabase.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1),
  bank: z.string().min(1),
  network: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard']),
  card_type: z.enum(['credit', 'debit', 'hybrid']).default('credit'),
  limit: z.number().positive(),
  used: z.number().min(0).default(0),
  closing_day: z.number().int().min(1).max(31),
  due_day: z.number().int().min(1).max(31),
  color: z.string().default('#7c3aed'),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  bank: z.string().min(1).optional(),
  network: z.enum(['visa', 'mastercard', 'elo', 'amex', 'hipercard']).optional(),
  card_type: z.enum(['credit', 'debit', 'hybrid']).optional(),
  limit: z.number().positive().optional(),
  used: z.number().min(0).optional(),
  closing_day: z.number().int().min(1).max(31).optional(),
  due_day: z.number().int().min(1).max(31).optional(),
  color: z.string().optional(),
})

// GET /api/credit-cards
router.get('/', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('credit_cards')
    .select('*')
    .order('created_at')

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// POST /api/credit-cards
router.post('/', validate(createSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('credit_cards')
    .insert({ ...req.body, user_id: req.userId })
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(201).json(data)
})

// PATCH /api/credit-cards/:id
router.patch('/:id', validate(updateSchema), async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { data, error } = await sb
    .from('credit_cards')
    .update(req.body)
    .eq('id', req.params.id as string)
    .select()
    .single()

  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// DELETE /api/credit-cards/:id
router.delete('/:id', async (req, res) => {
  const sb = createSupabaseClient(req.accessToken)
  const { error } = await sb
    .from('credit_cards')
    .delete()
    .eq('id', req.params.id as string)

  if (error) { res.status(500).json({ error: error.message }); return }
  res.status(204).end()
})

export default router
