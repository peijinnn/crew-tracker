import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { waypoints } = req.body as { waypoints: { lat: number; lng: number }[] }
  if (!Array.isArray(waypoints) || waypoints.length < 2)
    return res.status(400).json({ error: 'Need at least 2 waypoints' })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  if (!key) return res.status(500).json({ error: 'No Maps key configured' })

  const fmt = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`
  const origin = fmt(waypoints[0])
  const destination = fmt(waypoints[waypoints.length - 1])
  const mid = waypoints.slice(1, -1).map(fmt).join('|')

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  if (mid) url.searchParams.set('waypoints', mid)
  url.searchParams.set('key', key)

  try {
    const r = await fetch(url.toString())
    const data = await r.json()
    if (data.status !== 'OK')
      return res.status(400).json({ error: data.status, message: data.error_message || '' })
    const totalMeters: number = data.routes[0].legs.reduce((s: number, l: any) => s + l.distance.value, 0)
    return res.json({ distance_km: parseFloat((totalMeters / 1000).toFixed(1)) })
  } catch {
    return res.status(500).json({ error: 'Failed to fetch route' })
  }
}
