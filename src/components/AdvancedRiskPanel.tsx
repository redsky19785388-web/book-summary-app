import { useState } from 'react'
import { calcKelly, calcEV, calcRoR, detectTilt, PROP_FIRM } from '../utils/propfirm'

const TILT_COLOR: Record<string, string> = {
  none:    'text-green-400',
  caution: 'text-yellow-400',
  warning: 'text-orange-400',
  stop:    'text-red-400',
}

const TILT_BG: Record<string, string> = {
  none:    'bg-green-500/10 border-green-500/30',
  caution: 'bg-yellow-500/10 border-yellow-500/30',
  warning: 'bg-orange-500/10 border-orange-500/30',
  stop:    'bg-red-500/10 border-red-500/30',
}

function Metric({ label, value, sub, valueClass = 'text-slate-200' }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div className="text-center px-3 py-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function SliderRow({ label, value, onChange, min, max, step, display }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; display: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-32 flex-shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-blue-500"
      />
      <span className="text-xs font-mono text-slate-300 w-12 text-right">{display}</span>
    </div>
  )
}

export default function AdvancedRiskPanel() {
  const [winRate,  setWinRate]  = useState(0.50)
  const [rrRatio,  setRrRatio]  = useState(1.5)
  const [losses,   setLosses]   = useState(0)
  const [expanded, setExpanded] = useState(false)

  const kelly = calcKelly(winRate, rrRatio)
  const ev    = calcEV(winRate, rrRatio, PROP_FIRM.maxRiskPerTrade)
  const ror   = calcRoR(winRate, PROP_FIRM.maxDailyLoss, PROP_FIRM.maxRiskPerTrade, 20)
  const tilt  = detectTilt(losses)

  const kellyDisplay  = kelly.isPositive ? `${(kelly.half * 100).toFixed(1)}%` : '0%'
  const evDisplay     = `${ev >= 0 ? '+' : ''}$${ev.toFixed(1)}`
  const rorDisplay    = `${(ror * 100).toFixed(1)}%`

  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-300">
          🧠 高度リスク分析（多学問アプローチ）
        </span>
        <span className="text-slate-500 text-xs ml-2">{expanded ? '▲ 閉じる' : '▼ 開く'}</span>
      </button>

      {expanded && (
        <div className="bg-slate-900/50 p-4 space-y-4">
          {/* パラメータ入力 */}
          <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 space-y-3">
            <p className="text-xs font-semibold text-slate-400 mb-2">パラメータ設定</p>
            <SliderRow
              label="勝率"
              value={winRate} onChange={setWinRate}
              min={0.1} max={0.9} step={0.01}
              display={`${(winRate * 100).toFixed(0)}%`}
            />
            <SliderRow
              label="リスクリワード比"
              value={rrRatio} onChange={setRrRatio}
              min={0.5} max={5} step={0.1}
              display={`1:${rrRatio.toFixed(1)}`}
            />
            <SliderRow
              label="連続損失回数"
              value={losses} onChange={v => setLosses(Math.round(v))}
              min={0} max={6} step={1}
              display={`${losses}回`}
            />
          </div>

          {/* 指標グリッド */}
          <div className="grid grid-cols-3 divide-x divide-slate-700/50 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <Metric
              label="ハーフKelly"
              value={kellyDisplay}
              sub="数学 / J.L.Kelly 1956"
              valueClass={kelly.isPositive ? 'text-green-400' : 'text-red-400'}
            />
            <Metric
              label="1トレードEV"
              value={evDisplay}
              sub="意思決定理論"
              valueClass={ev >= 0 ? 'text-green-400' : 'text-red-400'}
            />
            <Metric
              label="破産確率(20T)"
              value={rorDisplay}
              sub="保険数理学"
              valueClass={ror < 0.05 ? 'text-green-400' : ror < 0.20 ? 'text-yellow-400' : 'text-red-400'}
            />
          </div>

          {/* チルト警告 */}
          <div className={`rounded-lg border p-3 ${TILT_BG[tilt.level]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-400">メンタル状態（行動ファイナンス）</span>
              <span className={`text-xs font-bold ${TILT_COLOR[tilt.level]}`}>
                {tilt.level === 'none' ? '● 正常' : tilt.level === 'caution' ? '▲ 注意' : tilt.level === 'warning' ? '⚠ 警告' : '🚫 停止'}
              </span>
            </div>
            <p className={`text-xs ${TILT_COLOR[tilt.level]}`}>{tilt.message}</p>
          </div>

          {/* 解説 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-slate-600">
            <p><span className="text-slate-500">Kelly基準</span>: 長期資産成長を最大化する最適ベット分数。ハーフKellyで実用的に運用。</p>
            <p><span className="text-slate-500">期待値(EV)</span>: 1トレードあたりの統計的期待利益。プラスEVシステムのみトレードすること。</p>
            <p><span className="text-slate-500">破産確率</span>: 20トレードセッションで日次上限に到達する確率（上界推定）。</p>
          </div>
        </div>
      )}
    </div>
  )
}
