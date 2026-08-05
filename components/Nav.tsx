import Link from 'next/link'
import { useAuth } from '../lib/useAuth'

export default function Nav({ title }: { title?: string }) {
  const { user, logout, viewingAsAdmin, exitViewAs } = useAuth()
  return (
    <>
      {viewingAsAdmin && (
        <div style={{ background: '#7c3aed', color: '#fff', textAlign: 'center', padding: '8px 12px', fontSize: '13px', fontWeight: 600 }}>
          👁️ Viewing as {user?.name} ({user?.role}) —{' '}
          <button
            onClick={exitViewAs}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#fff', borderRadius: '6px', padding: '2px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            Return to admin
          </button>
        </div>
      )}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <span>📋</span> {title || 'Crew Tracker'}
          </div>
          <div className="nav-right">
            {user && (
              <>
                <Link href="/faq" className="btn" style={{ padding: '6px 14px', fontSize: '13px', textDecoration: 'none' }}>❓ FAQ</Link>
                <span className="nav-user">{user.name}</span>
                <span className={`nav-badge ${user.role}`}>{user.role}</span>
                <button className="btn" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={viewingAsAdmin ? exitViewAs : logout}>
                  {viewingAsAdmin ? 'Exit view' : 'Sign out'}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
