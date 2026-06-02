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
        <div className="w-6 h-6 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        아직 수신된 웹훅이 없습니다.
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
