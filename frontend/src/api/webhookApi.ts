import api from './axiosInstance'

export interface WebhookUrlResponse {
  userId: string
  webhookUrl: string
  isActive: boolean
}

export async function getWebhookUrl(): Promise<WebhookUrlResponse> {
  const { data } = await api.get<WebhookUrlResponse>('/api/webhook/url')
  return data
}

export async function updateIsActive(isActive: boolean): Promise<WebhookUrlResponse> {
  const { data } = await api.patch<WebhookUrlResponse>('/api/webhook/url/active', { isActive })
  return data
}
