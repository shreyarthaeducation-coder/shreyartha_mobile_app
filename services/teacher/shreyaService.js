// services/teacher/shreyaService.js
// Mirrors: frontendmain/src/School/Teacher/components/TeacherChatbot/TeacherChatbot.js
// Backend: infrastructure/shreya/TeacherShreyaController.java
//          @PreAuthorize("hasAnyRole('TEACHER','SHREYARTHA_TEACHER')") — Portal B gets this free.
//
// The transport lives in services/shreyaApi.js, shared with the parent portal: the three Shreya
// controllers share their DTOs as literal classes and share an error contract, so only the base
// path and the client differ. That file documents the contract; this one just names the namespace.

import { staffApi } from '../staffApi';
import { createShreyaService, CHAT_HISTORY_WINDOW } from '../shreyaApi';

const { fetchChatHistory, fetchSectionSummary, sendChatMessage } = createShreyaService({
  client: staffApi,
  base: '/api/teacher/shreya',
});

export { fetchChatHistory, fetchSectionSummary, sendChatMessage, CHAT_HISTORY_WINDOW };
