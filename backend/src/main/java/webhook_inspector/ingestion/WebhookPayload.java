package webhook_inspector.ingestion;

import java.util.Map;

public record WebhookPayload(
        String id,
        String receivedAt,
        String method,
        String path,
        Map<String, String> headers,
        String body,
        String contentType,
        String sourceIp,
        long ttl
) {}
