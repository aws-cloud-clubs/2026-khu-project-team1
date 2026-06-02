package webhook_inspector.history;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/webhooks")
@RequiredArgsConstructor
public class HistoryController {

    private static final int MAX_LIMIT = 100;

    private final HistoryService historyService;

    @GetMapping
    public ResponseEntity<HistoryListResponse> list(
            @AuthenticationPrincipal String userId,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        int safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        int safeOffset = Math.max(offset, 0);
        return ResponseEntity.ok(historyService.list(userId, safeLimit, safeOffset));
    }

    @GetMapping("/{webhookId}")
    public ResponseEntity<HistoryDetailResponse> detail(
            @AuthenticationPrincipal String userId,
            @PathVariable String webhookId) {
        return ResponseEntity.ok(historyService.detail(userId, webhookId));
    }
}
