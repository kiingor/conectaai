'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface AudioRecorderProps {
  /** Chamado quando o usuário para a gravação (entrega o arquivo de áudio). */
  onConfirm: (file: File) => void
  /** Avisa o pai quando entra/sai do modo gravação (para esconder o input). */
  onActiveChange?: (active: boolean) => void
  disabled?: boolean
}

// Ordem de preferência — o navegador escolhe o primeiro suportado.
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
]

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const c of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* ignore */
    }
  }
  return ''
}

function extForMime(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4')) return 'm4a'
  return 'webm'
}

export function AudioRecorder({ onConfirm, onActiveChange, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string>('audio/webm')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number>(0)
  // true = confirmar (entregar áudio); false = cancelar (descartar)
  const confirmOnStopRef = useRef<boolean>(true)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Seu navegador não suporta gravação de áudio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      mimeRef.current = mime || 'audio/webm'
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream)
      chunksRef.current = []
      confirmOnStopRef.current = true

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stopTimer()
        releaseStream()
        const shouldConfirm = confirmOnStopRef.current
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        chunksRef.current = []
        setRecording(false)
        onActiveChange?.(false)
        if (shouldConfirm && blob.size > 0) {
          const ext = extForMime(mimeRef.current)
          const type = mimeRef.current.split(';')[0]
          const file = new File([blob], `audio-${Date.now()}.${ext}`, { type })
          onConfirm(file)
        }
      }

      recorder.start()
      recorderRef.current = recorder

      // Tempo medido pelo relógio real — imune a re-renders/timers duplicados.
      startedAtRef.current = Date.now()
      setSeconds(0)
      stopTimer()
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)

      setRecording(true)
      onActiveChange?.(true)
    } catch (err) {
      console.error('[AudioRecorder] Falha ao acessar o microfone:', err)
      releaseStream()
      toast.error('Não foi possível acessar o microfone. Verifique a permissão no navegador.')
    }
  }, [onActiveChange, onConfirm, releaseStream, stopTimer])

  const finish = useCallback((confirm: boolean) => {
    confirmOnStopRef.current = confirm
    try {
      recorderRef.current?.stop()
    } catch {
      // se o recorder não estava ativo, força limpeza
      stopTimer()
      releaseStream()
      setRecording(false)
      onActiveChange?.(false)
    }
  }, [onActiveChange, releaseStream, stopTimer])

  useEffect(() => {
    return () => {
      stopTimer()
      releaseStream()
    }
  }, [stopTimer, releaseStream])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (recording) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-red-500">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          Gravando
          <span className="tabular-nums">{fmt(seconds)}</span>
        </span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => finish(false)}
          className="shrink-0"
          title="Cancelar gravação"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button
          size="icon"
          onClick={() => finish(true)}
          className="shrink-0"
          title="Parar e revisar"
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={startRecording}
      disabled={disabled}
      className="shrink-0"
      title="Gravar áudio"
    >
      <Mic className="h-5 w-5 text-muted-foreground/80" />
    </Button>
  )
}
