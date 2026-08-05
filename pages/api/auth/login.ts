import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../../lib/supabase'
import { signToken } from '../../../lib/auth'
import { normalizePhone } from '../../../lib/phone'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { phone, password } = req.body
  if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' })

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('phone', normalizePhone(phone))
    .single()

  if (error || !user) {
    if (error) console.error('[login] Supabase lookup error:', error)
    else console.error('[login] No user matched phone:', normalizePhone(phone))
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    console.error('[login] Password mismatch for user:', user.id)
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = signToken({
    userId: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
  })

  res.json({
    token,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  })
}
