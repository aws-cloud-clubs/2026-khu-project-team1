package webhook_inspector;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import webhook_inspector.config.AppProperties;
import webhook_inspector.config.AwsProperties;

@SpringBootApplication
@EnableConfigurationProperties({AwsProperties.class, AppProperties.class})
public class DemoApplication {

	public static void main(String[] args) {
		SpringApplication.run(DemoApplication.class, args);
	}
}
