// services/travelExpenseService.js
// Mirrors: frontendmain/src/services/ApiServices.js `travelExpenseApi`
// Backend: travelexpense/controller/TravelExpenseController.java
//
// "My Expenses" — travel claims for Shreyartha teachers, Shreyartha counsellors and sales reps. The
// guard names those four roles (both spellings of the counsellor role exist), so one screen serves
// all three shells. Every handler answers a refusal with 400 + { success, message }, and the message
// says what to fix — show it as it comes.

import { staffApi } from './staffApi';

const BASE = '/api/staff/travel-expenses';

/** How a leg was travelled. Car and bike are paid per km; public transport by the fare entered. */
export const TRAVEL_MODES = [
  { value: 'CAR', label: 'Car' },
  { value: 'BIKE', label: 'Bike' },
  { value: 'PUBLIC_TRANSPORT', label: 'Public transport' },
];

/** Claim status → words and a StatusChip tone. */
export const CLAIM_STATUS = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Awaiting approval', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Returned', tone: 'error' },
  PAID: { label: 'Paid', tone: 'success' },
};

/** The month: `{ days:[{date, stops, status, totalKm, totalInr}], totals, rates, homeBase }`. */
export function fetchTravelMonth(year, month, signal) {
  return staffApi.get(`${BASE}/month`, { params: { year, month }, signal });
}

/**
 * One day: `{ date, status, editable, returnHome, homeBase, stops, legs, totalKm, totalInr,
 * straightLine, rates, rejectionReason, notes }`. Legs carry a `legKey`; a choice sent back is
 * applied only while that key still names the leg.
 */
export function fetchTravelDay(date, signal) {
  return staffApi.get(`${BASE}/day`, { params: { date }, signal });
}

/** `{ date, returnHome, legs:[{ seq, legKey, mode, fareInr }] }` — saved as a draft. */
export function saveTravelDay(payload) {
  return staffApi.put(`${BASE}/day`, payload);
}

/** Same body as saveTravelDay; saves and submits in one step. */
export function submitTravelDay(payload) {
  return staffApi.post(`${BASE}/day/submit`, payload);
}

/** "I'm here": `{ latitude, longitude, accuracy, label }`. Returns today's day. */
export function addTravelStop(payload) {
  return staffApi.post(`${BASE}/stops`, payload);
}

export function deleteTravelStop(stopId) {
  return staffApi.del(`${BASE}/stops/${stopId}`);
}

export function setTravelHomeBase(payload) {
  return staffApi.put(`${BASE}/home-base`, payload);
}

/** A ticket photo on one leg; `file` is `{ uri, name, type }` from utils/filePicker. */
export function uploadTravelReceipt(date, legKey, file) {
  return staffApi.multipart(`${BASE}/day/receipt`, { fields: { date, legKey }, files: { file } });
}
