// services/partner/shreyaService.js
// Mirrors: frontendmain/src/Partner/platform/components/PartnerChatbot/PartnerChatbot.js
// Backend: infrastructure/shreya/PartnerShreyaController.java
//          @PreAuthorize("hasRole('PARTNER')") at class level — an UNVERIFIED_PARTNER is refused.
//
// The transport lives in services/shreyaApi.js, shared with the teacher, parent, principal and
// student portals — the DTOs are the same classes on the server, not parallel copies.
//
// GROUNDED IN THE PARTNER'S OWN ACCOUNT. `PartnerShreyaContextService` resolves everything from the
// JWT's email; the only identifier the client ever sends back is a sub-tile's opaque itemKey
// (`school|CODE`, `fy|2026`, `class|<name>`), and the server refuses a school that is not linked.

import partnerApi from '../partnerApi';
import { createShreyaService, CHAT_HISTORY_WINDOW } from '../shreyaApi';

const { fetchChatHistory, fetchSectionSummary, sendChatMessage } = createShreyaService({
  client: partnerApi,
  base: '/api/partner/shreya',
});

export { fetchChatHistory, fetchSectionSummary, sendChatMessage, CHAT_HISTORY_WINDOW };
