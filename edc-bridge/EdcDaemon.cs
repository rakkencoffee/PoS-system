using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EdcBridge;

public sealed class EdcDaemon
{
    private readonly DaemonConfig _config;
    private readonly EdcClient _edcClient;
    private readonly HttpClient _http;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public EdcDaemon(DaemonConfig config, EdcClient edcClient)
    {
        _config = config;
        _edcClient = edcClient;
        _http = new HttpClient { BaseAddress = new Uri(_config.ApiBaseUrl) };
        _http.DefaultRequestHeaders.Add("x-api-key", _config.ApiKey);
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        Console.WriteLine($"[EdcDaemon] Polling {_config.ApiBaseUrl}/api/edc-jobs every {_config.PollIntervalMs}ms. Ctrl+C to stop.");

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await PollOnceAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EdcDaemon] Poll cycle error: {ex.Message}");
            }

            try
            {
                await Task.Delay(_config.PollIntervalMs, cancellationToken);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }

        Console.WriteLine("[EdcDaemon] Stopped.");
    }

    private async Task PollOnceAsync(CancellationToken cancellationToken)
    {
        var query = "/api/edc-jobs?status=PENDING&limit=1";
        if (!string.IsNullOrEmpty(_config.DeviceId))
            query += $"&deviceId={Uri.EscapeDataString(_config.DeviceId)}";

        var response = await _http.GetFromJsonAsync<EdcJobsResponse>(
            query, JsonOptions, cancellationToken);

        var job = response?.Jobs?.FirstOrDefault();
        if (job is null) return;

        Console.WriteLine($"[EdcDaemon] Job {job.Id} — order {job.OrderId}, amount Rp{job.Amount}, method {job.Method}");

        await PatchJobAsync(job.Id, new EdcJobPatch { Status = "PROCESSING" }, cancellationToken);

        var patch = job.Method == "QRIS"
            ? await ProcessQrisJobAsync(job.Amount, cancellationToken)
            : ProcessCardJob(job.Amount);

        await PatchJobAsync(job.Id, patch, cancellationToken);

        Console.WriteLine(patch.Status == "APPROVED"
            ? $"[EdcDaemon] Job {job.Id} APPROVED (approvalCode={patch.ApprovalCode})"
            : $"[EdcDaemon] Job {job.Id} {patch.Status} ({patch.ErrorMessage})");
    }

    private EdcJobPatch ProcessCardJob(int amount)
    {
        var result = _edcClient.Purchase(amount.ToString());

        return result.RawResponseData is not null
            ? new EdcJobPatch
            {
                Status = result.Approved ? "APPROVED" : "REJECTED",
                ApprovalCode = result.ApprovalCode,
                TraceNumber = result.TraceNumber,
                CardType = result.CardType,
                Pan = result.Pan,
                ResponseCode = result.ResponseCode,
                RawResponseData = result.RawResponseData,
                ErrorMessage = result.Approved ? null : result.ErrorMessage,
            }
            : new EdcJobPatch
            {
                Status = "FAILED",
                ResponseCode = result.ResponseCode,
                ErrorMessage = result.ErrorMessage,
            };
    }

    // QRIS payment is asynchronous (customer scans and pays via their own e-wallet
    // app, separate from the serial session), and GenerateQris()'s own COMStatus()
    // has been confirmed live (2026-09-07/08) to often fail to relay the final
    // result even when the EDC's own screen and printed receipt show the payment
    // genuinely APPROVED. There is no known-reliable fix yet (see
    // Pesan_Yokke_ResponseTimeout.txt, still awaiting vendor response).
    //
    // No inquiry retry at all as of 2026-09-15 (was 3 attempts/~30s, then cut to
    // 1/~10s, now 0): the kiosk's "Batalkan" only marks the order/job cancelled in
    // the DB -- it can't interrupt an EDC call already in flight, since the native
    // GenerateQris()/COMStatus() cycle blocks synchronously with no cancellation
    // hook. Any retry here just delays how soon the daemon is free for the next
    // job regardless of who it was for, which is what got noticed live: cancelling
    // and immediately retrying kept landing behind a still-running retry cycle.
    // Explicit accepted tradeoff, not a risk-free default: staff must still check
    // the EDC's own screen/receipt manually if a job comes back FAILED here, since
    // this is now the ONLY read of the transaction result -- there is no second
    // chance to catch a genuinely-successful payment that failed to relay.
    private Task<EdcJobPatch> ProcessQrisJobAsync(int amount, CancellationToken cancellationToken)
    {
        _ = cancellationToken; // kept for signature compatibility with the caller
        var result = _edcClient.GenerateQris(amount.ToString());
        if (IsQrisSuccess(result)) return Task.FromResult(BuildQrisPatch(result));

        return Task.FromResult(new EdcJobPatch
        {
            Status = "FAILED",
            ResponseCode = result.ResponseCode,
            ErrorMessage = result.ErrorMessage ?? "Status QRIS tidak dapat dikonfirmasi — cek layar/struk EDC manual",
        });
    }

    private static bool IsQrisSuccess(EdcQrisResult result) =>
        result.Approved || string.Equals(result.StatusTransaksi, "SUKSES", StringComparison.OrdinalIgnoreCase);

    private static EdcJobPatch BuildQrisPatch(EdcQrisResult result) => new()
    {
        Status = "APPROVED",
        ApprovalCode = result.ReferenceId,
        TraceNumber = result.ReferenceNumber,
        CardType = "QRIS",
        Pan = result.CustomerPan,
        ResponseCode = result.ResponseCode,
        RawResponseData = result.RawResponseData,
    };

    private async Task PatchJobAsync(string jobId, EdcJobPatch patch, CancellationToken cancellationToken)
    {
        var response = await _http.PatchAsJsonAsync($"/api/edc-jobs/{jobId}", patch, JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            Console.WriteLine($"[EdcDaemon] PATCH /api/edc-jobs/{jobId} failed: {response.StatusCode} {body}");
        }
    }
}

internal sealed class EdcJobsResponse
{
    public List<EdcJobDto>? Jobs { get; set; }
}

internal sealed class EdcJobDto
{
    public string Id { get; set; } = "";
    public string OrderId { get; set; } = "";
    public int Amount { get; set; }
    public string Status { get; set; } = "";
    public string Method { get; set; } = "CARD";
}

internal sealed class EdcJobPatch
{
    public required string Status { get; init; }
    public string? ApprovalCode { get; init; }
    public string? TraceNumber { get; init; }
    public string? CardType { get; init; }
    public string? Pan { get; init; }
    public string? ResponseCode { get; init; }
    public string? RawResponseData { get; init; }
    public string? ErrorMessage { get; init; }
}
