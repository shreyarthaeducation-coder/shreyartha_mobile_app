// services/portalClients.js
//
// HTTP clients for the portals carried over from the website on 5 Nov 2026. One per portal, each
// reading its own token (the keys the website and services/portalSession.js store), so a 401 from
// one portal never touches another's session. See services/portalApi.js for why these are not
// services/apiService.js.

import { createPortalApi } from './portalApi';

export const alumniApi = createPortalApi({ name: 'Alumni', tokenKey: 'alumniUserToken', loginRoute: '/auth/sign-in' });
export const universityApi = createPortalApi({ name: 'University', tokenKey: 'universityUserToken', loginRoute: '/auth/sign-in' });
export const universityStaffApi = createPortalApi({ name: 'UniversityStaff', tokenKey: 'universityStaffToken', loginRoute: '/auth/sign-in' });
export const industryApi = createPortalApi({ name: 'Industry', tokenKey: 'industryUserToken', loginRoute: '/auth/sign-in' });
export const investorApi = createPortalApi({ name: 'Investor', tokenKey: 'investorUserToken', loginRoute: '/auth/sign-in' });

/** University Staff roles → their app home, as the website's DASH_SEGMENT. */
export const UNIVERSITY_STAFF_HOME = {
  VICE_CHANCELLOR: '/unistaff/college',
  DEAN: '/unistaff/college',
  // Professor has had a dashboard of its own on the website since Nov 2026 (profile, My Classes,
  // personal details); Associate Dean keeps Faculty.
  PROFESSOR: '/unistaff/professor',
  ASSOCIATE_DEAN: '/unistaff/faculty',
  PLACEMENT_HEAD: '/unistaff/placement',
  // No dashboard on the website either — it sends them to a holding page (UniversityStaffWelcome),
  // and so does the app. Refusing them at sign-in left them with no way in at all.
  COUNSELOR: '/unistaff/welcome',
  ADMISSION_OFFICER: '/unistaff/welcome',
};

/** The website's labels for those roles. */
export const UNIVERSITY_STAFF_LABEL = {
  VICE_CHANCELLOR: 'Vice Chancellor',
  DEAN: 'Dean',
  PROFESSOR: 'Professor',
  ASSOCIATE_DEAN: 'Associate Dean',
  PLACEMENT_HEAD: 'Placement Head',
  COUNSELOR: 'Counselor',
  ADMISSION_OFFICER: 'Admission Officer',
};
