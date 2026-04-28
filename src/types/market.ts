export type Interval = '15m' | '1h' | '4h'

export interface Kline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

export interface BollingerBand {
  upper: number
  middle: number
  lower: number
  width: number
}

export type SMASlope  = 'up' | 'down' | 'flat'
export type BBStatus  = 'squeeze' | 'expanding' | 'normal'
export type EntrySignal = 'long' | 'short' | 'wait'
export type RSIStatus = 'overbought' | 'oversold' | 'neutral'
export type MACDCross = 'bullish' | 'bearish' | 'none'
export type HurstLabel = 'トレンド持続' | '平均回帰' | 'ランダム'

export interface IndicatorResult {
  // Core
  currentPrice: number
  sma: number
  smaSlope: SMASlope
  smaSlopeRate: number
  priceDeviation: number
  bb: BollingerBand
  bbStatus: BBStatus
  // 統計学: RSI(14)
  rsi: number
  rsiStatus: RSIStatus
  // 物理学的計測: ATR(14)
  atr: number
  atrPercent: number
  // 信号処理: MACD(12/26/9)
  macdHistogram: number
  macdCross: MACDCross
  // 統計学: Z-Score(20)
  zScore: number
  // フラクタル幾何学: Hurst指数
  hurst: number
  hurstLabel: HurstLabel
}

export interface IntervalState {
  indicators: IndicatorResult | null
  loading: boolean
  error: string | null
}

export type MarketData = Record<Interval, IntervalState>
