import { IntervalState, SMASlope, BBStatus, RSIStatus, MACDCross } from '../types/market'

interface Props {
  label: string
  state: IntervalState
}

const SLOPE: Record<SMASlope, { icon: string; color: string; text: string }> = {
  up:   { icon: '↑', color: 'text-green-400', text: '上昇' },
  down: { icon: '↓', color: 'text-red-400',   text: '下落' },
  flat: { icon: '→', color: 'text-yellow-400', text: '横ばい' },
}

const BB_CFG: Record<BBStatus, { color: string; bg: string; badge: string }> = {
  squeeze:   { color: 'text-yellow-300', bg: 'bg-yellow-400/10 border-yellow-400/30', badge: '⚡ スクイーズ' },
  expanding: { color: 'text-blue-300',   bg: 'bg-blue-400/10 border-blue-400/30',     badge: '💥 拡張中' },
  normal:    { color: 'text-slate-400',  bg: 'bg-slate-700/50 border-slate-600',       badge: '○ 通常' },
}

const RSI_CFG: Record<RSIStatus, { color: string; label: string }> = {
  overbought: { color: 'text-red-400',   label: '買われ過ぎ' },
  oversold:   { color: 'text-green-400', label: '売られ過ぎ' },
  neutral:    { color: 'text-slate-300', label: '中立' },
}

const MACD_CROSS_CFG: Record<MACDCross, { color: string; label: string }> = {
  bullish: { color: 'text-green-400', label: '↑ 上抜け' },
  bearish: { color: 'text-red-400',   label: '↓ 下抜け' },
  none:    { color: 'text-slate-500', label: '—' },
}

function fmt(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Row({ label, value, color = 'text-slate-300' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

export default function TimeframeCard({ label, state }: Props) {
  if (state.loading) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 animate-pulse min-h-[320px]">
        <div className="h-4 bg-slate-700 rounded w-20 mb-5" />
        {[100, 75, 50, 100, 65, 80].map((w, i) => (
          <div key={i} className={`h-3 bg-slate-700 rounded mb-3`} style={{ width: `${w}%` }} />
        ))}
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="bg-slate-800 rounded-xl p-4 border border-red-500/30">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</div>
        <p className="text-red-400 text-sm">⚠️ {state.error}</p>
        <p className="text-xs text-slate-500 mt-2">Binance APIへの接続を確認してください</p>
      </div>
    )
  }

  if (!state.indicators) return null

  const {
    sma, smaSlope, smaSlopeRate, priceDeviation,
    bb, bbStatus,
    rsi, rsiStatus,
    atrPercent,
    macdHistogram, macdCross,
    zScore,
    hurst, hurstLabel,
  } = state.indicators

  const slope  = SLOPE[smaSlope]
  const bbs    = BB_CFG[bbStatus]
  const rsiCfg = RSI_CFG[rsiStatus]
  const macdCfg = MACD_CROSS_CFG[macdCross]
  const devColor = priceDeviation > 0.5 ? 'text-green-400' : priceDeviation < -0.5 ? 'text-red-400' : 'text-slate-400'
  const zColor   = zScore > 1.5 ? 'text-red-400' : zScore < -1.5 ? 'text-green-400' : 'text-slate-300'
  const hColor   = hurst > 0.55 ? 'text-green-400' : hurst < 0.45 ? 'text-purple-400' : 'text-slate-400'
  const macdColor = macdHistogram > 0 ? 'text-green-400' : 'text-red-400'

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
        <span className="text-sm font-bold text-slate-200 uppercase tracking-widest">{label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${bbs.bg} ${bbs.color}`}>
          {bbs.badge}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* ── SMA Section ── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">SMA (20)</p>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-lg font-mono font-semibold text-white">${fmt(sma)}</span>
            <span className={`text-sm font-bold ${slope.color}`}>{slope.icon} {slope.text}</span>
          </div>
          <div className="space-y-1 text-xs">
            <Row label="SMA変化率 (5本)" value={`${smaSlopeRate >= 0 ? '+' : ''}${smaSlopeRate.toFixed(3)}%`} color={slope.color} />
            <Row label="価格乖離" value={`${priceDeviation >= 0 ? '+' : ''}${priceDeviation.toFixed(2)}%`} color={devColor} />
          </div>
        </div>

        <div className="border-t border-slate-700/60" />

        {/* ── Bollinger Bands ── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">ボリンジャーバンド (20, ±2σ)</p>
          <div className="flex items-baseline justify-between mb-2">
            <span className={`text-2xl font-mono font-bold ${bbs.color}`}>{bb.width.toFixed(2)}%</span>
            <span className="text-xs text-slate-500">バンド幅</span>
          </div>
          <div className="space-y-1 text-xs">
            <Row label="Upper" value={`$${fmt(bb.upper)}`} color="text-green-400" />
            <Row label="Middle" value={`$${fmt(bb.middle)}`} />
            <Row label="Lower" value={`$${fmt(bb.lower)}`} color="text-red-400" />
          </div>
        </div>

        <div className="border-t border-slate-700/60" />

        {/* ── 追加指標 ── */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">追加指標</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">RSI (14)</span>
              <span className={`font-mono ${rsiCfg.color}`}>
                {rsi.toFixed(1)} <span className="text-[10px]">({rsiCfg.label})</span>
              </span>
            </div>
            <Row label="ATR% (14)" value={`${atrPercent.toFixed(2)}%`} />
            <div className="flex justify-between items-center">
              <span className="text-slate-500">MACD Hist</span>
              <span className={`font-mono ${macdColor}`}>
                {macdHistogram >= 0 ? '+' : ''}{macdHistogram.toFixed(1)}
                {macdCross !== 'none' && (
                  <span className={`ml-1 text-[10px] ${macdCfg.color}`}>{macdCfg.label}</span>
                )}
              </span>
            </div>
            <Row
              label="Z-Score (20)"
              value={`${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}`}
              color={zColor}
            />
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Hurst指数</span>
              <span className={`font-mono ${hColor}`}>
                {hurst.toFixed(2)} <span className="text-[10px]">({hurstLabel})</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
