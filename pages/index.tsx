import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/useAuth'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!user) router.push('/login')
    else router.push(user.role === 'admin' ? '/admin' : '/staff')
  }, [user, loading, router])
  return null
}
