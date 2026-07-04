import { NOTE_NAMES } from '../music/theory'

/**
 * Compute a chromagram (12-bin pitch class energy vector) from FFT magnitude data.
 * Maps every FFT bin to its nearest pitch class and sums energy across all octaves.
 *
 * When `vocalReduction` is true, the 300–3000 Hz vocal range is heavily
 * de-weighted so that bass/treble instrument harmonics dominate the result.
 */
export function computeChromagram(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  vocalReduction = false,
): Float32Array {
  const chroma = new Float32Array(12)
  const binHz = sampleRate / fftSize

  const minBin = Math.ceil(60 / binHz)
  const maxBin = Math.min(Math.floor(2000 / binHz), magnitudes.length - 1)

  for (let i = minBin; i <= maxBin; i++) {
    const freq = i * binHz
    if (freq <= 0) continue
    const midi = 69 + 12 * Math.log2(freq / 440)
    const pitchClass = ((Math.round(midi) % 12) + 12) % 12

    let weight = 1
    if (vocalReduction) {
      if (freq < 250) {
        // Bass range: boost — bass guitar, kick harmonics carry the key
        weight = 3.0
      } else if (freq >= 300 && freq <= 3000) {
        // Vocal fundamental + formant range: suppress heavily
        weight = 0.1
      } else {
        // Above 3kHz: instrument harmonics, hi-hat, etc.
        weight = 0.6
      }
    }

    chroma[pitchClass] += magnitudes[i] * magnitudes[i] * weight
  }

  let max = 0
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > max) max = chroma[i]
  }
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max
  }

  return chroma
}

// ── Chord templates: binary vectors marking active pitch classes ──

interface ChordTemplate {
  name: string
  suffix: string
  intervals: number[]
}

const CHORD_TEMPLATES: ChordTemplate[] = [
  { name: '', suffix: '', intervals: [0, 4, 7] },               // major
  { name: 'm', suffix: 'm', intervals: [0, 3, 7] },             // minor
  { name: '7', suffix: '7', intervals: [0, 4, 7, 10] },         // dominant 7
  { name: 'maj7', suffix: 'maj7', intervals: [0, 4, 7, 11] },   // major 7
  { name: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10] },       // minor 7
  { name: 'dim', suffix: 'dim', intervals: [0, 3, 6] },         // diminished
  { name: 'aug', suffix: 'aug', intervals: [0, 4, 8] },         // augmented
  { name: 'sus2', suffix: 'sus2', intervals: [0, 2, 7] },       // sus2
  { name: 'sus4', suffix: 'sus4', intervals: [0, 5, 7] },       // sus4
  { name: '5', suffix: '5', intervals: [0, 7] },                // power chord
  { name: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14] },   // add9
  { name: 'm9', suffix: 'm9', intervals: [0, 3, 7, 10, 14] },   // minor 9
  { name: '9', suffix: '9', intervals: [0, 4, 7, 10, 14] },     // dominant 9
]

function makeTemplate(intervals: number[]): Float32Array {
  const t = new Float32Array(12)
  for (const i of intervals) t[i % 12] = 1
  return t
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < 12; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 0 ? dot / denom : 0
}

export interface ChordMatch {
  name: string
  root: number
  quality: string
  confidence: number
}

/**
 * Match a chromagram against all chord templates (all 12 roots x all qualities).
 * Returns the best match and confidence score.
 */
export function matchChord(chroma: Float32Array, minConfidence = 0.6): ChordMatch | null {
  let bestScore = 0
  let bestRoot = 0
  let bestTemplate: ChordTemplate | null = null

  for (const tmpl of CHORD_TEMPLATES) {
    const template = makeTemplate(tmpl.intervals)
    for (let root = 0; root < 12; root++) {
      // Rotate chromagram so root = 0
      const rotated = new Float32Array(12)
      for (let i = 0; i < 12; i++) {
        rotated[i] = chroma[(i + root) % 12]
      }
      const score = cosineSimilarity(rotated, template)
      if (score > bestScore) {
        bestScore = score
        bestRoot = root
        bestTemplate = tmpl
      }
    }
  }

  if (!bestTemplate || bestScore < minConfidence) return null

  return {
    name: NOTE_NAMES[bestRoot] + bestTemplate.suffix,
    root: bestRoot,
    quality: bestTemplate.suffix || 'maj',
    confidence: bestScore,
  }
}

// ── Krumhansl-Schmuckler key detection ──

// Key profiles: correlation weights for major and minor keys
// (Krumhansl & Kessler, 1982)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function correlate(a: number[] | Float32Array, b: number[]): number {
  const n = a.length
  let sumA = 0, sumB = 0
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i] }
  const meanA = sumA / n, meanB = sumB / n
  let num = 0, denA = 0, denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  const denom = Math.sqrt(denA) * Math.sqrt(denB)
  return denom > 0 ? num / denom : 0
}

export interface KeyResult {
  root: number
  name: string
  mode: 'major' | 'minor'
  confidence: number
}

/**
 * Krumhansl-Schmuckler algorithm: correlate the chromagram against
 * all 24 key profiles (12 major + 12 minor) and return the best match.
 */
export function detectKeyKS(chroma: Float32Array): KeyResult {
  let bestScore = -Infinity
  let bestRoot = 0
  let bestMode: 'major' | 'minor' = 'major'

  for (let root = 0; root < 12; root++) {
    const rotated = new Float32Array(12)
    for (let i = 0; i < 12; i++) {
      rotated[i] = chroma[(i + root) % 12]
    }

    const majScore = correlate(rotated, MAJOR_PROFILE)
    const minScore = correlate(rotated, MINOR_PROFILE)

    if (majScore > bestScore) {
      bestScore = majScore
      bestRoot = root
      bestMode = 'major'
    }
    if (minScore > bestScore) {
      bestScore = minScore
      bestRoot = root
      bestMode = 'minor'
    }
  }

  return {
    root: bestRoot,
    name: NOTE_NAMES[bestRoot] + (bestMode === 'minor' ? 'm' : ''),
    mode: bestMode,
    confidence: Math.max(0, bestScore),
  }
}

/**
 * Simple onset detection: compare spectral flux between consecutive frames.
 * Returns true if there's a significant energy increase (new note/chord attack).
 */
export function detectOnset(
  currentMag: Float32Array,
  previousMag: Float32Array,
  threshold = 0.15,
): boolean {
  let flux = 0
  for (let i = 0; i < currentMag.length; i++) {
    const diff = currentMag[i] - previousMag[i]
    if (diff > 0) flux += diff
  }
  return flux > threshold
}
