import { useState, useEffect, useId } from 'react'
import { PROP_FIRM, calcLotSize, calcDailyBudget } from '../utils/propfirm'

interface Props {
  currentPrice?: number
}

function NumInput({
  id, label, value, onChange, prefix, placeholder, hint, readonly,
}: {
  id: string; label: string; value: string; onChange?: (v: string) => void
  prefix?: string; placeholder?: string; hint?: string; readonly?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-slate-400 mb-1 font-medium">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-mono select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          value={value}
          readOnly={readonly}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition
            ${prefix ? 'pl-7' : ''}
            ${readonly
              ? 'bg-slate-700/40 border-slate-600 cursor-default text-slate-400'
              : 'bg-slate-700 border-slate-600 hover:border-slate-500'
            }`}
        />
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

export default function LotCalculator({ currentPrice }: Props) {
  const uid = useId()
  const [entry,   setEntry]   = useState('')
  const [sl,      setSl]      = useState('')
  const [maxRisk, setMaxRisk] = useState(String(PROP_FIRM.maxRiskPerTrade))
  const [pnl,     setPnl]     = useState('0')
  const [autoFill, setAutoFill] = useState(true)

  // 現在価格が更新されたとき、ユーザーが手動入力していなければ自動セット
  useEffect(() => {
    if (currentPrice && autoFill) {
      setEntry(currentPrice.toFixed(2))
    }
  }, [currentPrice, autoFill])

  const entryNum  = parseFloat(entry)  || 0
  const slNum     = parseFloat(sl)     || 0
  const riskNum   = Math.min(parseFloat(maxRisk) || PROP_FIRM.maxRiskPerTrade, PROP_FIRM.maxRiskPerTrade)
  const pnlNum    = parseFloat(pnl)    || 0

  const lot    = calcLotSize(entryNum, slNum, riskNum)
  const budget = calcDailyBudget(pnlNum)

  const handleEntryChange = (v: string) => {
    setAutoFill(false)
    setEntry(v)
  }

  const resetEntry = () => {
    setAutoFill(true)
    if (currentPrice) setEntry(currentPrice.toFixed(2))
  }

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-100 text-base sm:text-lg">
            🧮 プロップ専用 ロット計算機
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            損失を <span className="text-yellow-400 font-semibold">${PROP_FIRM.maxRiskPerTrade}</span> 以内に抑える最大BTC数量を逆算します
          </p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* ── 日次バジェット ─────────────────────────────────────────────────── */}
        <div className={`rounded-xl p-4 border ${budget.isBreached ? 'bg-red-950/60 border-red-500' : budget.isCritical ? 'bg-orange-950/50 border-orange-500/70' : 'bg-slate-700/30 border-slate-600'}`}>
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">本日の実現損益</p>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={pnl}
                  onChange={e => setPnl(e.target.value)}
                  step="1"
                  className="w-28 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <span className="text-xs text-slate-500">（損失はマイナスで入力）</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">本日損失</p>
                <p className="font-mono font-bold text-red-400">${budget.dailyLoss.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">残りバジェット</p>
                <p className={`font-mono font-bold ${budget.isBreached ? 'text-red-400' : budget.isCritical ? 'text-orange-400' : 'text-green-400'}`}>
                  ${Math.max(budget.remaining, 0).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">残りトレード数</p>
                <p className={`font-mono font-bold ${budget.remainingTrades === 0 ? 'text-red-400' : 'text-slate-200'}`}>
                  {budget.remainingTrades}回
                </p>
              </div>
            </div>
          </div>
          {budget.isBreached && (
            <p className="mt-3 text-sm font-bold text-red-400 bg-red-900/40 rounded-lg px-3 py-2">
              🚫 日次損失上限（${PROP_FIRM.maxDailyLoss}）に達しました。本日のトレードを即時停止してください。
            </p>
          )}
          {budget.isCritical && !budget.isBreached && (
            <p className="mt-3 text-sm font-bold text-orange-400 bg-orange-900/30 rounded-lg px-3 py-2">
              ⚠️ 残りバジェットが少なくなっています。次の損失で上限を超える可能性があります。
            </p>
          )}
        </div>

        {/* ── 入力フォーム ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <NumInput
              id={`${uid}-entry`}
              label="① エントリー価格"
              value={entry}
              onChange={handleEntryChange}
              prefix="$"
              placeholder="例: 95000"
              hint={autoFill ? '現在価格を自動入力中' : undefined}
            />
            {!autoFill && currentPrice && (
              <button
                onClick={resetEntry}
                className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                現在価格に戻す (${currentPrice.toFixed(2)})
              </button>
            )}
          </div>

          <NumInput
            id={`${uid}-sl`}
            label="② 損切り価格 (ストップロス)"
            value={sl}
            onChange={setSl}
            prefix="$"
            placeholder="例: 94500"
            hint={lot.direction ? `方向: ${lot.direction}` : undefined}
          />

          <NumInput
            id={`${uid}-risk`}
            label="③ 許容損失額 (上限 $100)"
            value={maxRisk}
            onChange={v => setMaxRisk(String(Math.min(parseFloat(v) || 0, PROP_FIRM.maxRiskPerTrade)))}
            prefix="$"
            hint={`口座残高の ${((riskNum / PROP_FIRM.accountBalance) * 100).toFixed(1)}%`}
          />
        </div>

        {/* ── 計算結果 ───────────────────────────────────────────────────────── */}
        {lot.isValid ? (
          <div className="rounded-xl border border-green-500/40 bg-green-950/30 overflow-hidden">
            {/* メイン結果 */}
            <div className="px-5 py-5 text-center border-b border-green-500/20">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">最大エントリー数量</p>
              <p className="text-5xl sm:text-6xl font-black text-green-400 font-mono leading-none mb-2">
                {lot.maxLots < 0.001
                  ? lot.maxLots.toFixed(6)
                  : lot.maxLots < 0.01
                  ? lot.maxLots.toFixed(5)
                  : lot.maxLots.toFixed(4)}
              </p>
              <p className="text-xl font-bold text-green-300">BTC</p>
              <p className="text-sm text-slate-400 mt-2">
                これ以上エントリーすると損失が <span className="text-red-400 font-bold">${riskNum}</span> を超えます
              </p>
            </div>

            {/* 内訳 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-700/50">
              {[
                { label: '価格差', value: `$${lot.priceDiff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                { label: 'ポジション規模', value: `$${lot.positionSizeUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
                { label: 'リスク率', value: `${lot.riskPercent.toFixed(2)}%` },
                { label: '方向', value: lot.direction === 'LONG' ? '📈 LONG' : lot.direction === 'SHORT' ? '📉 SHORT' : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="px-4 py-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm font-mono font-semibold text-slate-200">{value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-5 py-8 text-center">
            <p className="text-slate-500 text-sm">
              エントリー価格と損切り価格を入力すると、最大ロット数が表示されます
            </p>
            <p className="text-xs text-slate-600 mt-2">
              損切り価格がエントリー価格と同じ場合は計算できません
            </p>
          </div>
        )}

        {/* プロップルール確認チェックリスト */}
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 transition-colors list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
            エントリー前チェックリスト（プロップファームルール確認）
          </summary>
          <div className="mt-3 space-y-2">
            {[
              `損失額が $${PROP_FIRM.maxRiskPerTrade} 以内に収まるロット数であることを確認した`,
              `本日の累計損失が $${PROP_FIRM.maxDailyLoss} を超えていないことを確認した`,
              '3つの時間足（15m/1h/4h）全てのトレンドが同じ方向であることを確認した',
              'ボリンジャーバンドのスクイーズ（収縮）を確認した',
              'ブレイクアウト/ブレイクダウンが実際に発生したことを確認した（予測エントリーしない）',
              '損切り注文を先にOCOで設定してからエントリーする',
            ].map((item, i) => (
              <label key={i} className="flex items-start gap-2.5 cursor-pointer group/item">
                <input type="checkbox" className="mt-0.5 w-4 h-4 rounded border-slate-500 bg-slate-700 text-green-500 focus:ring-green-500 cursor-pointer flex-shrink-0" />
                <span className="text-xs text-slate-400 group-hover/item:text-slate-300 transition-colors leading-relaxed">{item}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
