import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/staffUi'

export function StaffLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        'rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shadow-lg shadow-purple-950/30',
        compact ? 'w-9 h-9' : 'w-12 h-12',
      )}>
        <Sparkles className={compact ? 'w-5 h-5 text-white' : 'w-6 h-6 text-white'} />
      </div>
      <div>
        <div className={cn('font-black tracking-tight text-white', compact ? 'text-lg' : 'text-2xl')}>Staff</div>
        {!compact && (
          <div className="text-[11px] uppercase tracking-[0.25em] text-purple-300">Assistente pessoal com IA</div>
        )}
      </div>
    </div>
  )
}
