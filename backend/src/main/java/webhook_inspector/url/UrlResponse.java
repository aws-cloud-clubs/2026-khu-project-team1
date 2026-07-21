package webhook_inspector.url;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UrlResponse(
        @JsonProperty("webhook_url") String webhookUrl,
        String uuid,
        @JsonProperty("is_active") boolean isActive,
        @JsonProperty("created_at") String createdAt
) {}
