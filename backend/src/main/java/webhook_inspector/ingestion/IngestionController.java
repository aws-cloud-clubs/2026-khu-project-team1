package webhook_inspector.ingestion;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class IngestionController {

    private final IngestionService ingestionService;

    @PostMapping("/{uuid}")
    public ResponseEntity<IngestionResponse> receiveWebhook(@PathVariable String uuid, HttpServletRequest request) throws IOException {

        Map<String, String> headers = new HashMap<>();
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String name = headerNames.nextElement();
            headers.put(name, request.getHeader(name));
        }

        String body = StreamUtils.copyToString(request.getInputStream(), StandardCharsets.UTF_8);
        String contentType = request.getContentType() != null ? request.getContentType() : "";
        String sourceIp = resolveSourceIp(request);
        String method = request.getMethod();
        String path = request.getRequestURI();
        String receivedAt = Instant.now().toString();
        String id = UUID.randomUUID().toString();
        long ttl = Instant.now().plusSeconds(30L * 24 * 60 * 60).getEpochSecond();

        WebhookPayload payload = new WebhookPayload(id, receivedAt, method, path, headers, body, contentType, sourceIp, ttl);

        IngestionResponse response = ingestionService.ingest(uuid, payload);
        return ResponseEntity.ok(response);
    }

    private String resolveSourceIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
