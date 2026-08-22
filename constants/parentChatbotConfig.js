// constants/parentChatbotConfig.js
// The `config` object that turns the shared ShreyaChatSheet into the parent's Shreya.
//
// Everything portal-specific about the chatbot lives here: which sections exist, which static text
// stands in when the AI is down, which HTTP client carries the token, which storage key holds the
// user's name, and how the greeting reads. The sheet itself knows none of it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PARENT_SECTIONS,
  buildParentSectionExplanation,
  resolveParentLink,
} from './parentChatbotData';
import * as parentShreya from '../services/parent/shreyaService';

/**
 * Mirrors ParentChatbot.js `greetingText()` verbatim, including the `**bold**` on the child's name —
 * the sheet's RichLine renders that.
 *
 * The web falls back to fetching `/linked-student` when `linkedStudentName` is missing from storage.
 * Here it is not worth a request: the parent home already fetched that child and wrote nothing back,
 * so a miss just means the shorter greeting, which is the web's own second branch.
 */
async function parentGreeting(name) {
  let child = '';
  try {
    child = (await AsyncStorage.getItem('linkedStudentName')) || '';
  } catch {
    // No child name — fall through to the generic greeting.
  }
  return child
    ? `Hi ${name}, ask me anything about **${child}'s** progress. What would you like to look at?`
    : `Hi ${name}, what can I help you with?`;
}

export const PARENT_CHATBOT_CONFIG = {
  sections: PARENT_SECTIONS,
  buildExplanation: buildParentSectionExplanation,
  service: parentShreya,
  nameKey: 'parentUserName',
  greeting: parentGreeting,
  resolveLink: resolveParentLink,
};
