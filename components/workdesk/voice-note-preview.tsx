'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Trash2, Send, Loader2 } from 'lucide-react'

interface VoiceNotePreviewProps {
  /** objectURL do áudio gravado */
  src: string
  /** descarta a gravação */
  onDiscard: () => void
  /** envia o áudio (reusa o fluxo de envio do compositor) */
  onSend: () => void
  /** true enquanto faz upload/envio */
  sending?: boolean
}

// Número de barras da waveform.
const BARS = 28

// Waveform estática "fake" mas com cara orgânica (determinística, sem random
// p/ não recalcular a cada render). Apenas decorativa + indicador de progresso.
const HEIGHTS = Array.from({ length: BARS }, (_, i) => {
  const base = Math.sin(i * 0.9) * Math.cos(i * 0.4)
  return 0.35 + Math.abs(base) * 0.65 // entre 0.35 e 1.0
})

export function VoiceNotePreview({ src, onDiscard, onSend, sending }: VoiceNotePreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  // (Re)cria o elemento de áudio quando o src muda.
  useEffect(() => {
    const audio = new Audio(src)
    audioRef.current = audio

    const onLoaded = () => {
      // Alguns formatos (webm gravado) reportam Infinity até dar seek.
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onTime = () => setCurrent(audio.currentTime)
    const onEnd = () => {
      setPlaying(false)
      setCurrent(0)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)

    return () => {
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audioRef.current = null
    }
  }, [src])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(() => {})
      setPlaying(true)
    }
  }

  const seekToBar = (index: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration === 0) return
    audio.currentTime = (index / BARS) * audio.duration
    setCurrent(audio.currentTime)
  }

  const progress = duration > 0 ? current / duration : 0
  const activeBars = Math.round(progress * BARS)

  const fmt = (s: number) => {
    if (!Number.isFinite(s)) s = 0
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }
  // Mostra o tempo decorrido enquanto toca; senão a duração total.
  const timeLabel = playing || current > 0 ? fmt(current) : fmt(duration)

  return (
    <div className="flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-500/25 pl-1.5 pr-2 py-1.5">
      {/* Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
        title={playing ? 'Pausar' : 'Reproduzir'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      {/* Waveform */}
      <div className="flex h-8 flex-1 items-center gap-[2px] px-1 min-w-[120px]">
        {HEIGHTS.map((h, i) => (
          <button
            key={i}
            type="button"
            onClick={() => seekToBar(i)}
            className="group flex h-full flex-1 items-center"
            title="Ir para"
            tabIndex={-1}
          >
            <span
              className={
                'w-full rounded-full transition-colors ' +
                (i < activeBars ? 'bg-emerald-400' : 'bg-emerald-400/30 group-hover:bg-emerald-400/50')
              }
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          </button>
        ))}
      </div>

      {/* Tempo */}
      <span className="shrink-0 tabular-nums text-xs font-medium text-emerald-300 w-9 text-right">
        {timeLabel}
      </span>

      {/* Descartar */}
      <button
        type="button"
        onClick={onDiscard}
        disabled={sending}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-red-400 disabled:opacity-50"
        title="Descartar áudio"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Enviar */}
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        title="Enviar áudio"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  )
}
