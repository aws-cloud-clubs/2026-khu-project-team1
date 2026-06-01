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
    await navigator.clipboard.writeText(data.webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = async () => {
    if (!data || toggling) return
    setToggling(true)
    try {
      const updated = await updateIsActive(!data.isActive)
      setData(updated)
    } catch {
      setError('상태 변경에 실패했습니다.')
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        로딩 중...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/30 border border-red-700 px-6 py-4 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">내 Webhook URL</h2>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
            data?.isActive ? 'bg-indigo-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              data?.isActive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {data?.isActive ? '활성 — 웹훅을 수신 중입니다.' : '비활성 — 웹훅을 수신하지 않습니다.'}
      </p>

      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-3">
        <span className="flex-1 text-sm text-gray-300 truncate">{data?.webhookUrl}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
        >
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
    </div>
  )
}
