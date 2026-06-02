package webhook_inspector.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
public class CorsConfig {

    /**
     * Spring Security 필터 체인(SecurityConfig#filterChain의 http.cors)이 사용하는 CORS 소스.
     *
     * <p>WebMvcConfigurer#addCorsMappings는 MVC 디스패처에만 적용되어 Security 필터보다 뒤에 있다.
     * 그 결과 인증 전 단계인 OPTIONS preflight가 Security에서 403으로 차단되어 CORS 헤더 없이 끝나므로,
     * Security가 직접 참조하는 CorsConfigurationSource 빈으로 등록해야 preflight가 통과한다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
