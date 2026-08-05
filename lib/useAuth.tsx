import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/router'

interface User { id: string; name: string; phone: string; role: string }
interface AuthCtx {
  user: User | null; token: string | null; login: (phone: string, password: string) => Promise<void>; logout: () => void; loading: boolean
  viewAs: (userId: string) => Promise<void>; exitViewAs: () => void; viewingAsAdmin: User | null
}

const Ctx = createContext<AuthCtx>({
  user: null, token: null, login: async () => {}, logout: () => {}, loading: true,
  viewAs: async () => {}, exitViewAs: () => {}, viewingAsAdmin: null,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewingAsAdmin, setViewingAsAdmin] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    const t = localStorage.getItem('crew_token')
    const u = localStorage.getItem('crew_user')
    if (t && u) { setToken(t); setUser(JSON.parse(u)) }
    const at = localStorage.getItem('crew_admin_token')
    const au = localStorage.getItem('crew_admin_user')
    if (at && au) setViewingAsAdmin(JSON.parse(au))
    setLoading(false)
  }, [])

  const login = async (phone: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
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
    localStorage.removeItem('crew_admin_token'); localStorage.removeItem('crew_admin_user')
    setToken(null); setUser(null); setViewingAsAdmin(null); router.push('/login')
  }

  const viewAs = async (userId: string) => {
    if (!token || !user) return
    const res = await fetch('/api/auth/view-as', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Could not switch view')

    // Stash the real admin session so we can restore it later, unless we're already impersonating.
    if (!viewingAsAdmin) {
      localStorage.setItem('crew_admin_token', token)
      localStorage.setItem('crew_admin_user', JSON.stringify(user))
      setViewingAsAdmin(user)
    }
    localStorage.setItem('crew_token', data.token)
    localStorage.setItem('crew_user', JSON.stringify(data.user))
    setToken(data.token); setUser(data.user)
    router.push('/staff')
  }

  const exitViewAs = () => {
    const at = localStorage.getItem('crew_admin_token')
    const au = localStorage.getItem('crew_admin_user')
    if (!at || !au) return
    localStorage.setItem('crew_token', at)
    localStorage.setItem('crew_user', au)
    localStorage.removeItem('crew_admin_token'); localStorage.removeItem('crew_admin_user')
    setToken(at); setUser(JSON.parse(au)); setViewingAsAdmin(null)
    router.push('/admin')
  }

  return <Ctx.Provider value={{ user, token, login, logout, loading, viewAs, exitViewAs, viewingAsAdmin }}>{children}</Ctx.Provider>
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
