import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { supabase } from '../lib/supabase'

export type SocketStatus = 'connecting' | 'connected' | 'disconnected'

export interface PushPayload {
  type: 'NEW_WEBHOOK'
  id: string
  user_id: string
  method: string
  received_at: string
  content_type: string | null
  body_preview: string
}

interface UseWebhookSocketArgs {
  onMessage: (payload: PushPayload) => void
  enabled: boolean
}

interface UseWebhookSocketResult {
  status: SocketStatus
}

export function useWebhookSocket({ onMessage, enabled }: UseWebhookSocketArgs): UseWebhookSocketResult {
  const [status, setStatus] = useState<SocketStatus>('disconnected')
  const clientRef = useRef<Client | null>(null)
  const subRef = useRef<StompSubscription | null>(null)
  // 항상 최신 onMessage를 참조 — Client 재생성 없이 콜백 갱신
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (!enabled) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${import.meta.env.VITE_API_BASE_URL}/ws`),
      reconnectDelay: 5000,
      beforeConnect: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          // 토큰 없으면 연결 시도 중단 — 빈 헤더로 CONNECT하면 백엔드 MessagingException + 무한 재시도
          await client.deactivate()
          setStatus('disconnected')
          return
        }
        client.connectHeaders = { Authorization: `Bearer ${session.access_token}` }
      },
      onConnect: () => {
        setStatus('connected')
        subRef.current = client.subscribe('/user/queue/webhooks', (frame) => {
          try {
            onMessageRef.current(JSON.parse(frame.body) as PushPayload)
          } catch {
            // 파싱 실패 무시
          }
        })
      },
      onWebSocketClose: () => setStatus('disconnected'),
      onStompError: () => setStatus('disconnected'),
    })

    clientRef.current = client
    setStatus('connecting')
    client.activate()

    return () => {
      subRef.current?.unsubscribe()
      subRef.current = null
      // 실제 활성 상태일 때만 deactivate — StrictMode 이중 마운트 시 비활성 client 호출 방지
      if (clientRef.current?.active) {
        clientRef.current.deactivate()
      }
      clientRef.current = null
      setStatus('disconnected')
    }
  }, [enabled])

  return { status }
}
