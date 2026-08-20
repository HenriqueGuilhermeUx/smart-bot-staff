import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, CheckCircle2, Clock3, LockKeyhole, RotateCcw, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react'
import { buildAlternatingChallengeCards, deckForAge, KIDS_CATEGORY_LABELS } from '@/data/kidsChallenges'
import type { StaffChild } from '@/lib/staffFamilyData'
import { saveKidsGameSession } from '@/lib/staffFamilyData'
import { getKidsSessionMinutes, hasParentalPin, setKidsSessionMinutes, setParentalPin, verifyParentalPin } from '@/lib/staffParental'
import { speakKidsText, stopKidsSpeech } from '@/lib/kidsVoice'
import { cn } from '@/lib/staffUi'

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function KidsChallengesView({ userId, children, onSessionSaved }: {
  userId: string
  children: StaffChild[]
  onSessionSaved?: () => void
}) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id || '')
  const [minutes, setMinutes] = useState(getKidsSessionMinutes())
  const [pinReady, setPinReady] = useState(hasParentalPin())
  const [newPin, setNewPin] = useState('')
  const [pinMessage, setPinMessage] = useState('')
  const [active, setActive] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [cardIndex, setCardIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [gateOpen, setGateOpen] = useState(false)
  const [gatePin, setGatePin] = useState('')
  const [gateError, setGateError] = useState('')
  const [timeEnded, setTimeEnded] = useState(false)
  const startAtRef = useRef('')
  const savedRef = useRef(false)

  useEffect(() => {
    if (!selectedChildId && children[0]) setSelectedChildId(children[0].id)
    if (selectedChildId && !children.some((child) => child.id === selectedChildId)) setSelectedChildId(children[0]?.id || '')
  }, [children, selectedChildId])

  const child = children.find((item) => item.id === selectedChildId) || children[0]
  const deck = useMemo(() => deckForAge(child?.age_group || '6-8'), [child?.age_group])
  const cards = useMemo(() => buildAlternatingChallengeCards(deck), [deck])
  const card = cards[cardIndex % Math.max(cards.length, 1)]

  useEffect(() => {
    if (!active || remaining <= 0) return
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [active, remaining > 0])

  useEffect(() => {
    if (!active || remaining !== 0 || timeEnded) return
    setTimeEnded(true)
    setGateOpen(true)
    void finalizeSession()
  }, [active, remaining, timeEnded])

  useEffect(() => {
    if (!active || !card?.audio_narrative || revealed) return
    void speakKidsText(card.question)
    return () => { void stopKidsSpeech() }
  }, [active, card?.card_id, revealed])

  async function createPin() {
    try {
      await setParentalPin(newPin)
      setPinReady(true)
      setNewPin('')
      setPinMessage('PIN parental criado. Guarde esse número com o responsável.')
    } catch (error) {
      setPinMessage(error instanceof Error ? error.message : 'Não consegui criar o PIN.')
    }
  }

  function chooseMinutes(value: number) {
    setMinutes(value)
    setKidsSessionMinutes(value)
  }

  function startSession() {
    if (!child || !pinReady) return
    savedRef.current = false
    startAtRef.current = new Date().toISOString()
    setRemaining(minutes * 60)
    setCardIndex(0)
    setScore(0)
    setAnswered(0)
    setSelectedAnswer('')
    setRevealed(false)
    setTimeEnded(false)
    setGateOpen(false)
    setActive(true)
  }

  function revealAnswer() {
    if (!selectedAnswer || revealed) return
    setRevealed(true)
    setAnswered((value) => value + 1)
    if (selectedAnswer === card.correct_answer) setScore((value) => value + 1)
    void speakKidsText(`${selectedAnswer === card.correct_answer ? 'Muito bem!' : 'Vamos aprender juntos.'} ${card.explanation}`)
  }

  function nextCard() {
    setCardIndex((value) => (value + 1) % cards.length)
    setSelectedAnswer('')
    setRevealed(false)
  }

  async function finalizeSession() {
    if (savedRef.current || !child || !startAtRef.current) return
    savedRef.current = true
    const elapsed = Math.max(0, minutes * 60 - remaining)
    await saveKidsGameSession(userId, {
      child_id: child.id,
      deck_id: deck.deck_id,
      score,
      total_questions: answered,
      duration_seconds: elapsed,
      started_at: startAtRef.current,
      ended_at: new Date().toISOString(),
    }).catch((error) => console.error('Erro ao salvar sessão Kids:', error))
    onSessionSaved?.()
  }

  function requestExit() {
    setGateOpen(true)
    setGatePin('')
    setGateError('')
  }

  async function unlock(action: 'exit' | '5' | '10') {
    const ok = await verifyParentalPin(gatePin)
    if (!ok) {
      setGateError('PIN incorreto.')
      return
    }
    setGatePin('')
    setGateError('')
    setGateOpen(false)

    if (action === 'exit') {
      await finalizeSession()
      setActive(false)
      setTimeEnded(false)
      await stopKidsSpeech()
      return
    }

    savedRef.current = false
    startAtRef.current = new Date().toISOString()
    setRemaining(Number(action) * 60)
    setTimeEnded(false)
  }

  if (!children.length) {
    return <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-7 text-center"><Brain className="w-10 h-10 text-purple-300 mx-auto" /><h3 className="text-xl font-black mt-3">Cadastre um filho primeiro</h3><p className="text-slate-500 mt-2">O Staff usa a faixa etária do perfil para escolher os desafios adequados.</p></div>
  }

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-6">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-fuchsia-500/15 text-fuchsia-300 grid place-items-center"><Brain className="w-6 h-6" /></div><div><h3 className="font-black text-lg">Desafios Kids</h3><p className="text-sm text-slate-500">Raciocínio e conhecimento com tempo controlado.</p></div></div>
          <label className="block mt-5 text-xs font-bold text-slate-500 uppercase tracking-wide">Quem vai jogar?</label>
          <select value={selectedChildId} onChange={(event) => setSelectedChildId(event.target.value)} className="w-full mt-2 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3">
            {children.map((item) => <option key={item.id} value={item.id}>{item.avatar_emoji} {item.display_name} · {item.age_group} anos</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-3">Deck: <span className="text-purple-300">{deck.theme}</span></p>

          <label className="block mt-5 text-xs font-bold text-slate-500 uppercase tracking-wide">Tempo da sessão</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[5, 10, 15].map((value) => <button key={value} onClick={() => chooseMinutes(value)} className={cn('py-3 rounded-xl border font-bold', minutes === value ? 'bg-purple-500/20 border-purple-400/40 text-purple-200' : 'bg-slate-900 border-slate-800 text-slate-400')}>{value} min</button>)}
          </div>
          <button onClick={startSession} disabled={!pinReady} className="btn-purple w-full mt-5 py-3.5 rounded-xl font-black disabled:opacity-40"><Sparkles className="inline w-4 h-4 mr-2" />Começar sessão</button>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 md:p-6">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-300 grid place-items-center"><ShieldCheck className="w-6 h-6" /></div><div><h3 className="font-black text-lg">Controle parental</h3><p className="text-sm text-slate-500">Mais tempo ou saída do modo criança exigem PIN.</p></div></div>
          {pinReady ? (
            <div className="mt-5 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5"><p className="text-emerald-300 font-bold">PIN configurado</p><p className="text-sm text-slate-500 mt-1">A criança não consegue ampliar o tempo nem sair da sessão sem a ação do responsável.</p></div>
          ) : (
            <div className="mt-5"><label className="text-sm text-slate-400">Crie um PIN de 4 a 6 números</label><div className="flex gap-2 mt-2"><input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-4 py-3" placeholder="••••" /><button onClick={createPin} className="px-4 rounded-xl bg-slate-800 font-bold">Salvar</button></div>{pinMessage && <p className="text-xs text-purple-300 mt-2">{pinMessage}</p>}</div>
          )}
        </section>
      </div>

      {active && card && (
        <div className="fixed inset-0 z-[90] bg-[#07101d] overflow-y-auto safe-area-top safe-area-bottom">
          <div className="min-h-screen max-w-3xl mx-auto p-4 md:p-8 flex flex-col">
            <header className="flex items-center justify-between gap-3">
              <div><p className="text-xs text-slate-500">Desafios Kids · {child?.display_name}</p><p className="font-black text-white">{deck.theme}</p></div>
              <div className="flex items-center gap-2"><div className={cn('px-3 py-2 rounded-xl border flex items-center gap-2 font-mono font-bold', remaining <= 60 ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-slate-900 border-slate-800 text-purple-200')}><Clock3 className="w-4 h-4" />{formatTime(remaining)}</div><button onClick={requestExit} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800"><LockKeyhole className="w-5 h-5" /></button></div>
            </header>

            <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span>{KIDS_CATEGORY_LABELS[card.category]}</span><span>{score} acerto{score === 1 ? '' : 's'} · {answered} respondida{answered === 1 ? '' : 's'}</span></div>

            <div className="flex-1 flex items-center justify-center py-6">
              <div className={cn('kids-flip-card w-full max-w-xl min-h-[430px]', revealed && 'is-flipped')}>
                <div className="kids-flip-inner">
                  <section className="kids-flip-face rounded-[32px] border border-purple-500/25 bg-gradient-to-b from-[#15112d] to-[#0a1021] p-6 md:p-9 shadow-2xl">
                    <div className="flex justify-between items-center"><span className="text-xs px-3 py-1.5 rounded-full bg-purple-500/15 text-purple-200">{KIDS_CATEGORY_LABELS[card.category]}</span>{card.audio_narrative && <button onClick={() => void speakKidsText(card.question)} className="p-2 rounded-xl bg-slate-900 text-purple-200"><Volume2 className="w-5 h-5" /></button>}</div>
                    <h2 className="text-2xl md:text-3xl font-black leading-tight mt-7">{card.question}</h2>
                    <div className="grid gap-3 mt-7">{card.options.map((option) => <button key={option} onClick={() => setSelectedAnswer(option)} className={cn('text-left px-4 py-4 rounded-2xl border font-bold transition-all', selectedAnswer === option ? 'bg-purple-500/25 border-purple-400/60 text-white scale-[1.01]' : 'bg-slate-950/50 border-slate-800 text-slate-300')}>{option}</button>)}</div>
                    <button onClick={revealAnswer} disabled={!selectedAnswer} className="btn-purple w-full mt-7 py-3.5 rounded-xl font-black disabled:opacity-30">Conferir</button>
                  </section>

                  <section className="kids-flip-face kids-flip-back rounded-[32px] border border-emerald-500/25 bg-gradient-to-b from-[#0d2a24] to-[#08131a] p-6 md:p-9 shadow-2xl flex flex-col justify-center">
                    <CheckCircle2 className={cn('w-14 h-14', selectedAnswer === card.correct_answer ? 'text-emerald-300' : 'text-amber-300')} />
                    <p className="text-sm uppercase tracking-wide font-bold mt-5 text-slate-400">{selectedAnswer === card.correct_answer ? 'Acertou!' : 'Boa tentativa!'}</p>
                    <h2 className="text-3xl font-black mt-2">Resposta: {card.correct_answer}</h2>
                    <p className="text-lg text-slate-300 mt-5 leading-relaxed">{card.explanation}</p>
                    <button onClick={nextCard} className="mt-8 w-full py-3.5 rounded-xl bg-white text-slate-950 font-black">Próximo desafio</button>
                  </section>
                </div>
              </div>
            </div>
          </div>

          {gateOpen && (
            <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md p-4 grid place-items-center">
              <div className="w-full max-w-md rounded-3xl border border-purple-500/25 bg-[#0a1021] p-6 shadow-2xl">
                <div className="flex items-start justify-between"><div><LockKeyhole className="w-8 h-8 text-purple-300" /><h3 className="text-2xl font-black mt-3">Área do responsável</h3></div>{!timeEnded && <button onClick={() => setGateOpen(false)} className="p-2"><X className="w-5 h-5" /></button>}</div>
                <p className="text-slate-500 mt-2">{timeEnded ? 'O tempo terminou. Digite o PIN para liberar mais tempo ou voltar ao Staff.' : 'Digite o PIN para encerrar a sessão antes do tempo.'}</p>
                <input value={gatePin} onChange={(event) => setGatePin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" className="w-full mt-5 rounded-xl bg-slate-950 border border-slate-700 px-4 py-3 text-center text-xl tracking-[0.4em]" placeholder="••••" />
                {gateError && <p className="text-sm text-rose-300 mt-2">{gateError}</p>}
                <div className="grid gap-2 mt-5">{timeEnded && <><button onClick={() => void unlock('5')} className="py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 font-bold">+ 5 minutos</button><button onClick={() => void unlock('10')} className="py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 font-bold">+ 10 minutos</button></>}<button onClick={() => void unlock('exit')} className="py-3 rounded-xl bg-slate-800 font-bold">Voltar ao Staff</button></div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-slate-950/50 border border-slate-800 p-4 text-sm text-slate-500 flex gap-3"><RotateCcw className="w-5 h-5 shrink-0 text-purple-300" /><p>Os decks básicos ficam no próprio aplicativo. A criança pode brincar sem enviar mensagens, fotos ou dados para a IA. Somente o responsável administra perfis, materiais e tempo de uso.</p></div>
    </div>
  )
}
