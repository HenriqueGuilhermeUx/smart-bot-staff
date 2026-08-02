import { Capacitor } from '@capacitor/core'
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition'
import { SpeechSynthesis } from '@capgo/capacitor-speech-synthesis'

export type StaffVoiceState = 'idle' | 'requesting-permission' | 'listening' | 'processing' | 'error'
export type VoiceResponseMode = 'never' | 'after-voice' | 'always'

export type StaffVoiceCallbacks = {
  onPartial?: (text: string) => void
  onState?: (state: StaffVoiceState) => void
  onError?: (message: string) => void
}

type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
    length: number
  }>
}

type BrowserSpeechRecognitionErrorEvent = { error?: string; message?: string }

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

const VOICE_PRIVACY_KEY = 'staff_voice_privacy_accepted_v1'
const VOICE_RESPONSE_KEY = 'staff_voice_response_mode_v1'
const VOICE_LANGUAGE = 'pt-BR'

let activeBrowserRecognition: BrowserSpeechRecognition | null = null
let nativeListening = false

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function friendlyRecognitionError(code?: string) {
  const normalized = (code || '').toLowerCase()
  if (normalized.includes('permission') || normalized.includes('denied') || normalized.includes('not-allowed')) {
    return 'Permita o acesso ao microfone para falar com o Staff.'
  }
  if (normalized.includes('no-speech') || normalized.includes('no_match') || normalized.includes('nomatch')) {
    return 'Não consegui ouvir sua fala. Tente novamente mais perto do microfone.'
  }
  if (normalized.includes('network')) return 'O serviço de voz está sem conexão. Tente novamente ou digite sua solicitação.'
  if (normalized.includes('busy') || normalized.includes('recognizer')) return 'O reconhecimento de voz está ocupado. Aguarde um instante e tente novamente.'
  return 'Não consegui reconhecer sua fala. Tente novamente.'
}

export function usesNativeVoice() {
  return Capacitor.isNativePlatform()
}

export function hasAcceptedVoicePrivacy() {
  return localStorage.getItem(VOICE_PRIVACY_KEY) === 'true'
}

export function acceptVoicePrivacy() {
  localStorage.setItem(VOICE_PRIVACY_KEY, 'true')
}

export function revokeVoicePrivacy() {
  localStorage.removeItem(VOICE_PRIVACY_KEY)
}

export function getVoiceResponseMode(): VoiceResponseMode {
  const stored = localStorage.getItem(VOICE_RESPONSE_KEY)
  if (stored === 'never' || stored === 'always' || stored === 'after-voice') return stored
  return 'after-voice'
}

export function setVoiceResponseMode(mode: VoiceResponseMode) {
  localStorage.setItem(VOICE_RESPONSE_KEY, mode)
}

