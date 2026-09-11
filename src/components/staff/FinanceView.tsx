import { useEffect, useMemo, useState } from 'react'
import { CircleDollarSign, FileText, Loader2, RefreshCw, WalletCards } from 'lucide-react'
import { loadFinancialEntries, type StaffFinancialEntry } from '@/lib/staffDocuments'

function money(value: number, currency = 'BRL') {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value) }
  catch { return `${currency} ${value.toFixed(2)}` }
}

export function FinanceView({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<StaffFinancialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true); setError('')
    try { setEntries(await loadFinancialEntries(userId)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não consegui carregar Finanças.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [userId])

  const month = useMemo(() => {
    const now = new Date()
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const current = entries.filter((entry) => entry.entry_type === 'expense' && entry.occurred_on.startsWith(prefix))
    return { count: current.length, total: current.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) }
  }, [entries])

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="flex items-end justify-between gap-3"><div><p className="text-purple-300 font-semibold">Staff Finanças</p><h1 className="text-3xl font-black">Sua vida financeira organizada.</h1><p className="text-slate-500 mt-2">Lançamentos confirmados por você, inclusive os criados a partir do Smart Inbox.</p></div><button onClick={() => void refresh()} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400"><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button></header>

      <div className="grid sm:grid-cols-2 gap-4">
        <section className="rounded-3xl border border-purple-500/20 bg-purple-500/8 p-6"><div className="w-11 h-11 rounded-xl bg-purple-500/15 grid place-items-center"><CircleDollarSign className="w-5 h-5 text-purple-300" /></div><p className="text-xs text-slate-500 mt-4">Despesas deste mês</p><p className="text-3xl font-black mt-1">{money(month.total)}</p><p className="text-xs text-slate-600 mt-1">{month.count} lançamento{month.count === 1 ? '' : 's'}</p></section>
        <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-6"><div className="w-11 h-11 rounded-xl bg-slate-900 grid place-items-center"><WalletCards className="w-5 h-5 text-emerald-300" /></div><p className="text-xs text-slate-500 mt-4">Base financeira</p><p className="text-xl font-black mt-1">{entries.length} registro{entries.length === 1 ? '' : 's'}</p><p className="text-xs text-slate-600 mt-1">O Smart Inbox evita duplicidade por documento e impressão digital.</p></section>
      </div>

      {error && <div className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-4 text-rose-200 text-sm">{error}</div>}

      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div className="p-5 border-b border-slate-800"><h2 className="font-black">Lançamentos</h2></div>
        {loading ? <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-purple-300 mx-auto" /></div> : entries.length ? <div className="divide-y divide-slate-800">{entries.map((entry) => <div key={entry.id} className="p-4 md:p-5 flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-900 grid place-items-center shrink-0">{entry.source_document_id ? <FileText className="w-4 h-4 text-purple-300" /> : <CircleDollarSign className="w-4 h-4 text-slate-400" />}</div><div className="min-w-0 flex-1"><p className="font-bold truncate">{entry.description}</p><p className="text-xs text-slate-600 mt-1">{new Date(`${entry.occurred_on}T12:00:00`).toLocaleDateString('pt-BR')} · {entry.category}{entry.merchant ? ` · ${entry.merchant}` : ''}</p></div><div className="text-right"><p className="font-black text-rose-200">− {money(Number(entry.amount), entry.currency)}</p>{entry.source_document_id && <p className="text-[10px] text-purple-300 mt-1">via Smart Inbox</p>}</div></div>)}</div> : <div className="p-12 text-center"><CircleDollarSign className="w-10 h-10 text-slate-700 mx-auto" /><p className="font-bold text-slate-400 mt-3">Nenhum lançamento ainda</p><p className="text-sm text-slate-600 mt-1">Envie um recibo ou nota ao Smart Inbox e confirme a despesa.</p></div>}
      </section>
    </div>
  )
}
