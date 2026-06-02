package webhook_inspector.history;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public record HistoryDetailResponse(
        String id,
        @JsonProperty("user_id") String userId,
        @JsonProperty("received_at") String receivedAt,
        String method,
        String path,
        Map<String, String> headers,
        String body,
        @JsonProperty("content_type") String contentType
) {}
