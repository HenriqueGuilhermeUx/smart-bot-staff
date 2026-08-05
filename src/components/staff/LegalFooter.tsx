import { FileText, Mail, MessageCircle, ShieldCheck, UserX } from 'lucide-react'
import { COMPANY } from '@/lib/company'
import { cn } from '@/lib/staffUi'

export function LegalFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={cn(
      'border-t border-white/5 text-slate-500',
      compact ? 'mt-6 pt-5' : 'mt-10 py-7',
    )}>
      <div className={cn(
        'flex gap-4',
        compact
          ? 'flex-col sm:flex-row sm:items-center sm:justify-between'
          : 'container mx-auto flex-col md:flex-row md:items-center md:justify-between',
      )}>
        <div className="text-xs leading-relaxed">
          <a
            href={COMPANY.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-purple-300 transition-colors"
          >
            {COMPANY.legalName}
          </a>
          <span className="block">CNPJ {COMPANY.cnpj}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2" aria-label="Privacidade, conta e contato">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir Política de Privacidade"
            title="Privacidade"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 flex items-center justify-center transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
          </a>
          <a
            href="/terms.html"
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir Termos de Uso"
            title="Termos de Uso"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 flex items-center justify-center transition-colors"
          >
            <FileText className="w-4 h-4" />
          </a>
          <a
            href="/account-deletion.html"
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir página de exclusão de conta"
            title="Excluir conta"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 flex items-center justify-center transition-colors"
          >
            <UserX className="w-4 h-4" />
          </a>
          <a
            href={COMPANY.emailUrl}
            aria-label="Enviar e-mail"
            title="E-mail"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 flex items-center justify-center transition-colors"
          >
            <Mail className="w-4 h-4" />
          </a>
          <a
            href={COMPANY.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir WhatsApp"
            title="WhatsApp"
            className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 flex items-center justify-center transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  )
}
