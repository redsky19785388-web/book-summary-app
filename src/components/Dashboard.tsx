import { useState, useEffect, useRef } from 'react'
import { useMarketData } from '../hooks/useMarketData'
import { useAlertSystem } from '../hooks/useAlertSystem'
import TimeframeCard from './TimeframeCard'
import ActionPanel from './ActionPanel'
import LotCalculator from './LotCalculator'
import NotificationSettings from './NotificationSettings'
import { getEntrySignal } from '../utils/indicators'
import { getActionState } from '../utils/propfirm'
import { Interval } from '../types/market'

const TIMEFRAMES: { interval: Interval; label: string }[] = [
  { interval: '15m', label: '15分足' },
  { interval: '1h',  label: '1時間足' },
  { interval: '4h',  label: '4時間足' },
]

// 20の精度向上メソッド（多学問横断）
const METHODS = [
  { disc: '統計学',         name: 'RSI (14)',                    desc: '過買/過売を0–100で数値化。70以上=過買い、30以下=過売り',                     impl: true },
  { disc: '統計学',         name: 'Z-Score (20)',                desc: 'SMAからの統計的乖離量。±2以上は統計的異常値圏',                               impl: true },
  { disc: '統計学',         name: '自己相関係数',                   desc: '価格変動の周期性を検出。ラグ分析でサイクル発見',                              impl: false },
  { disc: '物理学的計測',    name: 'ATR (14)',                    desc: '1本あたりの真のレンジ平均。ボラティリティの絶対値測定',                         impl: true },
  { disc: '物理学的計測',    name: '勢い（Momentum）',             desc: 'n期前との差分。物体の運動量に類比するトレンド強度',                            impl: false },
  { disc: '信号処理',        name: 'MACD (12/26/9)',              desc: 'EMAの差分をさらにEMAで平滑化。トレンド転換を信号検出',                          impl: true },
  { disc: '信号処理',        name: '適応型移動平均 (KAMA)',         desc: 'ノイズ比率に応じて自動速度調整するスマートフィルタ',                           impl: false },
  { disc: '信号処理',        name: 'EMA (指数平滑)',               desc: '直近価格に指数的な重みを置いたローパスフィルタ',                              impl: true },
  { disc: 'フラクタル幾何学', name: 'Hurst指数 (R/S解析)',         desc: 'H>0.55=トレンド持続, H<0.45=平均回帰, それ以外=ランダムウォーク',              impl: true },
  { disc: 'フラクタル幾何学', name: 'フラクタル次元',               desc: '価格曲線の複雑度を1–2で測定。1に近い=直線的なトレンド',                      impl: false },
  { disc: '情報理論',        name: 'Shannon Entropy',             desc: '価格変動の情報量。低い=規則性あり、高い=ノイズ優勢',                          impl: false },
  { disc: '情報理論',        name: 'VWAP',                        desc: '出来高加重平均価格。機関投資家のコスト基準点',                                 impl: false },
  { disc: '計量経済学',      name: 'GARCH モデル',                 desc: 'ボラティリティのクラスタリング。高波乱期の継続性予測',                          impl: false },
  { disc: '計量経済学',      name: '共和分分析',                    desc: '複数通貨ペアの長期的均衡関係を利用したペアトレード',                           impl: false },
  { disc: '行動経済学',      name: '心理的節目価格',                desc: 'ラウンドナンバー($90,000等)での反発/ブレイク確率上昇',                        impl: false },
  { disc: '行動経済学',      name: 'S/Rゾーン',                   desc: '参加者の記憶に基づく支持/抵抗帯。出来高プロファイルで強化',                     impl: false },
  { disc: 'ゲーム理論',      name: 'オーダーフロー不均衡',           desc: '買い/売りの圧力差。デプス(板)の非対称性から優位方向を判定',                   impl: false },
  { disc: '数学的最適化',    name: 'Fibonacci リトレースメント',    desc: '黄金比(0.382, 0.618等)による自然な反転水準',                                impl: false },
  { disc: '複雑系',          name: '多時間足コンフルエンス',         desc: '本ダッシュボードが実装済み。3足の方向一致でエントリー精度向上',                 impl: true },
  { disc: '複雑系',          name: 'Relative Volatility Index',   desc: 'RSIのボラティリティ版。価格変化の方向性ではなく変動量で計算',                   impl: false },
]

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

