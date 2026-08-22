// services/student/counselorService.js
// Mirrors: frontendmain/src/student/platform/counselor.js
// Backend: student/controller/StudentCounselorQueryController.java
//          POST /api/student/counselor-queries, @PreAuthorize over the five student roles
//          (FREE_STUDENT, SCHOOL_STUDENT, PREMIUM_STUDENT, COLLEGE_STUDENT, FREE_COLLEGE_STUDENT).

import studentApi from '../studentApi';

/**
 * The three values CounselorQueryService accepts. Anything else is a 400 whose `message` names the
 * allowed set. Kept in the same order and with the same labels as
 * frontendmain/src/common/preferredModes.js, which the web form, chatbot and admin table all share.
 */
export const PREFERRED_MODES = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VIDEO', label: 'Video' },
];

/**
 * The ten topics, verbatim from counselor.js `QUERY_OPTIONS`.
 *
 * These are stored as free text on `CounselorQuery.queryFor` and read by counsellors in the
 * Shreyartha panel, so the wording is a shared vocabulary between two portals — do not tidy it.
 */
export const QUERY_OPTIONS = [
  'Profile Development & Resume Crafting',
  'Assessment Insights',
  'Course & College Advisory',
  'Emerging Skills & Competencies',
  'College Admissions Support',
  'Soft Skills & Personal Growth (emotional & mental wellness, time management)',
  'Academic Support (Math, Science, etc.)',
  'Scholarship Opportunities & Financial Aid',
  'Career Pathway Consultation',
  'Parent Engagement, Q&A',
];

/**
 * Submit a counselling request.
 *
 * `preferredDateTime` must be a LOCAL wall clock — `CounselorQueryRequest.preferredDateTime` is a
 * `LocalDateTime`, with no zone. `components/ui/DateTimeField` already emits exactly that shape via
 * `utils/dates.toLocalDateTimeString` ("2026-08-21T14:30:00"), which is why this screen uses one
 * datetime field rather than the web's separate date and time inputs. **Never `toISOString()`
 * here**: it rewrites local midnight to 18:30 the previous day in IST, the bug the parent calendar
 * shipped once already.
 *
 * Resolves to `{success, message, id, preferredMode}`. A rejected mode comes back as 400 with
 * `{success:false, message}`, so surface `message` rather than a generic failure.
 */
export function submitCounselorQuery({ preferredDateTime, preferredMode, queryFor, queryDetails }) {
  return studentApi.post('/api/student/counselor-queries', {
    preferredDateTime,
    preferredMode,
    queryFor,
    queryDetails,
  });
}
