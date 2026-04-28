import { BollingerBand, BBStatus, SMASlope, EntrySignal, Kline } from '../types/market'

// ─── SMA ─────────────────────────────────────────────────────────────────────

export function calculateSMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  const result: number[] = []
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / period)
  }
  return result
}

// ─── EMA (信号処理: 指数平滑フィルタ) ────────────────────────────────────────

export function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return []
  const k = 2 / (period + 1)
  const result: number[] = []
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(ema)
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

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

// ─── RSI (統計学: 相対力指数, Wilder平滑化) ──────────────────────────────────

export function calculateRSI(values: number[], period = 14): number[] {
  if (values.length < period + 1) return []
  const changes = values.slice(1).map((v, i) => v - values[i])
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period
  const toRSI = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l))
  const result = [toRSI(avgGain, avgLoss)]
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-changes[i], 0)) / period
    result.push(toRSI(avgGain, avgLoss))
  }
  return result
}

// ─── ATR (物理学的計測: 真のレンジ平均) ──────────────────────────────────────

export function calculateATR(klines: Kline[], period = 14): number[] {
  if (klines.length < 2) return []
  const trs = klines.slice(1).map((k, i) =>
    Math.max(
      k.high - k.low,
      Math.abs(k.high - klines[i].close),
      Math.abs(k.low - klines[i].close),
    ),
  )
  if (trs.length < period) return []
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [atr]
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
    result.push(atr)
  }
  return result
}

// ─── MACD (信号処理: 移動平均収束発散) ───────────────────────────────────────

export function calculateMACD(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: number; signal: number; histogram: number }[] {
  const emaFast = calculateEMA(values, fastPeriod)
  const emaSlow = calculateEMA(values, slowPeriod)
  if (emaSlow.length === 0) return []
  const offset = slowPeriod - fastPeriod
  const macdLine = emaSlow.map((slow, i) => emaFast[i + offset] - slow)
  const signalLine = calculateEMA(macdLine, signalPeriod)
  if (signalLine.length === 0) return []
  const sigOffset = signalPeriod - 1
  return signalLine.map((sig, i) => {
    const m = macdLine[i + sigOffset]
    return { macd: m, signal: sig, histogram: m - sig }
  })
}

// ─── Z-Score (統計学: 標準化スコア) ──────────────────────────────────────────

export function calculateZScore(values: number[], period = 20): number[] {
  if (values.length < period) return []
  const result: number[] = []
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period)
    result.push(std === 0 ? 0 : (values[i] - mean) / std)
  }
  return result
}

// ─── Hurst指数 (フラクタル幾何学: R/S解析) ───────────────────────────────────
// H > 0.55 → トレンド持続, H < 0.45 → 平均回帰, 0.45–0.55 → ランダムウォーク

export function estimateHurst(closes: number[]): number {
  if (closes.length < 20) return 0.5
  const returns = closes.slice(1).map((v, i) => Math.log(v / closes[i]))
  const lags = [4, 8, 16].filter((l) => l < returns.length / 2)
  if (lags.length < 2) return 0.5

  const logRS: number[] = []
  const logLag: number[] = []
  for (const lag of lags) {
    const n = Math.floor(returns.length / lag)
    let totalRS = 0
    let valid = 0
    for (let seg = 0; seg < n; seg++) {
      const slice = returns.slice(seg * lag, (seg + 1) * lag)
      const mean = slice.reduce((a, b) => a + b, 0) / lag
      let cum = 0
      const cumDev = slice.map((v) => { cum += v - mean; return cum })
      const range = Math.max(...cumDev) - Math.min(...cumDev)
      const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / lag)
      if (std > 0) { totalRS += range / std; valid++ }
    }
    if (valid > 0) { logRS.push(Math.log(totalRS / valid)); logLag.push(Math.log(lag)) }
  }
  if (logLag.length < 2) return 0.5
  const n = logLag.length
  const sx = logLag.reduce((a, b) => a + b, 0)
  const sy = logRS.reduce((a, b) => a + b, 0)
  const sxy = logLag.reduce((s, x, i) => s + x * logRS[i], 0)
  const sx2 = logLag.reduce((s, x) => s + x * x, 0)
  const denom = n * sx2 - sx * sx
  return denom === 0 ? 0.5 : Math.max(0.1, Math.min(0.9, (n * sxy - sx * sy) / denom))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  if (allUp && hasSqueeze) return { signal: 'long',  label: 'LONG候補 ★★',  reason: '全時間足上昇 + BBスクイーズ — ブレイクアウト警戒' }
  if (allDown && hasSqueeze) return { signal: 'short', label: 'SHORT候補 ★★', reason: '全時間足下落 + BBスクイーズ — ブレイクダウン警戒' }
  if (allUp)  return { signal: 'long',  label: 'LONG傾向',  reason: '全時間足でSMAが上昇中' }
  if (allDown) return { signal: 'short', label: 'SHORT傾向', reason: '全時間足でSMAが下落中' }
  return { signal: 'wait', label: '待機', reason: '時間足のトレンドが不一致 — エントリー非推奨' }
}
