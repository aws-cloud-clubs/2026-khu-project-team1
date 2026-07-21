package webhook_inspector.ingestion;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.awspring.cloud.sqs.annotation.SqsListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import webhook_inspector.config.AwsProperties;
import webhook_inspector.realtime.PushSender;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkerService {

    private final DynamoDbClient dynamoDbClient;
    private final AwsProperties awsProperties;
    private final ObjectMapper objectMapper;
    private final PushSender pushSender;

    @SqsListener("${aws.sqs.queue-url}")
    public void processMessage(String messageBody) {
        try {
            SqsMessage msg = objectMapper.readValue(messageBody, SqsMessage.class);
            saveEvent(msg);
            pushSender.push(msg);
        } catch (Exception e) {
            log.error("Failed to process SQS message", e);
            throw new RuntimeException("SQS message processing failed", e);
        }
    }

    private void saveEvent(SqsMessage msg) throws Exception {
        String tableName = awsProperties.dynamodb().tableName();
        String pk = "EVENT#" + msg.id();

        String headersJson = objectMapper.writeValueAsString(msg.headers());

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("PK", AttributeValue.fromS(pk));
        item.put("SK", AttributeValue.fromS(pk));
        item.put("id", AttributeValue.fromS(msg.id()));
        item.put("user_id", AttributeValue.fromS(msg.userId()));
        item.put("received_at", AttributeValue.fromS(msg.receivedAt()));
        item.put("method", AttributeValue.fromS(msg.method()));
        item.put("path", AttributeValue.fromS(msg.path()));
        item.put("headers", AttributeValue.fromS(headersJson));
        item.put("body", AttributeValue.fromS(msg.body() != null ? msg.body() : ""));
        item.put("content_type", AttributeValue.fromS(msg.contentType() != null ? msg.contentType() : ""));
        item.put("source_ip", AttributeValue.fromS(msg.sourceIp() != null ? msg.sourceIp() : ""));
        item.put("ttl", AttributeValue.fromN(String.valueOf(msg.ttl())));

        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
    }
}
