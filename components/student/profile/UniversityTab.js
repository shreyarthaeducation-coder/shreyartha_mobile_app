import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import { makeStyles } from '../../../utils/makeStyles';
import { Select, TextField } from '../../ui';
import { StudentCard, StudentCardTitle } from '../StudentCard';
import {
  COLLEGE_TYPES,
  fetchAllAbroadColleges,
  fetchAllIndiaColleges,
  fetchCountries,
  fetchStates,
} from '../../../services/student/subjectCareerService';
import { fetchProfileSection, saveProfileSection } from '../../../services/student/profileService';

/**
 * Profile → University Preference.
 *
 * NOT a flat form, which is why it has its own component rather than a `PROFILE_FORMS` entry:
 * one select switches another select's option *source*, and a third is populated by a remote call
 * that depends on both. The config renderer has no vocabulary for either.
 *
 * The cascade, from `platform/profile/UniversityPreference.js`:
 *
 *   studyLocation  "India" | "Abroad"        ← not a country list
 *   studyRegion    states if India, countries if Abroad
 *   collegeType    Government | Private      ← INDIA ONLY, cleared when Abroad
 *   universityPref1/2  ← the colleges an admin actually added for that region
 *
 * **`studyRegion` is stored as a NAME, not an id.** The id exists only in this component, to drive
 * the college lookup, so re-opening the tab has to resolve the saved name back to an id before
 * the university pickers can populate. Storing the id instead would silently break the website,
 * which reads the same record.
 *
 * The lookup DTOs have `stateName` / `countryName` and **no `name`** — `subjectCareerService`
 * normalises that at the boundary so nothing here has to remember it.
 */

const LOCATIONS = [
  { value: 'India', label: 'India' },
  { value: 'Abroad', label: 'Abroad' },
];

const SOP_MAX_WORDS = 500;
const WHY_MAX_WORDS = 200;

const EMPTY = {
  studyLocation: '',
  studyRegion: '',
  collegeType: '',
  universityPref1: '',
  universityPref2: '',
  coursePref1: '',
  coursePref2: '',
  sopText: '',
  whyThisCourse: '',
};

const wordCount = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);

