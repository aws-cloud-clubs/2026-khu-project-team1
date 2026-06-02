package webhook_inspector.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.Key;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Supabase JWT(ES256) 서명 검증 공통 컴포넌트.
 * REST({@link JwtVerificationFilter})와 WebSocket(WebSocketAuthInterceptor)에서 함께 사용한다.
 *
 * <p>Supabase는 비대칭 키(ECDSA P-256)로 액세스 토큰을 서명하므로 공유 시크릿(HS256) 검증이 불가능하다.
 * 프로젝트의 JWKS 엔드포인트에서 공개키를 받아 토큰 헤더의 {@code kid}에 해당하는 키로 서명을 검증한다.
 * 공개키는 메모리에 캐시하고, 모르는 {@code kid}(키 회전)를 만나면 JWKS를 재조회한다.
 */
@Component
public class JwtVerifier {

    private final String jwksUri;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** kid -> 공개키 캐시. 키 회전 시 새 kid가 등장하면 재조회로 갱신. */
    private volatile Map<String, Key> keyCache = Map.of();

    public JwtVerifier(JwtProperties jwtProperties) {
        this.jwksUri = jwtProperties.jwksUri();
    }

    /**
     * 토큰 서명을 검증하고 Claims를 반환한다.
     *
     * @param token "Bearer " 접두어를 제거한 순수 JWT 문자열
     * @return 검증된 토큰의 Claims
     * @throws JwtException 서명 불일치·만료·형식 오류·키 조회 실패 시
     */
    public Claims verify(String token) {
        return Jwts.parser()
                .keyLocator(new LocatorAdapter<Key>() {
                    @Override
                    protected Key locate(JwsHeader header) {
                        return resolveKey(header.getKeyId());
                    }
                })
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Key resolveKey(String kid) {
        if (kid == null) {
            throw new JwtException("JWT header has no 'kid'");
        }
        Key key = keyCache.get(kid);
        if (key != null) {
            return key;
        }
        // 캐시 미스 → JWKS 재조회 (최초 로드 또는 키 회전 대응)
        refreshKeys();
        key = keyCache.get(kid);
        if (key == null) {
            throw new JwtException("No matching key in JWKS for kid: " + kid);
        }
        return key;
    }

    private synchronized void refreshKeys() {
        try {
            HttpResponse<String> response = httpClient.send(
                    HttpRequest.newBuilder(URI.create(jwksUri))
                            .timeout(Duration.ofSeconds(5))
                            .GET()
                            .build(),
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                throw new JwtException("JWKS fetch failed: HTTP " + response.statusCode());
            }

            JwkSet jwkSet = Jwks.setParser().build().parse(response.body());
            Map<String, Key> fresh = new HashMap<>();
            for (Jwk<?> jwk : jwkSet.getKeys()) {
                fresh.put(jwk.getId(), jwk.toKey());
            }
            keyCache = Map.copyOf(fresh);
        } catch (JwtException e) {
            throw e;
        } catch (Exception e) {
            throw new JwtException("JWKS fetch/parse failed", e);
        }
    }
}
