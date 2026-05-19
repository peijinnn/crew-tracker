import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth, api } from '../lib/useAuth'
import Nav from '../components/Nav'

const TRANSPORT_RATE = 0.45

function fmt(dt: string) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Staff() {
  const { user, token, loading } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'checkin' | 'claims' | 'history'>('checkin')
  const [events, setEvents] = useState<Event[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [locating, setLocating] = useState(false)
  const [msg, setMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // Claim form state
  const [claimEventId, setClaimEventId] = useState('')
  const [claimSessionId, setClaimSessionId] = useState('')
  const [claimMeal, setClaimMeal] = useState(false)
  const [mealAmt, setMealAmt] = useState('')
  const [mealSessions, setMealSessions] = useState('1')
  const [claimTransport, setClaimTransport] = useState(false)
  const [transportLegs, setTransportLegs] = useState<{ from: string; to: string; distKm: string }[]>([{ from: '', to: '', distKm: '' }])
  const [claimParking, setClaimParking] = useState(false)
  const [parkingAmt, setParkingAmt] = useState('')
  const [parkingNote, setParkingNote] = useState('')
  const [claimOther, setClaimOther] = useState(false)
  const [otherDesc, setOtherDesc] = useState('')
  const [otherAmt, setOtherAmt] = useState('')

  const fromRefs = useRef<(HTMLInputElement | null)[]>([])
  const toRefs = useRef<(HTMLInputElement | null)[]>([])
  const acInited = useRef<boolean[]>([])

  const initACForIndex = (i: number) => {
    const g = (window as any).google
    if (!g?.maps?.places || acInited.current[i]) return
    const fromEl = fromRefs.current[i]; const toEl = toRefs.current[i]
    if (!fromEl || !toEl) return
    acInited.current[i] = true
    const opts = { componentRestrictions: { country: 'my' }, fields: ['geometry', 'formatted_address', 'name'] }
    const fromAC = new g.maps.places.Autocomplete(fromEl, opts)
    const toAC = new g.maps.places.Autocomplete(toEl, opts)
    const calcDist = () => {
      const fp = fromAC.getPlace(); const tp = toAC.getPlace()
      if (!fp?.geometry || !tp?.geometry) return
      setTransportLegs(prev => { const u = [...prev]; u[i] = { ...u[i], from: fp.formatted_address || fp.name || '', to: tp.formatted_address || tp.name || '' }; return u })
      new g.maps.DistanceMatrixService().getDistanceMatrix(
        { origins: [fp.geometry.location], destinations: [tp.geometry.location], travelMode: 'DRIVING' },
        (res: any, status: string) => {
          if (status === 'OK' && res.rows[0].elements[0].status === 'OK')
            setTransportLegs(prev => { const u = [...prev]; u[i] = { ...u[i], distKm: (res.rows[0].elements[0].distance.value / 1000).toFixed(1) }; return u })
        }
      )
    }
    fromAC.addListener('place_changed', calcDist)
    toAC.addListener('place_changed', calcDist)
  }

  useEffect(() => {
    if (!claimTransport) { acInited.current = []; return }
    const t = setTimeout(() => transportLegs.forEach((_, i) => initACForIndex(i)), 150)
    return () => clearTimeout(t)
  }, [claimTransport, transportLegs.length])

  type Event = { id: string; name: string; venue: string; event_date: string; assigned_role?: string }
  type Session = { id: string; event_id: string; check_in: string; check_out?: string; hours?: number; check_in_lat?: number; check_in_lng?: number; events?: { name: string; venue: string }; role?: string }
  type Claim = { id: string; event_id: string; type: string; description?: string; amount: number; status: string; created_at: string; events?: { name: string } }

  const load = useCallback(async () => {
    if (!token) return
    const a = api(token)
    const [ev, sess, cl] = await Promise.all([a.get('/api/crew/events'), a.get('/api/sessions'), a.get('/api/claims')])
    setEvents(Array.isArray(ev) ? ev : [])
    const sessArr: Session[] = Array.isArray(sess) ? sess : []
    setSessions(sessArr)
    setActiveSession(sessArr.find((s: Session) => !s.check_out) || null)
    setClaims(Array.isArray(cl) ? cl : [])
  }, [token])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user?.role === 'admin') router.push('/admin')
    if (!loading && user) load()
  }, [user, loading, router, load])

  const getLocation = (): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported on this device'))
      navigator.geolocation.getCurrentPosition(pos => resolve(pos.coords), err => reject(new Error('Could not get location: ' + err.message)), { timeout: 10000, enableHighAccuracy: true })
    })
  }

  const checkIn = async (eventId: string, role: string) => {
    setLocating(true); setBusy(true); setMsg(null)
    try {
      const coords = await getLocation()
      let address = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
      // Try reverse geocode if Google Maps key available
      const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
      if (mapsKey) {
        try {
          const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.latitude},${coords.longitude}&key=${mapsKey}`)
          const d = await r.json()
          if (d.results?.[0]) address = d.results[0].formatted_address
        } catch {}
      }
      const res = await api(token).post('/api/sessions', {
        event_id: eventId, lat: coords.latitude, lng: coords.longitude, address, role
      })
      if (res.error) { setMsg({ type: 'error', text: res.error }); return }
      setMsg({ type: 'success', text: `✅ Checked in! Location recorded.` })
      await load()
    } catch (e: unknown) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Check-in failed' })
    } finally { setLocating(false); setBusy(false) }
  }

  const checkOut = async () => {
    if (!activeSession) return
    setLocating(true); setBusy(true); setMsg(null)
    try {
      const coords = await getLocation()
      const res = await api(token).patch('/api/sessions', {
        session_id: activeSession.id, lat: coords.latitude, lng: coords.longitude
      })
      if (res.error) { setMsg({ type: 'error', text: res.error }); return }
      setMsg({ type: 'success', text: `✅ Checked out! ${res.hours?.toFixed(1)}h recorded.` })
      await load()
    } catch (e: unknown) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Check-out failed' })
    } finally { setLocating(false); setBusy(false) }
  }

  const claimTotal = () => {
    let t = 0
    if (claimMeal) t += (parseFloat(mealAmt) || 0) * (parseInt(mealSessions) || 1)
    if (claimParking) t += parseFloat(parkingAmt) || 0
    if (claimTransport) t += transportLegs.reduce((s, l) => s + (parseFloat(l.distKm) || 0) * TRANSPORT_RATE, 0)
    if (claimOther) t += parseFloat(otherAmt) || 0
    return t
  }

  const submitClaim = async () => {
    if (!claimEventId) { setMsg({ type: 'error', text: 'Select an event' }); return }
    const items = []
    if (claimMeal) items.push({ type: 'meal', description: `Meal allowance (${mealSessions} session${parseInt(mealSessions) > 1 ? 's' : ''})`, amount: (parseFloat(mealAmt) || 0) * (parseInt(mealSessions) || 1) })
    if (claimParking) items.push({ type: 'parking', description: `Parking${parkingNote ? ' — ' + parkingNote : ''}`, amount: parseFloat(parkingAmt) || 0, receipt_note: parkingNote })
    if (claimTransport) transportLegs.filter(l => l.distKm).forEach(l => items.push({ type: 'transport', description: `Transport ${l.from} → ${l.to}`, amount: parseFloat(l.distKm) * TRANSPORT_RATE, distance_km: parseFloat(l.distKm), from_location: l.from, to_location: l.to }))
    if (claimOther) items.push({ type: 'other', description: otherDesc, amount: parseFloat(otherAmt) || 0 })
    if (!items.length) { setMsg({ type: 'error', text: 'Add at least one claim' }); return }

    setBusy(true); setMsg(null)
    try {
      const a = api(token)
      await Promise.all(items.map(item => a.post('/api/claims', { event_id: claimEventId, session_id: claimSessionId || undefined, ...item })))
      setMsg({ type: 'success', text: `✅ Claim submitted! RM ${claimTotal().toFixed(2)} pending approval.` })
      setClaimMeal(false); setClaimTransport(false); setClaimParking(false); setClaimOther(false)
      setMealAmt(''); setParkingAmt(''); setOtherAmt('')
      setTransportLegs([{ from: '', to: '', distKm: '' }])
      await load()
    } catch { setMsg({ type: 'error', text: 'Failed to submit claim' }) }
    finally { setBusy(false) }
  }

  const todayEvents = events.filter(e => e.event_date === new Date().toISOString().slice(0, 10))
  const upcomingEvents = events.filter(e => e.event_date > new Date().toISOString().slice(0, 10))

  const totalHours = sessions.filter(s => s.check_out).reduce((s, x) => s + (x.hours || 0), 0)
  const totalClaims = claims.reduce((s, c) => s + c.amount, 0)

  if (loading) return null

  return (
    <>
      <Head><title>Crew Tracker — Staff</title></Head>
      <Nav />
      <div className="container page">
        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        {/* Summary strip */}
        <div className="grid3" style={{ marginBottom: '1.5rem' }}>
          <div className="metric"><div className="metric-label">Total hours</div><div className="metric-value">{totalHours.toFixed(1)}h</div></div>
          <div className="metric"><div className="metric-label">Claims submitted</div><div className="metric-value">RM {totalClaims.toFixed(2)}</div></div>
          <div className="metric"><div className="metric-label">Status</div><div className="metric-value" style={{ fontSize: '15px' }}>{activeSession ? <span style={{ color: 'var(--success)' }}>● Checked in</span> : <span style={{ color: 'var(--muted)' }}>Not checked in</span>}</div></div>
        </div>

        {/* Active session banner */}
        {activeSession && (
          <div className="checkin-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div className="event-name">{activeSession.events?.name}</div>
                <div className="event-venue">📍 {activeSession.events?.venue}</div>
                <div style={{ fontSize: '13px', opacity: 0.8 }}>Checked in: {fmt(activeSession.check_in)}</div>
                {activeSession.check_in_lat && (
                  <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                    GPS: {activeSession.check_in_lat?.toFixed(5)}, {activeSession.check_in_lng?.toFixed(5)}
                  </div>
                )}
              </div>
              <button className="btn btn-success" onClick={checkOut} disabled={busy} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)' }}>
                {locating ? <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} /> : '🔴 Check out'}
              </button>
            </div>
          </div>
        )}

        <div className="tabs">
          {(['checkin', 'claims', 'history'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'checkin' ? '🕐 Check-in' : t === 'claims' ? '🧾 Claims' : '📋 History'}
            </button>
          ))}
        </div>

        {tab === 'checkin' && (
          <div>
            {todayEvents.length > 0 && (
              <>
                <div className="section-title" style={{ marginBottom: '0.75rem' }}>Today&apos;s events</div>
                {todayEvents.map(ev => (
                  <div key={ev.id} className="card" style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{ev.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>📍 {ev.venue}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Role: {ev.assigned_role || 'Crew'}</div>
                      </div>
                      {!activeSession ? (
                        <button className="btn btn-primary" onClick={() => checkIn(ev.id, ev.assigned_role || 'Crew')} disabled={busy}>
                          {locating ? <span className="spinner" /> : '✅ Check in'}
                        </button>
                      ) : (
                        <span className="badge badge-active">Checked in</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
            {upcomingEvents.length > 0 && (
              <>
                <div className="section-title" style={{ margin: '1.25rem 0 0.75rem' }}>Upcoming events</div>
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="card" style={{ marginBottom: '0.75rem', opacity: 0.8 }}>
                    <div style={{ fontWeight: 600 }}>{ev.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>📍 {ev.venue} · {fmtDate(ev.event_date)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Role: {ev.assigned_role || 'Crew'}</div>
                  </div>
                ))}
              </>
            )}
            {events.length === 0 && (
              <div className="empty"><div className="empty-icon">📭</div>No events assigned to you yet. Contact your admin.</div>
            )}
          </div>
        )}

        {tab === 'claims' && (
          <div className="card">
            <div className="card-title">Submit a claim</div>
            <div className="field">
              <label>Event</label>
              <select value={claimEventId} onChange={e => setClaimEventId(e.target.value)}>
                <option value="">Select event…</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {fmtDate(ev.event_date)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Linked session (optional)</label>
              <select value={claimSessionId} onChange={e => setClaimSessionId(e.target.value)}>
                <option value="">Not linked to a specific session</option>
                {sessions.filter(s => s.check_out).map(s => (
                  <option key={s.id} value={s.id}>{s.events?.name} — {fmt(s.check_in)} ({s.hours?.toFixed(1)}h)</option>
                ))}
              </select>
            </div>
            <hr />

            {/* Meal */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimMeal} onChange={e => setClaimMeal(e.target.checked)} /> 🍱 Meal allowance
            </label>
            {claimMeal && (
              <div className="grid2" style={{ marginBottom: '12px', paddingLeft: '24px' }}>
                <div className="field"><label>Amount per meal (RM)</label><input type="number" value={mealAmt} onChange={e => setMealAmt(e.target.value)} placeholder="15.00" step="0.50" /></div>
                <div className="field"><label>Number of meals</label><select value={mealSessions} onChange={e => setMealSessions(e.target.value)}><option value="1">1 meal</option><option value="2">2 meals</option><option value="3">3 meals (full day)</option></select></div>
              </div>
            )}

            {/* Transport */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimTransport} onChange={e => setClaimTransport(e.target.checked)} /> 🚗 Transport allowance
            </label>
            {claimTransport && (
              <div style={{ paddingLeft: '24px', marginBottom: '12px' }}>
                {transportLegs.map((leg, i) => (
                  <div key={i} style={{ border: '1px solid var(--border-md)', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Trip {i + 1}</span>
                      {transportLegs.length > 1 && <button className="btn" style={{ padding: '2px 8px', fontSize: '12px', color: 'var(--danger)' }} onClick={() => { setTransportLegs(prev => prev.filter((_, j) => j !== i)); acInited.current[i] = false }}>Remove</button>}
                    </div>
                    <div className="grid2">
                      <div className="field"><label>From</label><input ref={el => { fromRefs.current[i] = el }} type="text" placeholder="Type starting location..." /></div>
                      <div className="field"><label>To</label><input ref={el => { toRefs.current[i] = el }} type="text" placeholder="Type destination..." /></div>
                    </div>
                    <div className="field">
                      <label>Distance (km)</label>
                      <input type="text" value={leg.distKm} readOnly placeholder="Auto-filled when both locations selected" style={{ background: 'var(--bg-input, #f5f5f5)', color: 'var(--muted)', cursor: 'not-allowed' }} />
                      {leg.distKm && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>RM {(parseFloat(leg.distKm) * TRANSPORT_RATE).toFixed(2)} ({leg.distKm}km × RM{TRANSPORT_RATE})</div>}
                    </div>
                  </div>
                ))}
                <button className="btn" style={{ fontSize: '13px' }} onClick={() => setTransportLegs(prev => [...prev, { from: '', to: '', distKm: '' }])}>+ Add another trip</button>
              </div>
            )}

            {/* Parking */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimParking} onChange={e => setClaimParking(e.target.checked)} /> 🅿️ Parking claim
            </label>
            {claimParking && (
              <div className="grid2" style={{ marginBottom: '12px', paddingLeft: '24px' }}>
                <div className="field"><label>Amount (RM)</label><input type="number" value={parkingAmt} onChange={e => setParkingAmt(e.target.value)} placeholder="8.00" step="0.50" /></div>
                <div className="field"><label>Receipt / note</label><input type="text" value={parkingNote} onChange={e => setParkingNote(e.target.value)} placeholder="Parking ref or location" /></div>
              </div>
            )}

            {/* Other */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimOther} onChange={e => setClaimOther(e.target.checked)} /> 📎 Other
            </label>
            {claimOther && (
              <div className="grid2" style={{ marginBottom: '12px', paddingLeft: '24px' }}>
                <div className="field"><label>Description</label><input type="text" value={otherDesc} onChange={e => setOtherDesc(e.target.value)} placeholder="e.g. Equipment purchase" /></div>
                <div className="field"><label>Amount (RM)</label><input type="number" value={otherAmt} onChange={e => setOtherAmt(e.target.value)} placeholder="20.00" step="0.50" /></div>
              </div>
            )}

            <hr />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600 }}>Total claim</span>
              <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent)' }}>RM {claimTotal().toFixed(2)}</span>
            </div>
            <button className="btn btn-primary btn-full" onClick={submitClaim} disabled={busy || claimTotal() === 0}>
              {busy ? <span className="spinner" /> : 'Submit claim'}
            </button>
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-title">Work sessions</div>
              {sessions.filter(s => s.check_out).length === 0 ? (
                <div className="empty">No completed sessions yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Event</th><th>Check-in</th><th>Check-out</th><th>Hours</th><th>Location</th></tr></thead>
                    <tbody>
                      {sessions.filter(s => s.check_out).map(s => (
                        <tr key={s.id}>
                          <td>{s.events?.name || '—'}</td>
                          <td style={{ fontSize: '13px' }}>{fmt(s.check_in)}</td>
                          <td style={{ fontSize: '13px' }}>{s.check_out ? fmt(s.check_out) : '—'}</td>
                          <td><span className="badge badge-paid">{s.hours?.toFixed(1)}h</span></td>
                          <td>{s.check_in_lat ? (
                            <a href={`https://maps.google.com/?q=${s.check_in_lat},${s.check_in_lng}`} target="_blank" rel="noreferrer" className="location-pill">📍 View</a>
                          ) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">My claims</div>
              {claims.length === 0 ? (
                <div className="empty">No claims submitted yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Event</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {claims.map(c => (
                        <tr key={c.id}>
                          <td>{c.events?.name || '—'}</td>
                          <td><span className="badge badge-neutral">{c.type}</span></td>
                          <td style={{ fontSize: '13px', color: 'var(--muted)' }}>{c.description || '—'}</td>
                          <td style={{ fontWeight: 600 }}>RM {c.amount.toFixed(2)}</td>
                          <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                        </tr>
                      ))}
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