export default function UniversityTab({ showToast }) {
  const styles = useStyles();
  const palette = usePalette();

  const [form, setForm] = useState(EMPTY);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [states, setStates] = useState([]);
  const [countries, setCountries] = useState([]);
  // The region id lives only here — the record persists the name.
  const [regionId, setRegionId] = useState('');
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(false);

  const isIndia = form.studyLocation === 'India';

  const loadColleges = useCallback(async (location, id, type) => {
    // India needs a type as well as a region; Abroad needs only the country.
    if (!id || (location === 'India' && !type)) {
      setColleges([]);
      return;
    }
    setCollegesLoading(true);
    try {
      const list =
        location === 'India'
          ? await fetchAllIndiaColleges(id, type)
          : await fetchAllAbroadColleges(id);
      setColleges(list);
    } catch {
      setColleges([]);
    } finally {
      setCollegesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [profileRes, stateRes, countryRes] = await Promise.allSettled([
      fetchProfileSection('university'),
      fetchStates(),
      fetchCountries(),
    ]);

    const stateList = stateRes.status === 'fulfilled' ? stateRes.value : [];
    const countryList = countryRes.status === 'fulfilled' ? countryRes.value : [];
    setStates(stateList);
    setCountries(countryList);

    const data = profileRes.status === 'fulfilled' ? profileRes.value || {} : {};
    const next = { ...EMPTY, ...data };
    setForm(next);
    // The web decides "exists" from the fields it actually writes, not from a non-empty body.
    setExists(
      !!(next.studyLocation || next.studyRegion || next.universityPref1 || next.universityPref2),
    );

    // Resolve the saved region NAME back to an id so the university list can repopulate.
    if (next.studyRegion && next.studyLocation) {
      const list = next.studyLocation === 'India' ? stateList : countryList;
      const match = list.find(
        (item) =>
          (item.name || '').trim().toLowerCase() === next.studyRegion.trim().toLowerCase(),
      );
      if (match) {
        setRegionId(String(match.id));
        loadColleges(next.studyLocation, match.id, next.collegeType);
      }
    }
    setLoading(false);
  }, [loadColleges]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  /** Changing the location invalidates the region, the type and both university picks. */
  const pickLocation = (value) => {
    setForm((prev) => ({
      ...prev,
      studyLocation: value,
      studyRegion: '',
      collegeType: '',
      universityPref1: '',
      universityPref2: '',
    }));
    setRegionId('');
    setColleges([]);
  };

  const pickRegion = (id) => {
    const list = isIndia ? states : countries;
    const match = list.find((item) => String(item.id) === String(id));
    setRegionId(id);
    // Store the NAME, keep the id local.
    setForm((prev) => ({
      ...prev,
      studyRegion: match?.name || '',
      universityPref1: '',
      universityPref2: '',
    }));
    setColleges([]);
    if (id) loadColleges(isIndia ? 'India' : 'Abroad', id, form.collegeType);
  };

  const pickCollegeType = (value) => {
    setForm((prev) => ({ ...prev, collegeType: value, universityPref1: '', universityPref2: '' }));
    setColleges([]);
    if (regionId) loadColleges('India', regionId, value);
  };

  const submit = async () => {
    const missing = [];
    if (!form.studyLocation) missing.push('Where do you want to study');
    if (!form.studyRegion) missing.push(isIndia ? 'State' : 'Country');
    if (isIndia && !form.collegeType) missing.push('College Type');
    if (!form.coursePref1) missing.push('Course Preference 1');
    if (!form.sopText) missing.push('Statement of Purpose');
    if (!form.whyThisCourse) missing.push('Why this course');
    if (missing.length) {
      showToast?.(`Please fill in: ${missing.join(', ')}`, 'error');
      return;
    }
    if (wordCount(form.whyThisCourse) > WHY_MAX_WORDS) {
      showToast?.(`"Why this course" must be ${WHY_MAX_WORDS} words or fewer.`, 'error');
      return;
    }

    setSaving(true);
    // `collegeType` is India-only and must go out empty for Abroad, or the record keeps a stale
    // Government/Private against a country.
    const payload = { ...form, collegeType: isIndia ? form.collegeType : '' };

    try {
      await saveProfileSection('university', payload, exists);
      setExists(true);
      showToast?.('Saved.', 'success');
    } catch (e) {
      // The server disagrees with us about whether the record exists. The web retries with the
      // opposite verb rather than making the student press Save twice.
      const message = e?.message || '';
      const desynced = /already been saved/i.test(message) || /hasn't been saved yet/i.test(message);
      if (desynced) {
        try {
          await saveProfileSection('university', payload, !exists);
          setExists(true);
          showToast?.('Saved.', 'success');
          return;
        } catch (retryError) {
          showToast?.(retryError?.message || 'Could not save.', 'error');
          return;
        } finally {
          setSaving(false);
        }
      }
      showToast?.(message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />;
  }

  const regionList = isIndia ? states : countries;
  const collegeOptions = colleges.map((c) => ({
    value: c.collegeName,
    label: c.collegeName,
  }));
  // A saved pick whose college is no longer in the list must still show, or reopening the tab
  // silently blanks a choice the student made.
  const withSaved = (value) =>
    value && !collegeOptions.some((o) => o.value === value)
      ? [{ value, label: `${value} (saved)` }, ...collegeOptions]
      : collegeOptions;

  const sopWords = wordCount(form.sopText);
  const whyWords = wordCount(form.whyThisCourse);

  return (
    <>
      <StudentCard>
        <StudentCardTitle>University Preference</StudentCardTitle>

        <Select
          label="Where do you want to study? *"
          value={form.studyLocation}
          options={[{ value: '', label: 'Not set' }, ...LOCATIONS]}
          onChange={pickLocation}
        />

        <Select
          label={(isIndia ? 'Select State' : 'Select Country') + ' *'}
          value={regionId}
          options={[
            { value: '', label: 'Not set' },
            ...regionList.map((r) => ({ value: String(r.id), label: r.name })),
          ]}
          onChange={pickRegion}
          disabled={!form.studyLocation}
          searchable={regionList.length > 12}
        />

        {isIndia ? (
          <Select
            label="College Type *"
            value={form.collegeType}
            options={[{ value: '', label: 'Not set' }, ...COLLEGE_TYPES]}
            onChange={pickCollegeType}
          />
        ) : null}

        <Select
          label="University Preference 1"
          value={form.universityPref1}
          options={[{ value: '', label: collegesLoading ? 'Loading…' : 'Not set' }, ...withSaved(form.universityPref1)]}
          onChange={(v) => patch('universityPref1', v)}
          disabled={collegesLoading || (!colleges.length && !form.universityPref1)}
          searchable={colleges.length > 12}
        />
        <Select
          label="University Preference 2"
          value={form.universityPref2}
          options={[{ value: '', label: collegesLoading ? 'Loading…' : 'Not set' }, ...withSaved(form.universityPref2)]}
          onChange={(v) => patch('universityPref2', v)}
          disabled={collegesLoading || (!colleges.length && !form.universityPref2)}
          searchable={colleges.length > 12}
        />
        {!collegesLoading && regionId && colleges.length === 0 ? (
          <Text style={styles.hint}>No colleges have been added for this selection yet.</Text>
        ) : null}

        {/* Free text: colleges carry no course list. */}
        <TextField
          label="Course Preference 1 *"
          value={form.coursePref1}
          onChangeText={(v) => patch('coursePref1', v)}
        />
        <TextField
          label="Course Preference 2"
          value={form.coursePref2}
          onChangeText={(v) => patch('coursePref2', v)}
        />

        <TextField
          label={`Personal Statement / SOP * (max ${SOP_MAX_WORDS} words)`}
          value={form.sopText}
          onChangeText={(v) => patch('sopText', v)}
          multiline
          inputStyle={styles.textarea}
        />
        <Text style={[styles.count, sopWords > SOP_MAX_WORDS && styles.countOver]}>
          Words: {sopWords} / {SOP_MAX_WORDS}
        </Text>

        <TextField
          label={`Why this course / career? * (max ${WHY_MAX_WORDS} words)`}
          value={form.whyThisCourse}
          onChangeText={(v) => patch('whyThisCourse', v)}
          multiline
          inputStyle={styles.textarea}
        />
        <Text style={[styles.count, whyWords > WHY_MAX_WORDS && styles.countOver]}>
          Words: {whyWords} / {WHY_MAX_WORDS}
        </Text>
      </StudentCard>

      <Pressable
        onPress={submit}
        disabled={saving}
        style={({ pressed }) => [styles.save, saving && styles.saveOff, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator size="small" color={palette.onPrimary} />
        ) : (
          <Text style={styles.saveText}>Save University Preference</Text>
        )}
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  textarea: { height: 110, textAlignVertical: 'top' },
  count: { fontSize: TYPE.caption, color: SLATE[500], textAlign: 'right', marginTop: -6, marginBottom: 6 },
  countOver: { color: FEEDBACK.errorText, fontWeight: '700' },
  hint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: -4, marginBottom: 8 },
  save: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primary,
    marginBottom: SPACING.lg,
  },
  saveOff: { backgroundColor: SLATE[400] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: p.onPrimary },
  pressed: { opacity: 0.8 },
}));
