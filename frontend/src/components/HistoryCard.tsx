import type { WebhookListItem } from '../api/webhookApi'

interface HistoryCardProps {
  item: WebhookListItem
  onSelect: (id: string) => void
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-500/20 text-blue-400',
  POST: 'bg-green-500/20 text-green-400',
  PUT: 'bg-yellow-500/20 text-yellow-400',
  PATCH: 'bg-orange-500/20 text-orange-400',
  DELETE: 'bg-red-500/20 text-red-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function HistoryCard({ item, onSelect }: HistoryCardProps) {
  const methodColor = METHOD_COLORS[item.method] ?? 'bg-gray-500/20 text-gray-400'

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="w-full text-left bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-center gap-3 mb-1">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColor}`}>
          {item.method}
        </span>
        <span className="text-sm text-gray-300 truncate">
          {item.path || '—'}
        </span>
        <span className="ml-auto text-xs text-gray-500 shrink-0">
          {formatDate(item.received_at)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.content_type && (
          <span className="text-xs text-gray-500 truncate">{item.content_type}</span>
        )}
        {item.body_preview && (
          <span className="text-xs text-gray-600 truncate">{item.body_preview}</span>
        )}
      </div>
    </button>
  )
}
