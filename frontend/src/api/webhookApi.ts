import api from './axiosInstance'

export interface WebhookUrlResponse {
  webhook_url: string
  uuid: string
  is_active: boolean
  created_at: string
}

export interface UrlPatchResponse {
  uuid: string
  is_active: boolean
}

export interface WebhookListItem {
  id: string
  received_at: string
  method: string
  path: string
  content_type: string | null
  body_preview: string | null
}

export interface WebhookListResponse {
  total: number
  limit: number
  offset: number
  items: WebhookListItem[]
}

export interface WebhookDetail {
  id: string
  user_id: string
  received_at: string
  method: string
  path: string
  headers: Record<string, string>
  body: string | null
  content_type: string | null
}

export async function getWebhookUrl(): Promise<WebhookUrlResponse> {
  const { data } = await api.get<WebhookUrlResponse>('/v1/webhook-url')
  return data
}

export async function updateIsActive(isActive: boolean): Promise<UrlPatchResponse> {
  const { data } = await api.patch<UrlPatchResponse>('/v1/webhook-url', { is_active: isActive })
  return data
}

export async function getHistoryList(limit = 50, offset = 0): Promise<WebhookListResponse> {
  const { data } = await api.get<WebhookListResponse>('/v1/webhooks', { params: { limit, offset } })
  return data
}

export async function getHistoryDetail(id: string): Promise<WebhookDetail> {
  const { data } = await api.get<WebhookDetail>(`/v1/webhooks/${id}`)
  return data
}
