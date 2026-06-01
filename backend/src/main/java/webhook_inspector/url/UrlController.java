package webhook_inspector.url;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/webhook-url")
@RequiredArgsConstructor
public class UrlController {

    private final UrlService urlService;

    @GetMapping
    public ResponseEntity<UrlResponse> getWebhookUrl(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(urlService.getOrCreateWebhookUrl(userId));
    }

    @PatchMapping
    public ResponseEntity<UrlPatchResponse> updateWebhookUrl(
            @AuthenticationPrincipal String userId, @Valid @RequestBody UrlPatchRequest request) {
        return ResponseEntity.ok(urlService.updateIsActive(userId, request.isActive()));
    }
}
