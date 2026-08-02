import { useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellOff,
  Briefcase,
  Car,
  ChevronRight,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Link,
  Loader2,
  LogOut,
  Mic2,
  PartyPopper,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  User,
  Volume2,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/staffUi'
import type { VoiceResponseMode } from '@/lib/staffVoice'
import { supabase } from '@/lib/supabase'
import { LegalFooter } from '@/components/staff/LegalFooter'

const LIFE_AREAS = [
  { id: 'financas', label: 'Finanças', description: 'Contas, boletos e gastos', icon: Wallet },
  { id: 'saude', label: 'Saúde', description: 'Consultas e medicamentos', icon: Heart },
  { id: 'familia', label: 'Família', description: 'Rotina e compromissos', icon: User },
  { id: 'casa', label: 'Casa', description: 'Compras e manutenção', icon: Home },
  { id: 'trabalho', label: 'Trabalho', description: 'Prazos e prioridades', icon: Briefcase },
  { id: 'veiculos', label: 'Veículos', description: 'IPVA, seguro e revisão', icon: Car },
  { id: 'documentos', label: 'Documentos', description: 'Prazos e renovações', icon: FileText },
  { id: 'estudos', label: 'Estudos', description: 'Provas e atividades', icon: GraduationCap },
  { id: 'eventos', label: 'Eventos', description: 'Datas e aniversários', icon: PartyPopper },
  { id: 'investimentos', label: 'Investimentos', description: 'Aportes e alertas', icon: TrendingUp },
  { id: 'metas', label: 'Metas', description: 'Objetivos e hábitos', icon: Target },
] as const

export function LifeView({ onOpenChat }: { onOpenChat: (prompt: string) => void }) {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <p className="text-purple-300 font-semibold">Central da vida</p>
        <h1 className="text-3xl font-black text-white">Tudo o que importa, organizado.</h1>
        <p className="text-slate-500 mt-2">Escolha uma área para conversar com o Staff e começar a organizar.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {LIFE_AREAS.map((area) => (
          <button key={area.id} onClick={() => onOpenChat(`Quero organizar minha área de ${area.label.toLowerCase()}.`)} className="glass-card p-5 text-left hover:border-purple-500/30 hover:-translate-y-1 transition-all">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4"><area.icon className="w-5 h-5 text-purple-300" /></div>
            <div className="flex items-center justify-between">
              <div><h2 className="font-bold text-white">{area.label}</h2><p className="text-sm text-slate-500 mt-1">{area.description}</p></div>
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsView({
  notificationsEnabled,
  onNotifications,
  onLogout,
  nexaConnected,
  voiceResponseMode,
  onVoiceResponseMode,
}: {
  notificationsEnabled: boolean
  onNotifications: () => void
  onLogout: () => void
  nexaConnected: boolean
  voiceResponseMode: VoiceResponseMode
  onVoiceResponseMode: (mode: VoiceResponseMode) => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function deleteAccount() {
    if (deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR') {
      setDeleteError('Digite EXCLUIR para confirmar.')
      return
    }

    setDeleting(true)
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente e repita a solicitação.')

      const response = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Não foi possível excluir a conta.')

      setDeleteOpen(false)
      onLogout()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir a conta.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6"><p className="text-purple-300 font-semibold">Preferências</p><h1 className="text-3xl font-black text-white">Configurações</h1></div>
      <div className="space-y-4">
        <div className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center">
              {notificationsEnabled ? <Bell className="w-5 h-5 text-purple-300" /> : <BellOff className="w-5 h-5 text-slate-500" />}
            </div>
            <div><p className="font-semibold text-white">Notificações</p><p className="text-sm text-slate-500">Avisos de tarefas, compromissos e automações</p></div>
          </div>
          <button onClick={onNotifications} className={cn('px-4 py-2 rounded-xl text-sm border', notificationsEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-900 text-slate-400 border-slate-800')}>
            {notificationsEnabled ? 'Ativadas' : 'Ativar'}
          </button>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0"><Mic2 className="w-5 h-5 text-purple-300" /></div>
            <div className="flex-1">
              <p className="font-semibold text-white">Controle por voz</p>
              <p className="text-sm text-slate-500 mt-1">Toque no microfone para criar tarefas, agendar compromissos, consultar o dia e conversar com o Staff.</p>
              <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                <Shield className="w-4 h-4 text-emerald-300 shrink-0" />
                O áudio bruto não é salvo pelo Staff. A transcrição pode usar o serviço de voz configurado no aparelho.
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Volume2 className="w-5 h-5 text-cyan-300" /></div>
            <div><p className="font-semibold text-white">Respostas faladas</p><p className="text-sm text-slate-500">Escolha quando o Staff deve responder em voz alta.</p></div>
          </div>
          <select
            value={voiceResponseMode}
            onChange={(event) => onVoiceResponseMode(event.target.value as VoiceResponseMode)}
            className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white outline-none focus:border-purple-500"
            aria-label="Quando responder por voz"
          >
            <option value="after-voice">Quando eu usar o microfone</option>
            <option value="always">Sempre</option>
            <option value="never">Nunca</option>
          </select>
        </div>

        <div className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center"><Link className="w-5 h-5 text-cyan-300" /></div>
            <div><p className="font-semibold text-white">Integração Nexa</p><p className="text-sm text-slate-500">Opcional. O Staff funciona de forma independente.</p></div>
          </div>
          <span className={cn('px-3 py-2 rounded-xl text-xs border', nexaConnected ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-900 text-slate-500 border-slate-800')}>
            {nexaConnected ? 'Conectada' : 'Não conectada'}
          </span>
        </div>

        <div className="glass-card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-emerald-300" /></div>
          <div className="flex-1"><p className="font-semibold text-white">Privacidade e controle</p><p className="text-sm text-slate-500">Ações externas só são realizadas mediante sua autorização.</p></div>
          <a href="/privacy.html" target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:text-purple-200">Ver política</a>
        </div>

        <button onClick={() => { setDeleteOpen(true); setDeleteConfirmation(''); setDeleteError('') }} className="w-full p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-300 flex items-center justify-center gap-2 hover:bg-rose-500/10">
          <Trash2 className="w-5 h-5" /> Excluir conta e dados
        </button>

        <button onClick={onLogout} className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-center gap-2 hover:border-slate-700">
          <LogOut className="w-5 h-5" /> Sair da conta
        </button>
      </div>

      <LegalFooter compact />

      {deleteOpen && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="glass-card w-full max-w-lg p-6 md:p-7 relative">
            <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-5"><AlertTriangle className="w-7 h-7 text-rose-300" /></div>
            <h2 className="text-2xl font-black text-white">Excluir permanentemente?</h2>
            <p className="text-slate-400 mt-3 leading-relaxed">A conta, tarefas, compromissos, mensagens, automações e preferências serão excluídos. Esta ação não pode ser desfeita.</p>
            <label className="block mt-5">
              <span className="text-sm text-slate-300">Digite <strong>EXCLUIR</strong> para confirmar</span>
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={deleting} className="mt-2 w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400" autoComplete="off" />
            </label>
            {deleteError && <p className="text-sm text-rose-300 mt-3">{deleteError}</p>}
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting} className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">Cancelar</button>
              <button type="button" onClick={deleteAccount} disabled={deleting || deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR'} className="py-3 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />} Excluir minha conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
