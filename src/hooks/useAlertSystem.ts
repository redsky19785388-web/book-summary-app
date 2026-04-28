import { useState, useRef, useEffect, useCallback } from 'react'

const THROTTLE_MS = 15 * 60 * 1000 // 同一シグナルは15分間隔で1回だけ通知
const STORAGE_KEY = 'prop_alert_config'

export interface AlertConfig {
  browserNotifications: boolean
  discordWebhookUrl: string
}

const defaultConfig: AlertConfig = {
  browserNotifications: true,
  discordWebhookUrl: '',
}

function loadConfig(): AlertConfig {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? { ...defaultConfig, ...JSON.parse(s) } : defaultConfig
  } catch {
    return defaultConfig
  }
}

export function useAlertSystem() {
  const [config, setConfigState] = useState<AlertConfig>(loadConfig)
  const [permission, setPermission] = useState<NotificationPermission | 'unavailable'>('unavailable')
  const lastAlertRef = useRef<{ signal: string; time: number } | null>(null)

  // 初期化: Notification API の権限状態を取得
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  // config を localStorage に永続化
  const updateConfig = useCallback((patch: Partial<AlertConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }, [])

  // ブラウザ通知の許可をリクエスト
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const p = await Notification.requestPermission()
    setPermission(p)
    if (p === 'granted') updateConfig({ browserNotifications: true })
  }, [updateConfig])

  // ブラウザ通知を送信
  const sendBrowserNotif = useCallback((title: string, body: string) => {
    if (permission !== 'granted' || !config.browserNotifications) return
    try {
      new Notification(title, {
        body,
        tag: 'prop-trade-signal',
        requireInteraction: true,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>',
      })
    } catch { /* noop */ }
  }, [permission, config.browserNotifications])

  // Discord Webhook に POST
  const sendDiscord = useCallback(async (
    signal: 'long' | 'short',
    reason: string,
    price: number,
  ) => {
    if (!config.discordWebhookUrl) return
    const isLong = signal === 'long'
    const payload = {
      username: 'Prop Trade Monitor',
      embeds: [{
        title: isLong ? '🟢 LONGチャンス接近！' : '🔴 SHORTチャンス接近！',
        description: reason,
        color: isLong ? 0x22c55e : 0xef4444,
        fields: [
          { name: '現在価格', value: `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, inline: true },
          { name: '最大リスク', value: '$100 / トレード', inline: true },
          { name: '次のアクション', value: 'ロット計算機で数量を確認し、ブレイクアウト確認後にエントリー！', inline: false },
        ],
        footer: { text: 'Prop Firm Trading Dashboard' },
        timestamp: new Date().toISOString(),
      }],
    }
    try {
      await fetch(config.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.warn('Discord通知送信エラー:', err)
    }
  }, [config.discordWebhookUrl])

  // アラートのメインエントリポイント（スロットリング付き）
  const triggerAlert = useCallback(async (
    signal: 'long' | 'short',
    reason: string,
    price: number,
  ) => {
    const now = Date.now()
    const last = lastAlertRef.current
    if (last && last.signal === signal && now - last.time < THROTTLE_MS) return

    lastAlertRef.current = { signal, time: now }

    const title = signal === 'long' ? '🟢 LONGチャンス接近！' : '🔴 SHORTチャンス接近！'
    const body = `${reason}\n現在価格: $${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`

    sendBrowserNotif(title, body)
    await sendDiscord(signal, reason, price)
  }, [sendBrowserNotif, sendDiscord])

  // テスト通知（設定画面から呼び出し）
  const testAlert = useCallback(async (currentPrice: number) => {
    lastAlertRef.current = null // スロットリングをリセット
    await triggerAlert('long', '【テスト通知】アラート設定の確認です。本番シグナルではありません。', currentPrice)
  }, [triggerAlert])

  return {
    config,
    updateConfig,
    permission,
    requestPermission,
    triggerAlert,
    testAlert,
  }
}
