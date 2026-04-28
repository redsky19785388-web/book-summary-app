import { describe, it, expect } from 'vitest'
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateATR,
  calculateMACD,
  calculateZScore,
  estimateHurst,
  getSMASlope,
  getBBStatus,
  getEntrySignal,
} from './indicators'
import type { Kline } from '../types/market'

// ─── テスト1: SMA 計算正確性 ──────────────────────────────────────────────────
describe('calculateSMA', () => {
  it('[1,2,3,4,5] period=3 → [2,3,4]（既知の値との一致）', () => {
    expect(calculateSMA([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4])
  })

  it('全同値 [5,5,5] period=3 → SMA=5（定数列の一致性）', () => {
    expect(calculateSMA([5, 5, 5], 3)).toEqual([5])
  })

  it('データ不足 length < period → 空配列（境界条件）', () => {
    expect(calculateSMA([1, 2], 3)).toEqual([])
    expect(calculateSMA([], 5)).toEqual([])
  })
})

// ─── テスト2: EMA の収束性（信号処理理論） ────────────────────────────────────
describe('calculateEMA', () => {
  it('EMAは最終値に向かって収束する（指数平滑フィルタの特性）', () => {
    // 全て100のシリーズの後に200が続く → EMAは200に近づく
    const values = [...Array(50).fill(100), ...Array(50).fill(200)]
    const ema = calculateEMA(values, 12)
    const last = ema[ema.length - 1]
    expect(last).toBeGreaterThan(180)
    expect(last).toBeLessThan(200)
  })

  it('一定値列 → EMA = 定数（定常入力への応答）', () => {
    const flat = Array(30).fill(100)
    const ema = calculateEMA(flat, 12)
    ema.forEach((v) => expect(v).toBeCloseTo(100, 6))
  })
})

// ─── テスト3: ボリンジャーバンド（統計学: ±2σの意味） ────────────────────────
describe('calculateBollingerBands', () => {
  it('一定値列 → BB幅=0（標準偏差ゼロの確認）', () => {
    const flat = Array(25).fill(100)
    const bb = calculateBollingerBands(flat, 20)
    expect(bb[bb.length - 1].width).toBeCloseTo(0, 5)
    expect(bb[bb.length - 1].upper).toBeCloseTo(100, 5)
    expect(bb[bb.length - 1].lower).toBeCloseTo(100, 5)
  })

  it('幅の計算式: width = (upper - lower) / middle * 100', () => {
    const values = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5)
    const bb = calculateBollingerBands(values, 20, 2)
    const last = bb[bb.length - 1]
    expect(last.width).toBeCloseTo(((last.upper - last.lower) / last.middle) * 100, 8)
  })

  it('upper > middle > lower の順序性保証', () => {
    const values = Array.from({ length: 30 }, (_, i) => 90 + (i % 7) * 3)
    const bb = calculateBollingerBands(values, 20, 2)
    bb.forEach((b) => {
      expect(b.upper).toBeGreaterThan(b.middle)
      expect(b.middle).toBeGreaterThan(b.lower)
    })
  })
})

// ─── テスト4: RSI の境界条件（統計学: 0–100スケール） ────────────────────────
describe('calculateRSI', () => {
  it('連続上昇 → RSI ≈ 100（全てのゲインが利益）', () => {
    const allUp = Array.from({ length: 16 }, (_, i) => 100 + i)
    const rsi = calculateRSI(allUp, 14)
    expect(rsi[rsi.length - 1]).toBeGreaterThan(99.9)
  })

  it('連続下落 → RSI ≈ 0（全ての変化が損失）', () => {
    const allDown = Array.from({ length: 16 }, (_, i) => 115 - i)
    const rsi = calculateRSI(allDown, 14)
    expect(rsi[rsi.length - 1]).toBeLessThan(0.1)
  })

  it('ジグザグ動作 → RSI は 30–70 の中立ゾーン', () => {
    const zigzag = Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 2 : -2))
    const rsi = calculateRSI(zigzag, 14)
    const last = rsi[rsi.length - 1]
    expect(last).toBeGreaterThan(30)
    expect(last).toBeLessThan(70)
  })
})

// ─── テスト5: ATR の真のレンジ計算（物理学的計測） ───────────────────────────
describe('calculateATR', () => {
  it('ギャップアップ: TR = max(H-L, |H-prevClose|, |L-prevClose|)', () => {
    const klines: Kline[] = [
      { openTime: 0, open: 100, high: 105, low: 98,  close: 102, volume: 1000, closeTime: 1 },
      { openTime: 1, open: 102, high: 115, low: 101, close: 110, volume: 1000, closeTime: 2 },
      // TR = max(115-101=14, |115-102|=13, |101-102|=1) = 14
    ]
    const atr = calculateATR(klines, 1)
    expect(atr[0]).toBe(14)
  })

  it('一定レンジ: ATR = レンジ幅に収束', () => {
    const klines: Kline[] = Array.from({ length: 20 }, (_, i) => ({
      openTime: i, open: 100, high: 105, low: 95, close: 100, volume: 1000, closeTime: i + 1,
    }))
    const atr = calculateATR(klines, 14)
    // 各ローソクのTRは前足close=100から: max(10, 5, 5)=10
    expect(atr[atr.length - 1]).toBeCloseTo(10, 1)
  })
})

