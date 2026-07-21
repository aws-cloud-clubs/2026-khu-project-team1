import { useEffect, useState } from 'react'
import { getWebhookUrl, updateIsActive, type WebhookUrlResponse } from '../api/webhookApi'

export default function WebhookUrlCard() {
  const [data, setData] = useState<WebhookUrlResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getWebhookUrl()
      .then(setData)
      .catch(() => setError('URL을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = async () => {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.webhook_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('클립보드 복사에 실패했습니다.')
    }
  }

  const handleToggle = async () => {
    if (!data || toggling) return
    setToggling(true)
    try {
      const updated = await updateIsActive(!data.is_active)
      setData({ ...data, is_active: updated.is_active })
    } catch {
      setError('상태 변경에 실패했습니다.')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--text-faint)]">
        <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-[var(--rose)]/10 border border-[var(--rose)]/30 px-6 py-4 text-[var(--rose)] text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[var(--text)] font-semibold text-lg tracking-tight flex items-center gap-2">
          <span className="text-[var(--accent)]">~/</span>webhook-url
        </h2>
        <div className="flex items-center gap-2.5">
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
              data?.is_active
                ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                : 'bg-[var(--panel-2)] text-[var(--text-faint)]'
            }`}
          >
            {data?.is_active ? 'active' : 'inactive'}
          </span>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              data?.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--bg)] shadow transition-transform ${
                data?.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--text-dim)]">
        {data?.is_active
          ? '이 URL로 들어오는 웹훅을 수신 중입니다.'
          : '비활성 상태 — 웹훅을 수신하지 않습니다.'}
      </p>

      <div className="flex items-center gap-2 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg px-4 py-3">
        <span className="text-[var(--accent)] text-sm select-none">$</span>
        <span className="flex-1 text-sm text-[var(--text)] font-mono truncate">{data?.webhook_url}</span>
        <button
          onClick={handleCopy}
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
            copied
              ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/40'
              : 'bg-transparent text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-faint)]'
          }`}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
    </div>
  )
}
