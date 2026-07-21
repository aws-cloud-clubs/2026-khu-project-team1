package webhook_inspector.url;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public record UrlPatchRequest(
        @NotNull
        @JsonProperty("is_active")
        Boolean isActive
) {}
