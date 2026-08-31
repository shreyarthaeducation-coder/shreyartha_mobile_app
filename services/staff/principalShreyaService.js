// services/staff/principalShreyaService.js
// Backend: infrastructure/shreya/PrincipalShreyaController.java
//          @PreAuthorize("hasRole('SCHOOL_ADMIN')") — a Principal reaches it through
//          `PRINCIPAL implies SCHOOL_ADMIN` in the role hierarchy.
//
// The transport is the shared factory, as the teacher and parent services are: the four Shreya
// controllers share their DTOs as literal classes and share an error contract, so only the base
// path and the client differ.
//
// ── WHY THIS IS NOT services/teacher/shreyaService WITH A DIFFERENT BASE ─────
// It very nearly is, and that is the point of the factory. It is a separate FILE because the two
// namespaces have different role sets and different grounding, and a single service switching its
// base on a role argument would make "which Shreya am I talking to" a runtime question at every
// call site rather than an import-time one.

import { staffApi } from '../staffApi';
import { createShreyaService, CHAT_HISTORY_WINDOW } from '../shreyaApi';

const { fetchChatHistory, fetchSectionSummary, sendChatMessage } = createShreyaService({
  client: staffApi,
  base: '/api/principal/shreya',
});

export { fetchChatHistory, fetchSectionSummary, sendChatMessage, CHAT_HISTORY_WINDOW };
