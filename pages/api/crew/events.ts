import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../../lib/supabase'
import { requireAdmin, requireAuth } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const payload = requireAuth(req)
      if (payload.role === 'admin') {
        const { data, error } = await supabaseAdmin
          .from('events')
          .select(`*, event_assignments(user_id, role, users(id, name))`)
          .order('event_date', { ascending: false })
        if (error) throw error
        return res.json(data)
      } else {
        // Staff: only their assigned events
        const { data, error } = await supabaseAdmin
          .from('event_assignments')
          .select(`role, events(*)`)
          .eq('user_id', payload.userId)
        if (error) throw error
        return res.json(data.map((a: {role: string, events: unknown}) => ({ ...(a.events as object), assigned_role: a.role })))
      }
    }

    if (req.method === 'POST') {
      const adminPayload = requireAdmin(req)
      const { name, venue, venue_lat, venue_lng, event_date, start_time, end_time, assigned_users } = req.body
      if (!name || !venue || !event_date) return res.status(400).json({ error: 'Name, venue and date required' })

      const { data: event, error } = await supabaseAdmin
        .from('events')
        .insert({ name, venue, venue_lat, venue_lng, event_date, start_time, end_time, created_by: adminPayload.userId })
        .select().single()
      if (error) return res.status(400).json({ error: error.message })

      // Assign users if provided
      if (assigned_users?.length) {
        await supabaseAdmin.from('event_assignments').insert(
          assigned_users.map((u: { userId: string, role: string }) => ({
            event_id: event.id,
            user_id: u.userId,
            role: u.role || 'Crew'
          }))
        )
      }
      return res.status(201).json(event)
    }

    if (req.method === 'DELETE') {
      requireAdmin(req)
      const { id } = req.body
      const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.json({ success: true })
    }

    res.status(405).end()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    res.status(msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500).json({ error: msg })
  }
}
