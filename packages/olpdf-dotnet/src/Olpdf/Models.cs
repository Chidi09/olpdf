using System.Text.Json.Serialization;

namespace Olpdf;

// ── API response models ────────────────────────────────────────────────────────

public record ExtractResponse(
    [property: JsonPropertyName("blocks")]    List<Block> Blocks,
    [property: JsonPropertyName("meta")]      DocumentMeta? Meta
);

public record DocumentModel(
    [property: JsonPropertyName("blocks")]    List<Block> Blocks,
    [property: JsonPropertyName("meta")]      DocumentMeta? Meta,
    [property: JsonPropertyName("styles")]    object? Styles
);

public record Block(
    [property: JsonPropertyName("id")]               string Id,
    [property: JsonPropertyName("type")]             string Type,
    [property: JsonPropertyName("content")]          string? Content,
    [property: JsonPropertyName("confidence_score")] double? ConfidenceScore,
    [property: JsonPropertyName("needs_review")]     bool NeedsReview,
    [property: JsonPropertyName("bounding_box")]     double[]? BoundingBox
);

public record DocumentMeta(
    [property: JsonPropertyName("title")]     string? Title,
    [property: JsonPropertyName("author")]    string? Author,
    [property: JsonPropertyName("page_size")] string? PageSize
);

public record AiEditResponse(
    [property: JsonPropertyName("log_id")]        string LogId,
    [property: JsonPropertyName("updated_model")] DocumentModel UpdatedModel,
    [property: JsonPropertyName("tool_calls")]    List<object> ToolCalls
);

public record MergeResponse(
    [property: JsonPropertyName("merged_document_id")] string MergedDocumentId
);

public record SplitResponse(
    [property: JsonPropertyName("document_ids")] List<string> DocumentIds
);

public record PageRange(
    [property: JsonPropertyName("start")] int Start,
    [property: JsonPropertyName("end")]   int End
);
