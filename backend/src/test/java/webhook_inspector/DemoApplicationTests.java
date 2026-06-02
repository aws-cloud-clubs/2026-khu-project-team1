package webhook_inspector;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
        "supabase.jwt-secret=test-secret-key-that-is-long-enough-for-hmac",
        "aws.sqs.queue-url=https://sqs.ap-northeast-2.amazonaws.com/123456789/test-queue",
        "aws.dynamodb.table-name=test-table",
        "app.webhook-base-url=https://hook.example.com",
        "spring.cloud.aws.credentials.access-key=test",
        "spring.cloud.aws.credentials.secret-key=test",
        "spring.cloud.aws.region.static=ap-northeast-2"
})
class DemoApplicationTests {

    @Test
    void contextLoads() {
    }

}
