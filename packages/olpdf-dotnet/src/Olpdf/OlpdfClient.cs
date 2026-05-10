using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Olpdf;

/// <summary>C# client for the OLPDF REST API.</summary>
public sealed class OlpdfClient : IDisposable
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
    };

    public OlpdfClient(string apiKey, string baseUrl = "https://api.olpdf.xyz")
    {
        _http = new HttpClient { BaseAddress = new Uri(baseUrl.TrimEnd('/') + '/') };
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    /// <summary>Extract semantic blocks from a PDF at the given URL.</summary>
    public Task<ExtractResponse> ExtractAsync(string url, string mode = "semantic",
        CancellationToken ct = default)
        => PostAsync<ExtractResponse>("v1/extract",
            new { url, mode }, ct);

    /// <summary>Fetch the full document model by ID.</summary>
    public Task<DocumentModel> GetDocumentAsync(string documentId,
        CancellationToken ct = default)
        => GetAsync<DocumentModel>($"api/documents/{documentId}", ct);

    /// <summary>Save an updated document model.</summary>
    public Task<DocumentModel> SaveDocumentAsync(string documentId,
        DocumentModel model, CancellationToken ct = default)
        => PutAsync<DocumentModel>($"api/documents/{documentId}",
            new { document_model = model }, ct);

    /// <summary>Export a document. format: "pdf" | "epub" | "pdf_a" | "tagged"</summary>
    public async Task<byte[]> ExportAsync(string documentId,
        string format = "pdf", CancellationToken ct = default)
    {
        var resp = await _http.PostAsync(
            $"api/documents/{documentId}/export/{format}", null, ct);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    // ── AI ────────────────────────────────────────────────────────────────────

    /// <summary>Run a natural-language instruction on a document.</summary>
    public Task<AiEditResponse> InstructAsync(string documentId,
        string instruction, CancellationToken ct = default)
        => PostAsync<AiEditResponse>(
            $"api/ai/documents/{documentId}/instruction",
            new { instruction }, ct);

    /// <summary>Rewrite a block with a specific tone.</summary>
    public Task<AiEditResponse> RewriteWithToneAsync(string documentId,
        string blockId, string tone, CancellationToken ct = default)
        => InstructAsync(documentId,
            $"Rewrite block {blockId} with a {tone} tone.", ct);

    // ── PDF Toolkit ───────────────────────────────────────────────────────────

    /// <summary>Merge multiple documents into one PDF.</summary>
    public Task<MergeResponse> MergeAsync(IEnumerable<string> docIds,
        CancellationToken ct = default)
        => PostAsync<MergeResponse>("api/pdf/merge",
            new { doc_ids = docIds }, ct);

    /// <summary>Split a document into page ranges.</summary>
    public Task<SplitResponse> SplitAsync(string documentId,
        IEnumerable<PageRange> ranges, CancellationToken ct = default)
        => PostAsync<SplitResponse>($"api/pdf/split",
            new { document_id = documentId, page_ranges = ranges }, ct);

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<T> GetAsync<T>(string path, CancellationToken ct)
    {
        var resp = await _http.GetAsync(path, ct);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<T>(_json, ct))!;
    }

    private async Task<T> PostAsync<T>(string path, object body, CancellationToken ct)
    {
        var resp = await _http.PostAsJsonAsync(path, body, _json, ct);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<T>(_json, ct))!;
    }

    private async Task<T> PutAsync<T>(string path, object body, CancellationToken ct)
    {
        var resp = await _http.PutAsJsonAsync(path, body, _json, ct);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<T>(_json, ct))!;
    }

    public void Dispose() => _http.Dispose();
}
