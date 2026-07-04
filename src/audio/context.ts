export type TonePreset = 'acoustic' | 'clean' | 'drive'

// Chain: voices → input → drive (waveshaper) → tone (EQ) → dry + convolver reverb → out → compressor → speakers
let ctx: AudioContext | null = null
let input: GainNode | null = null
let drive: WaveShaperNode
let tone: BiquadFilterNode
let dryGain: GainNode
let wetGain: GainNode
let outGain: GainNode
let recordDest: MediaStreamAudioDestinationNode

// Settings chosen before the first keypress are applied when the context is created.
let desiredVolume = 0.8
let currentPreset: TonePreset = 'acoustic'

function makeDriveCurve(amount: number): Float32Array {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount)
  }
  return curve
}

function makeImpulse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.floor(rate * seconds)
  const impulse = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

function applyPreset(): void {
  if (!ctx) return
  switch (currentPreset) {
    case 'acoustic':
      drive.curve = null
      tone.type = 'lowshelf'
      tone.frequency.value = 220
      tone.gain.value = 2
      dryGain.gain.value = 1
      wetGain.gain.value = 0.12
      break
    case 'clean':
      drive.curve = null
      tone.type = 'peaking'
      tone.frequency.value = 2500
      tone.Q.value = 0.8
      tone.gain.value = 3
      dryGain.gain.value = 1
      wetGain.gain.value = 0.2
      break
    case 'drive':
      drive.curve = makeDriveCurve(8)
      tone.type = 'lowpass'
      tone.frequency.value = 3200
      tone.Q.value = 0.7
      dryGain.gain.value = 0.9
      wetGain.gain.value = 0.1
      break
  }
}

export function getAudio(): { ctx: AudioContext; master: GainNode } {
  if (!ctx || !input) {
    ctx = new AudioContext()
    input = ctx.createGain()
    drive = ctx.createWaveShaper()
    drive.oversample = '2x'
    tone = ctx.createBiquadFilter()
    const convolver = ctx.createConvolver()
    convolver.buffer = makeImpulse(ctx, 1.2, 3)
    dryGain = ctx.createGain()
    wetGain = ctx.createGain()
    outGain = ctx.createGain()
    outGain.gain.value = desiredVolume
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 6

    input.connect(drive)
    drive.connect(tone)
    tone.connect(dryGain)
    tone.connect(convolver)
    convolver.connect(wetGain)
    dryGain.connect(outGain)
    wetGain.connect(outGain)
    outGain.connect(compressor)
    compressor.connect(ctx.destination)

    recordDest = ctx.createMediaStreamDestination()
    compressor.connect(recordDest)

    applyPreset()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return { ctx, master: input }
}

export function setMasterVolume(value: number): void {
  desiredVolume = value
  if (ctx && outGain) {
    outGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02)
  }
}

export function setTonePreset(preset: TonePreset): void {
  currentPreset = preset
  applyPreset()
}

export function getRecordingStream(): MediaStream {
  getAudio()
  return recordDest.stream
}
