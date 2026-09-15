namespace EdcBridge;

public sealed record DaemonConfig
{
    public required string ApiBaseUrl { get; init; }
    public required string ApiKey { get; init; }
    public int PollIntervalMs { get; init; } = 3000;
    // Default false (flipped 2026-09-15): moving dialogs to a hidden virtual desktop
    // (see DialogDesktopHider) turned out to just trade one problem for a worse one --
    // some native dialogs (e.g. "Error response from Host") block POS4CAT_Ctl.dll from
    // accepting the next request until a human clicks OK, and nobody is ever on the
    // hidden desktop to click it, permanently wedging the terminal. Decision: let
    // native dialogs render wherever they naturally appear (normally the kiosk's own
    // desktop) so staff/customer can actually see and dismiss them; the kiosk's own
    // "Scan QR" overlay was removed to match (see EdcPaymentFlow.tsx). Set true only
    // to bring back the old hidden-desktop behavior, which still requires EdcBridge.exe
    // to be launched while that desktop is active -- see start-kiosk.ps1 (now unused by
    // default). An even earlier same-desktop overlay approach (AutoCloseDialogs) was
    // retired 2026-09-15 too: it let the dialog visually block the kiosk page, since
    // overlay and browser shared the same desktop.
    public bool HideDialogsOnDesktop { get; init; } = false;

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

        var hideDialogsOnDesktop = false;
        if (values.TryGetValue("HideDialogsOnDesktop", out var hideDialogsStr) && bool.TryParse(hideDialogsStr, out var hideDialogsParsed))
            hideDialogsOnDesktop = hideDialogsParsed;

        values.TryGetValue("DeviceId", out var deviceId);

        return new DaemonConfig
        {
            ApiBaseUrl = apiBaseUrl.TrimEnd('/'),
            ApiKey = apiKey,
            PollIntervalMs = pollIntervalMs,
            HideDialogsOnDesktop = hideDialogsOnDesktop,
            DeviceId = string.IsNullOrWhiteSpace(deviceId) ? null : deviceId,
        };
    }
}
