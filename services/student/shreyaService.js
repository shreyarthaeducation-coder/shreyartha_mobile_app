// services/student/shreyaService.js
// Mirrors: frontendmain/src/student/components/StudentChatbot/StudentChatbot.js
// Backend: infrastructure/shreya/ShreyaController.java (the STUDENT one — the class with no
//          role prefix in its name is the student's; the parent and teacher have their own).
//
// The transport lives in services/shreyaApi.js, shared with the parent and teacher portals. The
// DTOs are literally the same classes on all three — SectionSummaryRequest, ShreyaChatRequest,
// ShreyaReplyResponse, SubTile and ChapterLink all live in one package — and the error contract is
// identical. See that file for what /history, /section-summary and /chat each do when the AI
// provider fails; the three behave differently and the UI depends on the difference.
//
// GROUNDED IN MY ANALYTICS. `ShreyaContextService` builds the prompt context from this student's
// own records, resolved from the JWT. The client sends no student identifier.

import studentApi from '../studentApi';
import { createShreyaService, CHAT_HISTORY_WINDOW } from '../shreyaApi';

const { fetchChatHistory, fetchSectionSummary, sendChatMessage } = createShreyaService({
  client: studentApi,
  base: '/api/student/shreya',
});

export { fetchChatHistory, fetchSectionSummary, sendChatMessage, CHAT_HISTORY_WINDOW };
