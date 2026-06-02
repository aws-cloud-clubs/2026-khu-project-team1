package webhook_inspector.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Supabase JWT(HS256) 서명 검증 공통 컴포넌트.
 * REST({@link JwtVerificationFilter})와 WebSocket(WebSocketAuthInterceptor)에서 함께 사용한다.
 */
@Component
@RequiredArgsConstructor
public class JwtVerifier {

    private final JwtProperties jwtProperties;

    /**
     * 토큰 서명을 검증하고 Claims를 반환한다.
     *
     * @param token "Bearer " 접두어를 제거한 순수 JWT 문자열
     * @return 검증된 토큰의 Claims
     * @throws JwtException 서명 불일치·만료·형식 오류 등 검증 실패 시
     */
    public Claims verify(String token) {
        return Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(jwtProperties.jwtSecret().getBytes(StandardCharsets.UTF_8)))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
