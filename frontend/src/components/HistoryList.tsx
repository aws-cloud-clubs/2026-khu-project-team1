import type { WebhookListItem } from '../api/webhookApi'
import HistoryCard from './HistoryCard'
import HistorySkeleton from './HistorySkeleton'

interface HistoryListProps {
  items: WebhookListItem[]
  loading: boolean
  error: string | null
  onSelect: (id: string) => void
  /** 실시간 push로 막 도착한 항목 id 집합 — 하이라이트 애니메이션용 */
  newIds?: Set<string>
}

export default function HistoryList({ items, loading, error, onSelect, newIds }: HistoryListProps) {
  if (loading) {
    return <HistorySkeleton />
  }

  if (error) {
    return (
      <div className="bg-[var(--rose)]/10 border border-[var(--rose)]/30 rounded-xl px-4 py-3 text-[var(--rose)] text-sm">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[var(--border)] rounded-xl bg-[var(--panel)]/40">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--panel-2)] ring-1 ring-[var(--border)] mb-3">
          <svg className="h-6 w-6 text-[var(--text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
          </svg>
        </div>
        <p className="text-[var(--text-dim)] text-sm font-display">아직 수신된 웹훅이 없습니다</p>
        <p className="text-[var(--text-faint)] text-xs mt-1">위 URL로 웹훅을 보내면 여기에 실시간으로 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <HistoryCard
          key={item.id}
          item={item}
          onSelect={onSelect}
          isNew={newIds?.has(item.id)}
        />
      ))}
    </div>
  )
}
