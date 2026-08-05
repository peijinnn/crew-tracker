import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAdmin, signToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    requireAdmin(req)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return res.status(msg === 'Unauthorized' ? 401 : 403).json({ error: msg })
  }

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { data: target, error } = await supabaseAdmin
    .from('users')
    .select('id, name, phone, role')
    .eq('id', userId)
    .single()

  if (error || !target) return res.status(404).json({ error: 'User not found' })

  const token = signToken({ userId: target.id, phone: target.phone, name: target.name, role: target.role })
  res.json({ token, user: { id: target.id, name: target.name, phone: target.phone, role: target.role } })
}
