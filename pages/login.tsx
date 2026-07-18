import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../lib/useAuth'

export default function Login() {
  const { login, user, loading } = useAuth()
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!loading && user) router.push(user.role === 'admin' ? '/admin' : '/staff')
  }, [user, loading, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try { await login(phone, password) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Login failed') }
    finally { setBusy(false) }
  }

  return (
    <>
      <Head><title>Crew Tracker — Login</title></Head>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📋</div>
            <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Crew Tracker</h1>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>Sign in to your account</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="card">
            <form onSubmit={submit}>
              <div className="field">
                <label>Phone number</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="012-345 6789" required autoFocus />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={busy} style={{ marginTop: '8px' }}>
                {busy ? <span className="spinner" /> : 'Sign in'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--muted)', marginTop: '1.5rem' }}>
            Contact your admin if you need login details.
          </p>
        </div>
      </div>
    </>
  )
}
