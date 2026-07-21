package webhook_inspector.exception;

public class WebhookForbiddenException extends RuntimeException {

    public WebhookForbiddenException(String message) {
        super(message);
    }
}
