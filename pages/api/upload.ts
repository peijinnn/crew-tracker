import type { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const BUCKET = 'receipts'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { filename, contentType, data } = req.body as { filename: string; contentType: string; data: string }
  if (!filename || !contentType || !data) return res.status(400).json({ error: 'Missing fields' })

  const buffer = Buffer.from(data, 'base64')
  if (buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'File exceeds 5MB limit' })

  // Create bucket if it doesn't exist yet
  await supabaseAdmin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5242880 }).catch(() => {})

  const ext = filename.split('.').pop() || 'bin'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false })
  if (error) return res.status(500).json({ error: error.message })

  const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return res.json({ url: publicUrl })
}
