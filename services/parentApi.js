// services/parentApi.js
// The HTTP client for the native parent panel.
//
// See services/portalApi.js for why this is not services/apiService.js: a 403 here is routine —
// an unverified parent hitting /api/parent/fees, or a child who is not a school student hitting
// attendance — and apiService would end the session on every one of them.
//
// ENDPOINT SPELLING. The parent surface is entirely SINGULAR: `/api/parent/...`. There is no
// `/api/parents/` controller anywhere in the backend. Two dead stubs exist in the older service
// layer — `services/profileService.js` calls `/api/parent/profile` and `services/dashboardService.js`
// calls `/api/parent/dashboard` — and NEITHER endpoint exists (the dashboard controller has no root
// mapping). Ignore both; they would 404.
//
// THE CHILD IS NEVER A PARAMETER. Every `/api/parent/dashboard/*` endpoint resolves the linked
// student from the JWT subject — `ParentDashboardService.resolveLinkedStudent(parentEmail)` — and
// the controller deliberately accepts no `studentId`, which is what prevents cross-parent access.
// A parent has exactly one linked student, so there is no switcher to build.
//
// THE FEE ENDPOINTS ARE STRICTER than the rest: `ParentFeeController.resolveStudentId` additionally
// throws 403 when the parent is not verified, and 404 when no student is linked. So an unverified
// parent gets a renderable refusal there, not an empty list.

import { createPortalApi } from './portalApi';

export const parentApi = createPortalApi({
  name: 'Parent',
  tokenKey: 'parentUserToken',
  loginRoute: '/auth/parent-login',
});

export default parentApi;
