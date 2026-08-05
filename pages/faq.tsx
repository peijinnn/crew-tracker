import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useAuth } from '../lib/useAuth'
import Nav from '../components/Nav'

type QA = { q: string; a: string }

const GENERAL: QA[] = [
  { q: 'What are the different crew roles?', a: 'Crew, Full Time, and Team Lead are all staff roles that share the same check-in and claims view — they mainly differ in hourly rate and how the admin organizes the roster. Admin is a separate role with full access to manage crew, events, and payroll.' },
  { q: 'How does check-in / check-out work?', a: 'On the Check-in tab, tap "Check in" on an event you\'re assigned to — your GPS location is captured. When you\'re done, tap "Check out" (also GPS-captured). Your hours for that shift are calculated automatically from the two timestamps.' },
]

const CLAIMS: QA[] = [
  { q: 'What does "Linked session" mean on a claim?', a: 'Each check-in/check-out you complete creates a "session" (one shift). When submitting a claim, you can optionally link it to one of your completed sessions so the admin can see exactly which shift the expense relates to. Leave it as "Not linked to a specific session" if the claim isn\'t tied to one particular shift.' },
  { q: 'How is the transport claim calculated?', a: 'Transport is RM 0.45/km, based on the total route distance from Google Maps across all the stops you enter (start → any stops → destination). It\'s a single-trip distance, not doubled for a return trip.' },
  { q: 'How is the meal allowance calculated?', a: 'You enter an amount per meal and how many meals (1, 2, or 3 for a full day) — the claim total is amount × number of meals.' },
  { q: 'What claim types are there?', a: 'Meal allowance, Transport (auto-calculated from route distance), Parking (with an optional receipt upload), and Other (a free-form description plus amount, e.g. equipment purchases).' },
  { q: 'What happens after I submit a claim?', a: 'It appears as Pending in your History tab. The admin reviews it in the Claims tab and marks it Approved, Rejected, or Paid — you can check the status any time in your own History.' },
]

const ADMIN: QA[] = [
  { q: 'What does "View as" do?', a: 'From the Crew tab, click "View as" on any crew member to see the app exactly as they do — their real assigned events, sessions, and claims. A banner appears at the top so you can jump back to your admin view at any time. Actions taken while viewing as someone (like checking in/out or submitting a claim) are real and affect their account.' },
  { q: "How do I change a crew member's hourly rate?", a: 'In the Crew tab roster table, click directly on the rate value (it has a ✏️ next to it) to edit it inline.' },
  { q: 'How do I export payroll?', a: 'Go to the Payroll tab — it breaks down wages plus approved allowances per crew member, with a CSV export button.' },
]

function Section({ title, items }: { title: string; items: QA[] }) {
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-title">{title}</div>
      {items.map((item, i) => (
        <details key={i} style={{ marginBottom: i < items.length - 1 ? '10px' : 0, paddingBottom: i < items.length - 1 ? '10px' : 0, borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}>{item.q}</summary>
          <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>{item.a}</p>
        </details>
      ))}
    </div>
  )
}

export default function Faq() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (!user) return null

  return (
    <>
      <Head><title>Crew Tracker — FAQ</title></Head>
      <Nav title="FAQ" />
      <div className="container page">
        <Section title="General" items={GENERAL} />
        <Section title="Claims" items={CLAIMS} />
        {user.role === 'admin' && <Section title="For Admins" items={ADMIN} />}
      </div>
    </>
  )
}
