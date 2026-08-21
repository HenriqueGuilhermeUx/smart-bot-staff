import { useState } from 'react'
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { getSession, signOut, updatePassword } from '@/lib/supabase'
import { StaffLogo } from '@/components/staff/Brand'

export function PasswordRecovery({ onCompleted, onDeleted }: { onCompleted: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function saveNewPassword() {
    setMessage('')
    if (password.length < 6) return setMessage('A nova senha deve ter pelo menos 6 caracteres.')
    if (password !== confirmPassword) return setMessage('As senhas não coincidem.')

    setSaving(true)
    try {
      await updatePassword(password)
      window.history.replaceState({}, document.title, window.location.pathname)
      onCompleted()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR') {
      setMessage('Digite EXCLUIR para confirmar a exclusão.')
      return
    }

    setDeleting(true)
    setMessage('')
    try {
      const session = await getSession()
      if (!session?.access_token) throw new Error('O link expirou. Solicite uma nova recuperação de senha.')

      const response = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir a conta.')

      await signOut().catch(() => undefined)
      window.history.replaceState({}, document.title, window.location.pathname)
      onDeleted()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a conta.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark text-white px-4 py-10 flex items-center justify-center">
      <div className="glass-card w-full max-w-lg p-6 md:p-8">
        <StaffLogo />
        {!deleteMode ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 grid place-items-center mt-8 mb-5"><KeyRound className="w-7 h-7 text-purple-300" /></div>
            <h1 className="text-2xl md:text-3xl font-black">Crie uma nova senha</h1>
            <p className="text-slate-400 mt-3">Seu e-mail foi verificado pelo link de recuperação. Agora você pode definir uma nova senha para voltar ao Staff.</p>

            <label className="block mt-6">
              <span className="text-sm text-slate-300">Nova senha</span>
              <input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 outline-none focus:border-purple-500" placeholder="Mínimo 6 caracteres" />
            </label>
            <label className="block mt-4">
              <span className="text-sm text-slate-300">Confirme a nova senha</span>
              <input type="password" minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 outline-none focus:border-purple-500" />
            </label>

            {message && <p className="mt-4 text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">{message}</p>}

            <button onClick={() => void saveNewPassword()} disabled={saving || !password || !confirmPassword} className="btn-purple w-full mt-6 py-3.5 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-40">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Salvar nova senha
            </button>

            <div className="mt-7 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500">Não quer recuperar o acesso e prefere apagar seus dados?</p>
              <button onClick={() => { setDeleteMode(true); setMessage('') }} className="mt-3 text-sm text-rose-300 hover:text-rose-200 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Excluir minha conta em vez disso</button>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 grid place-items-center mt-8 mb-5"><AlertTriangle className="w-7 h-7 text-rose-300" /></div>
            <h1 className="text-2xl md:text-3xl font-black">Excluir conta e dados?</h1>
            <p className="text-slate-400 mt-3">Como o link de recuperação verificou seu e-mail, você pode excluir a conta mesmo sem lembrar a senha antiga. Esta ação é permanente.</p>
            <label className="block mt-6">
              <span className="text-sm text-slate-300">Digite <strong>EXCLUIR</strong> para confirmar</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-rose-500/30 outline-none focus:border-rose-400" autoComplete="off" />
            </label>
            {message && <p className="mt-4 text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{message}</p>}
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button onClick={() => { setDeleteMode(false); setMessage('') }} disabled={deleting} className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">Voltar</button>
              <button onClick={() => void deleteAccount()} disabled={deleting || deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR'} className="py-3 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Excluir permanentemente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
