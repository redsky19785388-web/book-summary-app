import { BollingerBand, BBStatus, SMASlope, EntrySignal } from '../types/market'

export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  const result: number[] = []
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  multiplier = 2,
): BollingerBand[] {
  if (values.length < period) return []
  const result: BollingerBand[] = []
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period
    const stdDev = Math.sqrt(variance)
    const upper = mean + multiplier * stdDev
    const lower = mean - multiplier * stdDev
    result.push({ upper, middle: mean, lower, width: ((upper - lower) / mean) * 100 })
  }
  return result
}

export function getSMASlope(smaValues: number[]): { direction: SMASlope; rate: number } {
  if (smaValues.length < 5) return { direction: 'flat', rate: 0 }
  const recent = smaValues[smaValues.length - 1]
  const base = smaValues[smaValues.length - 5]
  const rate = ((recent - base) / base) * 100
  if (rate > 0.05) return { direction: 'up', rate }
  if (rate < -0.05) return { direction: 'down', rate }
  return { direction: 'flat', rate }
}

export function getBBStatus(bbValues: BollingerBand[]): BBStatus {
  if (bbValues.length < 20) return 'normal'
  const recent = bbValues.slice(-20)
  const current = recent[recent.length - 1].width
  const avg = recent.slice(0, -1).reduce((sum, b) => sum + b.width, 0) / (recent.length - 1)
  if (current < avg * 0.75) return 'squeeze'
  if (current > avg * 1.30) return 'expanding'
  return 'normal'
}

export function getEntrySignal(
  slopes: SMASlope[],
  statuses: BBStatus[],
): { signal: EntrySignal; label: string; reason: string } {
  const allUp = slopes.every((s) => s === 'up')
  const allDown = slopes.every((s) => s === 'down')
  const hasSqueeze = statuses.includes('squeeze')

  if (allUp && hasSqueeze) return { signal: 'long', label: 'LONG候補 ★★', reason: '全時間足上昇 + BBスクイーズ — ブレイクアウト警戒' }
  if (allDown && hasSqueeze) return { signal: 'short', label: 'SHORT候補 ★★', reason: '全時間足下落 + BBスクイーズ — ブレイクダウン警戒' }
  if (allUp) return { signal: 'long', label: 'LONG傾向', reason: '全時間足でSMAが上昇中' }
  if (allDown) return { signal: 'short', label: 'SHORT傾向', reason: '全時間足でSMAが下落中' }
  return { signal: 'wait', label: '待機', reason: '時間足でトレンドが不一致 — エントリー非推奨' }
}
