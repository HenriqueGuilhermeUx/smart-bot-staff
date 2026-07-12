import { useState, type FormEvent } from 'react'
import { ArrowRight, Bell, Check, CheckCircle2, ChevronRight, Loader2, Sparkles, X } from 'lucide-react'
import { signIn, signUp } from '@/lib/supabase'
import type { AuthMode } from '@/lib/staffUi'
import { StaffLogo } from '@/components/staff/Brand'

export function StaffLanding({ onStart, nexaBenefit }: { onStart: (mode: AuthMode) => void; nexaBenefit: boolean }) {
  return (
    <div className="min-h-screen bg-dark text-white overflow-hidden">
      <header className="container mx-auto flex items-center justify-between py-5">
        <StaffLogo />
        <button onClick={() => onStart('login')} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
          Entrar
        </button>
      </header>

      <main className="container mx-auto pt-12 pb-20">
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center min-h-[72vh]">
          <section className="!py-0">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-200 text-sm mb-7">
              <Sparkles className="w-4 h-4" /> Sua vida organizada com a ajuda da IA
            </div>
            {nexaBenefit && (
              <div className="mb-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Benefício Nexa detectado. Entre para conectar sua conta.
              </div>
            )}
            <h1 className="text-5xl md:text-7xl font-black leading-[1.02] tracking-tight mb-6">
              Seu Staff pessoal,
              <span className="block text-gradient">sempre com você.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed mb-9">
              Organize compromissos, tarefas, contas, saúde, família, documentos e metas em um único assistente pessoal inteligente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => onStart('signup')} className="btn-purple px-7 py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                Criar minha conta gratuita <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={() => onStart('login')} className="px-7 py-4 rounded-2xl font-bold bg-slate-800/80 hover:bg-slate-700 border border-slate-700">
                Já tenho conta
              </button>
            </div>
            <div className="flex flex-wrap gap-5 mt-8 text-sm text-slate-400">
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Plano gratuito</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Dados sob seu controle</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Nexa opcional</span>
            </div>
          </section>

          <section className="!py-0 relative">
            <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full" />
            <div className="glass-card relative p-5 md:p-7 glow-effect-purple">
              <div className="flex items-center justify-between mb-6">
                <div><p className="text-sm text-slate-400">Hoje</p><h2 className="text-2xl font-bold">Seu dia em ordem</h2></div>
                <div className="w-11 h-11 rounded-xl bg-purple-500/20 flex items-center justify-center"><Bell className="w-5 h-5 text-purple-300" /></div>
              </div>
              <div className="space-y-3">
                {[
                  ['09:00', 'Pagar conta de luz', 'Finanças'],
                  ['14:30', 'Consulta médica', 'Saúde'],
                  ['18:00', 'Comprar itens do mercado', 'Casa'],
                ].map(([time, title, category]) => (
                  <div key={title} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-700/70">
                    <div className="text-sm font-semibold text-purple-300 w-12">{time}</div>
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <div className="flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-slate-500">{category}</p></div>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                ))}
              </div>
              <div className="mt-5 p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <p className="text-sm text-purple-200">“Me lembra de pagar a conta amanhã às 9h.”</p>
                <p className="text-xs text-slate-500 mt-2">O Staff entende, salva e acompanha.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export function StaffAuthModal({ mode, onMode, onClose, onAuthenticated }: {
  mode: AuthMode
  onMode: (mode: AuthMode) => void
  onClose: () => void
  onAuthenticated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'login') {
        await signIn(email, password)
        onAuthenticated()
      } else {
        const result = await signUp(email, password, name, '')
        if (result.session) onAuthenticated()
        else setMessage('Conta criada. Confirme o e-mail enviado para você e depois faça login.')
      }
    } catch (error: any) {
      setMessage(error?.message || 'Não foi possível concluir. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
      <div className="glass-card w-full max-w-md p-7 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        <StaffLogo />
        <div className="mt-7 mb-6">
          <h2 className="text-2xl font-black text-white">{mode === 'login' ? 'Bem-vindo de volta' : 'Crie seu Staff pessoal'}</h2>
          <p className="text-slate-400 mt-2">{mode === 'login' ? 'Entre para acessar sua rotina.' : 'Comece gratuitamente e organize sua vida.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <label className="block">
              <span className="text-sm text-slate-300">Nome</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-500" placeholder="Seu nome" />
            </label>
          )}
          <label className="block">
            <span className="text-sm text-slate-300">E-mail</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-500" placeholder="voce@email.com" />
          </label>
          <label className="block">
            <span className="text-sm text-slate-300">Senha</span>
            <input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-1 w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-500" placeholder="Mínimo 6 caracteres" />
          </label>
          <button disabled={loading} className="w-full btn-purple py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Entrar' : 'Criar conta gratuita'}
          </button>
        </form>
        {message && <p className="mt-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">{message}</p>}
        <button onClick={() => onMode(mode === 'login' ? 'signup' : 'login')} className="w-full mt-5 text-sm text-purple-300 hover:text-purple-200">
          {mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
        </button>
      </div>
    </div>
  )
}
