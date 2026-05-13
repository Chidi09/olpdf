// Citation Cleaner v1.0.0
// Scans document blocks for citation-like text patterns and normalizes
// spacing, punctuation, and format consistency.

var CITATION_PATTERNS = [
  /\(([A-Z][a-z]+(?:\s+et\s+al\.)?,\s+\d{4})\)/g,
  /\[(\d+(?:[-,]\s*\d+)*)\]/g,
  /\(([A-Z][a-z]+(?:\s+(?:and|&)\s+[A-Z][a-z]+)?,\s+\d{4}(?:,\s+p\.\s*\d+)?)\)/g,
];

var NORMALIZED_FORMATS = {
  parenYear: function(match, content) {
    return '(' + content.trim() + ')';
  },
  bracketRef: function(match, content) {
    return '[' + content.trim() + ']';
  }
};

self.onDocumentLoad = async function(olpdf, args) {
  var blocks = olpdf.getBlocks();
  var cleanedCount = 0;
  var issues = [];

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block.content || !block.content.text) continue;

    var text = block.content.text;
    var original = text;
    var blockIssues = [];

    // Normalize citation spacing: remove extra spaces inside parentheses
    text = text.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    text = text.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']');

    // Normalize comma spacing in citations
    text = text.replace(/(\w),(\d{4})/g, '$1, $2');

    // Detect "et al." variations
    text = text.replace(/\bet\s*al\b/gi, 'et al.');

    // Detect leading conjunctions in citations
    text = text.replace(/\(see\s+/gi, '(');

    // Count changes
    if (text !== original) {
      cleanedCount++;
      blockIssues.push('citation spacing');
      olpdf.updateBlock(block.id, text);
    }

    if (blockIssues.length > 0) {
      issues.push({ blockId: block.id, fixes: blockIssues });
    }
  }

  var msg = 'Citation Cleaner: Cleaned ' + cleanedCount + ' block' + (cleanedCount !== 1 ? 's' : '');
  if (cleanedCount > 0) {
    olpdf.notify(msg, 'info');
  } else {
    olpdf.notify('Citation Cleaner: No citations found to clean.', 'info');
  }
};
