import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAuth, requireAdmin } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const payload = requireAuth(req)
      const { event_id, user_id } = req.query

      let query = supabaseAdmin
        .from('sessions')
        .select(`*, users(id, name, hourly_rate), events(id, name, venue)`)
        .order('check_in', { ascending: false })

      if (payload.role !== 'admin') {
        query = query.eq('user_id', payload.userId)
      } else {
        if (event_id) query = query.eq('event_id', event_id)
        if (user_id) query = query.eq('user_id', user_id)
      }

      const { data, error } = await query
      if (error) throw error
      return res.json(data)
    }

    // Check in
    if (req.method === 'POST') {
      const payload = requireAuth(req)
      const { event_id, lat, lng, address, role } = req.body
      if (!event_id || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: 'event_id, lat and lng required' })
      }

      // Check no open session
      const { data: open } = await supabaseAdmin
        .from('sessions')
        .select('id')
        .eq('user_id', payload.userId)
        .is('check_out', null)
        .limit(1)

      if (open?.length) return res.status(400).json({ error: 'You already have an active check-in. Please check out first.' })

      const { data, error } = await supabaseAdmin
        .from('sessions')
        .insert({
          user_id: payload.userId,
          event_id,
          check_in: new Date().toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_address: address || null,
          role: role || 'Crew'
        })
        .select(`*, events(id, name, venue)`)
        .single()

      if (error) return res.status(400).json({ error: error.message })
      return res.status(201).json(data)
    }

    // Check out
    if (req.method === 'PATCH') {
      const payload = requireAuth(req)
      const { session_id, lat, lng } = req.body

      const { data: session } = await supabaseAdmin
        .from('sessions').select('*').eq('id', session_id).single()

      if (!session) return res.status(404).json({ error: 'Session not found' })
      if (payload.role !== 'admin' && session.user_id !== payload.userId) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const checkOut = new Date()
      const checkIn = new Date(session.check_in)
      const hours = parseFloat(((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(2))

      const { data, error } = await supabaseAdmin
        .from('sessions')
        .update({ check_out: checkOut.toISOString(), check_out_lat: lat, check_out_lng: lng, hours })
        .eq('id', session_id)
        .select(`*, users(id, name, hourly_rate), events(id, name, venue)`)
        .single()

      if (error) return res.status(400).json({ error: error.message })
      return res.json(data)
    }

    if (req.method === 'DELETE') {
      requireAdmin(req)
      const { id } = req.body
      const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ success: true })
    }

    res.status(405).end()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg })
  }
}