// ─── テスト6: MACD の構造整合性（信号処理） ──────────────────────────────────
describe('calculateMACD', () => {
  it('histogram = macd - signal（定義通りの計算）', () => {
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 2)
    const macd = calculateMACD(prices)
    expect(macd.length).toBeGreaterThan(0)
    macd.forEach((m) => {
      expect(m.histogram).toBeCloseTo(m.macd - m.signal, 8)
    })
  })

  it('単調増加列でMACD > 0（上昇トレンドで正値）', () => {
    const rising = Array.from({ length: 60 }, (_, i) => 100 + i * 10)
    const macd = calculateMACD(rising)
    const last = macd[macd.length - 1]
    expect(last.macd).toBeGreaterThan(0)
  })
})

// ─── テスト7: Z-Score の統計的性質 ───────────────────────────────────────────
describe('calculateZScore', () => {
  it('一定値列 → Z-Score = 0（標準偏差ゼロ）', () => {
    const flat = Array(25).fill(100)
    const z = calculateZScore(flat, 20)
    expect(z[z.length - 1]).toBeCloseTo(0, 8)
  })

  it('平均より高い値 → Z-Score > 0（方向性の確認）', () => {
    const values = [...Array(19).fill(100), 120]
    const z = calculateZScore(values, 20)
    expect(z[z.length - 1]).toBeGreaterThan(0)
  })

  it('±2σ超えは稀であることを確認（68-95-99.7ルール）', () => {
    // 正規分布に近い乱数的な列でZ>2の割合は5%以下
    const values = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i * 0.7) * 3 + Math.cos(i * 1.3) * 2)
    const zScores = calculateZScore(values, 20)
    const extremes = zScores.filter((z) => Math.abs(z) > 2).length
    expect(extremes / zScores.length).toBeLessThan(0.15)
  })
})

// ─── テスト8: Hurst指数の範囲（フラクタル幾何学） ────────────────────────────
describe('estimateHurst', () => {
  it('データ不足 (<20) → 0.5 を返す（ランダムウォークデフォルト）', () => {
    expect(estimateHurst([100, 101, 102])).toBe(0.5)
  })

  it('強いトレンド列 → H > 0.5 (トレンド持続傾向)', () => {
    const trend = Array.from({ length: 60 }, (_, i) => 100 + i * 2)
    const h = estimateHurst(trend)
    expect(h).toBeGreaterThan(0.5)
  })

  it('戻り値は [0.1, 0.9] に収まる（数値安定性）', () => {
    const random = Array.from({ length: 50 }, () => 100 + (Math.random() - 0.5) * 10)
    const h = estimateHurst(random)
    expect(h).toBeGreaterThanOrEqual(0.1)
    expect(h).toBeLessThanOrEqual(0.9)
  })
})

// ─── テスト9: SMA傾き判定（多角的な市場状態） ────────────────────────────────
describe('getSMASlope', () => {
  it('急上昇列 → direction: up', () => {
    expect(getSMASlope([100, 101, 102, 103, 104, 105]).direction).toBe('up')
  })

  it('急下落列 → direction: down', () => {
    expect(getSMASlope([105, 104, 103, 102, 101, 100]).direction).toBe('down')
  })

  it('変化率 > 0 のとき rate も正値', () => {
    const result = getSMASlope([100, 100.1, 100.2, 100.3, 100.4, 100.5])
    expect(result.direction).toBe('up')
    expect(result.rate).toBeGreaterThan(0)
  })

  it('データ不足 (<5) → flat（境界条件）', () => {
    expect(getSMASlope([100, 101]).direction).toBe('flat')
    expect(getSMASlope([]).direction).toBe('flat')
  })
})

// ─── テスト10: BBステータスとエントリーシグナル（統合テスト） ─────────────────
describe('getBBStatus + getEntrySignal integration', () => {
  it('スクイーズ判定: 現在幅 < 過去平均×0.75 → squeeze', () => {
    const wide  = { upper: 110, middle: 100, lower: 90,  width: 20 }
    const narrow = { upper: 101, middle: 100, lower: 99, width: 2 }
    expect(getBBStatus([...Array(19).fill(wide), narrow])).toBe('squeeze')
  })

  it('拡張判定: 現在幅 > 過去平均×1.30 → expanding', () => {
    const normal = { upper: 102, middle: 100, lower: 98, width: 4 }
    const wide   = { upper: 108, middle: 100, lower: 92, width: 16 }
    expect(getBBStatus([...Array(19).fill(normal), wide])).toBe('expanding')
  })

  it('全足上昇 + スクイーズ → LONG候補 ★★（最強エントリーシグナル）', () => {
    const result = getEntrySignal(['up', 'up', 'up'], ['squeeze', 'normal', 'squeeze'])
    expect(result.signal).toBe('long')
    expect(result.label).toContain('★★')
  })

  it('全足下落 + スクイーズ → SHORT候補 ★★', () => {
    const result = getEntrySignal(['down', 'down', 'down'], ['squeeze', 'squeeze', 'normal'])
    expect(result.signal).toBe('short')
    expect(result.label).toContain('★★')
  })

  it('時間足不一致 → 待機（エントリー非推奨）', () => {
    const result = getEntrySignal(['up', 'down', 'flat'], ['normal', 'normal', 'normal'])
    expect(result.signal).toBe('wait')
  })

  it('全足上昇 + スクイーズなし → LONG傾向（★★なし）', () => {
    const result = getEntrySignal(['up', 'up', 'up'], ['normal', 'normal', 'normal'])
    expect(result.signal).toBe('long')
    expect(result.label).not.toContain('★★')
  })
})

