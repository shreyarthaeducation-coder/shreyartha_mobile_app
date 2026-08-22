// services/parent/activitiesService.js
// Mirrors: Parent/platform/pages/ParentLearningActivities.js — but NOT the way it fetches.
// Backend: parent/controller/ParentDashboardController.java → getLearningActivities
//
// ── ONE CALL, NOT SIX ────────────────────────────────────────────────────────
// The web page makes six requests and FIVE OF THEM 404, which is why Learning Activities renders
// empty for every parent on the website. They are the STUDENT controller's routes with
// `/api/parent/dashboard` pasted in front — hence the give-away doubled segment in
// `/resources/resources/topic/{id}`. None of these exist:
//
//     /resources/subjects/{id}/chapters
//     /resources/resources/topic/{id}
//     /resources/homework/topic/{id}
//     /resources/homework/all
//     /personalised-resources
//
// Meanwhile `GET /api/parent/dashboard/learning-activities` — written for exactly this page —
// returns all three lists in one response and is never called. That is what we use.
//
// The trade is that the composite has no drill-down: it returns everything for the child's section
// flat, with no subject/chapter/topic filter. That suits a phone better than the three-level
// cascade the web attempts, and unlike the cascade it actually works.
//
// It degrades to empty lists rather than erroring when the child has no school or class, so an
// empty screen here means "nothing assigned", not "something broke".

import { parentApi } from '../parentApi';

/**
 * Everything the child has been given: teacher resources, homework, personalised resources.
 *
 * @returns {Promise<{
 *   teacherResources: TeacherResourceResponse[],
 *   homework: TeacherResourceResponse[],
 *   personalisedResources: PersonalisedResourceResponse[]
 * }>}
 *
 * TWO DTOs, AND THEY ARE NOT THE SAME SHAPE:
 *   TeacherResourceResponse       has `createdAt` and `dueDate`, `fileUrl`. NO `assignedDate`,
 *                                 NO `linkUrl`.
 *   PersonalisedResourceResponse  has `assignedDate` AND `createdAt`, `fileUrl` AND `linkUrl`,
 *                                 plus a completion flag serialised as `completed`.
 *
 * The web reads `assignedDate` for homework (a field that DTO does not have, so its calendar shows
 * nothing) and `isCompleted` for personalised resources (the JSON says `completed`, so its badge
 * never appears). Both are read correctly below.
 */
export async function fetchLearningActivities(signal) {
  const res = await parentApi.get('/api/parent/dashboard/learning-activities', { signal });
  return {
    teacherResources: Array.isArray(res?.teacherResources) ? res.teacherResources : [],
    homework: Array.isArray(res?.homework) ? res.homework : [],
    personalisedResources: Array.isArray(res?.personalisedResources)
      ? res.personalisedResources
      : [],
  };
}

/** The three tabs, in the web's order. */
export const ACTIVITY_TABS = [
  { value: 'teacherResources', label: 'Resources', icon: 'folder-open-outline' },
  { value: 'homework', label: 'Homework', icon: 'document-text-outline' },
  { value: 'personalisedResources', label: 'Personalised', icon: 'sparkles-outline' },
];

/** Icon per resource type. `resourceType` is an enum name, not a MIME type. */
const TYPE_ICON = {
  PDF: 'document-text-outline',
  VIDEO: 'videocam-outline',
  IMAGE: 'image-outline',
  LINK: 'link-outline',
  NOTE: 'create-outline',
  TEXT: 'create-outline',
};

export const iconFor = (resource) =>
  TYPE_ICON[resource?.resourceType] || TYPE_ICON[resource?.fileType] || 'attach-outline';

/**
 * The date to sort and label by.
 *
 * `assignedDate` exists only on personalised resources; teacher resources and homework fall back to
 * `createdAt`. The web reads `assignedDate` for all three and therefore sorts homework by undefined.
 */
export const activityDate = (resource) => resource?.assignedDate || resource?.createdAt || null;

/** Newest first, matching every other list in this portal. */
export function sortByDate(list) {
  return [...(list || [])].sort((a, b) => {
    const left = activityDate(a) || '';
    const right = activityDate(b) || '';
    return String(right).localeCompare(String(left));
  });
}

/**
 * Where tapping a card should go.
 *
 * Only personalised resources carry `linkUrl`. S3 URLs are stored UNENCODED in this backend, so a
 * filename with a space produces a URL `Linking.openURL` rejects outright.
 */
export function openUrlFor(resource) {
  const raw = resource?.fileUrl || resource?.linkUrl || '';
  return raw ? encodeURI(raw) : '';
}

/** Personalised resources only; Jackson serialises the boolean getter as `completed`. */
export const isCompleted = (resource) => resource?.completed === true;
