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

export type SMASlope = 'up' | 'down' | 'flat'
export type BBStatus = 'squeeze' | 'expanding' | 'normal'
export type EntrySignal = 'long' | 'short' | 'wait'

export interface IndicatorResult {
  currentPrice: number
  sma: number
  smaSlope: SMASlope
  smaSlopeRate: number
  priceDeviation: number
  bb: BollingerBand
  bbStatus: BBStatus
}

export interface IntervalState {
  indicators: IndicatorResult | null
  loading: boolean
  error: string | null
}

export type MarketData = Record<Interval, IntervalState>
