package webhook_inspector.realtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import webhook_inspector.ingestion.SqsMessage;

/**
 * MOD-006: 저장된 WebhookEvent를 소유자에게 실시간 Push 전송하는 컴포넌트.
 *
 * <p>WorkerService(MOD-004)가 WebhookEvent 저장 직후 {@link #push(SqsMessage)}를 호출한다.
 * STOMP CONNECT 단계(WebSocketAuthInterceptor)에서 지정된 Principal 이름(= user_id)을
 * 라우팅 키로 사용하여 해당 사용자의 구독 경로({@code /user/queue/webhooks})로만 전송한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushSender {

    /** 사용자별 구독 목적지. 최종 경로는 userDestinationPrefix가 붙은 /user/queue/webhooks. */
    private static final String USER_DESTINATION = "/queue/webhooks";

    /** body_preview 최대 길이(history 패키지 컨벤션과 일치). */
    private static final int BODY_PREVIEW_MAX_LENGTH = 200;

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * SqsMessage를 EVT-003 페이로드로 변환해 소유자에게 전송한다.
     *
     * @param msg 저장 완료된 웹훅 이벤트 메시지
     */
    public void push(SqsMessage msg) {
        PushPayload payload = new PushPayload(
                PushPayload.TYPE_NEW_WEBHOOK,
                msg.id(),
                msg.userId(),
                msg.method(),
                msg.receivedAt(),
                msg.contentType(),
                bodyPreview(msg.body())
        );

        messagingTemplate.convertAndSendToUser(msg.userId(), USER_DESTINATION, payload);
        log.debug("Pushed NEW_WEBHOOK to user={} id={}", msg.userId(), msg.id());
    }

    private String bodyPreview(String body) {
        if (body == null) {
            return "";
        }
        return body.length() <= BODY_PREVIEW_MAX_LENGTH
                ? body
                : body.substring(0, BODY_PREVIEW_MAX_LENGTH);
    }
}
