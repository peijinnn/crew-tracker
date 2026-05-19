import jwt from 'jsonwebtoken'
import { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret'

export interface TokenPayload {
  userId: string
  email: string
  name: string
  role: 'admin' | 'full-time' | 'team-lead' | 'crew'
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextApiRequest): TokenPayload | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}

export function requireAuth(req: NextApiRequest): TokenPayload {
  const payload = getTokenFromRequest(req)
  if (!payload) throw new Error('Unauthorized')
  return payload
}

export function requireAdmin(req: NextApiRequest): TokenPayload {
  const payload = requireAuth(req)
  if (payload.role !== 'admin') throw new Error('Forbidden')
  return payload
}
