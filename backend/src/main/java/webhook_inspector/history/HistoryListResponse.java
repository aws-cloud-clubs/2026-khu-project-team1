package webhook_inspector.history;

import java.util.List;

public record HistoryListResponse(
        int total,
        int limit,
        int offset,
        List<HistoryListItem> items
) {}
