import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { PDFDocument } from 'pdf-lib';
import { REPORT_CONFIG, STREAM_CONFIG, fitLevel, reportFor } from '../constants/psychometricReports';

/**
 * The printable psychometric report: the authored Assessment Framework document as the front
 * page(s), then the student's report.
 *
 * Mirrors `frontendmain/src/student/platform/PsychometricAssessment/psychometricPdfUtils.js`, and
 * deliberately diverges from it in one respect. The web RASTERISES the live DOM with html2canvas and
 * slices the resulting tall bitmap across A4 pages, which is why it needs `MIN_PAGE_FILL`,
 * `ORPHAN_HEADING_GAP` and a block-measuring pass: cutting a bitmap at a fixed interval slices
 * through cards and strands headings. Here the report is authored as real HTML and handed to the
 * platform's own print engine, which paginates semantically — so `page-break-inside: avoid` on each
 * card does the same job exactly, and porting those two constants would have been carrying the
 * workaround without the problem.
 *
 * THE MERGE DEGRADES, IT DOES NOT FAIL. Every step that can fail — reading the bundled framework
 * PDF, parsing it, merging — falls back to the report-only PDF, which is the web's behaviour too. A
 * student who taps Download must get their report; the cover page is not worth failing over.
 */

/** Bundled at build time. Metro treats .pdf as an asset, so this resolves to a local file. */
const FRAMEWORK_PDF = require('../assets/docs/Psychometric_Assessment_Framework.pdf');

const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/** Everything interpolated into the HTML goes through this — a student's own name reaches it. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The report's only band boundary, matching PsychometricReport's `bandColor`. */
const bandColor = (pct) => (pct >= 50 ? '#16a34a' : '#d97706');

/* ── HTML ────────────────────────────────────────────────────────────────── */

const STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Roboto, sans-serif;
    color: #1e293b; margin: 0; padding: 28px 26px; font-size: 12px; line-height: 1.55;
  }
  h1 { font-size: 21px; margin: 0 0 2px; color: #0f172a; }
  .sub { font-size: 12px; color: #475569; margin: 0; }
  .who { font-size: 11.5px; color: #64748b; margin: 2px 0 0; }
  .headline { text-align: center; margin: 20px 0 6px; }
  .headline .value { font-size: 38px; font-weight: 800; color: #4f46e5; line-height: 1; }
  .headline .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .5px; }
  .meta { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 20px; }
  .meta span { margin: 0 7px; }

  /* One card per category. This is the whole of the web's pagination logic on mobile: the print
     engine keeps each card intact and moves its heading with it, so nothing is sliced or stranded. */
  .card {
    border: 1px solid #e2e8f0; border-radius: 10px; padding: 13px 14px; margin-bottom: 11px;
    page-break-inside: avoid; break-inside: avoid;
  }
  .card h2 { font-size: 13.5px; margin: 0; color: #0f172a; }
  .hint { font-size: 10.5px; color: #64748b; margin: 1px 0 0; }
  .rowhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .pct { font-size: 15px; font-weight: 800; white-space: nowrap; }
  .track { height: 8px; border-radius: 4px; background: #e2e8f0; overflow: hidden; margin: 9px 0 8px; }
  .fill { height: 100%; border-radius: 4px; }
  .badge {
    display: inline-block; font-size: 9.5px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .4px; padding: 3px 9px; border-radius: 999px;
  }
  .badge.up { background: #dcfce7; color: #166534; }
  .badge.dn { background: #fef3c7; color: #92400e; }
  .remark { font-size: 11.5px; color: #475569; margin: 8px 0 0; }
  .tips { margin-top: 9px; padding: 9px 11px; background: #f1f5f9; border-radius: 8px; }
  .tips .t { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .4px; }
  .tips li { font-size: 11px; color: #475569; }
  .tips ul { margin: 4px 0 0; padding-left: 16px; }
  .foot { margin-top: 18px; font-size: 9.5px; color: #94a3b8; text-align: center; }
`;

function categoryCard(row) {
  const pct = clamp(row.value);
  const strong = pct >= 50;
  const tips =
    !strong && row.tips?.length
      ? `<div class="tips"><div class="t">Improvement focus</div><ul>${row.tips
          .map((t) => `<li>${esc(t)}</li>`)
          .join('')}</ul></div>`
      : '';
  return `
    <div class="card">
      <div class="rowhead">
        <div>
          <h2>${esc(row.label)}</h2>
          ${row.hint ? `<p class="hint">${esc(row.hint)}</p>` : ''}
        </div>
        <div class="pct" style="color:${bandColor(pct)}">${pct}%</div>
      </div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${bandColor(pct)}"></div></div>
      <span class="badge ${strong ? 'up' : 'dn'}">${strong ? 'Strength' : 'Development area'}</span>
      <p class="remark">${esc(strong ? row.high : row.low)}</p>
      ${tips}
    </div>`;
}

function streamCard(stream, rank) {
  const pct = clamp(stream.value);
  return `
    <div class="card">
      <div class="rowhead">
        <h2>${esc(stream.icon)} ${esc(stream.title)}</h2>
        <div class="pct" style="color:${esc(stream.color)}">${pct}%</div>
      </div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${esc(stream.color)}"></div></div>
      <span class="badge ${rank === 1 ? 'up' : 'dn'}">${esc(fitLevel(rank))}</span>
      ${rank === 1 ? `<p class="remark">${esc(stream.statement)}</p>` : ''}
    </div>`;
}

/**
 * The report as a standalone HTML document.
 *
 * Mirrors PsychometricReport's two shapes — five configs score categories against the 50%
 * threshold, Stream Aptitude ranks four streams — because a printed report that disagreed with the
 * on-screen one would be worse than no printed report.
 */
export function buildReportHtml({ results, topicType, topicName, studentInfo }) {
  const isStream = topicType === 'streamAptitude';
  const config = reportFor(topicType) || REPORT_CONFIG['3c'];

  let bodyHtml;
  if (isStream) {
    const slice = results[STREAM_CONFIG.resultKey] || {};
    const ranked = STREAM_CONFIG.streams
      .map((s) => ({ ...s, value: Number(slice[s.key] ?? 0) }))
      .sort((a, b) => b.value - a.value);
    bodyHtml = ranked.map((s, i) => streamCard(s, i + 1)).join('');
  } else {
    const slice = results[config.resultKey] || {};
    bodyHtml = config.categories
      .map((c) =>
        categoryCard({
          ...c,
          value: Number(slice[c.key] ?? results.categoryScores?.[c.key]?.percentage ?? 0),
        }),
      )
      .join('');
  }

  const who = studentInfo?.name
    ? `<p class="who">${esc(studentInfo.name)}${
        studentInfo.class && studentInfo.class !== 'N/A' ? ` &middot; Class ${esc(studentInfo.class)}` : ''
      }${studentInfo.school && studentInfo.school !== 'N/A' ? ` &middot; ${esc(studentInfo.school)}` : ''}</p>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${STYLES}</style></head><body>
  <h1>${esc(isStream ? STREAM_CONFIG.title : config.title)}</h1>
  ${topicName ? `<p class="sub">${esc(topicName)}</p>` : ''}
  ${who}
  <div class="headline">
    <div class="value">${clamp(results.overallReadiness)}%</div>
    <div class="label">Overall readiness</div>
  </div>
  <div class="meta">
    <span>${esc(results.answeredQuestions)}/${esc(results.totalQuestions)} answered</span>
    <span>${esc(results.totalScore)}/${esc(results.totalMaxScore)} marks</span>
    <span>${esc(results.assessmentDate)}</span>
  </div>
  ${bodyHtml}
  <p class="foot">The 3C Edge &middot; Psychometric Assessment</p>
</body></html>`;
}

/* ── The framework cover ─────────────────────────────────────────────────── */

/** `%PDF-` — the first five bytes every PDF begins with. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

const isPdfBytes = (bytes) =>
  bytes?.length >= PDF_MAGIC.length && PDF_MAGIC.every((b, i) => bytes[i] === b);

const base64ToBytes = (b64) => {
  const binary = global.atob ? global.atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

/**
 * The bundled framework PDF as bytes, or null.
 *
 * THE MAGIC-BYTE CHECK IS KEPT even though a bundled asset cannot be an SPA's index.html — the
 * failure the web guards against. It stays because the cost is five byte comparisons and the
 * alternative is handing whatever the asset system returned to a parser: in a release build this
 * path is a packaged file, and a truncated or mis-resolved one should degrade to "no cover", not to
 * a broken document.
 */
async function loadFrameworkBytes() {
  try {
    const asset = Asset.fromModule(FRAMEWORK_PDF);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return null;

    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToBytes(b64);
    return isPdfBytes(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Framework pages first, then the report — the web's merge order, and the order the document is
 * written to be read in.
 *
 * @returns {Promise<string|null>} base64 of the merged PDF, or null to use the report alone
 */
async function mergeWithFramework(reportUri) {
  try {
    const coverBytes = await loadFrameworkBytes();
    if (!coverBytes) return null;

    const reportB64 = await FileSystem.readAsStringAsync(reportUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const reportBytes = base64ToBytes(reportB64);
    if (!isPdfBytes(reportBytes)) return null;

    const merged = await PDFDocument.create();
    const coverDoc = await PDFDocument.load(coverBytes);
    const reportDoc = await PDFDocument.load(reportBytes);

    const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach((p) => merged.addPage(p));
    const reportPages = await merged.copyPages(reportDoc, reportDoc.getPageIndices());
    reportPages.forEach((p) => merged.addPage(p));

    return await merged.saveAsBase64();
  } catch {
    // pdf-lib is pure JS but not a small amount of it; a parse or memory failure here must cost the
    // cover page, never the report.
    return null;
  }
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

/**
 * Build the report PDF, prepend the framework cover when possible, and hand it to the share sheet.
 *
 * @returns {Promise<{shared: boolean, uri: string, withCover: boolean}>}
 */
export async function downloadPsychometricPdf({ results, topicType, topicName, studentInfo }) {
  const html = buildReportHtml({ results, topicType, topicName, studentInfo });
  const { uri: reportUri } = await Print.printToFileAsync({ html, base64: false });

  let finalUri = reportUri;
  let withCover = false;

  const mergedB64 = await mergeWithFramework(reportUri);
  if (mergedB64) {
    const target = `${FileSystem.cacheDirectory}psychometric-report-${Date.now()}.pdf`;
    await FileSystem.writeAsStringAsync(target, mergedB64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    finalUri = target;
    withCover = true;
  }

  if (!(await Sharing.isAvailableAsync())) {
    return { shared: false, uri: finalUri, withCover };
  }

  await Sharing.shareAsync(finalUri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Psychometric Report',
    UTI: 'com.adobe.pdf',
  });
  return { shared: true, uri: finalUri, withCover };
}
