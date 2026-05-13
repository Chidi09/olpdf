// Table Extractor v1.0.0
// Detects tabular regions in document blocks and exports table data
// in CSV, Markdown, or JSON format.

var TABLE_DELIMITERS = [
  /\t/,
  /\s{2,}/,
  /\|/,
  /,\s/,
];

var TABLE_ROW_PATTERNS = [
  /^\s*\|.+\|\s*$/m,
  /^[\d\s,.$%€£]+\t[\d\s,.$%€£]+/m,
  /^[\w\s]+\s{2,}[\w\s]+/m,
];

var HEADER_ROW_PATTERNS = [
  /^[\w\s]+\t[\w\s]+(\t[\w\s]+)*$/m,
  /^\|?\s*[\w\s]+\s*\|.*\|?\s*$/m,
  /^[\w\s]+\s{3,}[\w\s]+/m,
];

function detectTables(text) {
  var lines = text.split('\n');
  var tables = [];
  var currentTable = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    // Detect separator lines (common in markdown tables)
    if (/^[\|\s\-:]+$/.test(line) && currentTable) {
      currentTable.isMarkdown = true;
      continue;
    }

    var isRow = false;
    for (var d = 0; d < TABLE_DELIMITERS.length; d++) {
      if (TABLE_DELIMITERS[d].test(line) && line.split(TABLE_DELIMITERS[d]).length >= 2) {
        isRow = true;
        break;
      }
    }

    if (isRow) {
      if (!currentTable) {
        currentTable = { rows: [], startLine: i };
      }
      currentTable.rows.push(line);
    } else {
      if (currentTable && currentTable.rows.length >= 2) {
        tables.push({
          rowCount: currentTable.rows.length,
          startLine: currentTable.startLine,
          endLine: i - 1,
          preview: currentTable.rows.slice(0, 3).join(' | '),
          hasMarkdownHeader: currentTable.isMarkdown || HEADER_ROW_PATTERNS.some(function(p) { return p.test(currentTable.rows[0]); })
        });
      }
      currentTable = null;
    }
  }

  // Handle table at end of text
  if (currentTable && currentTable.rows.length >= 2) {
    tables.push({
      rowCount: currentTable.rows.length,
      startLine: currentTable.startLine,
      endLine: lines.length - 1,
      preview: currentTable.rows.slice(0, 3).join(' | '),
      hasMarkdownHeader: currentTable.isMarkdown || HEADER_ROW_PATTERNS.some(function(p) { return p.test(currentTable.rows[0]); })
    });
  }

  return tables;
}

function toCSV(text) {
  var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
  return lines.map(function(line) {
    var cells = line.split('\t').length > 1 ? line.split('\t') : line.split(/\s{2,}/);
    return cells.map(function(c) { return '"' + c.trim().replace(/"/g, '""') + '"'; }).join(',');
  }).join('\n');
}

function toMarkdown(text) {
  var lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
  if (lines.length < 2) return text;
  var header = lines[0];
  var separator = '|' + header.split(/\t|\s{2,}|\|/).filter(function(c) { return c.trim(); }).map(function() { return ' --- '; }).join('|') + '|';
  return lines.map(function(line) {
    var cells = line.split('\t').length > 1 ? line.split('\t') : line.split(/\s{2,}/);
    return '| ' + cells.map(function(c) { return c.trim(); }).join(' | ') + ' |';
  }).join('\n');
}

self.onDocumentLoad = async function(olpdf, args) {
  var blocks = olpdf.getBlocks();
  var tableCount = 0;
  var totalRows = 0;

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block.content || !block.content.text) continue;
    var tables = detectTables(block.content.text);
    tableCount += tables.length;
    tables.forEach(function(t) { totalRows += t.rowCount; });
  }

  if (tableCount > 0) {
    olpdf.notify(
      'Table Extractor: Detected ' + tableCount + ' table' + (tableCount !== 1 ? 's' : '') + ' (' + totalRows + ' rows total). Select a region and use "Extract" to export.',
      'info'
    );
  }
};

self.onSelection = async function(olpdf, args) {
  if (!args || !args.text) {
    olpdf.notify('Table Extractor: Select the table region first.', 'info');
    return;
  }

  var tables = detectTables(args.text);
  if (tables.length === 0) {
    olpdf.notify('Table Extractor: No tabular data detected in selection. Try selecting a wider region.', 'error');
    return;
  }

  var csv = toCSV(args.text);
  var md = toMarkdown(args.text);

  olpdf.notify(
    'Table Extractor: Extracted ' + tables.length + ' table' + (tables.length !== 1 ? 's' : '') + ' (' + tables[0].rowCount + ' rows). CSV and Markdown ready.',
    'info'
  );
};
