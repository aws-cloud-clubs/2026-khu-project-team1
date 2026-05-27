package webhook_inspector.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aws")
public record AwsProperties(
        DynamoDb dynamodb,
        Sqs sqs
) {
    public record DynamoDb(String tableName) {}
    public record Sqs(String queueUrl) {}
}
