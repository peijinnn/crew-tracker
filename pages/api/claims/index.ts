import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth, requireAdmin } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const payload = requireAuth(req)
      let query = supabaseAdmin
        .from('claims')
        .select(`*, users(id, name), events(id, name, venue)`)
        .order('created_at', { ascending: false })

      if (payload.role !== 'admin') query = query.eq('user_id', payload.userId)

      const { data, error } = await query
      if (error) throw error
      return res.json(data)
    }

    if (req.method === 'POST') {
      const payload = requireAuth(req)
      const { event_id, session_id, type, description, amount, distance_km, from_location, to_location, receipt_note, receipt_url } = req.body
      if (!event_id || !type || amount === undefined) {
        return res.status(400).json({ error: 'event_id, type and amount required' })
      }

      const { data, error } = await supabaseAdmin
        .from('claims')
        .insert({
          user_id: payload.userId,
          event_id, session_id, type, description, amount,
          distance_km, from_location, to_location, receipt_note, receipt_url,
          status: 'pending'
        })
        .select(`*, events(id, name)`)
        .single()

      if (error) return res.status(400).json({ error: error.message })
      return res.status(201).json(data)
    }

    // Admin: update claim status
    if (req.method === 'PATCH') {
      requireAdmin(req)
      const { id, status } = req.body
      const { data, error } = await supabaseAdmin
        .from('claims').update({ status }).eq('id', id)
        .select().single()
      if (error) return res.status(400).json({ error: error.message })
      return res.json(data)
    }

    res.status(405).end()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(msg === 'Unauthorized' ? 401 : 403).json({ error: msg })
  }
}
