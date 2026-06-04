import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from '../components/Header'
import WebhookUrlCard from '../components/WebhookUrlCard'
import HistoryList from '../components/HistoryList'
import HistoryDetailModal from '../components/HistoryDetailModal'
import StatsCard from '../components/StatsCard'
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
  connected: { dot: 'bg-[var(--accent)] live-dot', label: 'LIVE' },
  connecting: { dot: 'bg-[var(--amber)] animate-pulse', label: '연결 중…' },
  disconnected: { dot: 'bg-[var(--text-faint)]', label: '연결 끊김' },
}

export default function DashboardPage() {
  const [items, setItems] = useState<WebhookListItem[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historyReady, setHistoryReady] = useState(false)
  // 실시간 push로 막 도착한 항목 id — 도착 하이라이트 애니메이션용. 일정 시간 후 자동 해제.
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set())
  const newIdTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    getHistoryList(MAX_ITEMS)
      .then((res) => {
        setTotal(res.total)
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
      setTotal((t) => t + 1)
      // 도착 하이라이트 마킹 + 2.5초 후 자동 해제
      setNewIds((s) => new Set(s).add(incoming.id))
      const timer = setTimeout(() => {
        setNewIds((s) => {
          const next = new Set(s)
          next.delete(incoming.id)
          return next
        })
        newIdTimers.current.delete(incoming.id)
      }, 2500)
      newIdTimers.current.set(incoming.id, timer)
      return [incoming, ...prev].slice(0, MAX_ITEMS)
    })
  }, [])

  // 언마운트 시 남은 하이라이트 타이머 정리
  useEffect(() => {
    const timers = newIdTimers.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  const handleModalClose = useCallback(() => setSelectedId(null), [])

  // M2: historyReady 후에만 소켓 활성화 — 초기 fetch와의 race 차단
  const { status } = useWebhookSocket({ onMessage: handlePush, enabled: historyReady })

  const statusUi = STATUS_UI[status]

  // 오늘(로컬 기준) 수신 건수 — 최근 N건 범위 내 계산
  const todayCount = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return items.filter((i) => new Date(i.received_at) >= start).length
  }, [items])

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rise">
          <StatsCard
            label="총 수신"
            value={total.toLocaleString()}
            accent="indigo"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
          />
          <StatsCard
            label="오늘 수신"
            value={todayCount.toLocaleString()}
            accent="green"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            }
          />
          <StatsCard
            label="실시간 연결"
            value={<span className="text-base">{statusUi.label}</span>}
            accent={status === 'connected' ? 'green' : 'gray'}
            icon={
              <span className={`block h-3 w-3 rounded-full ${statusUi.dot}`} />
            }
          />
        </div>

        <div className="rise" style={{ animationDelay: '60ms' }}>
          <WebhookUrlCard />
        </div>

        <section className="rise" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-[var(--text)] font-semibold tracking-tight flex items-center gap-2">
              <span className="text-[var(--accent)]">$</span> 수신 이력
            </h2>
            <span className="text-xs text-[var(--text-faint)]">{total.toLocaleString()} events</span>
          </div>
          <HistoryList
            items={items}
            loading={listLoading}
            error={listError}
            onSelect={setSelectedId}
            newIds={newIds}
          />
        </section>
      </main>

      <HistoryDetailModal id={selectedId} onClose={handleModalClose} />
    </div>
  )
}
