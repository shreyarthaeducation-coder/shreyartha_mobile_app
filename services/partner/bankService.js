// services/partner/bankService.js
// The partner portal's only form: payout bank details plus an optional UPI QR image.
//
// Ports frontendmain/src/Partner/platform/PartnerBankInfo.js, including its four validation
// regexes — those are copied VERBATIM rather than re-derived. An IFSC pattern rewritten from
// memory is the kind of thing that rejects a valid account on a Friday evening.

import partnerApi from '../partnerApi';

/** @returns {Promise<object>} { bankName, accountHolderName, accountNumber, ifscCode, pan, gstin, upiImageUrl, updatedAt } */
export function fetchBankDetails(signal) {
  return partnerApi.get('/api/partner/bank-details', { signal });
}

export function saveBankDetails(payload, signal) {
  return partnerApi.put('/api/partner/bank-details', { body: payload, signal });
}

/**
 * Upload the UPI QR image.
 *
 * The field name is `file` — that is what the @RequestPart is called; anything else is a 400 the
 * form cannot explain. portalApi.multipart raises the timeout to 60s for this.
 *
 * @param {{ uri: string, name?: string, type?: string }} image from utils/filePicker
 */
export function uploadUpiImage(image, signal) {
  return partnerApi.multipart(
    '/api/partner/bank-details/upi-image',
    {
      // `files` is an OBJECT keyed by field name, not an array — see portalApi.multipart. The key
      // IS the @RequestPart name, so it must be exactly `file`.
      files: {
        file: {
          uri: image.uri,
          name: image.name || 'upi.jpg',
          type: image.type || 'image/jpeg',
        },
      },
    },
    { signal },
  );
}

// ── Validation, copied verbatim from PartnerBankInfo.js ─────────────────────────────────────────

export const PATTERNS = {
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  account: /^[0-9]{6,20}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
};

/** Fields the web uppercases as the user types. Doing it on change, not on submit, matters: the
 *  regexes above are all uppercase-only, so a lowercase IFSC would fail validation while looking
 *  perfectly correct on screen. */
export const UPPERCASE_FIELDS = ['ifscCode', 'pan', 'gstin'];

/** Max UPI image size, matching the web's 5 MB guard. */
export const MAX_UPI_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * @returns {Record<string,string>} field → message; empty when the form is valid.
 */
export function validateBankDetails(form) {
  const errors = {};
  const req = (key, label) => {
    if (!String(form?.[key] || '').trim()) errors[key] = `${label} is required.`;
  };

  req('bankName', 'Bank name');
  req('accountHolderName', 'Account holder name');

  const account = String(form?.accountNumber || '').trim();
  if (!account) errors.accountNumber = 'Account number is required.';
  else if (!PATTERNS.account.test(account)) {
    errors.accountNumber = 'Enter a valid account number (6-20 digits).';
  }

  const ifsc = String(form?.ifscCode || '').trim().toUpperCase();
  if (!ifsc) errors.ifscCode = 'IFSC code is required.';
  else if (!PATTERNS.ifsc.test(ifsc)) errors.ifscCode = 'Enter a valid IFSC, e.g. HDFC0001234.';

  // PAN and GSTIN are optional — but must be valid when supplied.
  const pan = String(form?.pan || '').trim().toUpperCase();
  if (pan && !PATTERNS.pan.test(pan)) errors.pan = 'Enter a valid PAN, e.g. ABCDE1234F.';

  const gstin = String(form?.gstin || '').trim().toUpperCase();
  if (gstin && !PATTERNS.gstin.test(gstin)) errors.gstin = 'Enter a valid 15-character GSTIN.';

  return errors;
}
