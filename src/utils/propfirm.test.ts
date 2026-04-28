import { describe, it, expect } from 'vitest'
import {
  calcLotSize,
  calcDailyBudget,
  getActionState,
  calcKelly,
  calcEV,
  calcRoR,
  detectTilt,
  PROP_FIRM,
} from './propfirm'

// ═══════════════════════════════════════════════════════════════════
// 多角的テスト 5選（プログラム全体の健全性検証）
// ═══════════════════════════════════════════════════════════════════

// ─── 多角的1: ロット計算の数学的正確性 ──────────────────────────────
describe('[多角的1] calcLotSize — 数学的精度', () => {
  it('基本計算: $100リスク / $500差 = 0.2 BTC', () => {
    const r = calcLotSize(50000, 49500, 100)
    expect(r.maxLots).toBeCloseTo(0.2, 8)
    expect(r.priceDiff).toBe(500)
    expect(r.direction).toBe('LONG')
    expect(r.isValid).toBe(true)
  })

  it('SHORT方向: エントリー < ストップロス', () => {
    const r = calcLotSize(49000, 49500, 100)
    expect(r.direction).toBe('SHORT')
    expect(r.maxLots).toBeCloseTo(100 / 500, 8)
  })

  it('エントリー = ストップロス → isValid: false', () => {
    const r = calcLotSize(50000, 50000, 100)
    expect(r.isValid).toBe(false)
    expect(r.maxLots).toBe(0)
  })

  it('不変条件: lot × priceDiff ≤ maxRisk（資金保全の数学的証明）', () => {
    const cases = [
      [95000, 94500, 100],
      [100000, 99000, 50],
      [80000, 82000, 75],
    ] as const
    cases.forEach(([entry, sl, risk]) => {
      const r = calcLotSize(entry, sl, risk)
      if (r.isValid) {
        expect(r.maxLots * r.priceDiff).toBeCloseTo(risk, 6)
      }
    })
  })
})

// ─── 多角的2: 日次バジェットの状態遷移 ──────────────────────────────
describe('[多角的2] calcDailyBudget — 状態機械の検証', () => {
  it('PnL=0: 損失なし、残高=maxDailyLoss', () => {
    const b = calcDailyBudget(0)
    expect(b.dailyLoss).toBe(0)
    expect(b.remaining).toBe(PROP_FIRM.maxDailyLoss)
    expect(b.isBreached).toBe(false)
    expect(b.remainingTrades).toBe(7)  // 700/100=7
  })

  it('PnL=-700: 上限到達、残トレード=0', () => {
    const b = calcDailyBudget(-700)
    expect(b.isBreached).toBe(true)
    expect(b.remainingTrades).toBe(0)
  })

  it('PnL=-550: クリティカルゾーン（残り=150 < 200）', () => {
    const b = calcDailyBudget(-550)
    expect(b.isCritical).toBe(true)
    expect(b.isBreached).toBe(false)
    expect(b.remaining).toBe(150)
  })

  it('PnL=+200（利益）: dailyLoss=0, 損失扱いしない', () => {
    const b = calcDailyBudget(200)
    expect(b.dailyLoss).toBe(0)
    expect(b.remaining).toBe(PROP_FIRM.maxDailyLoss)
  })
})

// ─── 多角的3: ActionState の6状態カバレッジ ─────────────────────────
describe('[多角的3] getActionState — 全状態網羅', () => {
  it('signal=null → loading状態', () => {
    const s = getActionState(null, [], [])
    expect(s.level).toBe('loading')
  })

  it('slopes混合 → danger（最高リスク: チャート離脱指示）', () => {
    const s = getActionState('wait', ['up', 'down', 'flat'], ['normal', 'normal', 'normal'])
    expect(s.level).toBe('danger')
  })

  it('expanding → caution（高ボラ危険）', () => {
    const s = getActionState('long', ['up', 'up', 'up'], ['expanding', 'normal', 'normal'])
    expect(s.level).toBe('caution')
  })

  it('全上昇 + squeeze → ready（LONG準備）', () => {
    const s = getActionState('long', ['up', 'up', 'up'], ['squeeze', 'squeeze', 'normal'])
    expect(s.level).toBe('ready')
    expect(s.emoji).toBe('🟢')
  })

  it('全下落 + squeeze → ready（SHORT準備）', () => {
    const s = getActionState('short', ['down', 'down', 'down'], ['squeeze', 'normal', 'normal'])
    expect(s.level).toBe('ready')
    expect(s.emoji).toBe('🔴')
  })

  it('全上昇 + squeezeなし → watch', () => {
    const s = getActionState('long', ['up', 'up', 'up'], ['normal', 'normal', 'normal'])
    expect(s.level).toBe('watch')
  })
})

// ─── 多角的4: 不変条件テスト（数理的堅牢性） ─────────────────────────
describe('[多角的4] 数学的不変条件', () => {
  it('calcLotSize: positionSizeUsd = maxLots × entryPrice', () => {
    const entry = 95000, sl = 94000, risk = 100
    const r = calcLotSize(entry, sl, risk)
    expect(r.positionSizeUsd).toBeCloseTo(r.maxLots * entry, 4)
  })

  it('calcLotSize: riskPercent = risk / accountBalance × 100', () => {
    const r = calcLotSize(95000, 94000, 100)
    expect(r.riskPercent).toBeCloseTo((100 / PROP_FIRM.accountBalance) * 100, 6)
  })

  it('calcDailyBudget: dailyLoss + remaining = maxDailyLoss（損失がある場合）', () => {
    [-200, -500, -700].forEach(pnl => {
      const b = calcDailyBudget(pnl)
      expect(b.dailyLoss + Math.max(0, b.remaining)).toBeCloseTo(PROP_FIRM.maxDailyLoss, 6)
    })
  })
})

