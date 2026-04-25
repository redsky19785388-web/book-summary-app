import { IntervalState, SMASlope, BBStatus } from '../types/market'

interface Props {
  label: string
  state: IntervalState
}

const SLOPE: Record<SMASlope, { icon: string; color: string; text: string }> = {
  up:   { icon: '↑', color: 'text-green-400', text: '上昇' },
  down: { icon: '↓', color: 'text-red-400',   text: '下落' },
  flat: { icon: '→', color: 'text-yellow-400', text: '横ばい' },
}

const BB_STATUS: Record<BBStatus, { color: string; bg: string; badge: string }> = {
  squeeze:   { color: 'text-yellow-300', bg: 'bg-yellow-400/10 border-yellow-400/30', badge: '⚡ スクイーズ' },
  expanding: { color: 'text-blue-300',   bg: 'bg-blue-400/10 border-blue-400/30',     badge: '💥 拡張中' },
  normal:    { color: 'text-slate-400',  bg: 'bg-slate-700/50 border-slate-600',       badge: '○ 通常' },
}

function fmt(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TimeframeCard({ label, state }: Props) {
  if (state.loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-20 mb-5" />
        <div className="space-y-3">
          <div className="h-3 bg-slate-700 rounded w-full" />
          <div className="h-3 bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-slate-700 rounded w-1/2" />
          <div className="h-3 bg-slate-700 rounded w-full mt-4" />
          <div className="h-3 bg-slate-700 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="bg-slate-800 rounded-xl p-5 border border-red-500/30">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</div>
        <div className="text-red-400 text-sm">⚠️ {state.error}</div>
        <div className="text-xs text-slate-500 mt-2">Binance APIへの接続を確認してください</div>
      </div>
    )
  }

  if (!state.indicators) return null

  const { sma, smaSlope, smaSlopeRate, priceDeviation, bb, bbStatus } = state.indicators
  const slope = SLOPE[smaSlope]
  const bbs = BB_STATUS[bbStatus]
  const devColor = priceDeviation > 0.5 ? 'text-green-400' : priceDeviation < -0.5 ? 'text-red-400' : 'text-slate-400'

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-500 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">{label}</span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${bbs.bg} ${bbs.color}`}>
          {bbs.badge}
        </span>
      </div>

      {/* SMA Section */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">SMA (20)</div>
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-mono font-semibold text-white">${fmt(sma)}</span>
          <span className={`text-sm font-bold ${slope.color}`}>
            {slope.icon}&nbsp;{slope.text}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">SMA変化率</span>
            <span className={`font-mono ${slope.color}`}>
              {smaSlopeRate >= 0 ? '+' : ''}{smaSlopeRate.toFixed(3)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">価格乖離</span>
            <span className={`font-mono ${devColor}`}>
              {priceDeviation >= 0 ? '+' : ''}{priceDeviation.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700 my-3" />

      {/* Bollinger Bands Section */}
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">ボリンジャーバンド (20, ±2σ)</div>
        <div className="flex items-baseline justify-between mb-2">
          <span className={`text-2xl font-mono font-bold ${bbs.color}`}>{bb.width.toFixed(2)}%</span>
          <span className="text-xs text-slate-500">バンド幅</span>
        </div>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Upper</span>
            <span className="text-green-400">${fmt(bb.upper)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Middle</span>
            <span className="text-slate-300">${fmt(bb.middle)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Lower</span>
            <span className="text-red-400">${fmt(bb.lower)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
