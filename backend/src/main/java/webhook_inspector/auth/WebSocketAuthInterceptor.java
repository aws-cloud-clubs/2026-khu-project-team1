package webhook_inspector.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * STOMP CONNECT 프레임 단계에서 Supabase JWT를 검증하는 인터셉터.
 *
 * <p>HTTP 핸드셰이크는 인증 없이 통과하고(WS-001), 클라이언트가 보내는 STOMP CONNECT 프레임의
 * {@code Authorization: Bearer {jwt}} native 헤더로 인증한다. 검증에 성공하면 해당 사용자를
 * 세션의 Principal로 지정하며, 이 Principal 이름(= JWT subject = user_id)이 이후
 * {@code convertAndSendToUser(userId, ...)} 푸시 라우팅 키로 사용된다.
 *
 * <p>{@link webhook_inspector.config.WebSocketConfig#configureClientInboundChannel}에 등록된다.
 */
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final String AUTH_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtVerifier jwtVerifier;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        // CONNECT 프레임에서만 인증 수행. 이후 SUBSCRIBE/SEND 등은 그대로 통과.
        if (!StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String authHeader = accessor.getFirstNativeHeader(AUTH_HEADER);

        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            throw new MessagingException("Missing or malformed Authorization header on STOMP CONNECT");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            Claims claims = jwtVerifier.verify(token);
            String supabaseUid = claims.getSubject();

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(supabaseUid, null, List.of());
            accessor.setUser(authentication);

        } catch (JwtException e) {
            throw new MessagingException("Invalid or expired token on STOMP CONNECT", e);
        }

        return message;
    }
}