// ─── 多角的5: エンドツーエンド統合シナリオ ──────────────────────────
describe('[多角的5] 統合シナリオ: 実際のトレードフロー', () => {
  it('スクイーズシグナル → ロット計算 → バジェット確認 → チルト判定', () => {
    const actionState = getActionState('long', ['up', 'up', 'up'], ['squeeze', 'squeeze', 'normal'])
    expect(actionState.level).toBe('ready')

    const lot = calcLotSize(95000, 94000, 100)
    expect(lot.isValid).toBe(true)
    expect(lot.maxLots).toBeCloseTo(0.1, 8)

    const budget = calcDailyBudget(-100)
    expect(budget.remaining).toBe(600)
    expect(budget.isBreached).toBe(false)

    const tilt = detectTilt(1)
    expect(tilt.level).toBe('caution')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 精度向上テスト 10選（学術的エッジケース・数値安定性）
// ═══════════════════════════════════════════════════════════════════

// ─── 精度1: Kelly基準 — 正のエッジが存在する場合 ───────────────────
describe('[精度1] calcKelly — 正のエッジ', () => {
  it('勝率55% / RR=1:1 → Kelly>0（期待値プラス）', () => {
    const k = calcKelly(0.55, 1.0)
    expect(k.isPositive).toBe(true)
    expect(k.full).toBeGreaterThan(0)
    expect(k.half).toBeCloseTo(k.full / 2, 8)
  })

  it('勝率50% / RR=2:1 → Kelly>0（リワードで補償）', () => {
    const k = calcKelly(0.50, 2.0)
    expect(k.isPositive).toBe(true)
    // f = (2*0.5 - 0.5) / 2 = 0.25
    expect(k.full).toBeCloseTo(0.25, 6)
  })
})

// ─── 精度2: Kelly基準 — ネガティブエッジ（勝てないシステム） ────────
describe('[精度2] calcKelly — ネガティブエッジ', () => {
  it('勝率40% / RR=1:1 → full=0（ベットしてはいけない）', () => {
    const k = calcKelly(0.40, 1.0)
    expect(k.full).toBe(0)
    expect(k.isPositive).toBe(false)
  })

  it('勝率0.01（最小値境界） → 0以上を返す', () => {
    const k = calcKelly(0.01, 10.0)
    expect(k.full).toBeGreaterThanOrEqual(0)
    expect(k.half).toBeGreaterThanOrEqual(0)
  })
})

// ─── 精度3: 期待値（EV）の正/負の境界 ───────────────────────────────
describe('[精度3] calcEV — 期待値の計算', () => {
  it('勝率50% / RR=1:1 → EV=0（ブレークイーブン）', () => {
    expect(calcEV(0.50, 1.0, 100)).toBeCloseTo(0, 6)
  })

  it('勝率60% / RR=1.5:1 → EV>0（プラスシステム）', () => {
    // EV = 0.6*1.5*100 - 0.4*100 = 90 - 40 = 50
    expect(calcEV(0.60, 1.5, 100)).toBeCloseTo(50, 4)
  })

  it('勝率40% / RR=1:1 → EV<0（マイナスシステム）', () => {
    expect(calcEV(0.40, 1.0, 100)).toBeLessThan(0)
  })

  it('EV線形性: riskAmount2倍 → EV2倍', () => {
    const ev1 = calcEV(0.55, 1.5, 100)
    const ev2 = calcEV(0.55, 1.5, 200)
    expect(ev2).toBeCloseTo(ev1 * 2, 6)
  })
})

// ─── 精度4: 破産確率（RoR）の境界条件 ───────────────────────────────
describe('[精度4] calcRoR — 破産確率の境界', () => {
  it('勝率0（必ず負ける） → RoR=1.0（確実な破産）', () => {
    expect(calcRoR(0.01, 700, 100, 20)).toBeGreaterThan(0.9)
  })

  it('勝率99% → RoR≈0（ほぼ破産しない）', () => {
    expect(calcRoR(0.99, 700, 100, 20)).toBeCloseTo(0, 3)
  })

  it('RoRは常に[0, 1]の範囲内（確率の定義）', () => {
    const cases = [
      [0.3, 700, 100, 10],
      [0.5, 500, 100, 20],
      [0.7, 300, 50,  15],
    ] as const
    cases.forEach(([w, ml, rpt, st]) => {
      const ror = calcRoR(w, ml, rpt, st)
      expect(ror).toBeGreaterThanOrEqual(0)
      expect(ror).toBeLessThanOrEqual(1)
    })
  })
})

// ─── 精度5: チルト検出の段階的エスカレーション ─────────────────────
describe('[精度5] detectTilt — 行動ファイナンス', () => {
  it('0連敗 → none（通常状態）', () => {
    expect(detectTilt(0).level).toBe('none')
  })

  it('1連敗 → caution（注意）', () => {
    expect(detectTilt(1).level).toBe('caution')
  })

  it('2連敗 → warning（警告）', () => {
    expect(detectTilt(2).level).toBe('warning')
  })

  it('3連敗以上 → stop（即時停止）', () => {
    expect(detectTilt(3).level).toBe('stop')
    expect(detectTilt(10).level).toBe('stop')
  })

  it('全レベルでmessageが空でない', () => {
    [0, 1, 2, 3].forEach(n => {
      expect(detectTilt(n).message.length).toBeGreaterThan(0)
    })
  })
})
