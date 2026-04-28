import { EntrySignal, BBStatus, SMASlope } from '../types/market'

export const PROP_FIRM = {
  accountBalance:    10_000,
  maxDailyLoss:         700,
  maxRiskPerTrade:      100,
} as const

export type ActionLevel = 'danger' | 'caution' | 'watch' | 'prepare' | 'ready' | 'loading'

export interface ActionState {
  level: ActionLevel
  emoji: string
  title: string
  message: string
  instruction: string
  bg: string
  border: string
  titleColor: string
  instructionBg: string
}

export function getActionState(
  signal: EntrySignal | null,
  slopes: SMASlope[],
  bbStatuses: BBStatus[],
): ActionState {
  // データ未取得
  if (!signal) {
    return {
      level: 'loading',
      emoji: '📡',
      title: 'データ取得中...',
      message: 'Binance APIからリアルタイムデータを取得しています。',
      instruction: 'しばらくお待ちください。',
      bg: 'bg-slate-800/60', border: 'border-slate-700',
      titleColor: 'text-slate-400', instructionBg: 'bg-slate-700/40',
    }
  }

  const hasSqueeze   = bbStatuses.includes('squeeze')
  const hasExpanding = bbStatuses.includes('expanding')
  const allUp   = slopes.every(s => s === 'up')
  const allDown = slopes.every(s => s === 'down')
  const isMixed = !allUp && !allDown

  // ① トレンド不一致 → 最高リスク: 今すぐ離席
  if (isMixed) {
    return {
      level: 'danger',
      emoji: '🚫',
      title: '【警告：休むも相場】トレンド不一致',
      message: '15分・1時間・4時間足のトレンドがバラバラです。この状況でのエントリーは「感情トレード」であり、プロップファームの資金を危険にさらします。',
      instruction: `1日の損失上限（$${PROP_FIRM.maxDailyLoss}）を守るため、今すぐPCを閉じてチャートから離れてください。次のアラートが届くまで絶対にエントリーしないでください。画面を見続けること自体が損失の原因になります。`,
      bg: 'bg-red-950/70', border: 'border-red-500',
      titleColor: 'text-red-400', instructionBg: 'bg-red-900/40',
    }
  }

  // ② BBが急拡大 → エントリー禁止（スリッページ・損切り超過リスク）
  if (hasExpanding) {
    return {
      level: 'caution',
      emoji: '⚡',
      title: '【危険：高ボラティリティ】BBバンド急拡大',
      message: 'ボリンジャーバンドが急拡大しており、相場が荒れています。スプレッド拡大・スリッページにより損切り$100を大幅に超過するリスクがあります。',
      instruction: `この局面でのエントリーは完全禁止です。BBバンドが正常範囲（スクイーズ または 通常状態）に戻るまでチャートを閉じてください。プロップファームでは1回のスリッページで口座を失う可能性があります。`,
      bg: 'bg-orange-950/70', border: 'border-orange-500',
      titleColor: 'text-orange-400', instructionBg: 'bg-orange-900/40',
    }
  }

  // ③ 全足上昇 + スクイーズ → 最高優先: ロット計算してスタンバイ
  if (allUp && hasSqueeze) {
    return {
      level: 'ready',
      emoji: '🟢',
      title: '【準備：LONGチャンス接近中】全足上昇 + BBスクイーズ',
      message: '15分・1時間・4時間足が全てUPトレンドに揃い、ボリンジャーバンドが収縮しています。ブレイクアウト直前の高確率シグナルです。',
      instruction: `今すぐ損切り位置（直近サポートライン下）を決め、下の「ロット計算機」に入力してください。許容損失$${PROP_FIRM.maxRiskPerTrade}以内に収まる最大BTC数量を計算し、ブレイクアウトを「確認してから」エントリーしてください。予測でエントリーしないこと。`,
      bg: 'bg-green-950/70', border: 'border-green-400',
      titleColor: 'text-green-400', instructionBg: 'bg-green-900/40',
    }
  }

  // ④ 全足下落 + スクイーズ → 最高優先: ロット計算してスタンバイ
  if (allDown && hasSqueeze) {
    return {
      level: 'ready',
      emoji: '🔴',
      title: '【準備：SHORTチャンス接近中】全足下落 + BBスクイーズ',
      message: '15分・1時間・4時間足が全てDOWNトレンドに揃い、ボリンジャーバンドが収縮しています。ブレイクダウン直前の高確率シグナルです。',
      instruction: `今すぐ損切り位置（直近レジスタンスライン上）を決め、下の「ロット計算機」に入力してください。許容損失$${PROP_FIRM.maxRiskPerTrade}以内に収まる最大BTC数量を計算し、ブレイクダウンを「確認してから」エントリーしてください。`,
      bg: 'bg-rose-950/70', border: 'border-rose-400',
      titleColor: 'text-rose-400', instructionBg: 'bg-rose-900/40',
    }
  }

  // ⑤ 全足上昇だがスクイーズなし → 待機（スクイーズ待ち）
  if (allUp) {
    return {
      level: 'watch',
      emoji: '📈',
      title: '【監視：LONG方向確認中】BBスクイーズ待ち',
      message: '全時間足のSMAが上昇していますが、ボリンジャーバンドがまだ収縮していません。エントリーするには早すぎます。',
      instruction: 'BBスクイーズ（バンド幅の収縮）が発生するまでエントリーしないでください。アラートをONにしてチャートから離れてください。この段階でエントリーするのは「先走り」であり、プロップファームのルール違反になりやすいです。',
      bg: 'bg-blue-950/70', border: 'border-blue-500/60',
      titleColor: 'text-blue-400', instructionBg: 'bg-blue-900/30',
    }
  }

  // ⑥ 全足下落だがスクイーズなし → 待機
  if (allDown) {
    return {
      level: 'watch',
      emoji: '📉',
      title: '【監視：SHORT方向確認中】BBスクイーズ待ち',
      message: '全時間足のSMAが下落していますが、ボリンジャーバンドがまだ収縮していません。エントリーするには早すぎます。',
      instruction: 'BBスクイーズが発生するまでエントリーしないでください。アラートをONにしてチャートから離れてください。',
      bg: 'bg-blue-950/70', border: 'border-blue-500/60',
      titleColor: 'text-blue-400', instructionBg: 'bg-blue-900/30',
    }
  }

  return {
    level: 'watch',
    emoji: '⏳',
    title: '【待機：明確なシグナルなし】',
    message: '現在、明確なトレードチャンスはありません。',
    instruction: 'アラートをONにしてチャートを閉じてください。次のシグナルが出るまで待機することが、プロップファームで生き残る唯一の方法です。',
    bg: 'bg-slate-800/60', border: 'border-slate-600',
    titleColor: 'text-slate-300', instructionBg: 'bg-slate-700/40',
  }
}

