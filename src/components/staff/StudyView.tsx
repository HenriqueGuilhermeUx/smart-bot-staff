import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, Camera, CheckCircle2, FileText, GraduationCap, Loader2, RotateCcw, Sparkles, Trash2, Volume2, XCircle } from 'lucide-react'
import {
  analyzeStudyMaterial,
  deleteStudyMaterial,
  loadStudyMaterials,
  prepareStudyFile,
  saveStudyAttempt,
  saveStudyMaterial,
  uploadStudyFile,
  type StaffChild,
  type StudyMaterial,
} from '@/lib/staffFamilyData'
import { speakKidsText, stopKidsSpeech } from '@/lib/kidsVoice'
import { cn } from '@/lib/staffUi'

export function StudyView({ userId, children, onDataChanged }: {
  userId: string
  children: StaffChild[]
  onDataChanged?: () => void
}) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '')
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sourceOnly, setSourceOnly] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [message, setMessage] = useState('')
  const [quizOpen, setQuizOpen] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizScore, setQuizScore] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)

  const child = children.find((item) => item.id === selectedChildId) || children[0]
  const selectedMaterial = materials.find((item) => item.id === selectedMaterialId) || materials[0]

  async function refreshMaterials(childId = selectedChildId) {
    if (!childId) return
    setLoadingList(true)
    try {
      const list = await loadStudyMaterials(userId, childId)
      setMaterials(list)
      setSelectedMaterialId((current) => current && list.some((item) => item.id === current) ? current : list[0]?.id || '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não consegui carregar os estudos.')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id)
  }, [children, selectedChildId])

  useEffect(() => {
    if (selectedChildId) void refreshMaterials(selectedChildId)
  }, [selectedChildId])

  async function generateStudy() {
    if (!child || !file) return
    setLoading(true)
    setMessage('Preparando o material...')
    try {
      const prepared = await prepareStudyFile(file)
      const pack = await analyzeStudyMaterial({ child, file: prepared, sourceOnly })
      setMessage('Salvando na biblioteca...')

      let filePath: string | null = null
      try {
        filePath = await uploadStudyFile(userId, child.id, prepared)
      } catch (uploadError) {
        console.warn('Arquivo não foi persistido; o material de estudo será salvo:', uploadError)
      }

      const saved = await saveStudyMaterial({
        userId,
        childId: child.id,
        fileName: prepared.name,
        mimeType: prepared.type,
        filePath,
        sourceOnly,
        pack,
      })

      setMaterials((current) => [saved, ...current])
      setSelectedMaterialId(saved.id)
      setFile(null)
      setMessage('Material pronto e salvo na biblioteca.')
      onDataChanged?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não consegui preparar o estudo.')
    } finally {
      setLoading(false)
    }
  }

  async function removeMaterial(material: StudyMaterial) {
    if (!window.confirm(`Excluir “${material.title}” da biblioteca?`)) return
    await deleteStudyMaterial(userId, material)
    const next = materials.filter((item) => item.id !== material.id)
    setMaterials(next)
    setSelectedMaterialId(next[0]?.id || '')
    onDataChanged?.()
  }

  function startQuiz() {
    if (!selectedMaterial?.study_pack?.questions?.length) return
    setQuizIndex(0)
    setQuizAnswer(null)
    setQuizRevealed(false)
    setQuizScore(0)
    setQuizFinished(false)
    setQuizOpen(true)
  }

  const question = selectedMaterial?.study_pack?.questions?.[quizIndex]

  function revealQuiz() {
    if (quizAnswer === null || !question || quizRevealed) return
    setQuizRevealed(true)
    if (quizAnswer === question.correct_index) setQuizScore((value) => value + 1)
    const correct = quizAnswer === question.correct_index
    void speakKidsText(`${correct ? 'Muito bem!' : 'Vamos revisar.'} ${question.explanation}`)
  }

  async function nextQuiz() {
    if (!selectedMaterial || !child) return
    const total = selectedMaterial.study_pack.questions.length
    if (quizIndex + 1 >= total) {
      setQuizFinished(true)
      const finalScore = quizScore + (quizRevealed ? 0 : 0)
      await saveStudyAttempt(userId, {
        child_id: child.id,
        material_id: selectedMaterial.id,
        score: finalScore,
        total_questions: total,
      }).catch((error) => console.error('Erro ao salvar tentativa:', error))
      onDataChanged?.()
      return
    }
    setQuizIndex((value) => value + 1)
    setQuizAnswer(null)
    setQuizRevealed(false)
  }

  const stats = useMemo(() => {
    if (!selectedMaterial) return null
    const pack = selectedMaterial.study_pack
    return `${pack.key_points?.length || 0} pontos-chave · ${pack.questions?.length || 0} perguntas · ${pack.flashcards?.length || 0} flashcards`
  }, [selectedMaterial])

  if (!children.length) {
    return <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-7 text-center"><GraduationCap className="w-10 h-10 text-purple-300 mx-auto" /><h3 className="text-xl font-black mt-3">Cadastre um filho primeiro</h3><p className="text-slate-500 mt-2">Depois você poderá fotografar cadernos, livros e apostilas e salvar o estudo no perfil dele.</p></div>
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-slate-950/60 p-5 md:p-7">
        <div className="flex gap-4 items-start"><div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-300 grid place-items-center"><Camera className="w-6 h-6" /></div><div className="flex-1"><h3 className="text-xl font-black">Transformar material em estudo</h3><p className="text-slate-500 text-sm mt-1">Fotografe caderno, livro, atividade ou apostila. O responsável gera o conteúdo uma vez; a criança depois estuda o material salvo sem conversar diretamente com a IA.</p></div></div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div><label className="text-xs uppercase tracking-wide font-bold text-slate-500">Perfil</label><select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)} className="w-full mt-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">{children.map((item) => <option key={item.id} value={item.id}>{item.avatar_emoji} {item.display_name} · {item.school_grade || `${item.age_group} anos`}</option>)}</select></div>
          <div><label className="text-xs uppercase tracking-wide font-bold text-slate-500">Arquivo</label><label className="mt-2 min-h-[50px] px-4 py-3 rounded-xl bg-slate-900 border border-dashed border-purple-500/35 flex items-center gap-3 cursor-pointer"><FileText className="w-5 h-5 text-purple-300" /><span className="text-sm text-slate-300 truncate">{file?.name || 'Foto ou PDF (até 5 MB)'}</span><input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label></div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-slate-950/50 border border-slate-800 p-4 cursor-pointer"><input type="checkbox" checked={sourceOnly} onChange={(event) => setSourceOnly(event.target.checked)} className="mt-1" /><div><p className="font-bold text-slate-200">Somente o material enviado</p><p className="text-xs text-slate-500 mt-1">Recomendado para prova e dever: o Staff não completa lacunas com conteúdo externo; trechos ilegíveis são sinalizados.</p></div></label>

        <button onClick={generateStudy} disabled={!file || loading} className="btn-purple w-full md:w-auto px-6 py-3.5 rounded-xl font-black mt-5 disabled:opacity-35">{loading ? <><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />Preparando...</> : <><Sparkles className="inline w-4 h-4 mr-2" />Criar sequência de estudo</>}</button>
        {message && <p className={cn('text-sm mt-3', message.includes('pronto') || message.includes('salvo') ? 'text-emerald-300' : 'text-slate-400')}>{message}</p>}
      </section>

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <aside className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 h-fit">
          <div className="flex items-center justify-between"><div><h3 className="font-black">Biblioteca de {child?.display_name}</h3><p className="text-xs text-slate-500 mt-1">Materiais salvos</p></div>{loadingList && <Loader2 className="w-4 h-4 animate-spin text-purple-300" />}</div>
          <div className="space-y-2 mt-4">{materials.length ? materials.map((material) => <button key={material.id} onClick={() => setSelectedMaterialId(material.id)} className={cn('w-full text-left rounded-2xl border p-3 transition-colors', selectedMaterial?.id === material.id ? 'bg-purple-500/15 border-purple-500/30' : 'bg-slate-900/60 border-slate-800')}><p className="font-bold text-sm text-white line-clamp-2">{material.title}</p><p className="text-xs text-purple-300 mt-1">{material.subject}</p><p className="text-[11px] text-slate-600 mt-1">{new Date(material.created_at).toLocaleDateString('pt-BR')}</p></button>) : <div className="p-5 text-center text-sm text-slate-600">Nenhum material salvo ainda.</div>}</div>
        </aside>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-7 min-h-[300px]">
          {selectedMaterial ? <>
            <div className="flex gap-3 justify-between items-start"><div><p className="text-xs uppercase tracking-wide font-bold text-purple-300">{selectedMaterial.subject}</p><h2 className="text-2xl font-black mt-1">{selectedMaterial.title}</h2><p className="text-xs text-slate-600 mt-2">{stats}</p></div><button onClick={() => void removeMaterial(selectedMaterial)} className="p-2 rounded-xl text-slate-600 hover:text-rose-300"><Trash2 className="w-5 h-5" /></button></div>

            {selectedMaterial.study_pack.source_warnings?.length > 0 && <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4"><p className="font-bold text-amber-200 text-sm">Atenção ao material</p>{selectedMaterial.study_pack.source_warnings.map((warning) => <p key={warning} className="text-xs text-amber-100/70 mt-1">• {warning}</p>)}</div>}

            <div className="mt-6"><h3 className="font-black flex items-center gap-2"><BookOpenCheck className="w-5 h-5 text-purple-300" />Resumo</h3><p className="text-slate-300 leading-relaxed mt-3">{selectedMaterial.study_pack.summary}</p></div>
            <div className="mt-6"><h3 className="font-black">Pontos-chave</h3><div className="grid sm:grid-cols-2 gap-2 mt-3">{selectedMaterial.study_pack.key_points.map((point) => <div key={point} className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-sm text-slate-300">• {point}</div>)}</div></div>
            <div className="mt-6"><h3 className="font-black">Texto para estudar</h3><p className="text-slate-400 leading-relaxed mt-3 whitespace-pre-wrap">{selectedMaterial.study_pack.study_text}</p></div>

            <div className="flex flex-wrap gap-3 mt-7"><button onClick={startQuiz} className="btn-purple px-5 py-3 rounded-xl font-black"><GraduationCap className="inline w-4 h-4 mr-2" />Fazer perguntas</button><button onClick={() => void speakKidsText(selectedMaterial.study_pack.summary)} className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 font-bold text-slate-300"><Volume2 className="inline w-4 h-4 mr-2" />Ouvir resumo</button></div>

            <div className="mt-7"><h3 className="font-black">Flashcards</h3><div className="grid md:grid-cols-2 gap-3 mt-3">{selectedMaterial.study_pack.flashcards.map((card, index) => <details key={`${card.front}-${index}`} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 group"><summary className="cursor-pointer font-bold text-slate-200">{card.front}</summary><p className="text-sm text-purple-200 mt-3">{card.back}</p></details>)}</div></div>
          </> : <div className="h-full min-h-[280px] grid place-items-center text-center"><div><BookOpenCheck className="w-10 h-10 text-slate-700 mx-auto" /><p className="font-bold text-slate-400 mt-3">Escolha ou crie um material</p><p className="text-sm text-slate-600 mt-1">O Staff organiza tudo por filho e disciplina.</p></div></div>}
        </section>
      </div>

      {quizOpen && selectedMaterial && question && (
        <div className="fixed inset-0 z-[90] bg-[#07101d] overflow-y-auto p-4 md:p-8 safe-area-top safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <header className="flex items-center justify-between gap-3"><div><p className="text-xs text-purple-300">Estudo de {child?.display_name}</p><h2 className="font-black">{selectedMaterial.title}</h2></div><button onClick={() => { setQuizOpen(false); void stopKidsSpeech() }} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><XCircle className="w-5 h-5" /></button></header>

            {!quizFinished ? <section className="mt-8 rounded-[30px] bg-slate-950 border border-purple-500/20 p-6 md:p-8"><div className="flex items-center justify-between text-xs text-slate-500"><span>Pergunta {quizIndex + 1} de {selectedMaterial.study_pack.questions.length}</span><span>{quizScore} acerto{quizScore === 1 ? '' : 's'}</span></div><div className="flex gap-3 items-start mt-6"><h3 className="text-2xl font-black flex-1">{question.question}</h3><button onClick={() => void speakKidsText(question.question)} className="p-2 rounded-xl bg-slate-900 text-purple-300"><Volume2 className="w-5 h-5" /></button></div><div className="grid gap-3 mt-6">{question.options.map((option, index) => <button key={`${option}-${index}`} disabled={quizRevealed} onClick={() => setQuizAnswer(index)} className={cn('p-4 rounded-2xl border text-left font-bold', quizRevealed && index === question.correct_index ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : quizRevealed && index === quizAnswer ? 'bg-rose-500/10 border-rose-500/30 text-rose-200' : quizAnswer === index ? 'bg-purple-500/20 border-purple-500/40' : 'bg-slate-900 border-slate-800')}>{option}</button>)}</div>{quizRevealed && <div className="mt-5 rounded-2xl bg-slate-900 border border-slate-800 p-4"><div className="flex gap-2 items-center">{quizAnswer === question.correct_index ? <CheckCircle2 className="w-5 h-5 text-emerald-300" /> : <RotateCcw className="w-5 h-5 text-amber-300" />}<p className="font-bold">{quizAnswer === question.correct_index ? 'Muito bem!' : 'Vamos revisar'}</p></div><p className="text-sm text-slate-400 mt-2">{question.explanation}</p></div>}<button onClick={quizRevealed ? () => void nextQuiz() : revealQuiz} disabled={quizAnswer === null} className="btn-purple w-full py-3.5 rounded-xl font-black mt-6 disabled:opacity-35">{quizRevealed ? 'Próxima' : 'Conferir'}</button></section> : <section className="mt-10 text-center rounded-[30px] bg-slate-950 border border-emerald-500/20 p-8"><CheckCircle2 className="w-16 h-16 text-emerald-300 mx-auto" /><h2 className="text-3xl font-black mt-4">Revisão concluída!</h2><p className="text-slate-400 mt-2">{quizScore} de {selectedMaterial.study_pack.questions.length} respostas corretas.</p><button onClick={() => setQuizOpen(false)} className="btn-purple px-7 py-3 rounded-xl font-bold mt-6">Voltar à biblioteca</button></section>}
          </div>
        </div>
      )}
    </div>
  )
}
