import { useState, useEffect, useCallback } from 'react'
import { Interval, Kline, IndicatorResult, MarketData, HurstLabel } from '../types/market'
import {
  calculateSMA,
  calculateBollingerBands,
  calculateRSI,
  calculateATR,
  calculateMACD,
  calculateZScore,
  estimateHurst,
  getSMASlope,
  getBBStatus,
} from '../utils/indicators'

// dev: Viteプロキシ経由でCORSを回避、prod: Binance直接アクセス（CORSサポート済み）
const API_BASE = import.meta.env.DEV
  ? '/binance/api/v3/klines'
  : 'https://api.binance.com/api/v3/klines'

async function fetchKlines(symbol: string, interval: Interval, limit = 100): Promise<Kline[]> {
  const url = `${API_BASE}?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`APIエラー: ${res.status} ${res.statusText}`)
  const raw: [number, string, string, string, string, string, number, ...unknown[]][] = await res.json()
  return raw.map((k) => ({
    openTime: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }))
}

function computeIndicators(klines: Kline[]): IndicatorResult {
  const closes = klines.map((k) => k.close)

  // Core
  const smaValues = calculateSMA(closes, 20)
  const bbValues  = calculateBollingerBands(closes, 20, 2)
  const { direction: smaSlope, rate: smaSlopeRate } = getSMASlope(smaValues)
  const bbStatus     = getBBStatus(bbValues)
  const currentPrice = closes[closes.length - 1]
  const lastSMA = smaValues[smaValues.length - 1]
  const lastBB  = bbValues[bbValues.length - 1]

  // 統計学: RSI(14)
  const rsiValues = calculateRSI(closes, 14)
  const rsi = rsiValues[rsiValues.length - 1] ?? 50
  const rsiStatus = rsi >= 70 ? 'overbought' : rsi <= 30 ? 'oversold' : 'neutral'

  // 物理学的計測: ATR(14)
  const atrValues = calculateATR(klines, 14)
  const atr = atrValues[atrValues.length - 1] ?? 0
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0

  // 信号処理: MACD(12/26/9)
  const macdValues = calculateMACD(closes)
  const lastM = macdValues[macdValues.length - 1]
  const prevM = macdValues[macdValues.length - 2]
  let macdCross: IndicatorResult['macdCross'] = 'none'
  if (lastM && prevM) {
    if (prevM.histogram <= 0 && lastM.histogram > 0) macdCross = 'bullish'
    else if (prevM.histogram >= 0 && lastM.histogram < 0) macdCross = 'bearish'
  }

  // 統計学: Z-Score(20)
  const zScoreValues = calculateZScore(closes, 20)
  const zScore = zScoreValues[zScoreValues.length - 1] ?? 0

  // フラクタル幾何学: Hurst指数
  const hurst = estimateHurst(closes)
  const hurstLabel: HurstLabel = hurst > 0.55 ? 'トレンド持続' : hurst < 0.45 ? '平均回帰' : 'ランダム'

  return {
    currentPrice,
    sma: lastSMA,
    smaSlope,
    smaSlopeRate,
    priceDeviation: ((currentPrice - lastSMA) / lastSMA) * 100,
    bb: lastBB,
    bbStatus,
    rsi,
    rsiStatus,
    atr,
    atrPercent,
    macdHistogram: lastM?.histogram ?? 0,
    macdCross,
    zScore,
    hurst,
    hurstLabel,
  }
}

const INTERVALS: Interval[] = ['15m', '1h', '4h']

const INITIAL_STATE: MarketData = {
  '15m': { indicators: null, loading: true, error: null },
  '1h':  { indicators: null, loading: true, error: null },
  '4h':  { indicators: null, loading: true, error: null },
}

export function useMarketData(symbol = 'BTCUSDT') {
  const [data, setData] = useState<MarketData>(INITIAL_STATE)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAll = useCallback(async () => {
    setData((prev) => {
      const next = { ...prev }
      INTERVALS.forEach((iv) => { next[iv] = { ...prev[iv], loading: true, error: null } })
      return next
    })
    const results = await Promise.allSettled(INTERVALS.map((iv) => fetchKlines(symbol, iv, 100)))
    const updates: Partial<MarketData> = {}
    results.forEach((result, i) => {
      const iv = INTERVALS[i]
      if (result.status === 'fulfilled') {
        updates[iv] = { indicators: computeIndicators(result.value), loading: false, error: null }
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : '不明なエラー'
        updates[iv] = { indicators: null, loading: false, error: msg }
      }
    })
    setData((prev) => ({ ...prev, ...updates }))
    setLastUpdated(new Date())
  }, [symbol])

  useEffect(() => {
    fetchAll()
    const timer = setInterval(fetchAll, 60_000)
    return () => clearInterval(timer)
  }, [fetchAll])

  return { data, lastUpdated, refresh: fetchAll }
}
