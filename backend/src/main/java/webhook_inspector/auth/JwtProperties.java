package webhook_inspector.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

//...
@ConfigurationProperties(prefix = "supabase")
public record JwtProperties(String jwksUri) {}
