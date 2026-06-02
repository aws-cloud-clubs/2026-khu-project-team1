package webhook_inspector.realtime;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * EVT-003 실시간 푸시 메시지 DTO.
 *
 * <p>WorkerService가 WebhookEvent 저장 직후 {@link PushSender}를 통해
 * {@code convertAndSendToUser(userId, "/queue/webhooks", payload)}로 전송한다.
 * 식별자 필드명은 {@code id}로 통일한다(history 패키지 HistoryListItem과 일치).
 */
public record PushPayload(
        String type,
        String id,
        @JsonProperty("user_id") String userId,
        String method,
        @JsonProperty("received_at") String receivedAt,
        @JsonProperty("content_type") String contentType,
        @JsonProperty("body_preview") String bodyPreview
) {
    /** 신규 웹훅 수신 알림 타입. */
    public static final String TYPE_NEW_WEBHOOK = "NEW_WEBHOOK";
}
