import type { WebhookListItem } from '../api/webhookApi'

interface HistoryCardProps {
  item: WebhookListItem
  onSelect: (id: string) => void
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-50 text-blue-700',
  POST: 'bg-green-50 text-green-700',
  PUT: 'bg-amber-50 text-amber-700',
  PATCH: 'bg-orange-50 text-orange-700',
  DELETE: 'bg-red-50 text-red-700',
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
  const methodColor = METHOD_COLORS[item.method] ?? 'bg-gray-100 text-gray-600'

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3 mb-1">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${methodColor}`}>
          {item.method}
        </span>
        <span className="text-sm text-gray-700 font-mono truncate">
          {item.path || '—'}
        </span>
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {formatDate(item.received_at)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {item.content_type && (
          <span className="text-xs text-gray-400 truncate">{item.content_type}</span>
        )}
        {item.body_preview && (
          <span className="text-xs text-gray-400 truncate">{item.body_preview}</span>
        )}
      </div>
    </button>
  )
}
