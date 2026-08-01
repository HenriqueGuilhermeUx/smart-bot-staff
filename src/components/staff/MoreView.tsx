import { ChevronRight, LayoutGrid, Settings, Zap } from 'lucide-react'
import type { StaffScreen } from '@/lib/staffUi'

const ITEMS: Array<{ screen: StaffScreen; title: string; description: string; icon: typeof LayoutGrid }> = [
  { screen: 'life', title: 'Áreas da vida', description: 'Finanças, saúde, casa, família e mais.', icon: LayoutGrid },
  { screen: 'automations', title: 'Automações', description: 'Resumos, alertas e rotinas proativas.', icon: Zap },
  { screen: 'settings', title: 'Configurações', description: 'Notificações, integrações e privacidade.', icon: Settings },
]

export function MoreView({ onNavigate }: { onNavigate: (screen: StaffScreen) => void }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-purple-300 font-semibold">Central</p>
        <h1 className="text-3xl font-black text-white">Mais recursos</h1>
        <p className="text-slate-500 mt-2">Acesse suas áreas, automações e preferências.</p>
      </div>
      <div className="space-y-4">
        {ITEMS.map((item) => (
          <button key={item.screen} onClick={() => onNavigate(item.screen)} className="w-full glass-card p-5 text-left flex items-center gap-4 hover:border-purple-500/30 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center"><item.icon className="w-5 h-5 text-purple-300" /></div>
            <div className="flex-1"><p className="font-bold text-white">{item.title}</p><p className="text-sm text-slate-500 mt-1">{item.description}</p></div>
            <ChevronRight className="w-5 h-5 text-slate-700" />
          </button>
        ))}
      </div>
    </div>
  )
}
