package webhook_inspector.ingestion;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public record SqsMessage(
        String id,
        @JsonProperty("user_id") String userId,
        @JsonProperty("webhook_uuid") String webhookUuid,
        @JsonProperty("received_at") String receivedAt,
        String method,
        String path,
        Map<String, String> headers,
        String body,
        @JsonProperty("content_type") String contentType,
        @JsonProperty("source_ip") String sourceIp,
        long ttl
) {}
