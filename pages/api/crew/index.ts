import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAdmin, requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // Admin: get all crew. Staff: get self.
      const payload = requireAuth(req)
      if (payload.role === 'admin') {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('id,name,phone,email,role,hourly_rate,home_area,bank_details,created_at')
          .order('name')
        if (error) throw error
        return res.json(data)
      } else {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select('id,name,phone,email,role,hourly_rate,home_area,bank_details')
          .eq('id', payload.userId)
          .single()
        if (error) throw error
        return res.json(data)
      }
    }

    if (req.method === 'POST') {
      requireAdmin(req)
      const { name, email, password, phone, role, hourly_rate, home_area, bank_details } = req.body
      if (!name || !phone || !password) return res.status(400).json({ error: 'Name, phone and password required' })
      const password_hash = await bcrypt.hash(password, 10)
      const { data, error } = await supabaseAdmin
        .from('users')
        .insert({ name, email: email || null, password_hash, phone: phone.trim(), role: role || 'staff', hourly_rate, home_area, bank_details })
        .select('id,name,email,phone,role,hourly_rate,home_area,bank_details')
        .single()
      if (error) return res.status(400).json({ error: error.message })
      return res.status(201).json(data)
    }

    if (req.method === 'PATCH') {
      requireAdmin(req)
      const { id, name, phone, role, hourly_rate, home_area, bank_details, password } = req.body
      const updates: Record<string, unknown> = { name, phone, role, hourly_rate, home_area, bank_details }
      if (password) updates.password_hash = await bcrypt.hash(password, 10)
      const { data, error } = await supabaseAdmin
        .from('users').update(updates).eq('id', id)
        .select('id,name,email,role,hourly_rate,home_area,bank_details').single()
      if (error) return res.status(400).json({ error: error.message })
      return res.json(data)
    }

    if (req.method === 'DELETE') {
      requireAdmin(req)
      const { id } = req.body
      const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ success: true })
    }

    res.status(405).end()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500).json({ error: msg })
  }
}
