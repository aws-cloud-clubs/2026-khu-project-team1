package webhook_inspector.ingestion;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.awspring.cloud.sqs.operations.SqsTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import webhook_inspector.config.AwsProperties;
import webhook_inspector.exception.WebhookForbiddenException;
import webhook_inspector.exception.WebhookNotFoundException;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class IngestionService {

    private final DynamoDbClient dynamoDbClient;
    private final SqsTemplate sqsTemplate;
    private final AwsProperties awsProperties;
    private final ObjectMapper objectMapper;

    public IngestionResponse ingest(String uuid, WebhookPayload payload) {
        Map<String, AttributeValue> userItem = findActiveUser(uuid);
        String userId = userItem.get("user_id").s();
        SqsMessage sqsMessage = buildSqsMessage(userId, uuid, payload);
        var result = sqsTemplate.send(awsProperties.sqs().queueUrl(), serialize(sqsMessage));
        return new IngestionResponse(result.messageId().toString(), "received");
    }

    private Map<String, AttributeValue> findActiveUser(String uuid) {
        String tableName = awsProperties.dynamodb().tableName();

        var items = dynamoDbClient.query(QueryRequest.builder()
                .tableName(tableName)
                .indexName("GSI-UUID")
                .keyConditionExpression("webhook_uuid = :uuid")
                .expressionAttributeValues(Map.of(":uuid", AttributeValue.fromS(uuid)))
                .limit(1)
                .build()).items();

        if (items.isEmpty()) {
            throw new WebhookNotFoundException("Webhook URL not found: " + uuid);
        }

        Map<String, AttributeValue> userItem = items.getFirst();
        if (!userItem.get("is_active").bool()) {
            throw new WebhookForbiddenException("Webhook URL is inactive");
        }

        return userItem;
    }

    private SqsMessage buildSqsMessage(String userId, String uuid, WebhookPayload payload) {
        return new SqsMessage(
                payload.id(),
                userId,
                uuid,
                payload.receivedAt(),
                payload.method(),
                payload.path(),
                payload.headers(),
                payload.body(),
                payload.contentType(),
                payload.sourceIp(),
                payload.ttl()
        );
    }

    private String serialize(SqsMessage sqsMessage) {
        try {
            return objectMapper.writeValueAsString(sqsMessage);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize SQS message", e);
        }
    }
}
