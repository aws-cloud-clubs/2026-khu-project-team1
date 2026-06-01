package webhook_inspector.url;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UrlPatchResponse(
        String uuid,
        @JsonProperty("is_active") boolean isActive
) {}
