import { useRef, useState } from 'react'
import { getRecordingStream } from '../audio/context'

export function Recorder() {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const toggle = () => {
    if (recording) {
      recorderRef.current?.stop()
      setRecording(false)
      return
    }
    const recorder = new MediaRecorder(getRecordingStream())
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eguitar-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    recorder.start()
    recorderRef.current = recorder
    setRecording(true)
  }

  return (
    <button
      className={'record-btn' + (recording ? ' recording' : '')}
      onClick={toggle}
      title={recording ? 'Stop and download recording' : 'Record your playing'}
    >
      {recording ? '■ Stop' : '● Rec'}
    </button>
  )
}
