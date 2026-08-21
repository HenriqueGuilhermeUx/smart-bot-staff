import { useEffect, useMemo, useState } from 'react'
import { Baby, BarChart3, BookOpenCheck, Brain, Loader2, Plus, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { KidsChallengesView } from '@/components/staff/KidsChallengesView'
import { StudyView } from '@/components/staff/StudyView'
import {
  createChild,
  deleteChild,
  loadChildren,
  loadKidsGameSessions,
  loadStudyAttempts,
  loadStudyMaterials,
  type KidsGameSession,
  type StaffChild,
  type StudyAttempt,
  type StudyMaterial,
} from '@/lib/staffFamilyData'
import type { KidsAgeGroup } from '@/data/kidsChallenges'
import { cn } from '@/lib/staffUi'

const ageOptions: Array<{ value: KidsAgeGroup; label: string }> = [
  { value: '3-5', label: '3 a 5 anos' },
  { value: '6-8', label: '6 a 8 anos' },
  { value: '9-11', label: '9 a 11 anos' },
  { value: '12-13', label: '12 a 13 anos' },
]

const avatars = ['🧒', '👧', '👦', '🧑', '🌟', '🚀', '🦄', '🐼']
type FamilyTab = 'children' | 'challenges' | 'studies' | 'progress'

export function FamilyHub({ user }: { user: any }) {
  const [tab, setTab] = useState<FamilyTab>('children')
  const [children, setChildren] = useState<StaffChild[]>([])
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [gameSessions, setGameSessions] = useState<KidsGameSession[]>([])
  const [studyAttempts, setStudyAttempts] = useState<StudyAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [ageGroup, setAgeGroup] = useState<KidsAgeGroup>('6-8')
  const [schoolGrade, setSchoolGrade] = useState('')
  const [avatar, setAvatar] = useState('🧒')

  async function refresh(showLoader = false) {
    if (showLoader) setLoading(true)
    setError('')
    try {
      const childRows = await loadChildren(user.id)
      setChildren(childRows)
      const [materialRows, sessionRows, attemptRows] = await Promise.all([
        loadStudyMaterials(user.id),
        loadKidsGameSessions(user.id),
        loadStudyAttempts(user.id),
      ])
      setMaterials(materialRows)
      setGameSessions(sessionRows)
      setStudyAttempts(attemptRows)
    } catch (reason: any) {
      console.error('Staff Family load error:', reason)
      const raw = String(reason?.message || reason || '')
      setError(raw || 'Não consegui carregar o módulo Família. Saia e entre novamente; se persistir, tente atualizar a tela em alguns instantes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh(true) }, [user.id])

  async function addChild() {
    if (!name.trim()) return
    setAdding(true)
    setError('')
    try {
      const child = await createChild(user.id, {
        display_name: name.trim(),
        age_group: ageGroup,
        school_grade: schoolGrade.trim() || null,
        avatar_emoji: avatar,
      })
      setChildren((current) => [...current, child])
      setName('')
      setSchoolGrade('')
      setAvatar('🧒')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não consegui cadastrar o perfil.')
    } finally {
      setAdding(false)
    }
  }

  async function removeChild(child: StaffChild) {
    if (!window.confirm(`Excluir o perfil de ${child.display_name} e os estudos/progressos associados?`)) return
    try {
      await deleteChild(user.id, child.id)
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não consegui excluir o perfil.')
    }
  }

  const childStats = useMemo(() => children.map((child) => {
    const games = gameSessions.filter((item) => item.child_id === child.id)
    const attempts = studyAttempts.filter((item) => item.child_id === child.id)
    const childMaterials = materials.filter((item) => item.child_id === child.id)
    const totalQuestions = games.reduce((sum, item) => sum + item.total_questions, 0) + attempts.reduce((sum, item) => sum + item.total_questions, 0)
    const totalScore = games.reduce((sum, item) => sum + item.score, 0) + attempts.reduce((sum, item) => sum + item.score, 0)
    return {
      child,
      games: games.length,
      materials: childMaterials.length,
      attempts: attempts.length,
      accuracy: totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0,
      minutes: Math.round(games.reduce((sum, item) => sum + item.duration_seconds, 0) / 60),
    }
  }), [children, gameSessions, materials, studyAttempts])

  const tabs: Array<{ id: FamilyTab; label: string; icon: typeof Baby }> = [
    { id: 'children', label: 'Filhos', icon: Baby },
    { id: 'challenges', label: 'Desafios Kids', icon: Brain },
    { id: 'studies', label: 'Estudos', icon: BookOpenCheck },
    { id: 'progress', label: 'Progresso', icon: BarChart3 },
  ]

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><div className="text-center"><Loader2 className="w-8 h-8 text-purple-300 animate-spin mx-auto" /><p className="text-slate-500 mt-3">Organizando a família...</p></div></div>

  return (
    <div className="max-w-6xl mx-auto">
      <section className="rounded-[30px] border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-slate-950/60 to-fuchsia-500/5 p-5 md:p-7">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-4 items-start">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 grid place-items-center text-purple-300"><UsersRound className="w-7 h-7" /></div>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">Staff Família</p><h1 className="text-2xl md:text-3xl font-black mt-1">Um staff para a rotina dos filhos também.</h1><p className="text-slate-500 mt-2 max-w-2xl">Perfis gerenciados pelo responsável, tempo educativo, materiais escolares e acompanhamento de estudos — sem conta infantil independente.</p></div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 self-start"><ShieldCheck className="w-4 h-4" />Controle do responsável</div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto py-5 no-scrollbar">
        {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={cn('shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm', tab === item.id ? 'bg-purple-500/20 border-purple-500/35 text-purple-200' : 'bg-slate-950/70 border-slate-800 text-slate-500')}><item.icon className="w-4 h-4" />{item.label}</button>)}
      </div>

      {error && <div className="mb-5 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      {tab === 'children' && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-5">
          <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Perfis dos filhos</h2><p className="text-sm text-slate-500 mt-1">Use apelido ou primeiro nome; não pedimos data de nascimento.</p></div><span className="text-xs text-slate-600">{children.length} perfil{children.length === 1 ? '' : 'is'}</span></div>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              {children.map((child) => <article key={child.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-start gap-3"><div className="w-12 h-12 rounded-2xl bg-purple-500/10 grid place-items-center text-2xl">{child.avatar_emoji}</div><div className="flex-1 min-w-0"><h3 className="font-black truncate">{child.display_name}</h3><p className="text-xs text-purple-300 mt-1">{child.age_group} anos{child.school_grade ? ` · ${child.school_grade}` : ''}</p></div><button onClick={() => void removeChild(child)} className="p-2 text-slate-700 hover:text-rose-300" aria-label={`Excluir perfil de ${child.display_name}`}><Trash2 className="w-4 h-4" /></button></div></article>)}
              {!children.length && <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-600">Cadastre o primeiro perfil para liberar Desafios Kids e Estudos.</div>}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-6">
            <h2 className="font-black flex items-center gap-2"><Plus className="w-5 h-5 text-purple-300" />Adicionar perfil</h2>
            <label className="block text-xs uppercase font-bold tracking-wide text-slate-600 mt-5">Nome ou apelido</label><input value={name} onChange={(event) => setName(event.target.value.slice(0, 60))} className="w-full mt-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3" placeholder="Ex.: Pedro" />
            <label className="block text-xs uppercase font-bold tracking-wide text-slate-600 mt-4">Faixa etária</label><select value={ageGroup} onChange={(event) => setAgeGroup(event.target.value as KidsAgeGroup)} className="w-full mt-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">{ageOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <label className="block text-xs uppercase font-bold tracking-wide text-slate-600 mt-4">Série escolar</label><input value={schoolGrade} onChange={(event) => setSchoolGrade(event.target.value.slice(0, 50))} className="w-full mt-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3" placeholder="Ex.: 3º ano" />
            <label className="block text-xs uppercase font-bold tracking-wide text-slate-600 mt-4">Avatar</label><div className="grid grid-cols-8 gap-1.5 mt-2">{avatars.map((item) => <button key={item} onClick={() => setAvatar(item)} className={cn('aspect-square rounded-xl border text-xl', avatar === item ? 'bg-purple-500/20 border-purple-500/40' : 'bg-slate-900 border-slate-800')}>{item}</button>)}</div>
            <button onClick={() => void addChild()} disabled={!name.trim() || adding} className="btn-purple w-full py-3.5 rounded-xl font-black mt-5 disabled:opacity-35">{adding ? <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> : <Plus className="w-4 h-4 inline mr-2" />}Salvar perfil</button>
          </section>
        </div>
      )}

      {tab === 'challenges' && <KidsChallengesView userId={user.id} children={children} onSessionSaved={() => void refresh()} />}
      {tab === 'studies' && <StudyView userId={user.id} children={children} onDataChanged={() => void refresh()} />}

      {tab === 'progress' && <div className="space-y-4">
        {childStats.map(({ child, games, materials: countMaterials, attempts, accuracy, minutes }) => <section key={child.id} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-6"><div className="flex flex-col md:flex-row md:items-center gap-5"><div className="flex items-center gap-3 md:w-64"><div className="w-14 h-14 rounded-2xl bg-purple-500/10 grid place-items-center text-2xl">{child.avatar_emoji}</div><div><h3 className="font-black text-lg">{child.display_name}</h3><p className="text-xs text-slate-500">{child.school_grade || `${child.age_group} anos`}</p></div></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1"><Stat value={games} label="sessões Kids" /><Stat value={minutes} label="minutos de desafios" /><Stat value={countMaterials} label="materiais de estudo" /><Stat value={attempts ? `${accuracy}%` : '—'} label="acertos registrados" /></div></div></section>)}
        {!childStats.length && <div className="rounded-3xl border border-dashed border-slate-800 p-10 text-center text-slate-600">Cadastre um perfil para começar a acompanhar o progresso.</div>}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">O progresso é um apoio de organização familiar e não substitui avaliação escolar, pedagógica ou profissional.</div>
      </div>}
    </div>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3"><p className="text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></div>
}
