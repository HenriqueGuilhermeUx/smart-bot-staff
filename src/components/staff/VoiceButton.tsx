import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff, ShieldCheck, Sparkles, Square, X } from 'lucide-react'
import {
  acceptVoicePrivacy,
  cancelStaffListening,
  hasAcceptedVoicePrivacy,
  listenForStaffCommand,
  staffVoiceAvailable,
  stopStaffListening,
  type StaffVoiceState,
} from '@/lib/staffVoice'
import { cn } from '@/lib/staffUi'

export function VoiceButton({
  onTranscript,
  disabled = false,
  floating = false,
  className,
}: {
  onTranscript: (text: string) => Promise<void> | void
  disabled?: boolean
  floating?: boolean
  className?: string
}) {
  const [state, setState] = useState<StaffVoiceState>('idle')
  const [partial, setPartial] = useState('')
  const [error, setError] = useState('')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    staffVoiceAvailable().then(setSupported).catch(() => setSupported(false))
    return () => { void cancelStaffListening() }
  }, [])

  const listening = state === 'listening' || state === 'requesting-permission'
  const processing = state === 'processing'

  async function begin() {
    if (!hasAcceptedVoicePrivacy()) {
      setPrivacyOpen(true)
      return
    }

    setError('')
    setPartial('')

    try {
      const transcript = await listenForStaffCommand({
        onPartial: setPartial,
        onState: setState,
        onError: setError,
      })
      setState('processing')
      await onTranscript(transcript)
      setPartial('')
      setState('idle')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não consegui ouvir você.')
      setState('error')
      window.setTimeout(() => setState('idle'), 2500)
    }
  }

  async function toggle() {
    if (listening) {
      await stopStaffListening()
      return
    }
    if (!processing) await begin()
  }

  function acceptAndStart() {
    acceptVoicePrivacy()
    setPrivacyOpen(false)
    window.setTimeout(() => { void begin() }, 100)
  }

  const label = !supported
    ? 'Voz indisponível'
    : listening
      ? 'Parar gravação'
      : processing
        ? 'Processando sua fala'
        : 'Falar com o Staff'

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || processing || !supported}
        aria-label={label}
        title={label}
        className={cn(
          'relative flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed',
          floating
            ? 'fixed z-30 right-4 bottom-24 md:right-7 md:bottom-7 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 text-white shadow-2xl shadow-purple-950/60 border border-purple-300/20 hover:scale-105'
            : 'w-12 h-12 rounded-xl border border-purple-500/25 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20',
          listening && 'bg-rose-500/20 border-rose-400/40 text-rose-200 animate-pulse',
          className,
        )}
      >
        {processing || state === 'requesting-permission'
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : listening
            ? <Square className="w-4 h-4 fill-current" />
            : supported
              ? <Mic className="w-5 h-5" />
              : <MicOff className="w-5 h-5" />}
        {floating && !listening && !processing && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-purple-700 flex items-center justify-center"><Sparkles className="w-3 h-3" /></span>
        )}
      </button>

      {(listening || processing || error) && (
        <div className="fixed z-[70] inset-x-4 bottom-24 md:bottom-8 md:left-auto md:right-24 md:w-[390px] rounded-3xl border border-purple-500/25 bg-[#090d1d]/95 backdrop-blur-2xl shadow-2xl p-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
              error ? 'bg-rose-500/10 text-rose-300' : 'bg-purple-500/15 text-purple-300',
            )}>
              {error ? <MicOff className="w-6 h-6" /> : processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">{error ? 'Não consegui entender' : processing ? 'Organizando seu pedido...' : 'Ouvindo você'}</p>
              <p className={cn('text-sm mt-1 leading-relaxed', error ? 'text-rose-300' : 'text-slate-400')}>
                {error || partial || 'Fale naturalmente. O Staff transforma sua fala em uma solicitação.'}
              </p>
              {listening && (
                <div className="flex items-end gap-1 h-6 mt-3" aria-hidden="true">
                  {[9, 18, 12, 22, 15, 25, 13, 19, 10, 23, 16, 11].map((height, index) => (
                    <span key={index} className="w-1 rounded-full bg-purple-400 animate-pulse" style={{ height, animationDelay: `${index * 70}ms` }} />
                  ))}
                </div>
              )}
            </div>
            {listening && <button type="button" onClick={() => { void stopStaffListening() }} className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white" aria-label="Parar"><X className="w-4 h-4" /></button>}
          </div>
        </div>
      )}

      {privacyOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-3xl bg-[#0a0f22] border border-purple-500/25 shadow-2xl p-6 md:p-7">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 flex items-center justify-center mb-5"><ShieldCheck className="w-7 h-7 text-purple-300" /></div>
            <h2 className="text-2xl font-black text-white">Use sua voz com privacidade</h2>
            <p className="text-slate-400 mt-3 leading-relaxed">
              O microfone será usado somente enquanto você estiver falando com o Staff. A fala é transformada em texto para executar sua solicitação. O Staff não salva o áudio bruto.
            </p>
            <div className="mt-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-sm text-slate-400 leading-relaxed">
              Dependendo do aparelho, o reconhecimento pode acontecer no próprio dispositivo ou pelo serviço de voz configurado no Android. Você pode continuar usando o app por texto a qualquer momento.
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setPrivacyOpen(false)} className="py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">Agora não</button>
              <button type="button" onClick={acceptAndStart} className="btn-purple py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Mic className="w-5 h-5" /> Permitir e falar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
