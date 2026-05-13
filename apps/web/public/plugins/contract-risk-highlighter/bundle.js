// Contract Risk Highlighter v1.0.0
// Scans document blocks for risky clauses, missing dates, ambiguous language,
// and missing signature blocks.

var RISK_PATTERNS = [
  { pattern: /best efforts|reasonable endeavours|commercially reasonable/gi, label: 'ambiguous obligation', severity: 'medium' },
  { pattern: /material adverse change|MAC/i, label: 'undefined MAC clause', severity: 'high' },
  { pattern: /indemnify|hold harmless/gi, label: 'indemnification clause', severity: 'info' },
  { pattern: /\bconfidential\b(?!ity)/gi, label: 'confidentiality reference', severity: 'info' },
  { pattern: /time is of the essence/gi, label: 'strict deadline clause', severity: 'high' },
  { pattern: /as is|as-is|without warranty/gi, label: 'no warranty clause', severity: 'high' },
  { pattern: /unilateral right|sole discretion/gi, label: 'unilateral control clause', severity: 'high' },
  { pattern: /non[- ]?compete|non[- ]?solicit/gi, label: 'restrictive covenant', severity: 'medium' },
  { pattern: /limitation of liability|cap on liability/gi, label: 'liability cap', severity: 'info' },
  { pattern: /force majeure/gi, label: 'force majeure clause', severity: 'info' },
  { pattern: /auto[- ]?renew|automatic renewal/gi, label: 'auto-renewal clause', severity: 'medium' },
  { pattern: /governing law|jurisdiction/gi, label: 'jurisdiction clause', severity: 'info' },
  { pattern: /arbitration|binding arbitration/gi, label: 'arbitration clause', severity: 'info' },
  { pattern: /severability|savings clause/gi, label: 'severability clause', severity: 'info' },
  { pattern: /entire agreement|merger clause/gi, label: 'entire agreement clause', severity: 'info' },
];

var MISSING_DATE = /_(?!_)(date|dd|mm|yyyy|year)/gi;
var SIGNATURE_BLOCK = /signature|signed|executed|witness/i;
var MISSING_SIGNATURE = /signature\s*:?\s*_{2,}/gi;

self.onDocumentLoad = async function(olpdf, args) {
  var blocks = olpdf.getBlocks();
  var findings = [];
  var hasSignatureSection = false;

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (!block.content || !block.content.text) continue;
    var text = block.content.text;
    var blockFindings = [];

    // Check for signature section
    if (SIGNATURE_BLOCK.test(text)) {
      hasSignatureSection = true;
    }

    // Check for missing dates
    if (MISSING_DATE.test(text)) {
      blockFindings.push({ label: 'missing date placeholder', severity: 'medium' });
    }

    // Check for missing signature lines
    if (MISSING_SIGNATURE.test(text)) {
      blockFindings.push({ label: 'incomplete signature block', severity: 'high' });
    }

    // Pattern matching
    for (var p = 0; p < RISK_PATTERNS.length; p++) {
      if (RISK_PATTERNS[p].pattern.test(text)) {
        blockFindings.push({ label: RISK_PATTERNS[p].label, severity: RISK_PATTERNS[p].severity });
      }
    }

    if (blockFindings.length > 0) {
      findings.push({ blockId: block.id, items: blockFindings });
    }
  }

  if (!hasSignatureSection) {
    findings.push({ blockId: 'document', items: [{ label: 'no signature section found', severity: 'high' }] });
  }

  var riskCount = findings.filter(function(f) { return f.items.some(function(i) { return i.severity === 'high'; }); }).length;
  var totalFindings = findings.reduce(function(sum, f) { return sum + f.items.length; }, 0);

  var msg = 'Risk Highlighter: Found ' + totalFindings + ' issue' + (totalFindings !== 1 ? 's' : '');
  if (riskCount > 0) {
    msg += ' (' + riskCount + ' high severity)';
  }
  olpdf.notify(msg, riskCount > 0 ? 'error' : 'info');
};
