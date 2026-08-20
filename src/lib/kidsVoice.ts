import { SpeechSynthesis } from '@capgo/capacitor-speech-synthesis'

const LANGUAGE = 'pt-BR'

export async function stopKidsSpeech() {
  await SpeechSynthesis.cancel().catch(() => undefined)
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export async function speakKidsText(text: string) {
  const value = text.replace(/\s+/g, ' ').trim().slice(0, 700)
  if (!value) return
  await stopKidsSpeech()

  try {
    const availability = await SpeechSynthesis.isAvailable()
    if (!availability.isAvailable) throw new Error('tts-unavailable')
    await SpeechSynthesis.initialize().catch(() => undefined)
    await SpeechSynthesis.speak({
      text: value,
      language: LANGUAGE,
      pitch: 1.05,
      rate: 0.9,
      volume: 1,
      queueStrategy: 'Flush',
    })
  } catch {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(value)
    utterance.lang = LANGUAGE
    utterance.rate = 0.9
    utterance.pitch = 1.05
    window.speechSynthesis.speak(utterance)
  }
}
