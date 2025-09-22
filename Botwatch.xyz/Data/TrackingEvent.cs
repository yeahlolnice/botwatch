namespace Botwatch.Data;

public class TrackingEvent
{
    public int Id { get; set; }
    public DateTimeOffset Utc { get; set; } = DateTimeOffset.UtcNow;

    public string VisitorId { get; set; } = string.Empty;
    public string EventName { get; set; } = "form_submit";
    public string EventKey { get; set; } = string.Empty;

    public string Path { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string? Referer { get; set; }
    public string Ip { get; set; } = string.Empty;

    public string? FormDataJson { get; set; }
    public bool? HoneypotTriggered { get; set; }
    public long? TimeToSubmitMs { get; set; }
}
