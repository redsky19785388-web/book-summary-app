import { ActionState, PROP_FIRM } from '../utils/propfirm'

interface Props {
  actionState: ActionState
}

const LEVEL_PULSE: Record<ActionState['level'], string> = {
  danger:  'animate-pulse',
  caution: 'animate-pulse',
  ready:   '',
  watch:   '',
  prepare: '',
  loading: '',
}

export default function ActionPanel({ actionState }: Props) {
  const pulse = LEVEL_PULSE[actionState.level]

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${actionState.bg} ${actionState.border} ${pulse}`}>
      {/* ルールリマインダーバー */}
      <div className="bg-slate-900/60 px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400 border-b border-white/5">
        <span>口座残高 <strong className="text-slate-200">${PROP_FIRM.accountBalance.toLocaleString()}</strong></span>
        <span>日次上限損失 <strong className="text-red-400">${PROP_FIRM.maxDailyLoss}</strong></span>
        <span>1トレード最大リスク <strong className="text-yellow-400">${PROP_FIRM.maxRiskPerTrade}</strong></span>
      </div>

      {/* メインコンテンツ */}
      <div className="p-5 sm:p-6">
        {/* タイトル */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl sm:text-4xl leading-none mt-0.5">{actionState.emoji}</span>
          <h2 className={`text-lg sm:text-xl font-extrabold leading-snug ${actionState.titleColor}`}>
            {actionState.title}
          </h2>
        </div>

        {/* 状況説明 */}
        <p className="text-slate-300 text-sm sm:text-base mb-4 leading-relaxed">
          {actionState.message}
        </p>

        {/* アクション指示（強調） */}
        {actionState.instruction && (
          <div className={`rounded-xl p-4 ${actionState.instructionBg} border border-white/5`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">
              ▶ 今すぐやること
            </p>
            <p className="text-white text-sm sm:text-base leading-relaxed font-medium">
              {actionState.instruction}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
