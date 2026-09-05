import { gstLabel, humanise, inr, shortDate } from './salesFormat';

/**
 * The quotation, as printable HTML for expo-print.
 *
 * HTML rather than a PDF library because `printToFileAsync` already ships with the app and this
 * document is a table — pulling in a layout engine to draw nine rows would be weight for nothing.
 * The web panel renders the same content with jspdf; both read the identical
 * /deals/{id}/quotation payload, so the two documents carry the same numbers.
 *
 * It is a QUOTATION, not a tax invoice, and says so at the foot. No GSTIN and no invoice number:
 * something that reads as a tax invoice must not be issuable from a rep's phone, and the accounts
 * team raises the real one.
 */

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function quotationHtml(deal) {
  const rows = (deal.items || [])
    .map((item) => {
      const perStudent = item.pricingMode === 'PER_STUDENT_PER_MONTH';
      return `
        <tr>
          <td>${esc(item.productName)}</td>
          <td>${esc(item.grade || '—')}</td>
          <td class="n">${perStudent ? esc(item.studentCount ?? 0) : '—'}</td>
          <td class="n">${perStudent ? esc(item.months ?? 0) : '—'}</td>
          <td class="n">${esc(inr(item.unitPriceInr, { decimals: false }))}</td>
          <td class="n">${esc(inr(item.lineBaseInr))}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0f172a; padding: 28px; }
  h1 { font-size: 19px; color: #312e81; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 0 0 18px; font-weight: 600; }
  .muted { color: #64748b; font-size: 11px; }
  .row { display: flex; justify-content: space-between; align-items: flex-end; }
  hr { border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { text-align: left; color: #64748b; font-size: 10px; text-transform: uppercase;
       letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; padding: 7px 5px; }
  td { padding: 7px 5px; border-bottom: 1px solid #f1f5f9; }
  td.n, th.n { text-align: right; }
  .totals { margin-top: 14px; width: 100%; font-size: 12px; }
  .totals td { border: 0; padding: 3px 5px; }
  .totals td:first-child { text-align: right; color: #64748b; }
  .totals td:last-child { text-align: right; width: 130px; }
  .totals tr.grand td { font-weight: 700; font-size: 13.5px; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .words { font-size: 11px; color: #64748b; margin-top: 12px; }
  .foot { font-size: 9.5px; color: #94a3b8; margin-top: 22px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="row">
    <div>
      <h1>The 3C Edge — Shreyartha</h1>
      <h2>Quotation</h2>
    </div>
    <div class="muted" style="text-align:right">
      ${esc(deal.quotationNumber || '')}<br />
      ${esc(shortDate(deal.createdAt))}
    </div>
  </div>

  <hr />

  <div class="muted">Prepared for</div>
  <div style="font-size:14px;font-weight:600;margin-top:3px">${esc(deal.schoolName || '—')}</div>
  ${deal.schoolCode ? `<div class="muted">School code: ${esc(deal.schoolCode)}</div>` : ''}

  <hr />

  <table>
    <thead>
      <tr>
        <th>Product</th><th>Grade</th><th class="n">Students</th>
        <th class="n">Months</th><th class="n">Rate</th><th class="n">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td>${esc(inr(deal.baseAmountInr))}</td></tr>
    <!-- gstLabel() prefers the deal's own snapshotted rate, so a quotation reprinted after a
         statutory rate change still shows the rate the school was actually quoted. -->
    <tr><td>${esc(gstLabel(deal))}</td><td>${esc(inr(deal.gstAmountInr))}</td></tr>
    <tr class="grand"><td>Total</td><td>${esc(inr(deal.totalAmountInr))}</td></tr>
  </table>

  ${deal.amountInWords ? `<div class="words">${esc(deal.amountInWords)}</div>` : ''}
  ${deal.paymentMethod ? `<div class="words">Proposed method of payment: ${esc(humanise(deal.paymentMethod))}</div>` : ''}

  <div class="foot">
    This is a quotation and not a tax invoice. Prices are exclusive of GST, which is shown
    separately above. Validity 30 days from the date of issue.
  </div>
</body>
</html>`;
}