// ─── ロット計算 ───────────────────────────────────────────────────────────────

export interface LotResult {
  maxLots: number
  positionSizeUsd: number
  priceDiff: number
  riskPercent: number
  direction: 'LONG' | 'SHORT' | null
  isValid: boolean
}

export function calcLotSize(
  entryPrice: number,
  stopLossPrice: number,
  maxRisk: number,
): LotResult {
  const priceDiff = Math.abs(entryPrice - stopLossPrice)
  const isValid = priceDiff > 0 && entryPrice > 0 && stopLossPrice > 0
  const maxLots = isValid ? maxRisk / priceDiff : 0
  const positionSizeUsd = maxLots * entryPrice
  const riskPercent = (maxRisk / PROP_FIRM.accountBalance) * 100
  const direction =
    entryPrice > stopLossPrice ? 'LONG' :
    entryPrice < stopLossPrice ? 'SHORT' : null

  return { maxLots, positionSizeUsd, priceDiff, riskPercent, direction, isValid }
}

// ─── 日次リスク管理 ───────────────────────────────────────────────────────────

export function calcDailyBudget(realizedPnl: number) {
  const dailyLoss = Math.max(0, -realizedPnl)
  const remaining = PROP_FIRM.maxDailyLoss - dailyLoss
  const remainingTrades = remaining > 0 ? Math.floor(remaining / PROP_FIRM.maxRiskPerTrade) : 0
  const isBreached = remaining <= 0
  const isCritical = remaining > 0 && remaining < PROP_FIRM.maxRiskPerTrade * 2
  return { dailyLoss, remaining, remainingTrades, isBreached, isCritical }
}
