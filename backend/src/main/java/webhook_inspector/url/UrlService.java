package webhook_inspector.url;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import webhook_inspector.config.AppProperties;
import webhook_inspector.config.AwsProperties;
import webhook_inspector.exception.WebhookNotFoundException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UrlService {

    private final DynamoDbClient dynamoDbClient;
    private final AwsProperties awsProperties;
    private final AppProperties appProperties;

    public UrlResponse getOrCreateWebhookUrl(String userId) {
        String pk = "USER#" + userId;
        String sk = "METADATA";
        String tableName = awsProperties.dynamodb().tableName();

        GetItemResponse existing = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", AttributeValue.fromS(pk),
                        "SK", AttributeValue.fromS(sk)))
                .build());

        if (existing.hasItem()) {
            Map<String, AttributeValue> item = existing.item();
            return toUrlResponse(item);
        }

        String webhookUuid = UUID.randomUUID().toString();
        String createdAt = Instant.now().toString();

        Map<String, AttributeValue> newItem = new HashMap<>();
        newItem.put("PK", AttributeValue.fromS(pk));
        newItem.put("SK", AttributeValue.fromS(sk));
        newItem.put("user_id", AttributeValue.fromS(userId));
        newItem.put("webhook_uuid", AttributeValue.fromS(webhookUuid));
        newItem.put("is_active", AttributeValue.fromBool(true));
        newItem.put("created_at", AttributeValue.fromS(createdAt));

        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(newItem)
                .build());

        return new UrlResponse(
                appProperties.webhookBaseUrl() + "/" + webhookUuid, webhookUuid, true, createdAt);
    }

    public UrlPatchResponse updateIsActive(String userId, boolean isActive) {
        String tableName = awsProperties.dynamodb().tableName();
        String pk = "USER#" + userId;
        String sk = "METADATA";

        GetItemResponse existing = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", AttributeValue.fromS(pk),
                        "SK", AttributeValue.fromS(sk)))
                .build());

        if (!existing.hasItem()) {
            throw new WebhookNotFoundException("User not found: " + userId);
        }

        dynamoDbClient.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(Map.of(
                        "PK", AttributeValue.fromS(pk),
                        "SK", AttributeValue.fromS(sk)))
                .updateExpression("SET is_active = :active")
                .expressionAttributeValues(Map.of(":active", AttributeValue.fromBool(isActive)))
                .build());

        String webhookUuid = existing.item().get("webhook_uuid").s();
        return new UrlPatchResponse(webhookUuid, isActive);
    }

    private UrlResponse toUrlResponse(Map<String, AttributeValue> item) {
        String webhookUuid = item.get("webhook_uuid").s();
        boolean isActive = item.get("is_active").bool();
        String createdAt = item.get("created_at").s();
        String webhookUrl = appProperties.webhookBaseUrl() + "/" + webhookUuid;
        return new UrlResponse(webhookUrl, webhookUuid, isActive, createdAt);
    }
}
