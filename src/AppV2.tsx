import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getSession, onAuthStateChange, signOut } from '@/lib/supabase'
import { StaffAuthModal, StaffLanding } from '@/components/staff/AuthLanding'
import { StaffWorkspace } from '@/components/staff/StaffWorkspace'
import type { AuthMode } from '@/lib/staffUi'

export default function AppV2() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [nexaBenefit, setNexaBenefit] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nexaToken = params.get('nexaToken')
    if (nexaToken) {
      localStorage.setItem('nexaToken', nexaToken)
      setNexaBenefit(true)
      window.history.replaceState({}, document.title, window.location.pathname)
    } else {
      setNexaBenefit(Boolean(localStorage.getItem('nexaToken')))
    }

    getSession().then((session) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    const { data: { subscription } } = onAuthStateChange((nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await signOut()
    setUser(null)
  }

  if (loading) {
    return <div className="min-h-screen bg-dark flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
  }

  if (user) return <StaffWorkspace user={user} onLogout={logout} />

  return (
    <>
      <StaffLanding onStart={setAuthMode} nexaBenefit={nexaBenefit} />
      {authMode && (
        <StaffAuthModal
          mode={authMode}
          onMode={setAuthMode}
          onClose={() => setAuthMode(null)}
          onAuthenticated={() => setAuthMode(null)}
        />
      )}
    </>
  )
}