export default function Dashboard() {
  const { data, lastUpdated, refresh } = useMarketData('BTCUSDT')
  const alertSystem = useAlertSystem()
  const [refreshing,    setRefreshing]    = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [showMethods,    setShowMethods]   = useState(false)

  const currentPrice = data['15m'].indicators?.currentPrice
  const allLoaded = TIMEFRAMES.every(tf => data[tf.interval].indicators !== null)

  const slopes     = TIMEFRAMES.map(tf => data[tf.interval].indicators?.smaSlope   ?? 'flat')
  const bbStatuses = TIMEFRAMES.map(tf => data[tf.interval].indicators?.bbStatus   ?? 'normal')

  const entrySignal  = allLoaded ? getEntrySignal(slopes, bbStatuses) : null
  const actionState  = getActionState(allLoaded ? entrySignal?.signal ?? null : null, slopes, bbStatuses)

  // ★★シグナル発生時にアラート送信（前回から変化したときのみ）
  const prevSignalLabelRef = useRef('')
  useEffect(() => {
    if (!entrySignal || !currentPrice) return
    const isStrong = entrySignal.label.includes('★★')
    const wasStrong = prevSignalLabelRef.current.includes('★★')
    if (isStrong && !wasStrong && entrySignal.signal !== 'wait') {
      alertSystem.triggerAlert(entrySignal.signal, entrySignal.reason, currentPrice)
    }
    prevSignalLabelRef.current = entrySignal.label
  }, [entrySignal, currentPrice, alertSystem])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  const notifBadge = alertSystem.permission === 'granted' && alertSystem.config.browserNotifications
    ? '🔔'
    : alertSystem.config.discordWebhookUrl
    ? '💬'
    : '🔕'

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-bold leading-tight">
              <span className="text-yellow-400">BTC/USDT</span>
              <span className="text-slate-200 ml-1.5">トレード監視</span>
              <span className="ml-2 text-xs font-normal text-slate-500 hidden sm:inline">Prop Firm Edition</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {currentPrice != null && (
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">現在価格</div>
                <div className="text-lg sm:text-2xl font-mono font-bold text-white leading-tight">
                  ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {/* 通知設定ボタン */}
            <button
              onClick={() => setShowNotifPanel(v => !v)}
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors text-lg
                ${showNotifPanel ? 'bg-slate-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
              title="アラート設定"
            >
              {notifBadge}
            </button>
            {/* 更新ボタン */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition-colors text-slate-300 hover:text-white disabled:opacity-50"
              aria-label="手動更新"
            >
              <RefreshIcon spinning={refreshing} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12 pt-4 space-y-4">
        {/* ── 通知設定パネル（トグル） ── */}
        {showNotifPanel && (
          <NotificationSettings
            config={alertSystem.config}
            permission={alertSystem.permission}
            onUpdate={alertSystem.updateConfig}
            onRequestPermission={alertSystem.requestPermission}
            onTest={() => alertSystem.testAlert(currentPrice ?? 0)}
            onClose={() => setShowNotifPanel(false)}
          />
        )}

        {/* ── アクション指示パネル（最大目立つ表示） ── */}
        <ActionPanel actionState={actionState} />

        {/* ── タイムフレームカード（横スクロール on mobile、3列 on sm+） ── */}
        <div className="overflow-x-auto -mx-4 px-4 pb-2 sm:overflow-visible sm:mx-0 sm:px-0 sm:pb-0">
          <div className="flex gap-3 w-max sm:w-auto sm:grid sm:grid-cols-3">
            {TIMEFRAMES.map(({ interval, label }) => (
              <div key={interval} className="w-72 sm:w-auto snap-start flex-shrink-0">
                <TimeframeCard label={label} state={data[interval]} />
              </div>
            ))}
          </div>
        </div>

        {/* ── ロット計算機 ── */}
        <LotCalculator currentPrice={currentPrice} />

        {/* ── 凡例 ── */}
        <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-500">
          <p className="font-semibold text-slate-400 mb-2">凡例</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <span>⚡ スクイーズ — BB幅が過去平均の75%未満（ブレイク前兆）</span>
            <span>💥 拡張中 — BB幅が過去平均の130%超（高ボラ危険域）</span>
            <span>Hurst H&gt;0.55=トレンド持続、H&lt;0.45=平均回帰</span>
          </div>
        </div>

        {/* ── 精度向上メソッド 20選 ── */}
        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <button
            onClick={() => setShowMethods(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
          >
            <span className="text-sm font-semibold text-slate-300">
              📚 精度向上メソッド 20選 — 多学問横断アプローチ
            </span>
            <span className="text-slate-500 text-xs ml-2">{showMethods ? '▲ 閉じる' : '▼ 開く'}</span>
          </button>
          {showMethods && (
            <div className="bg-slate-900/50 px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {METHODS.map((m, i) => (
                  <div key={i} className={`p-2.5 rounded-lg border text-xs ${m.impl ? 'border-green-500/20 bg-green-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-600 font-mono w-5 flex-shrink-0">{i + 1}.</span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-200">{m.name}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{m.disc}</span>
                          {m.impl && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">✓ 実装済</span>}
                        </div>
                        <p className="text-slate-500 mt-0.5 leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-[11px] text-slate-600">
          {lastUpdated
            ? `最終更新: ${lastUpdated.toLocaleTimeString('ja-JP')} ｜ 60秒ごと自動更新`
            : 'データ取得中...'}
          {' '}｜ Binance Public API ｜ Prop Firm Edition
        </p>
      </main>
    </div>
  )
}
