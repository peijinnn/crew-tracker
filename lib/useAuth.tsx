import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface User { id: string; name: string; email: string; role: 'admin' | 'staff' }
interface AuthCtx { user: User | null; token: string | null; login: (email: string, password: string) => Promise<void>; logout: () => void; loading: boolean }

const Ctx = createContext<AuthCtx>({ user: null, token: null, login: async () => {}, logout: () => {}, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const t = localStorage.getItem('crew_token')
    const u = localStorage.getItem('crew_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem('crew_token', data.token)
    localStorage.setItem('crew_user', JSON.stringify(data.user))
    setToken(data.token); setUser(data.user)
    router.push(data.user.role === 'admin' ? '/admin' : '/staff')
  }

  const logout = () => {
    localStorage.removeItem('crew_token'); localStorage.removeItem('crew_user')
    setToken(null); setUser(null); router.push('/login')
  }

  return <Ctx.Provider value={{ user, token, login, logout, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

export function api(token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return {
    get: (url: string) => fetch(url, { headers }).then(r => r.json()),
    post: (url: string, body: unknown) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).then(r => r.json()),
    patch: (url: string, body: unknown) => fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) }).then(r => r.json()),
    del: (url: string, body: unknown) => fetch(url, { method: 'DELETE', headers, body: JSON.stringify(body) }).then(r => r.json()),
  }
}
