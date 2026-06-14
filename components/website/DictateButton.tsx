'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'

/**
 * Tarayıcı yerel Web Speech API ile sesle-yazma (client-side, ücretsiz, anahtarsız).
 * Desteklenmeyen tarayıcıda (örn. Firefox) hiçbir şey render etmez (graceful).
 * Yeniden kullanılabilir: onAppend ile herhangi bir alana metin ekler.
 */

interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean }
interface SpeechResultList { length: number; [i: number]: SpeechResult }
interface SpeechEvent { resultIndex: number; results: SpeechResultList }
interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechEvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => RecognitionLike
    webkitSpeechRecognition?: new () => RecognitionLike
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

interface DictateButtonProps {
  onAppend: (text: string) => void
  lang?: string
  labelStart: string
  labelStop: string
}

export default function DictateButton({ onAppend, lang = 'tr-TR', labelStart, labelStop }: DictateButtonProps) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<RecognitionLike | null>(null)

  useEffect(() => { setSupported(getRecognitionCtor() != null) }, [])
  useEffect(() => () => { try { recRef.current?.stop() } catch { /* noop */ } }, [])

  const toggle = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* noop */ } return }
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: SpeechEvent) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
      }
      if (finalText.trim()) onAppend(finalText.trim())
    }
    rec.onend = () => { setListening(false); recRef.current = null }
    rec.onerror = () => { setListening(false) }
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? labelStop : labelStart}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        listening ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-50/60'
      }`}
    >
      {listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      <span className={listening ? 'animate-pulse' : ''}>{listening ? labelStop : labelStart}</span>
    </button>
  )
}
