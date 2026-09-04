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
        var response = await _http.GetFromJsonAsync<EdcJobsResponse>(
            "/api/edc-jobs?status=PENDING&limit=1", JsonOptions, cancellationToken);

        var job = response?.Jobs?.FirstOrDefault();
        if (job is null) return;

        Console.WriteLine($"[EdcDaemon] Job {job.Id} — order {job.OrderId}, amount Rp{job.Amount}");

        await PatchJobAsync(job.Id, new EdcJobPatch { Status = "PROCESSING" }, cancellationToken);

        var result = _edcClient.Purchase(job.Amount.ToString());

        var patch = result.RawResponseData is not null
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

        await PatchJobAsync(job.Id, patch, cancellationToken);

        Console.WriteLine(result.Approved
            ? $"[EdcDaemon] Job {job.Id} APPROVED (approvalCode={result.ApprovalCode})"
            : $"[EdcDaemon] Job {job.Id} {patch.Status} ({result.ErrorMessage})");
    }

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
