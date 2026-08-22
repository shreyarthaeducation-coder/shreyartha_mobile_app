import { PartnerBankInfoScreen } from '../../components/partner';

/**
 * Bank Information — native.
 *
 * This file no longer imports the WebView fallback — which is exactly how constants/partnerMenu.js
 * defines a finished tile, and how scripts/checkpartner.mjs detects one (a plain substring check,
 * so the fallback's name must not appear here even in a comment).
 *
 * The menu entry keeps its `web` path so the checker can still cross-check the tile set against
 * the website's sidebar.
 */
export default function PartnerBankInfo() {
  return <PartnerBankInfoScreen />;
}
