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
      <div className="flex items-center justify-center py-12 text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-6 py-4 text-red-600 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-gray-900 font-semibold text-lg">내 Webhook URL</h2>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              data?.is_active
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {data?.is_active ? '활성' : '비활성'}
          </span>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              data?.is_active ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                data?.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {data?.is_active
          ? '이 URL로 들어오는 웹훅을 수신 중입니다.'
          : '비활성 상태 — 웹훅을 수신하지 않습니다.'}
      </p>

      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <span className="flex-1 text-sm text-gray-700 font-mono truncate">{data?.webhook_url}</span>
        <button
          onClick={handleCopy}
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
    </div>
  )
}
