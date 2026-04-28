import { AlertConfig } from '../hooks/useAlertSystem'

interface Props {
  config: AlertConfig
  permission: NotificationPermission | 'unavailable'
  onUpdate: (patch: Partial<AlertConfig>) => void
  onRequestPermission: () => void
  onTest: () => void
  onClose: () => void
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
        ${checked ? 'bg-blue-500' : 'bg-slate-600'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

const PERMISSION_LABEL: Record<NotificationPermission | 'unavailable', { text: string; color: string }> = {
  granted:     { text: '✓ 許可済み',       color: 'text-green-400' },
  denied:      { text: '✗ ブロック済み',    color: 'text-red-400' },
  default:     { text: '未設定',           color: 'text-slate-400' },
  unavailable: { text: '非対応ブラウザ',   color: 'text-slate-500' },
}

export default function NotificationSettings({
  config, permission, onUpdate, onRequestPermission, onTest, onClose,
}: Props) {
  const pl = PERMISSION_LABEL[permission]

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <h3 className="font-bold text-slate-100">🔔 アラート・通知設定</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none transition-colors">✕</button>
      </div>

      <div className="p-5 space-y-5">
        {/* ブラウザ通知 */}
        <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-200">ブラウザ通知（デスクトップ）</p>
              <p className="text-xs text-slate-500 mt-0.5">全足一致 + BBスクイーズ時にOS通知を送信（15分間隔）</p>
            </div>
            <Toggle
              checked={config.browserNotifications && permission === 'granted'}
              onChange={v => onUpdate({ browserNotifications: v })}
              disabled={permission !== 'granted'}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${pl.color}`}>{pl.text}</span>
            {permission === 'default' && (
              <button
                onClick={onRequestPermission}
                className="text-xs bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
              >
                通知を許可する
              </button>
            )}
            {permission === 'denied' && (
              <span className="text-xs text-slate-500">ブラウザの設定からサイトの通知許可を変更してください</span>
            )}
          </div>
        </div>

        {/* Discord Webhook */}
        <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/50 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-0.5">Discord Webhook 通知</p>
            <p className="text-xs text-slate-500">シグナル発生時に指定のDiscordチャンネルにメッセージを送信</p>
          </div>
          <input
            type="url"
            value={config.discordWebhookUrl}
            onChange={e => onUpdate({ discordWebhookUrl: e.target.value })}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full bg-slate-700 border border-slate-600 hover:border-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
          />
          <div className="text-xs text-slate-500 space-y-1">
            <p>取得方法: Discordサーバー → チャンネル編集 → 連携サービス → ウェブフック → 新しいウェブフック</p>
            <p className="text-slate-600">⚠ URLは他人に共有しないでください（誰でもあなたのチャンネルに投稿できます）</p>
          </div>
        </div>

        {/* テスト送信 */}
        <button
          onClick={onTest}
          className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-700 text-sm font-medium text-slate-300 hover:text-white transition-colors border border-slate-600"
        >
          📨 テスト通知を送る（スロットリングをリセット）
        </button>

        <p className="text-xs text-slate-600 text-center">
          同一シグナルは15分間に1回のみ送信されます（重複防止）
        </p>
      </div>
    </div>
  )
}
