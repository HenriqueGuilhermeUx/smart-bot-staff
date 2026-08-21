import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getSession, onAuthStateChange, signOut } from '@/lib/supabase'
import { StaffAuthModal, StaffLanding } from '@/components/staff/AuthLanding'
import { StaffWorkspace } from '@/components/staff/StaffWorkspace'
import { PasswordRecovery } from '@/components/staff/PasswordRecovery'
import type { AuthMode } from '@/lib/staffUi'

function recoveryMarkerPresent() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash || ''
  return params.get('staff_recovery') === '1' || params.get('type') === 'recovery' || /type=recovery|access_token=/.test(hash)
}

export default function AppV2() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(() => recoveryMarkerPresent())

  useEffect(() => {
    // Staff is an independent product. Remove any legacy Nexa token left by older builds.
    localStorage.removeItem('nexaToken')

    getSession().then((session) => {
      setUser(session?.user || null)
      if (recoveryMarkerPresent() && session?.user) setPasswordRecovery(true)
      setLoading(false)
    })

    const { data: { subscription } } = onAuthStateChange((nextUser, event) => {
      setUser(nextUser)
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await signOut()
    setUser(null)
  }

  function finishRecovery() {
    setPasswordRecovery(false)
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  function finishDeletion() {
    setPasswordRecovery(false)
    setUser(null)
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (loading) {
    return <div className="min-h-screen bg-dark flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>
  }

  if (passwordRecovery && user) {
    return <PasswordRecovery onCompleted={finishRecovery} onDeleted={finishDeletion} />
  }

  if (user) return <StaffWorkspace user={user} onLogout={logout} />

  return (
    <>
      <StaffLanding onStart={setAuthMode} />
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
