// services/parent/childrenService.js
//
// My Children (6 Nov 2026) — the website's Parent/platform/pages/ParentChildren.js and
// components/ParentLinkCodeBox.js, against the same /api/parent/children endpoints.
//
// Every call answers with the whole family: `{ verified, activeStudentId, children[], pending[],
// message }`. The ACTIVE child is held on the server (ParentUser.linkedStudent), so once `select`
// answers, every other parent endpoint already serves that child — nothing here passes an id on.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { parentApi } from '../parentApi';

const BASE = '/api/parent/children';

export const fetchChildren = (signal) => parentApi.get(BASE, { signal });

/** A code from the school links and verifies at once; the child's mobile or email asks the school. */
export const linkChild = (code) => parentApi.post(`${BASE}/link`, { code });

export const withdrawRequest = (requestId) => parentApi.del(`${BASE}/requests/${requestId}`);

export const selectChild = (studentId) => parentApi.put(`${BASE}/${studentId}/select`, {});

export const removeChild = (studentId) => parentApi.del(`${BASE}/${studentId}`);

/** Matches the server: an email, or ten or more digits, is a mobile or email rather than a code. */
export const looksLikeContact = (value) =>
  String(value || '').includes('@') || String(value || '').replace(/[^0-9]/g, '').length >= 10;

/**
 * What the dashboard and the layout's gate read, kept in step with the answer — the website's
 * `rememberActiveChild`. A code verifies the parent, so `parentUserVerified` can turn true here.
 */
export async function rememberActiveChild(result) {
  if (!result) return;
  const active = (result.children || []).find((c) => c.studentId === result.activeStudentId);
  try {
    await AsyncStorage.multiSet([
      ['parentUserVerified', String(Boolean(result.verified))],
      ['linkedStudentName', active?.fullName ?? ''],
    ]);
  } catch {
    // Storage only feeds fallbacks; the server already holds the truth.
  }
}

/** "Class 7 · Section A · East Point" — the website's line under each child's name. */
export const childDetails = (child) =>
  [child?.currentClass && `Class ${child.currentClass}`, child?.section && `Section ${child.section}`, child?.schoolName]
    .filter(Boolean)
    .join(' · ');
