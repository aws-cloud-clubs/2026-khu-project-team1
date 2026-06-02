import { useCallback, useEffect, useState } from 'react'
import Header from '../components/Header'
import WebhookUrlCard from '../components/WebhookUrlCard'
import HistoryList from '../components/HistoryList'
import HistoryDetailModal from '../components/HistoryDetailModal'
import { getHistoryList } from '../api/webhookApi'
import type { WebhookListItem } from '../api/webhookApi'
import { useWebhookSocket } from '../hooks/useWebhookSocket'
import type { PushPayload, SocketStatus } from '../hooks/useWebhookSocket'

const MAX_ITEMS = 50

function dedupeMerge(incoming: WebhookListItem[], current: WebhookListItem[]): WebhookListItem[] {
  const seen = new Set(incoming.map((i) => i.id))
  const merged = [...incoming, ...current.filter((i) => !seen.has(i.id))]
  merged.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
  return merged
}

const STATUS_UI: Record<SocketStatus, { dot: string; label: string }> = {
  connected: { dot: 'bg-green-500', label: '실시간 연결됨' },
  connecting: { dot: 'bg-yellow-500 animate-pulse', label: '연결 중…' },
  disconnected: { dot: 'bg-gray-500', label: '연결 끊김' },
}

export default function DashboardPage() {
  const [items, setItems] = useState<WebhookListItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historyReady, setHistoryReady] = useState(false)

  useEffect(() => {
    getHistoryList(MAX_ITEMS)
      .then((res) => {
        // 덮어쓰기 대신 머지 — 소켓이 먼저 push한 항목 보존 (M2 race 방지)
        setItems((prev) => dedupeMerge(res.items, prev).slice(0, MAX_ITEMS))
      })
      .catch(() => setListError('이력을 불러오지 못했습니다.'))
      .finally(() => {
        setListLoading(false)
        setHistoryReady(true)
      })
  }, [])

  const handlePush = useCallback((p: PushPayload) => {
    const incoming: WebhookListItem = {
      id: p.id,
      received_at: p.received_at,
      method: p.method,
      path: '',
      content_type: p.content_type,
      body_preview: p.body_preview,
    }
    setItems((prev) => {
      if (prev.some((i) => i.id === incoming.id)) return prev
      return [incoming, ...prev].slice(0, MAX_ITEMS)
    })
  }, [])

  const handleModalClose = useCallback(() => setSelectedId(null), [])

  // M2: historyReady 후에만 소켓 활성화 — 초기 fetch와의 race 차단
  const { status } = useWebhookSocket({ onMessage: handlePush, enabled: historyReady })

  const statusUi = STATUS_UI[status]

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
        <WebhookUrlCard />

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">수신 이력</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusUi.dot}`} />
              <span className="text-xs text-gray-400">{statusUi.label}</span>
            </div>
          </div>
          <HistoryList
            items={items}
            loading={listLoading}
            error={listError}
            onSelect={setSelectedId}
          />
        </section>
      </main>

      <HistoryDetailModal id={selectedId} onClose={handleModalClose} />
    </div>
  )
}
