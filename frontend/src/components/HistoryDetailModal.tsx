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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--panel)] border border-[var(--border)] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-display text-[var(--text)] font-semibold flex items-center gap-2">
            <span className="text-[var(--accent)]">›</span> 웹훅 상세
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--panel-2)] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-[var(--rose)]/10 border border-[var(--rose)]/30 rounded-xl px-4 py-3 text-[var(--rose)] text-sm">
              {error}
            </div>
          )}

          {detail && (
            <div className="flex flex-col gap-6">
              <section>
                <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">기본 정보</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-[var(--text-dim)]">Method</dt>
                  <dd className="text-[var(--text)] font-medium">{detail.method}</dd>
                  <dt className="text-[var(--text-dim)]">Path</dt>
                  <dd className="text-[var(--text)] font-mono break-all">{detail.path || '/'}</dd>
                  <dt className="text-[var(--text-dim)]">Content-Type</dt>
                  <dd className="text-[var(--text)]">{detail.content_type || '—'}</dd>
                  <dt className="text-[var(--text-dim)]">수신 시각</dt>
                  <dd className="text-[var(--text)]">
                    {new Date(detail.received_at).toLocaleString('ko-KR')}
                  </dd>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">Headers</h3>
                {Object.keys(detail.headers).length === 0 ? (
                  <p className="text-[var(--text-faint)] text-sm">헤더 없음</p>
                ) : (
                  <dl className="flex flex-col gap-1.5 bg-[var(--bg-soft)] border border-[var(--border)] rounded-lg p-3">
                    {Object.entries(detail.headers).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <dt className="text-[var(--cyan)] shrink-0 font-medium break-all">{k}</dt>
                        <dd className="text-[var(--text-dim)] font-mono break-all">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider mb-2">Body</h3>
                {bodyFormatted && bodyFormatted.truncated && (
                  <p className="text-[var(--amber)] text-xs mb-1">
                    원문이 큽니다 — 앞 100KB만 표시합니다.
                  </p>
                )}
                {bodyFormatted && bodyFormatted.text ? (
                  <pre className="bg-[var(--bg)] text-[var(--text)] border border-[var(--border)] rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
                    {bodyFormatted.text}
                  </pre>
                ) : (
                  <p className="text-[var(--text-faint)] text-sm">본문 없음</p>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
