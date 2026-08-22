// services/parent/shreyaService.js
// Mirrors: frontendmain/src/Parent/platform/components/ParentChatbot/ParentChatbot.js
// Backend: infrastructure/shreya/ParentShreyaController.java
//          @PreAuthorize("hasRole('PARENT')") at class level.
//
// The transport lives in services/shreyaApi.js, shared with the teacher portal — the DTOs are the
// same classes on both sides, not parallel copies, and the error contract is identical. See that
// file for what /history, /section-summary and /chat each do when the AI provider fails; the three
// behave differently and the UI depends on the difference.
//
// GROUNDED IN THE LINKED CHILD. `ParentShreyaContextService` builds the prompt context from the
// parent's linked student — the same one every /api/parent/dashboard/* endpoint resolves from the
// JWT. The client sends no student identifier, here or anywhere else in this portal.

import { parentApi } from '../parentApi';
import { createShreyaService, CHAT_HISTORY_WINDOW } from '../shreyaApi';

const { fetchChatHistory, fetchSectionSummary, sendChatMessage } = createShreyaService({
  client: parentApi,
  base: '/api/parent/shreya',
});

export { fetchChatHistory, fetchSectionSummary, sendChatMessage, CHAT_HISTORY_WINDOW };
