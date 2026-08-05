import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth, api } from '../lib/useAuth'
import Nav from '../components/Nav'
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import PlaceAutocomplete from '../components/PlaceAutocomplete'

const TRANSPORT_RATE = 0.45

function fmt(dt: string) {
  if (!dt) return '—'
  const d = new Date(dt)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const time = d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
  return `${day}/${month}/${d.getFullYear()}, ${time}`
}
function fmtDate(dt: string) {
  const [y, m, d] = dt.split('-')
  return `${d}/${m}/${y}`
}

function SortableRoutePoint({ rp, i, total, isConfirmed, onPlaceSelected, onRemove }: {
  rp: { id: string; address: string }
  i: number
  total: number
  isConfirmed: boolean
  onPlaceSelected: (loc: any, addr: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rp.id })
  const color = i === 0 ? '#22c55e' : i === total - 1 ? '#ef4444' : '#f59e0b'
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <button {...attributes} {...listeners} style={{ cursor: isDragging ? 'grabbing' : 'grab', background: 'none', border: 'none', padding: '4px 2px', color: 'var(--muted)', flexShrink: 0, fontSize: '18px', lineHeight: 1, touchAction: 'none' }} title="Drag to reorder">⠿</button>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
        {String.fromCharCode(65 + i)}
      </div>
      <PlaceAutocomplete
        placeholder={i === 0 ? 'Starting point' : i === total - 1 ? 'Destination' : `Stop ${String.fromCharCode(65 + i)}`}
        onPlaceSelected={onPlaceSelected}
      />
      {isConfirmed && <span style={{ color: '#22c55e', fontSize: '14px', flexShrink: 0 }}>✓</span>}
      {total > 2 && (
        <button className="btn" style={{ padding: '2px 8px', fontSize: '12px', color: 'var(--danger)', flexShrink: 0 }} onClick={onRemove}>✕</button>
      )}
    </div>
  )
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
  const [routePoints, setRoutePoints] = useState<{ id: string; address: string }[]>([{ id: 'a', address: '' }, { id: 'b', address: '' }])
  const [totalDistKm, setTotalDistKm] = useState('')
  const [claimParking, setClaimParking] = useState(false)
  const [parkingAmt, setParkingAmt] = useState('')
  const [parkingNote, setParkingNote] = useState('')
  const [parkingFile, setParkingFile] = useState<File | null>(null)
  const [claimToll, setClaimToll] = useState(false)
  const [tollAmt, setTollAmt] = useState('')
  const [tollNote, setTollNote] = useState('')
  const [tollFile, setTollFile] = useState<File | null>(null)
  const [claimOther, setClaimOther] = useState(false)
  const [otherDesc, setOtherDesc] = useState('')
  const [otherAmt, setOtherAmt] = useState('')

  const [calculating, setCalculating] = useState(false)
  const [selectedLocs, setSelectedLocs] = useState<Record<string, { lat: number; lng: number }>>({})

  useEffect(() => {
    if (!claimTransport) { setSelectedLocs({}); setTotalDistKm('') }
  }, [claimTransport])

  const calcRoute = async () => {
    const locs = routePoints.map(rp => selectedLocs[rp.id]).filter(Boolean)
    if (locs.length < 2) { setMsg({ type: 'error', text: `Only ${locs.length}/${routePoints.length} stops confirmed — click a suggestion from the dropdown for each address box` }); return }
    setCalculating(true); setMsg(null)
    try {
      const r = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: locs }),
      })
      const data = await r.json()
      if (data.error) { setMsg({ type: 'error', text: `Route error: ${data.error}${data.message ? ' — ' + data.message : ''}` }); return }
      setTotalDistKm(String(data.distance_km))
    } catch { setMsg({ type: 'error', text: 'Failed to calculate route' }) }
    finally { setCalculating(false) }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRoutePoints(prev => {
        const from = prev.findIndex(rp => rp.id === String(active.id))
        const to = prev.findIndex(rp => rp.id === String(over.id))
        return arrayMove(prev, from, to)
      })
      setTotalDistKm('')
    }
  }

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

  const uploadFile = async (file: File): Promise<string | null> => {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const base64 = (e.target!.result as string).split(',')[1]
          const r = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, contentType: file.type, data: base64 }),
          })
          const d = await r.json()
          resolve(d.url || null)
        } catch { resolve(null) }
      }
      reader.readAsDataURL(file)
    })
  }

  const claimTotal = () => {
    let t = 0
    if (claimMeal) t += (parseFloat(mealAmt) || 0) * (parseInt(mealSessions) || 1)
    if (claimParking) t += parseFloat(parkingAmt) || 0
    if (claimToll) t += parseFloat(tollAmt) || 0
    if (claimTransport) t += (parseFloat(totalDistKm) || 0) * TRANSPORT_RATE
    if (claimOther) t += parseFloat(otherAmt) || 0
    return t
  }

  const submitClaim = async () => {
    if (!claimEventId) { setMsg({ type: 'error', text: 'Select an event' }); return }
    setBusy(true); setMsg(null)
    try {
      const [parkingUrl, tollUrl] = await Promise.all([
        claimParking && parkingFile ? uploadFile(parkingFile) : Promise.resolve(null),
        claimToll && tollFile ? uploadFile(tollFile) : Promise.resolve(null),
      ])

      const items: Record<string, unknown>[] = []
      if (claimMeal) items.push({ type: 'meal', description: `Meal allowance (${mealSessions} session${parseInt(mealSessions) > 1 ? 's' : ''})`, amount: (parseFloat(mealAmt) || 0) * (parseInt(mealSessions) || 1) })
      if (claimParking) items.push({ type: 'parking', description: `Parking${parkingNote ? ' — ' + parkingNote : ''}`, amount: parseFloat(parkingAmt) || 0, receipt_note: parkingNote, receipt_url: parkingUrl || undefined })
      if (claimToll) items.push({ type: 'toll', description: `Toll${tollNote ? ' — ' + tollNote : ''}`, amount: parseFloat(tollAmt) || 0, receipt_note: tollNote, receipt_url: tollUrl || undefined })
      if (claimTransport && totalDistKm) items.push({ type: 'transport', description: `Transport ${routePoints.map(rp => rp.address).filter(Boolean).join(' → ')}`, amount: parseFloat(totalDistKm) * TRANSPORT_RATE, distance_km: parseFloat(totalDistKm), from_location: routePoints[0].address, to_location: routePoints[routePoints.length - 1].address })
      if (claimOther) items.push({ type: 'other', description: otherDesc, amount: parseFloat(otherAmt) || 0 })
      if (!items.length) { setMsg({ type: 'error', text: 'Add at least one claim' }); return }

      const a = api(token)
      await Promise.all(items.map(item => a.post('/api/claims', { event_id: claimEventId, session_id: claimSessionId || undefined, ...item })))
      setMsg({ type: 'success', text: `✅ Claim submitted! RM ${claimTotal().toFixed(2)} pending approval.` })
      setClaimMeal(false); setClaimTransport(false); setClaimParking(false); setClaimToll(false); setClaimOther(false)
      setMealAmt(''); setParkingAmt(''); setParkingFile(null); setTollAmt(''); setTollNote(''); setTollFile(null); setOtherAmt('')
      setSelectedLocs({})
      setRoutePoints([{ id: 'a', address: '' }, { id: 'b', address: '' }]); setTotalDistKm('')
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
              <div style={{ paddingLeft: '8px', marginBottom: '12px' }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={routePoints.map(rp => rp.id)} strategy={verticalListSortingStrategy}>
                    {routePoints.map((rp, i) => (
                      <SortableRoutePoint
                        key={rp.id}
                        rp={rp}
                        i={i}
                        total={routePoints.length}
                        isConfirmed={!!selectedLocs[rp.id]}
                        onPlaceSelected={(loc, addr) => {
                          setSelectedLocs(prev => ({ ...prev, [rp.id]: { lat: loc.lat(), lng: loc.lng() } }))
                          setRoutePoints(prev => prev.map(p => p.id === rp.id ? { ...p, address: addr } : p))
                        }}
                        onRemove={() => {
                          setSelectedLocs(prev => { const n = { ...prev }; delete n[rp.id]; return n })
                          setRoutePoints(prev => prev.filter(p => p.id !== rp.id))
                          setTotalDistKm('')
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', paddingLeft: '32px' }}>
                  {routePoints.filter(rp => selectedLocs[rp.id]).length}/{routePoints.length} stops confirmed ✓ · drag ⠿ to reorder
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', paddingLeft: '32px' }}>
                  <button className="btn" style={{ fontSize: '13px' }} onClick={() => {
                    const newId = Math.random().toString(36).slice(2, 6)
                    setRoutePoints(prev => [...prev, { id: newId, address: '' }])
                  }}>+ Add stop</button>
                  <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={calcRoute} disabled={calculating}>{calculating ? <span className="spinner" /> : 'Calculate route'}</button>
                </div>
                <div className="field" style={{ paddingLeft: '32px' }}>
                  <label>Total route distance (km)</label>
                  <input type="text" value={totalDistKm} readOnly placeholder="Press Calculate route" style={{ background: 'var(--bg-input, #f5f5f5)', color: 'var(--muted)', cursor: 'not-allowed' }} />
                  {totalDistKm && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>RM {(parseFloat(totalDistKm) * TRANSPORT_RATE).toFixed(2)} ({totalDistKm}km × RM{TRANSPORT_RATE})</div>}
                </div>
              </div>
            )}

            {/* Parking */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimParking} onChange={e => setClaimParking(e.target.checked)} /> 🅿️ Parking claim
            </label>
            {claimParking && (
              <div style={{ marginBottom: '12px', paddingLeft: '24px' }}>
                <div className="grid2">
                  <div className="field"><label>Amount (RM)</label><input type="number" value={parkingAmt} onChange={e => setParkingAmt(e.target.value)} placeholder="8.00" step="0.50" /></div>
                  <div className="field"><label>Note (optional)</label><input type="text" value={parkingNote} onChange={e => setParkingNote(e.target.value)} placeholder="Parking ref or location" /></div>
                </div>
                <div className="field">
                  <label>Receipt <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(image or PDF, max 5MB)</span></label>
                  <input type="file" accept="image/*,application/pdf" onChange={e => setParkingFile(e.target.files?.[0] || null)} />
                  {parkingFile && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>📎 {parkingFile.name} ({(parkingFile.size / 1024).toFixed(0)} KB)</div>}
                </div>
              </div>
            )}

            {/* Toll */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px', fontWeight: 500 }}>
              <input type="checkbox" checked={claimToll} onChange={e => setClaimToll(e.target.checked)} /> 🛣️ Toll claim
            </label>
            {claimToll && (
              <div style={{ marginBottom: '12px', paddingLeft: '24px' }}>
                <div className="grid2">
                  <div className="field"><label>Amount (RM)</label><input type="number" value={tollAmt} onChange={e => setTollAmt(e.target.value)} placeholder="5.00" step="0.50" /></div>
                  <div className="field"><label>Note (optional)</label><input type="text" value={tollNote} onChange={e => setTollNote(e.target.value)} placeholder="e.g. SMART Tunnel, PLUS" /></div>
                </div>
                <div className="field">
                  <label>Receipt <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(image or PDF, max 5MB)</span></label>
                  <input type="file" accept="image/*,application/pdf" onChange={e => setTollFile(e.target.files?.[0] || null)} />
                  {tollFile && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>📎 {tollFile.name} ({(tollFile.size / 1024).toFixed(0)} KB)</div>}
                </div>
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
