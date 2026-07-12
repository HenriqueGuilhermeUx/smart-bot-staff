import {
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
  LogOut,
  PartyPopper,
  Shield,
  Target,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/staffUi'

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

export function SettingsView({ notificationsEnabled, onNotifications, onLogout, nexaConnected }: {
  notificationsEnabled: boolean
  onNotifications: () => void
  onLogout: () => void
  nexaConnected: boolean
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6"><p className="text-purple-300 font-semibold">Preferências</p><h1 className="text-3xl font-black text-white">Configurações</h1></div>
      <div className="space-y-4">
        <div className="glass-card p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center">
              {notificationsEnabled ? <Bell className="w-5 h-5 text-purple-300" /> : <BellOff className="w-5 h-5 text-slate-500" />}
            </div>
            <div><p className="font-semibold text-white">Notificações</p><p className="text-sm text-slate-500">Avisos de lembretes enquanto o app estiver ativo</p></div>
          </div>
          <button onClick={onNotifications} className={cn('px-4 py-2 rounded-xl text-sm border', notificationsEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-900 text-slate-400 border-slate-800')}>
            {notificationsEnabled ? 'Ativadas' : 'Ativar'}
          </button>
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
          <div><p className="font-semibold text-white">Privacidade e controle</p><p className="text-sm text-slate-500">Ações externas só serão realizadas mediante sua autorização.</p></div>
        </div>

        <button onClick={onLogout} className="w-full p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-300 flex items-center justify-center gap-2 hover:bg-rose-500/10">
          <LogOut className="w-5 h-5" /> Sair da conta
        </button>
      </div>
    </div>
  )
}
