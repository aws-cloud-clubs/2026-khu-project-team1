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

export async function getWebhookUrl(): Promise<WebhookUrlResponse> {
  const { data } = await api.get<WebhookUrlResponse>('/v1/webhook-url')
  return data
}

export async function updateIsActive(isActive: boolean): Promise<UrlPatchResponse> {
  const { data } = await api.patch<UrlPatchResponse>('/v1/webhook-url', { is_active: isActive })
  return data
}
