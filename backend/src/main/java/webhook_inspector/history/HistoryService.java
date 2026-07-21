package webhook_inspector.history;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import webhook_inspector.config.AwsProperties;
import webhook_inspector.exception.WebhookForbiddenException;
import webhook_inspector.exception.WebhookNotFoundException;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HistoryService {

    // user_id(PK) + received_at(SK) 기준 인덱스, Projection = All
    private static final String USER_EVENTS_INDEX = "GSI-userId-receivedAt";

    // DynamoDB는 offset/total을 네이티브로 지원하지 않으므로 최신순 최대 건수만 조회 후 메모리에서 슬라이스.
    private static final int MAX_FETCH = 1000;
    private static final int BODY_PREVIEW_MAX = 200;

    private final DynamoDbClient dynamoDbClient;
    private final AwsProperties awsProperties;
    private final ObjectMapper objectMapper;

    public HistoryListResponse list(String userId, int limit, int offset) {
        String tableName = awsProperties.dynamodb().tableName();

        List<Map<String, AttributeValue>> items = dynamoDbClient.query(QueryRequest.builder()
                .tableName(tableName)
                .indexName(USER_EVENTS_INDEX)
                .keyConditionExpression("user_id = :uid")
                .expressionAttributeValues(Map.of(":uid", AttributeValue.fromS(userId)))
                .scanIndexForward(false)   // received_at 최신순
                .limit(MAX_FETCH)
                .build()).items();

        int total = items.size();

        List<HistoryListItem> pageItems = items.stream()
                .skip(offset)
                .limit(limit)
                .map(this::toListItem)
                .toList();

        return new HistoryListResponse(total, limit, offset, pageItems);
    }

    public HistoryDetailResponse detail(String userId, String webhookId) {
        String tableName = awsProperties.dynamodb().tableName();
        String pk = "EVENT#" + webhookId;

        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", AttributeValue.fromS(pk),
                        "SK", AttributeValue.fromS(pk)))
                .build());

        if (!response.hasItem()) {
            throw new WebhookNotFoundException("Webhook event not found: " + webhookId);
        }

        Map<String, AttributeValue> item = response.item();

        if (!userId.equals(stringOrNull(item.get("user_id")))) {
            throw new WebhookForbiddenException("Access denied to webhook event: " + webhookId);
        }

        return new HistoryDetailResponse(
                stringOrEmpty(item.get("id")),
                stringOrEmpty(item.get("user_id")),
                stringOrEmpty(item.get("received_at")),
                stringOrEmpty(item.get("method")),
                stringOrEmpty(item.get("path")),
                parseHeaders(item.get("headers")),
                stringOrEmpty(item.get("body")),
                stringOrEmpty(item.get("content_type"))
        );
    }

    private HistoryListItem toListItem(Map<String, AttributeValue> item) {
        return new HistoryListItem(
                stringOrEmpty(item.get("id")),
                stringOrEmpty(item.get("received_at")),
                stringOrEmpty(item.get("method")),
                stringOrEmpty(item.get("path")),
                stringOrEmpty(item.get("content_type")),
                preview(stringOrEmpty(item.get("body")))
        );
    }

    private String preview(String body) {
        if (body.length() <= BODY_PREVIEW_MAX) {
            return body;
        }
        return body.substring(0, BODY_PREVIEW_MAX) + "...";
    }

    private Map<String, String> parseHeaders(AttributeValue headers) {
        String json = stringOrNull(headers);
        if (json == null) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String stringOrNull(AttributeValue value) {
        return value == null ? null : value.s();
    }

    private String stringOrEmpty(AttributeValue value) {
        return value == null ? "" : value.s();
    }
}
