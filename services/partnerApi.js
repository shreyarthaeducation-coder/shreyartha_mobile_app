// services/partnerApi.js
// The HTTP client for the native partner panel.
//
// See services/portalApi.js for why this is not services/apiService.js. The partner case is the
// sharpest illustration: `GET /api/partner/analytics/linked-partners` refuses a non-master with
// **HTTP 400, not 403** — PartnerAnalyticsService throws
// IllegalStateException("Only Master Partners can view linked partners.") and the controller maps
// that to 400 with `{success:false, message}`. So read `message`, never switch on the status.
//
// ENDPOINT SPELLING is singular throughout — `/api/partner/...`; there is no `/api/partners/`.
// The surface is split across three bases that do NOT nest:
//   /api/partner/profile          the shell's identity + partnerType + linkedSchoolCodes
//   /api/partner/analytics/**     school students, monetization, linked partners, earnings
//   /api/partner/bank-details/**  the portal's only form, plus the UPI image upload
//
// UNVERIFIED_PARTNER IS GRANTED NOTHING. Unlike the parent role, which at least reaches
// change-password, no @PreAuthorize anywhere names UNVERIFIED_PARTNER — so every call in this
// panel fails until an admin verifies the account. The shell must gate on that before fetching,
// or an unverified partner sees a screen of errors instead of the pending-verification page.

import { createPortalApi } from './portalApi';

export const partnerApi = createPortalApi({
  name: 'Partner',
  tokenKey: 'partnerUserToken',
  loginRoute: '/auth/partner-login',
});

export default partnerApi;