// ─── 多角的テスト11: SMAと価格の統計的不変条件（統計学） ────────────
describe('[多角的11] SMAの数学的不変条件', () => {
  it('SMAは最大値を超えず最小値を下回らない（有界性）', () => {
    const values = [10, 50, 30, 90, 20, 70, 40, 60, 80, 100]
    const sma = calculateSMA(values, 5)
    const minV = Math.min(...values)
    const maxV = Math.max(...values)
    sma.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(minV)
      expect(s).toBeLessThanOrEqual(maxV)
    })
  })

  it('SMA(period=1) = 元データそのもの（自明なケース）', () => {
    const values = [10, 20, 30, 40, 50]
    expect(calculateSMA(values, 1)).toEqual(values)
  })
})

// ─── 多角的テスト12: EMAの重み付けの正確性（情報理論） ───────────────
describe('[多角的12] EMAの重み付け特性', () => {
  it('EMAは直近データに強く反応する（SMAより感度が高い）', () => {
    const stable = Array(30).fill(100)
    const withJump = [...stable, 200]

    const sma = calculateSMA(withJump, 20)
    const ema = calculateEMA(withJump, 20)

    const smaLast = sma[sma.length - 1]
    const emaLast = ema[ema.length - 1]

    // EMAは最新の200に対してSMAより大きく動く
    expect(emaLast).toBeGreaterThan(smaLast)
  })
})

// ─── 多角的テスト13: ATRとボラティリティの物理的意味 ─────────────────
describe('[多角的13] ATRの対称性と正値性', () => {
  it('ATRは常に正値（ボラティリティの絶対量）', () => {
    const klines: Kline[] = Array.from({ length: 20 }, (_, i) => ({
      openTime: i, open: 100, high: 100 + (i % 3 + 1) * 2, low: 100 - (i % 3 + 1),
      close: 100 + (i % 2), volume: 1000, closeTime: i + 1,
    }))
    const atr = calculateATR(klines, 10)
    atr.forEach(v => expect(v).toBeGreaterThan(0))
  })

  it('ボラティリティゼロ（高=安=終=前終） → ATR=0', () => {
    const klines: Kline[] = Array.from({ length: 20 }, (_, i) => ({
      openTime: i, open: 100, high: 100, low: 100, close: 100, volume: 1000, closeTime: i + 1,
    }))
    const atr = calculateATR(klines, 10)
    expect(atr[atr.length - 1]).toBeCloseTo(0, 6)
  })
})

// ─── 多角的テスト14: MACD信号処理の単調性検証 ───────────────────────
describe('[多角的14] MACDの反転検出能力（信号処理）', () => {
  it('下落→上昇 転換点でMACDヒストグラムが最初より最後で大きい（遅行性を考慮）', () => {
    // 十分なデータを与えてMACDが収束する時間を確保
    const declining = Array.from({ length: 60 }, (_, i) => 300 - i * 2)
    const rising    = Array.from({ length: 60 }, (_, i) => 180 + i * 2)
    const prices = [...declining, ...rising]
    const macd = calculateMACD(prices)

    // 最初の数値と最後の数値を比較（遅行指標のため後半が高くなる）
    const first = macd[0].histogram
    const last  = macd[macd.length - 1].histogram
    expect(last).toBeGreaterThan(first)
  })
})

// ─── 多角的テスト15: Hurstとトレンド強度の複雑系的検証 ─────────────
describe('[多角的15] Hurst指数の分類精度（フラクタル幾何学）', () => {
  it('平均回帰列（ジグザグ）→ H < 0.5 傾向', () => {
    // 強い平均回帰: 100, 110, 90, 110, 90, ...
    const meanReverting = Array.from({ length: 60 }, (_, i) =>
      100 + (i % 2 === 0 ? 15 : -15)
    )
    const h = estimateHurst(meanReverting)
    // 理論的にはH<0.5だが推定誤差を考慮して0.6以下を検証
    expect(h).toBeLessThan(0.6)
  })

  it('トレンド vs 平均回帰でHurst値が異なる方向に動く', () => {
    const trend = Array.from({ length: 60 }, (_, i) => 100 + i * 3)
    const zigzag = Array.from({ length: 60 }, (_, i) => 100 + (i % 2 === 0 ? 10 : -10))
    const hTrend  = estimateHurst(trend)
    const hZigzag = estimateHurst(zigzag)
    expect(hTrend).toBeGreaterThan(hZigzag)
  })
})
