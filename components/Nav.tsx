import { useAuth } from '../lib/useAuth'

export default function Nav({ title }: { title?: string }) {
  const { user, logout } = useAuth()
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-logo">
          <span>📋</span> {title || 'Crew Tracker'}
        </div>
        <div className="nav-right">
          {user && (
            <>
              <span className="nav-user">{user.name}</span>
              <span className={`nav-badge ${user.role}`}>{user.role}</span>
              <button className="btn" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={logout}>Sign out</button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
