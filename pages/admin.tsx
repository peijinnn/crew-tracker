import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth, api } from '../lib/useAuth'
import Nav from '../components/Nav'

function fmt(dt: string) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

type User = { id: string; name: string; email?: string; phone: string; role: string; hourly_rate: number; home_area?: string; bank_details?: string }
type Event = { id: string; name: string; venue: string; venue_lat?: number; venue_lng?: number; event_date: string; event_assignments?: { user_id: string; role: string; users: { id: string; name: string } }[] }
type Session = { id: string; user_id: string; event_id: string; check_in: string; check_out?: string; hours?: number; check_in_lat?: number; check_in_lng?: number; users?: { id: string; name: string; hourly_rate: number }; events?: { id: string; name: string; venue: string } }
type Claim = { id: string; user_id: string; event_id: string; type: string; description?: string; amount: number; status: string; distance_km?: number; from_location?: string; to_location?: string; receipt_note?: string; receipt_url?: string; created_at: string; users?: { id: string; name: string }; events?: { id: string; name: string } }

const AVATAR_COLORS = ['#dbeafe:#1d4ed8','#dcfce7:#15803d','#fef3c7:#b45309','#fce7f3:#be185d','#ede9fe:#7c3aed','#ffedd5:#c2410c']
function avatarStyle(i: number) { const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length].split(':'); return { background: bg, color: fg } }
function initials(n: string) { return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }

export default function Admin() {
  const { user, token, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'dashboard' | 'crew' | 'events' | 'sessions' | 'claims' | 'payroll'>('dashboard')
  const [crew, setCrew] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // New crew form
  const [newName, setNewName] = useState(''); const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass] = useState(''); const [newPhone, setNewPhone] = useState('')
  const [newRate, setNewRate] = useState(''); const [newArea, setNewArea] = useState('')
  const [newBank, setNewBank] = useState(''); const [newRole, setNewRole] = useState('crew')

  // New event form
  const [evName, setEvName] = useState(''); const [evVenue, setEvVenue] = useState('')
  const [evDate, setEvDate] = useState(''); const [evLat, setEvLat] = useState('')
  const [evLng, setEvLng] = useState(''); const [evStart, setEvStart] = useState('')
  const [evEnd, setEvEnd] = useState(''); const [evAssigned, setEvAssigned] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!token) return
    const a = api(token)
    const [c, ev, sess, cl] = await Promise.all([a.get('/api/crew'), a.get('/api/crew/events'), a.get('/api/sessions'), a.get('/api/claims')])
    setCrew(Array.isArray(c) ? c : [])
    setEvents(Array.isArray(ev) ? ev : [])
    setSessions(Array.isArray(sess) ? sess : [])
    setClaims(Array.isArray(cl) ? cl : [])
  }, [token])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user?.role !== 'admin') router.push('/staff')
    if (!loading && user) load()
  }, [user, loading, router, load])

  const addCrew = async () => {
    if (!newName || !newPhone || !newPass) { setMsg({ type: 'error', text: 'Name, phone and password required' }); return }
    setBusy(true)
    const res = await api(token).post('/api/crew', { name: newName, email: newEmail, password: newPass, phone: newPhone, role: newRole, hourly_rate: parseFloat(newRate) || 0, home_area: newArea, bank_details: newBank })
    setBusy(false)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: `✅ ${newName} added!` })
    setNewName(''); setNewEmail(''); setNewPass(''); setNewPhone(''); setNewRate(''); setNewArea(''); setNewBank('')
    await load()
  }

  const removeCrew = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return
    await api(token).del('/api/crew', { id })
    await load()
  }

  const [editingRateId, setEditingRateId] = useState<string | null>(null)
  const [editRateValue, setEditRateValue] = useState('')

  const startEditRate = (c: User) => { setEditingRateId(c.id); setEditRateValue(String(c.hourly_rate || 0)) }
  const cancelEditRate = () => { setEditingRateId(null); setEditRateValue('') }
  const saveRate = async (id: string) => {
    const hourly_rate = parseFloat(editRateValue)
    if (isNaN(hourly_rate) || hourly_rate < 0) { setMsg({ type: 'error', text: 'Enter a valid rate' }); return }
    const res = await api(token).patch('/api/crew', { id, hourly_rate })
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setEditingRateId(null); setEditRateValue('')
    await load()
  }

  const addEvent = async () => {
    if (!evName || !evVenue || !evDate) { setMsg({ type: 'error', text: 'Name, venue and date required' }); return }
    setBusy(true)
    const res = await api(token).post('/api/crew/events', {
      name: evName, venue: evVenue, event_date: evDate,
      venue_lat: evLat ? parseFloat(evLat) : undefined, venue_lng: evLng ? parseFloat(evLng) : undefined,
      start_time: evStart || undefined, end_time: evEnd || undefined,
      assigned_users: evAssigned.map(uid => ({ userId: uid, role: 'Crew' }))
    })
    setBusy(false)
    if (res.error) { setMsg({ type: 'error', text: res.error }); return }
    setMsg({ type: 'success', text: `✅ Event "${evName}" created!` })
    setEvName(''); setEvVenue(''); setEvDate(''); setEvLat(''); setEvLng(''); setEvStart(''); setEvEnd(''); setEvAssigned([])
    await load()
  }

  const updateClaimStatus = async (id: string, status: string) => {
    await api(token).patch('/api/claims', { id, status })
    await load()
  }

  // Payroll calc
  const payroll = crew.map((c, i) => {
    const crewSessions = sessions.filter(s => s.user_id === c.id && s.check_out)
    const hours = crewSessions.reduce((s, x) => s + (x.hours || 0), 0)
    const wages = hours * c.hourly_rate
    const crewClaims = claims.filter(cl => cl.user_id === c.id)
    const allowances = crewClaims.reduce((s, x) => s + x.amount, 0)
    const paidClaims = crewClaims.filter(cl => cl.status === 'paid').reduce((s, x) => s + x.amount, 0)
    return { ...c, hours, wages, allowances, paidClaims, total: wages + allowances, sessions: crewSessions.length, idx: i }
  }).filter(c => c.hours > 0 || c.allowances > 0)

  const activeSessions = sessions.filter(s => !s.check_out)
  const pendingClaims = claims.filter(c => c.status === 'pending')
  const totalHours = sessions.filter(s => s.check_out).reduce((s, x) => s + (x.hours || 0), 0)
  const totalPayout = payroll.reduce((s, c) => s + c.total, 0)

  const exportCSV = () => {
    const rows = [['Name', 'Sessions', 'Hours', 'Rate', 'Wages', 'Allowances', 'Total', 'Bank']]
    payroll.forEach(c => rows.push([c.name, String(c.sessions), c.hours.toFixed(2), String(c.hourly_rate), c.wages.toFixed(2), c.allowances.toFixed(2), c.total.toFixed(2), c.bank_details || '']))
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'payroll.csv'; a.click()
  }

  if (loading) return null

  return (
    <>
      <Head><title>Crew Tracker — Admin</title></Head>
      <Nav title="Crew Tracker — Admin" />
      <div className="container page">
        {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`} onClick={() => setMsg(null)} style={{ cursor: 'pointer' }}>{msg.text}</div>}

        <div className="tabs">
          {(['dashboard', 'crew', 'events', 'sessions', 'claims', 'payroll'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'dashboard' ? '📊 Dashboard' : t === 'crew' ? '👥 Crew' : t === 'events' ? '📅 Events' : t === 'sessions' ? '🕐 Sessions' : t === 'claims' ? `🧾 Claims ${pendingClaims.length ? `(${pendingClaims.length})` : ''}` : '💰 Payroll'}
            </button>
          ))}
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div>
            <div className="grid4" style={{ marginBottom: '1.5rem' }}>
              <div className="metric"><div className="metric-label">Total crew</div><div className="metric-value">{crew.length}</div></div>
              <div className="metric"><div className="metric-label">Currently active</div><div className="metric-value" style={{ color: activeSessions.length ? 'var(--success)' : undefined }}>{activeSessions.length}</div></div>
              <div className="metric"><div className="metric-label">Total hours logged</div><div className="metric-value">{totalHours.toFixed(1)}h</div></div>
              <div className="metric"><div className="metric-label">Pending claims</div><div className="metric-value" style={{ color: pendingClaims.length ? 'var(--warn)' : undefined }}>{pendingClaims.length}</div></div>
            </div>

            <div className="grid2">
              <div className="card">
                <div className="card-title">Currently checked in</div>
                {activeSessions.length === 0 ? <div className="empty">No active check-ins</div> : activeSessions.map((s, i) => {
                  const c = crew.find(x => x.id === s.user_id)
                  const elapsed = ((Date.now() - new Date(s.check_in).getTime()) / 3600000).toFixed(1)
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="avatar" style={avatarStyle(i)}>{initials(c?.name || '?')}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{c?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{s.events?.name} · {elapsed}h elapsed</div>
                        {s.check_in_lat && <a href={`https://maps.google.com/?q=${s.check_in_lat},${s.check_in_lng}`} target="_blank" rel="noreferrer" className="location-pill" style={{ marginTop: '4px', display: 'inline-flex' }}>📍 View location</a>}
                      </div>
                      <span className="badge badge-active">Active</span>
                    </div>
                  )
                })}
              </div>

              <div className="card">
                <div className="card-title">Pending claims</div>
                {pendingClaims.length === 0 ? <div className="empty">No pending claims</div> : pendingClaims.slice(0, 5).map(cl => {
                  const c = crew.find(x => x.id === cl.user_id)
                  return (
                    <div key={cl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '14px' }}>{c?.name} — {cl.type}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{cl.events?.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>RM {cl.amount.toFixed(2)}</span>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--success)', borderColor: '#bbf7d0' }} onClick={() => updateClaimStatus(cl.id, 'approved')}>✓ Approve</button>
                      </div>
                    </div>
                  )
                })}
                {pendingClaims.length > 5 && <div style={{ fontSize: '13px', color: 'var(--muted)', paddingTop: '8px' }}>+{pendingClaims.length - 5} more — see Claims tab</div>}
              </div>
            </div>
          </div>
        )}

        {/* CREW */}
        {tab === 'crew' && (
          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-title">Add crew member</div>
              <div className="grid2">
                <div className="field"><label>Full name *</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ahmad Faris" /></div>
                <div className="field"><label>Phone * (used to log in)</label><input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="012-345 6789" /></div>
                <div className="field"><label>Password *</label><input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Set their login password" /></div>
                <div className="field"><label>Email (optional)</label><input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ahmad@email.com" /></div>
                <div className="field"><label>Hourly rate (RM)</label><input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="12.00" step="0.50" /></div>
                <div className="field"><label>Role</label><select value={newRole} onChange={e => setNewRole(e.target.value)}><option value="crew">Crew</option><option value="full-time">Full Time</option><option value="team-lead">Team Lead</option><option value="admin">Admin</option></select></div>
              </div>
              <button className="btn btn-primary" onClick={addCrew} disabled={busy}>{busy ? <span className="spinner" /> : '+ Add crew member'}</button>
            </div>

            <div className="card">
              <div className="card-title">Crew roster ({crew.length})</div>
              {crew.length === 0 ? <div className="empty">No crew yet</div> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Member</th><th>Role</th><th>Email</th><th>Rate</th><th></th></tr></thead>
                    <tbody>
                      {crew.map((c, i) => (
                        <tr key={c.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar" style={avatarStyle(i)}>{initials(c.name)}</div>
                              <div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.phone}</div></div>
                            </div>
                          </td>
                          <td><span className="badge badge-paid" style={{ textTransform: 'capitalize' }}>{c.role.replace('-', ' ')}</span></td>
                          <td style={{ fontSize: '13px' }}>{c.email || '—'}</td>
                          <td>
                            {editingRateId === c.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>RM</span>
                                <input type="number" value={editRateValue} onChange={e => setEditRateValue(e.target.value)} step="0.50" min="0" style={{ width: '80px' }} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveRate(c.id); if (e.key === 'Escape') cancelEditRate() }} />
                                <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => saveRate(c.id)}>Save</button>
                                <button className="btn" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={cancelEditRate}>Cancel</button>
                              </div>
                            ) : (
                              <span style={{ cursor: 'pointer' }} onClick={() => startEditRate(c)} title="Click to edit">RM {(c.hourly_rate || 0).toFixed(2)}/hr ✏️</span>
                            )}
                          </td>
                          <td><button className="btn" style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--danger)' }} onClick={() => removeCrew(c.id, c.name)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EVENTS */}
        {tab === 'events' && (
          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-title">Create event</div>
              <div className="grid2">
                <div className="field"><label>Event name *</label><input value={evName} onChange={e => setEvName(e.target.value)} placeholder="Sunway Wedding Expo" /></div>
                <div className="field"><label>Venue *</label><input value={evVenue} onChange={e => setEvVenue(e.target.value)} placeholder="Sunway Pyramid Convention Centre" /></div>
                <div className="field"><label>Date *</label><input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} /></div>
                <div className="grid2" style={{ gap: '8px' }}>
                  <div className="field"><label>Start time</label><input type="time" value={evStart} onChange={e => setEvStart(e.target.value)} /></div>
                  <div className="field"><label>End time</label><input type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} /></div>
                </div>
                <div className="field"><label>Venue latitude (optional, for map)</label><input value={evLat} onChange={e => setEvLat(e.target.value)} placeholder="3.07167" /></div>
                <div className="field"><label>Venue longitude</label><input value={evLng} onChange={e => setEvLng(e.target.value)} placeholder="101.60694" /></div>
              </div>
              <div className="field">
                <label>Assign crew (hold Ctrl/Cmd to select multiple)</label>
                <select multiple value={evAssigned} onChange={e => setEvAssigned(Array.from(e.target.selectedOptions, o => o.value))} style={{ height: '120px' }}>
                  {crew.filter(c => c.role !== 'admin').map(c => <option key={c.id} value={c.id}>{c.name} ({c.role})</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={addEvent} disabled={busy}>{busy ? <span className="spinner" /> : '+ Create event'}</button>
            </div>

            <div className="card">
              <div className="card-title">All events</div>
              {events.length === 0 ? <div className="empty">No events yet</div> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Assigned crew</th><th></th></tr></thead>
                    <tbody>
                      {events.map(ev => (
                        <tr key={ev.id}>
                          <td style={{ fontWeight: 600 }}>{ev.name}</td>
                          <td style={{ fontSize: '13px' }}>{fmtDate(ev.event_date)}</td>
                          <td style={{ fontSize: '13px' }}>{ev.venue}{ev.venue_lat && <> · <a href={`https://maps.google.com/?q=${ev.venue_lat},${ev.venue_lng}`} target="_blank" rel="noreferrer" className="location-pill" style={{ marginLeft: '4px' }}>Map</a></>}</td>
                          <td style={{ fontSize: '13px' }}>{ev.event_assignments?.map(a => a.users?.name).join(', ') || '—'}</td>
                          <td><button className="btn" style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--danger)' }} onClick={async () => { if (confirm('Delete event?')) { await api(token).del('/api/crew/events', { id: ev.id }); await load() } }}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SESSIONS */}
        {tab === 'sessions' && (
          <div className="card">
            <div className="section-header">
              <div className="card-title">All work sessions</div>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{sessions.length} sessions total</span>
            </div>
            {sessions.length === 0 ? <div className="empty">No sessions yet</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Crew</th><th>Event</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Location</th></tr></thead>
                  <tbody>
                    {sessions.map(s => {
                      const c = crew.find(x => x.id === s.user_id)
                      const ci = crew.findIndex(x => x.id === s.user_id)
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar" style={{ ...avatarStyle(ci), width: '28px', height: '28px', fontSize: '11px' }}>{initials(c?.name || '?')}</div>
                              {c?.name || '—'}
                            </div>
                          </td>
                          <td style={{ fontSize: '13px' }}>{s.events?.name}</td>
                          <td style={{ fontSize: '13px' }}>{fmt(s.check_in)}</td>
                          <td style={{ fontSize: '13px' }}>{s.check_out ? fmt(s.check_out) : <span className="badge badge-active">Active</span>}</td>
                          <td>{s.hours ? <span className="badge badge-paid">{s.hours.toFixed(1)}h</span> : '—'}</td>
                          <td>{s.check_in_lat ? <a href={`https://maps.google.com/?q=${s.check_in_lat},${s.check_in_lng}`} target="_blank" rel="noreferrer" className="location-pill">📍 View</a> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CLAIMS */}
        {tab === 'claims' && (
          <div className="card">
            <div className="card-title">All claims</div>
            {claims.length === 0 ? <div className="empty">No claims yet</div> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Crew</th><th>Event</th><th>Type</th><th>Description</th><th>Amount</th><th>Receipt</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {claims.map(cl => {
                      const c = crew.find(x => x.id === cl.user_id)
                      return (
                        <tr key={cl.id}>
                          <td style={{ fontWeight: 500 }}>{c?.name || '—'}</td>
                          <td style={{ fontSize: '13px' }}>{cl.events?.name}</td>
                          <td><span className="badge badge-neutral">{cl.type}</span></td>
                          <td style={{ fontSize: '13px', color: 'var(--muted)', maxWidth: '200px' }}>{cl.description || '—'}{cl.distance_km ? ` (${cl.distance_km}km)` : ''}</td>
                          <td style={{ fontWeight: 600 }}>RM {cl.amount.toFixed(2)}</td>
                          <td>{cl.receipt_url ? <a href={cl.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize: '18px', textDecoration: 'none' }}>📎</a> : '—'}</td>
                          <td><span className={`badge badge-${cl.status}`}>{cl.status}</span></td>
                          <td>
                            <select value={cl.status} onChange={e => updateClaimStatus(cl.id, e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: 'auto', borderRadius: '6px', border: '1px solid var(--border-md)' }}>
                              <option value="pending">pending</option>
                              <option value="approved">approved</option>
                              <option value="paid">paid</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* PAYROLL */}
        {tab === 'payroll' && (
          <div>
            <div className="grid3" style={{ marginBottom: '1rem' }}>
              <div className="metric"><div className="metric-label">Total wages</div><div className="metric-value">RM {payroll.reduce((s, c) => s + c.wages, 0).toFixed(2)}</div></div>
              <div className="metric"><div className="metric-label">Total allowances</div><div className="metric-value">RM {payroll.reduce((s, c) => s + c.allowances, 0).toFixed(2)}</div></div>
              <div className="metric"><div className="metric-label">Grand total payout</div><div className="metric-value payroll-total">RM {totalPayout.toFixed(2)}</div></div>
            </div>

            <div className="card">
              <div className="section-header">
                <div className="card-title">Payroll breakdown</div>
                <button className="btn" onClick={exportCSV}>⬇ Export CSV</button>
              </div>
              {payroll.length === 0 ? <div className="empty">No payroll data yet</div> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Crew member</th><th>Sessions</th><th>Hours</th><th>Rate</th><th>Wages</th><th>Allowances</th><th>Total</th><th>Bank / e-wallet</th></tr></thead>
                    <tbody>
                      {payroll.map(c => (
                        <tr key={c.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar" style={avatarStyle(c.idx)}>{initials(c.name)}</div>
                              <div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.phone}</div></div>
                            </div>
                          </td>
                          <td>{c.sessions}</td>
                          <td>{c.hours.toFixed(1)}h</td>
                          <td>RM {c.hourly_rate.toFixed(2)}</td>
                          <td>RM {c.wages.toFixed(2)}</td>
                          <td>RM {c.allowances.toFixed(2)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>RM {c.total.toFixed(2)}</td>
                          <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{c.bank_details || '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg)' }}>
                        <td colSpan={4} style={{ fontWeight: 700 }}>Total</td>
                        <td style={{ fontWeight: 700 }}>RM {payroll.reduce((s, c) => s + c.wages, 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>RM {payroll.reduce((s, c) => s + c.allowances, 0).toFixed(2)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '16px' }}>RM {totalPayout.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
