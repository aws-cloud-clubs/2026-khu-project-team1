import { useEffect, useState } from 'react'
import { getHistoryDetail } from '../api/webhookApi'
import type { WebhookDetail } from '../api/webhookApi'

interface HistoryDetailModalProps {
  id: string | null
  onClose: () => void
}

const BODY_TRUNCATE_LIMIT = 100_000

function formatBody(raw: string | null): { text: string; truncated: boolean } {
  if (!raw) return { text: '', truncated: false }
  const source = raw.length > BODY_TRUNCATE_LIMIT ? raw.slice(0, BODY_TRUNCATE_LIMIT) : raw
  const truncated = raw.length > BODY_TRUNCATE_LIMIT
  try {
    return { text: JSON.stringify(JSON.parse(source), null, 2), truncated }
  } catch {
    return { text: source, truncated }
  }
}

export default function HistoryDetailModal({ id, onClose }: HistoryDetailModalProps) {
  const [detail, setDetail] = useState<WebhookDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setDetail(null)
    setError(null)
    setLoading(true)
    getHistoryDetail(id)
      .then(setDetail)
      .catch(() => setError('상세 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!id) return null

  const bodyFormatted = detail ? formatBody(detail.body) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">웹훅 상세</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {detail && (
            <div className="flex flex-col gap-5">
              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">기본 정보</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-gray-500">Method</dt>
                  <dd className="text-gray-200">{detail.method}</dd>
                  <dt className="text-gray-500">Path</dt>
                  <dd className="text-gray-200 break-all">{detail.path || '—'}</dd>
                  <dt className="text-gray-500">Content-Type</dt>
                  <dd className="text-gray-200">{detail.content_type || '—'}</dd>
                  <dt className="text-gray-500">수신 시각</dt>
                  <dd className="text-gray-200">
                    {new Date(detail.received_at).toLocaleString('ko-KR')}
                  </dd>
                </dl>
              </section>

              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Headers</h3>
                {Object.keys(detail.headers).length === 0 ? (
                  <p className="text-gray-500 text-sm">헤더 없음</p>
                ) : (
                  <dl className="flex flex-col gap-1">
                    {Object.entries(detail.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <dt className="text-gray-400 shrink-0 min-w-0 break-all">{k}:</dt>
                        <dd className="text-gray-200 break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section>
                <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">Body</h3>
                {bodyFormatted && bodyFormatted.truncated && (
                  <p className="text-yellow-500 text-xs mb-1">
                    원문이 큽니다 — 앞 100KB만 표시합니다.
                  </p>
                )}
                {bodyFormatted && bodyFormatted.text ? (
                  <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {bodyFormatted.text}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">본문 없음</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
