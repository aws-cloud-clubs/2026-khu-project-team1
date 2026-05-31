package webhook_inspector.exception;

public class WebhookNotFoundException extends RuntimeException {

    public WebhookNotFoundException(String message) {
        super(message);
    }
}
