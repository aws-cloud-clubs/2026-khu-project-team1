import type { WebhookListItem } from '../api/webhookApi'
import HistoryCard from './HistoryCard'

interface HistoryListProps {
  items: WebhookListItem[]
  loading: boolean
  error: string | null
  onSelect: (id: string) => void
}

export default function HistoryList({ items, loading, error, onSelect }: HistoryListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">아직 수신된 웹훅이 없습니다</p>
        <p className="text-gray-400 text-xs mt-1">위 URL로 웹훅을 보내면 여기에 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </div>
  )
}
