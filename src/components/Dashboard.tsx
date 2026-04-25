import { useMarketData } from '../hooks/useMarketData'
import TimeframeCard from './TimeframeCard'
import { getEntrySignal } from '../utils/indicators'
import { Interval, EntrySignal } from '../types/market'

const TIMEFRAMES: { interval: Interval; label: string }[] = [
  { interval: '15m', label: '15分足' },
  { interval: '1h',  label: '1時間足' },
  { interval: '4h',  label: '4時間足' },
]

const SIGNAL_STYLE: Record<EntrySignal, { color: string; bg: string; icon: string }> = {
  long:  { color: 'text-green-300', bg: 'bg-green-500/10 border-green-500/30', icon: '🟢' },
  short: { color: 'text-red-300',   bg: 'bg-red-500/10 border-red-500/30',     icon: '🔴' },
  wait:  { color: 'text-yellow-300',bg: 'bg-yellow-500/10 border-yellow-500/30',icon: '🟡' },
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

export default function Dashboard() {
  const { data, lastUpdated, refresh } = useMarketData('BTCUSDT')

  const currentPrice = data['15m'].indicators?.currentPrice
  const allLoaded = TIMEFRAMES.every((tf) => data[tf.interval].indicators !== null)

  const entrySignal = allLoaded
    ? getEntrySignal(
        TIMEFRAMES.map((tf) => data[tf.interval].indicators!.smaSlope),
        TIMEFRAMES.map((tf) => data[tf.interval].indicators!.bbStatus),
      )
    : null

  const sigStyle = entrySignal ? SIGNAL_STYLE[entrySignal.signal] : null

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              <span className="text-yellow-400">BTC/USDT</span> トレード監視
            </h1>
            <p className="text-slate-500 text-sm mt-1">無駄なエントリーを極限まで減らすためのダッシュボード</p>
          </div>
          <div className="flex items-center gap-4">
            {currentPrice != null && (
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wide">現在価格</div>
                <div className="text-2xl font-mono font-bold text-white">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <button
              onClick={refresh}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300 hover:text-white"
              title="手動更新"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {/* ── Entry Signal Banner ── */}
        {entrySignal && sigStyle && (
          <div className={`rounded-xl p-4 border mb-6 ${sigStyle.bg}`}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{sigStyle.icon}</span>
              <div>
                <div className={`text-lg font-bold ${sigStyle.color}`}>{entrySignal.label}</div>
                <div className="text-sm text-slate-400">{entrySignal.reason}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TIMEFRAMES.map(({ interval, label }) => (
            <TimeframeCard key={interval} label={label} state={data[interval]} />
          ))}
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-400 mb-2">凡例</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <span>⚡ スクイーズ — BBが収縮中。ブレイクアウト準備期間</span>
            <span>💥 拡張中 — BBが大きく広がり、高ボラティリティ</span>
            <span>↑ SMA変化率はSMA5本前との比較（5期間変化率）</span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="mt-4 text-center text-xs text-slate-600">
          {lastUpdated
            ? `最終更新: ${lastUpdated.toLocaleTimeString('ja-JP')} ｜ 60秒ごとに自動更新`
            : 'データ取得中...'}
          <span className="ml-2">｜ データソース: Binance Public API</span>
        </div>
      </div>
    </div>
  )
}
