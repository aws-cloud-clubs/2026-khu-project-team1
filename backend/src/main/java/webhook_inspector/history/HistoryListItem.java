package webhook_inspector.history;

import com.fasterxml.jackson.annotation.JsonProperty;

public record HistoryListItem(
        String id,
        @JsonProperty("received_at") String receivedAt,
        String method,
        String path,
        @JsonProperty("content_type") String contentType,
        @JsonProperty("body_preview") String bodyPreview
) {}
