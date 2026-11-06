import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { StatusChip } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { universityApi } from '../../services/portalClients';
import { pickImage } from '../../utils/filePicker';
import CrudListScreen from '../portal/CrudListScreen';
import RecordScreen from '../portal/RecordScreen';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import FieldInput from '../portal/FieldInput';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The University portal, native (5 Nov 2026) — the website's University/platform: Overview,
 * Profile & Institution, Courses & Fees, Campus Tour & Media. An account not yet approved can still
 * fill everything in, as on the website, and sees "Pending Approval" until it is.
 */

const D = '/api/university/dashboard';

export const UNIVERSITY_TILES = [
  { key: 'profile', label: 'Profile & Institution', icon: 'business-outline', route: '/university/profile', blurb: 'Your institution as students see it' },
  { key: 'courses', label: 'Courses & Fees', icon: 'book-outline', route: '/university/courses', blurb: 'Programmes, eligibility and costs' },
  { key: 'gallery', label: 'Campus Tour & Media', icon: 'images-outline', route: '/university/gallery', blurb: 'Photos and virtual tours' },
];

export function UniversityHome() {
  const [profile, setProfile] = useState(null);
  const load = useCallback(async () => {
    try {
      setProfile(await universityApi.get(`${D}/profile`));
    } catch {
      setProfile(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen
      portalLabel="University"
      nameKey="universityUserName"
      tiles={UNIVERSITY_TILES}
      onRefresh={load}
      intro={profile ? (profile.approved ? 'Approved — your institution is visible to students.' : 'Pending approval — you can complete your profile meanwhile.') : undefined}
      stats={profile ? [{ label: 'University code', value: profile.universityCode || '—' }, { label: 'Status', value: profile.approved ? 'Approved' : 'Pending' }] : undefined}
    />
  );
}

const COLLEGE_TYPES = [
  { value: 'PRIVATE', label: 'Private' },
  { value: 'PUBLIC_GOVERNMENT', label: 'Public / Government' },
  { value: 'AUTONOMOUS', label: 'Autonomous' },
  { value: 'DEEMED_UNIVERSITY', label: 'Deemed University' },
  { value: 'AFFILIATED', label: 'Affiliated' },
];
const typeLabel = (v) => COLLEGE_TYPES.find((t) => t.value === v)?.label || v;

export function UniversityProfile() {
  const styles = useStyles();
  const palette = usePalette();
  const [busy, setBusy] = useState('');

  const upload = async (kind, reload, showToast) => {
    const file = await pickImage();
    if (!file || file.denied) {
      if (file?.denied) showToast('Allow photo access to upload.', 'error');
      return;
    }
    setBusy(kind);
    try {
      await universityApi.multipart(`${D}/profile/${kind}`, { files: { file } });
      showToast(kind === 'logo' ? 'Logo updated.' : 'Banner updated.', 'success');
      reload();
    } catch (e) {
      showToast(e?.message || 'Upload failed.', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <RecordScreen
      title="Profile & Institution"
      fallbackRoute="/university"
      load={() => universityApi.get(`${D}/profile`)}
      heading={(p) => p.universityName}
      subheading={(p) => [typeLabel(p.collegeType), p.city].filter(Boolean).join(' · ')}
      photo={(p) => p.logoUrl || null}
      sections={[
        { title: 'Institution', rows: [['Type', (p) => typeLabel(p.collegeType)], ['Established', 'establishedYear'], ['Accreditation', 'accreditation'], ['Website', 'websiteUrl'], ['About', 'description']] },
        { title: 'Contact', rows: [['Admissions email', 'admissionsEmail'], ['Phone', 'phoneNumber']] },
        { title: 'Address', rows: [['Address', 'addressLine'], ['City', 'city'], ['State', 'state'], ['Postal code', 'postalCode'], ['Country', 'country'], ['Map', 'mapEmbedUrl']] },
      ]}
      fields={[
        { key: 'universityName', label: 'Institution name', required: true },
        { key: 'collegeType', label: 'College type', type: 'select', options: COLLEGE_TYPES },
        { key: 'establishedYear', label: 'Established year', type: 'number' },
        { key: 'accreditation', label: 'Accreditation' },
        { key: 'websiteUrl', label: 'Website', type: 'url' },
        { key: 'admissionsEmail', label: 'Admissions email', type: 'email' },
        { key: 'phoneNumber', label: 'Phone', type: 'phone' },
        { key: 'description', label: 'About the institution', type: 'multiline' },
        { key: 'addressLine', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'postalCode', label: 'Postal code' },
        { key: 'country', label: 'Country' },
        { key: 'mapEmbedUrl', label: 'Google Maps embed link', type: 'url' },
        { key: 'latitude', label: 'Latitude', type: 'number' },
        { key: 'longitude', label: 'Longitude', type: 'number' },
      ]}
      // PUT /profile takes the whole editable profile, so the edits go on top of what was loaded.
      save={(v, record) => universityApi.put(`${D}/profile`, { ...record, ...v })}
    >
      {(p, reload, showToast) => (
        <View style={styles.media}>
          {p.bannerUrl ? <Image source={{ uri: p.bannerUrl }} style={styles.banner} resizeMode="cover" /> : null}
          <View style={styles.row}>
            {[
              ['logo', 'Upload logo', 'image-outline'],
              ['banner', 'Upload banner', 'easel-outline'],
            ].map(([kind, label, icon]) => (
              <Pressable
                key={kind}
                onPress={() => upload(kind, reload, showToast)}
                disabled={!!busy}
                style={({ pressed }) => [styles.button, { borderColor: palette.primary }, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name={icon} size={18} color={palette.primaryDark} />
                <Text style={[styles.buttonText, { color: palette.primaryDark }]}>{busy === kind ? 'Uploading…' : label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </RecordScreen>
  );
}

const DEGREES = ['UG', 'PG', 'DOCTORATE', 'DIPLOMA'];
const money = (v) => (v == null || v === '' ? '' : `₹${Number(v).toLocaleString('en-IN')}`);

export function UniversityCourses() {
  return (
    <CrudListScreen
      title="Courses & Fees"
      fallbackRoute="/university"
      load={() => universityApi.get(`${D}/courses`)}
      create={(v) => universityApi.post(`${D}/courses`, v)}
      update={(c, v) => universityApi.put(`${D}/courses/${c.id}`, v)}
      remove={(c) => universityApi.del(`${D}/courses/${c.id}`)}
      addLabel="Add a course"
      emptyTitle="No courses yet"
      emptyMessage="Add the programmes you offer, with eligibility and fees."
      describe={(c) => ({
        title: c.courseName,
        subtitle: [c.degreeLevel, c.department, c.duration].filter(Boolean).join(' · '),
        chips: c.popular ? [{ label: 'Popular', tone: 'success' }] : [],
        meta: [
          ['Minimum %', c.minPercentage != null ? `${c.minPercentage}%` : ''],
          ['Required exams', c.requiredExams],
          ['Tuition fee', money(c.tuitionFee)],
          ['Hostel fee', money(c.hostelFee)],
          ['Admission fee', money(c.admissionFee)],
          ['Total estimated cost', money(c.totalEstimatedCost)],
        ],
        body: c.courseDetails,
      })}
      fields={[
        { key: 'courseName', label: 'Course name', required: true },
        { key: 'degreeLevel', label: 'Degree level', type: 'select', options: DEGREES, default: 'UG' },
        { key: 'department', label: 'Department' },
        { key: 'duration', label: 'Duration', placeholder: 'e.g. 4 years' },
        { key: 'minPercentage', label: 'Minimum percentage', type: 'number' },
        { key: 'requiredExams', label: 'Required exams', placeholder: 'e.g. JEE, SAT' },
        { key: 'tuitionFee', label: 'Tuition fee (₹)', type: 'number' },
        { key: 'hostelFee', label: 'Hostel fee (₹)', type: 'number' },
        { key: 'admissionFee', label: 'Admission fee (₹)', type: 'number' },
        { key: 'totalEstimatedCost', label: 'Total estimated cost (₹)', type: 'number' },
        { key: 'popular', label: 'Mark as popular', type: 'switch' },
        { key: 'courseDetails', label: 'Course details', type: 'multiline' },
      ]}
    />
  );
}

const CATEGORIES = [
  { value: 'CAMPUS_LIFE', label: 'Campus Life' },
  { value: 'LIBRARY', label: 'Library' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'LABS', label: 'Labs' },
  { value: 'SPORTS', label: 'Sports' },
  { value: 'OTHER', label: 'Other' },
];

export function UniversityGallery() {
  const styles = useStyles();
  const palette = usePalette();
  const [category, setCategory] = useState('CAMPUS_LIFE');
  const [uploading, setUploading] = useState(false);

  return (
    <CrudListScreen
      title="Campus Tour & Media"
      fallbackRoute="/university"
      load={() => universityApi.get(`${D}/gallery`)}
      remove={(img) => universityApi.del(`${D}/gallery/${img.id}`)}
      emptyTitle="No photos yet"
      emptyMessage="Add photos of your campus, library, hostel, labs and sports."
      header={(data, reload) => (
        <View style={styles.uploadCard}>
          <FieldInput field={{ key: 'category', label: 'Photo category', type: 'select', options: CATEGORIES }} value={category} onChange={setCategory} />
          <Pressable
            disabled={uploading}
            onPress={async () => {
              const file = await pickImage();
              if (!file || file.denied) return;
              setUploading(true);
              try {
                await universityApi.multipart(`${D}/gallery`, { files: { file }, fields: { category } });
                reload();
              } finally {
                setUploading(false);
              }
            }}
            style={({ pressed }) => [styles.primary, { backgroundColor: palette.primary }, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="cloud-upload-outline" size={19} color="#ffffff" />
            <Text style={styles.primaryText}>{uploading ? 'Uploading…' : 'Upload a photo'}</Text>
          </Pressable>
          <TourLinks />
        </View>
      )}
      describe={(img) => ({
        title: CATEGORIES.find((c) => c.value === img.category)?.label || img.category || 'Photo',
        body: undefined,
        chips: [],
        meta: [],
        image: img.imageUrl,
      })}
      renderExtra={(img) => (img.imageUrl ? <Image source={{ uri: img.imageUrl }} style={styles.photo} resizeMode="cover" /> : null)}
    />
  );
}

/** The video and virtual tour links, saved onto the profile (which takes its whole shape). */
function TourLinks() {
  const styles = useStyles();
  const palette = usePalette();
  const [links, setLinks] = useState({ videoTourUrl: '', virtualTourUrl: '' });
  const [state, setState] = useState('');
  useEffect(() => {
    universityApi
      .get(`${D}/profile`)
      .then((p) => setLinks({ videoTourUrl: p?.videoTourUrl || '', virtualTourUrl: p?.virtualTourUrl || '' }))
      .catch(() => {});
  }, []);
  const save = async () => {
    setState('saving');
    try {
      const current = await universityApi.get(`${D}/profile`);
      await universityApi.put(`${D}/profile`, { ...current, ...links });
      setState('saved');
    } catch (e) {
      setState(e?.message || 'Could not save.');
    }
  };
  return (
    <View style={styles.tour}>
      <FieldInput field={{ key: 'videoTourUrl', label: 'Video tour link', type: 'url' }} value={links.videoTourUrl} onChange={(v) => setLinks((l) => ({ ...l, videoTourUrl: v }))} />
      <FieldInput field={{ key: 'virtualTourUrl', label: 'Virtual tour link', type: 'url' }} value={links.virtualTourUrl} onChange={(v) => setLinks((l) => ({ ...l, virtualTourUrl: v }))} />
      <Pressable onPress={save} style={({ pressed }) => [styles.button, { borderColor: palette.primary }, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={[styles.buttonText, { color: palette.primaryDark }]}>{state === 'saving' ? 'Saving…' : 'Save tour links'}</Text>
      </Pressable>
      {state && state !== 'saving' ? <StatusChip label={state === 'saved' ? 'Saved' : state} tone={state === 'saved' ? 'success' : 'error'} style={styles.saved} /> : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  media: { marginTop: SPACING.sm },
  banner: { width: '100%', height: 140, borderRadius: 14, marginBottom: SPACING.sm, backgroundColor: SLATE[100] },
  row: { flexDirection: 'row', gap: SPACING.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: TOUCH.min,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
  },
  buttonText: { fontSize: TYPE.label, fontWeight: '800' },
  uploadCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, minHeight: TOUCH.min, borderRadius: 14 },
  primaryText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  tour: { marginTop: SPACING.md, gap: SPACING.sm },
  saved: { alignSelf: 'flex-start' },
  photo: { width: '100%', height: 180, borderRadius: 12, marginTop: SPACING.sm, backgroundColor: SLATE[100] },
  pressed: { opacity: 0.8 },
}));