export async function staffVoiceAvailable() {
  if (usesNativeVoice()) {
    const result = await SpeechRecognition.available().catch(() => ({ available: false }))
    return result.available
  }
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export async function stopStaffListening() {
  if (usesNativeVoice()) {
    if (!nativeListening) return
    await SpeechRecognition.forceStop({ timeout: 1200 }).catch(async () => {
      await SpeechRecognition.stop().catch(() => undefined)
    })
    return
  }
  activeBrowserRecognition?.stop()
}

export async function cancelStaffListening() {
  if (usesNativeVoice()) {
    if (!nativeListening) return
    await SpeechRecognition.forceStop({ timeout: 500 }).catch(() => undefined)
    nativeListening = false
    return
  }
  activeBrowserRecognition?.abort()
  activeBrowserRecognition = null
}

async function listenNative(callbacks: StaffVoiceCallbacks) {
  callbacks.onState?.('requesting-permission')

  const availability = await SpeechRecognition.available()
  if (!availability.available) throw new Error('unavailable')

  const permission = await SpeechRecognition.checkPermissions()
  const resolvedPermission = permission.speechRecognition === 'granted'
    ? permission
    : await SpeechRecognition.requestPermissions()

  if (resolvedPermission.speechRecognition !== 'granted') throw new Error('permission-denied')

  const onDevice = await SpeechRecognition
    .isOnDeviceRecognitionAvailable({ language: VOICE_LANGUAGE })
    .catch(() => ({ available: false }))

  return new Promise<string>(async (resolve, reject) => {
    let lastPartial = ''
    let settled = false
    let finishing = false
    let timeoutId = 0

    const listeners = await Promise.all([
      SpeechRecognition.addListener('partialResults', (event) => {
        const partial = normalizeTranscript(event.accumulatedText || event.matches?.[0] || event.accumulated || '')
        if (!partial) return
        lastPartial = partial
        callbacks.onPartial?.(partial)
      }),
      SpeechRecognition.addListener('error', (event) => {
        if (settled || finishing) return
        const message = friendlyRecognitionError(event.code || event.message)
        callbacks.onError?.(message)
        void finish(false, message)
      }),
      SpeechRecognition.addListener('listeningState', (event) => {
        if (event.state === 'started' || event.state === 'startingListening') callbacks.onState?.('listening')
        if (event.state === 'stopped' && !settled && !finishing) void finish(true)
      }),
    ])

    async function cleanup() {
      nativeListening = false
      window.clearTimeout(timeoutId)
      await Promise.all(listeners.map((listener) => listener.remove())).catch(() => undefined)
    }

    async function finish(success: boolean, explicitError?: string) {
      if (settled || finishing) return
      finishing = true

      if (success) {
        const cached = await SpeechRecognition.getLastPartialResult().catch(() => ({ available: false, text: '', matches: [] as string[] }))
        const transcript = normalizeTranscript(cached.text || cached.matches?.[0] || lastPartial)
        await cleanup()
        settled = true
        finishing = false
        if (!transcript) {
          reject(new Error('no-speech'))
          return
        }
        callbacks.onState?.('processing')
        resolve(transcript)
        return
      }

      await cleanup()
      settled = true
      finishing = false
      reject(new Error(explicitError || 'recognition-error'))
    }

    try {
      nativeListening = true
      callbacks.onState?.('listening')
      const immediate = await SpeechRecognition.start({
        language: VOICE_LANGUAGE,
        maxResults: 3,
        partialResults: true,
        popup: false,
        addPunctuation: true,
        allowForSilence: 1400,
        useOnDeviceRecognition: onDevice.available,
        contextualStrings: [
          'Staff', 'agenda', 'automação', 'reunião', 'consulta', 'lembrete', 'tarefa',
          'resumo diário', 'planejamento semanal', 'cardiologista', 'condomínio',
        ],
      })

      const immediateText = normalizeTranscript(immediate.matches?.[0] || '')
      if (immediateText) {
        lastPartial = immediateText
        callbacks.onPartial?.(immediateText)
      }

      timeoutId = window.setTimeout(() => {
        void SpeechRecognition.forceStop({ timeout: 800 }).catch(() => undefined)
      }, 25000)
    } catch (error) {
      await finish(false, error instanceof Error ? error.message : String(error))
    }
  })
}

function listenWeb(callbacks: StaffVoiceCallbacks) {
  return new Promise<string>((resolve, reject) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      reject(new Error('unavailable'))
      return
    }

    const recognition = new Recognition()
    activeBrowserRecognition = recognition
    let finalText = ''
    let partialText = ''
    let settled = false

    recognition.lang = VOICE_LANGUAGE
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const item = event.results[index]
        const transcript = normalizeTranscript(item[0]?.transcript || '')
        if (!transcript) continue
        if (item.isFinal) finalText = transcript
        else partialText = transcript
      }
      const visible = finalText || partialText
      if (visible) callbacks.onPartial?.(visible)
    }

    recognition.onerror = (event) => {
      if (settled) return
      settled = true
      activeBrowserRecognition = null
      reject(new Error(event.error || event.message || 'recognition-error'))
    }

    recognition.onend = () => {
      if (settled) return
      settled = true
      activeBrowserRecognition = null
      const transcript = normalizeTranscript(finalText || partialText)
      if (!transcript) {
        reject(new Error('no-speech'))
        return
      }
      callbacks.onState?.('processing')
      resolve(transcript)
    }

    callbacks.onState?.('listening')
    recognition.start()
  })
}

export async function listenForStaffCommand(callbacks: StaffVoiceCallbacks = {}) {
  try {
    await cancelStaffListening()
    return usesNativeVoice() ? await listenNative(callbacks) : await listenWeb(callbacks)
  } catch (error) {
    const message = friendlyRecognitionError(error instanceof Error ? error.message : String(error))
    callbacks.onState?.('error')
    callbacks.onError?.(message)
    throw new Error(message)
  } finally {
    window.setTimeout(() => callbacks.onState?.('idle'), 250)
  }
}

function plainSpeechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`~]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}

export function shouldSpeakStaffResponse(fromVoice: boolean) {
  const mode = getVoiceResponseMode()
  return mode === 'always' || (mode === 'after-voice' && fromVoice)
}

export async function stopStaffSpeech() {
  await SpeechSynthesis.cancel().catch(() => undefined)
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function speakStaffResponse(text: string, fromVoice: boolean) {
  if (!shouldSpeakStaffResponse(fromVoice)) return
  const speechText = plainSpeechText(text)
  if (!speechText) return

  await stopStaffSpeech()

  try {
    const availability = await SpeechSynthesis.isAvailable()
    if (!availability.isAvailable) throw new Error('tts-unavailable')
    await SpeechSynthesis.initialize().catch(() => undefined)
    await SpeechSynthesis.speak({
      text: speechText,
      language: VOICE_LANGUAGE,
      pitch: 1,
      rate: 0.95,
      volume: 1,
      queueStrategy: 'Flush',
    })
    return
  } catch {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = VOICE_LANGUAGE
    utterance.rate = 0.95
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }
}
