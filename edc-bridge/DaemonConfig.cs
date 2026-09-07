namespace EdcBridge;

public sealed record DaemonConfig
{
    public required string ApiBaseUrl { get; init; }
    public required string ApiKey { get; init; }
    public int PollIntervalMs { get; init; } = 3000;
    public bool AutoCloseDialogs { get; init; } = true;

    // Which physical kiosk device (and therefore which physical EDC terminal)
    // this daemon instance belongs to — must match the ?device= value that
    // device's kiosk browser sends. Null = accept jobs from any device (fine
    // when there's only one EDC in play, e.g. local testing); once more than
    // one EDC is live, every daemon.config needs its own DeviceId or two
    // daemons can end up racing for the same job.
    public string? DeviceId { get; init; }

    private const string FileName = "daemon.config";

    // Simple KEY=VALUE lines, one per line — same spirit as pos4cat.ini, no extra
    // parsing dependency needed. Not committed to git (holds the API key).
    public static DaemonConfig Load()
    {
        if (!File.Exists(FileName))
        {
            throw new FileNotFoundException(
                $"'{FileName}' not found next to EdcBridge.exe. Copy 'daemon.config.example' to " +
                "'daemon.config' and fill in ApiBaseUrl / ApiKey.");
        }

        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rawLine in File.ReadAllLines(FileName))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#') || line.StartsWith(';'))
                continue;

            var idx = line.IndexOf('=');
            if (idx < 0) continue;

            values[line[..idx].Trim()] = line[(idx + 1)..].Trim();
        }

        if (!values.TryGetValue("ApiBaseUrl", out var apiBaseUrl) || apiBaseUrl.Length == 0)
            throw new InvalidOperationException($"'{FileName}' is missing ApiBaseUrl.");
        if (!values.TryGetValue("ApiKey", out var apiKey) || apiKey.Length == 0)
            throw new InvalidOperationException($"'{FileName}' is missing ApiKey.");

        var pollIntervalMs = 3000;
        if (values.TryGetValue("PollIntervalMs", out var pollStr) && int.TryParse(pollStr, out var parsed))
            pollIntervalMs = parsed;

        var autoCloseDialogs = true;
        if (values.TryGetValue("AutoCloseDialogs", out var autoCloseStr) && bool.TryParse(autoCloseStr, out var autoCloseParsed))
            autoCloseDialogs = autoCloseParsed;

        values.TryGetValue("DeviceId", out var deviceId);

        return new DaemonConfig
        {
            ApiBaseUrl = apiBaseUrl.TrimEnd('/'),
            ApiKey = apiKey,
            PollIntervalMs = pollIntervalMs,
            AutoCloseDialogs = autoCloseDialogs,
            DeviceId = string.IsNullOrWhiteSpace(deviceId) ? null : deviceId,
        };
    }
}
