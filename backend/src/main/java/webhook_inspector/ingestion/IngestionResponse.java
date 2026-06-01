package webhook_inspector.ingestion;

import com.fasterxml.jackson.annotation.JsonProperty;

public record IngestionResponse(
        @JsonProperty("message_id") String messageId,
        String status
) {}
