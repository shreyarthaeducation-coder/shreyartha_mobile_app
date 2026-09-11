import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../../constants/theme';
import { usePalette } from '../../../components/ui/PaletteContext';
import { Card, CardTitle, SensitiveGate, Select, TextField } from '../../ui';
import {
  BLOOD_GROUPS,
  GENDERS,
  TAX_REGIMES,
  fetchHrProfile,
  fetchPtStates,
  fetchTaxDeclaration,
  saveHrTab,
  uploadHrPhoto,
} from '../../../services/teacher/hrService';
import { currentLeaveYear } from '../../../utils/currency';
import { pickPhoto } from '../../../utils/filePicker';
import useSensitiveReveal from '../../../hooks/useSensitiveReveal';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * My Profile → HR. The employee record behind Leave and Payroll.
 * Ports frontendmain/src/School/shared/hr/StaffHrProfileSection.js.
 *
 * Six sections, one save. Employee code, joining date, probation end and employment status are
 * **read-only** — `HrProfileRequest` declares them but `updateProfile(..., allowAdminFields=false)`
 * ignores them on the self-service endpoint, so showing them as editable would be a lie.
 *
 * Always the current financial year; the web has no year selector here either.
 */


/** `[key, label, keyboard, multiline, hint]` — the form is data, not 30 near-identical JSX blocks. */
const SECTIONS = [
  {
    title: 'Personal details',
    fields: [
      ['dateOfBirth', 'Date of birth', null, false, 'YYYY-MM-DD'],
      ['personalEmail', 'Personal email', 'email-address'],
      ['alternateMobile', 'Alternate mobile', 'phone-pad'],
      ['currentAddress', 'Current address', null, true],
      ['permanentAddress', 'Permanent address', null, true],
      ['aadhaarNumber', 'Aadhaar number', 'number-pad', false, '12 digits'],
      ['panNumber', 'PAN number', null, false, 'ABCDE1234F'],
    ],
  },
  {
    title: 'Qualification & experience',
    fields: [
      ['highestQualification', 'Highest qualification'],
      ['qualificationDetails', 'Details', null, true],
      ['totalExperienceYears', 'Total experience (years)', 'numeric'],
      ['experienceDetails', 'Experience details', null, true],
    ],
  },
  {
    title: 'Emergency contact',
    fields: [
      ['emergencyContactName', 'Name'],
      ['emergencyContactRelation', 'Relationship'],
      ['emergencyContactPhone', 'Phone', 'phone-pad'],
    ],
  },
  {
    title: 'Provident fund & insurance',
    fields: [
      ['uanNumber', 'UAN number', 'number-pad', false, '12 digits'],
      ['pfAccountId', 'PF account'],
      ['esicNumber', 'ESIC number'],
    ],
  },
  {
    title: 'Bank details',
    fields: [
      ['bankName', 'Bank name'],
      ['bankBranch', 'Branch'],
      ['accountHolderName', 'Account holder'],
      ['bankAccountNumber', 'Account number', 'number-pad'],
      ['bankIfsc', 'IFSC'],
    ],
  },
];

/** Only declared under the OLD regime — the new regime allows no Chapter VI-A deductions. */
const DEDUCTIONS = [
  ['deduction80c', 'Section 80C (max ₹1,50,000)'],
  ['deduction80d', 'Section 80D — medical insurance'],
  ['deduction80ccd1b', 'Section 80CCD(1B) — NPS (max ₹50,000)'],
  ['deduction80tta', 'Section 80TTA — savings interest (max ₹10,000)'],
  ['homeLoanInterest', 'Home loan interest (max ₹2,00,000)'],
  ['annualRentPaid', 'Annual rent paid (for HRA exemption)'],
];

/** Money inputs are held as strings while typing; the server wants numbers or nothing. */
const toAmount = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default function HrTab({ showToast }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const financialYear = useMemo(() => currentLeaveYear(), []);

  const [profile, setProfile] = useState(null);
  const [declaration, setDeclaration] = useState(null);
  const [ptStates, setPtStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const sensitive = useSensitiveReveal({
    title: 'Show your personal details?',
    message:
      'This section contains your Aadhaar, PAN, UAN, bank account and tax declarations. Make '
      + 'sure nobody else can see your screen.',
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [p, d, states] = await Promise.all([
        fetchHrProfile(),
        fetchTaxDeclaration(financialYear),
        fetchPtStates(),
      ]);
      setProfile(p || {});
      setDeclaration(d || {});
      setPtStates(states);
    } catch (e) {
      setError(e?.message || 'Could not load your HR record.');
    } finally {
      setLoading(false);
    }
  }, [financialYear]);

  useEffect(() => {
    load();
  }, [load]);

  const patchProfile = (key, value) => setProfile((p) => ({ ...p, [key]: value }));
  const patchDeclaration = (key, value) => setDeclaration((d) => ({ ...d, [key]: value }));

  // The declaration's regime is the newer of the two — it is written back onto the profile
  // server-side — so it wins when the two disagree, exactly as the web reads it.
  const regime = declaration?.regime || profile?.taxRegime || 'NEW';
  const isOldRegime = regime === 'OLD';

  /**
   * The photo uploads **immediately**, outside the Save button — the endpoint writes
   * profilePictureUrl/Key onto the profile server-side, so folding it into the batch save would
   * mean the picture only appeared after a second, unrelated action.
   */
  const changePhoto = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    if (picked.denied) {
      showToast?.('Allow photo access to change your picture.', 'error');
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await uploadHrPhoto(picked);
      // The response carries the new URL; patch locally rather than re-reading the whole record.
      if (res?.url) patchProfile('profilePictureUrl', res.url);
      showToast?.('Profile picture updated.', 'success');
    } catch (e) {
      // validateImage rejects anything outside png/jpeg/gif/webp, and anything over the configured
      // size cap, as a 400 with the reason in `message`.
      showToast?.(e?.message || 'Could not upload the picture.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const declPayload = { regime };
      // Only the old regime's figures are consumed; sending them under NEW would store deductions
      // the payroll engine then ignores, which reads as data loss on the next regime switch.
      if (isOldRegime) {
        DEDUCTIONS.forEach(([key]) => {
          declPayload[key] = toAmount(declaration?.[key]);
        });
      }
      // Sequential and order-dependent — see saveHrTab. The declaration lands last and rewrites
      // the profile's copy of the regime.
      await saveHrTab(
        financialYear,
        { ...profile, taxRegime: regime, totalExperienceYears: toAmount(profile?.totalExperienceYears) },
        declPayload,
      );
      showToast?.('HR details saved.', 'success');
      await load();
    } catch (e) {
      // Aadhaar / PAN / UAN / IFSC format failures arrive as a 400 with the reason in `message`.
      showToast?.(e?.message || 'Could not save your HR details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={PALETTE.primary} style={styles.loader} />;
  }
  if (error && !profile) {
    return (
      <Card>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={load} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardTitle>Employment</CardTitle>

        <View style={styles.photoRow}>
          <View style={styles.avatar}>
            {profile?.profilePictureUrl ? (
              <Image
                source={{ uri: profile.profilePictureUrl }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={30} color={PALETTE.primaryDark} />
            )}
            {uploadingPhoto ? (
              <View style={styles.avatarBusy}>
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            ) : null}
          </View>
          <View style={styles.photoMeta}>
            <Text style={styles.photoName} numberOfLines={1}>
              {profile?.fullName || 'Your profile'}
            </Text>
            <Text style={styles.photoSub} numberOfLines={1}>
              {profile?.designation || profile?.userType || ''}
              {profile?.email ? ` · ${profile.email}` : ''}
            </Text>
            <Pressable
              onPress={changePhoto}
              disabled={uploadingPhoto}
              style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Ionicons name="camera-outline" size={17} color={PALETTE.primaryDark} />
              <Text style={styles.photoBtnText}>
                {profile?.profilePictureUrl ? 'Change picture' : 'Add a picture'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.readonlyNote}>Set by your school administrator.</Text>
        {[
          ['Employee code', profile?.employeeCode],
          ['Date of joining', profile?.dateOfJoining],
          ['Probation ends', profile?.probationEndDate],
          ['Status', profile?.employmentStatus],
        ].map(([label, value]) => (
          <View key={label} style={styles.readonlyRow}>
            <Text style={styles.readonlyLabel}>{label}</Text>
            <Text style={styles.readonlyValue}>{value || '—'}</Text>
          </View>
        ))}
      </Card>

      {/* Everything below is personal or financial: Aadhaar and PAN, UAN, PF and ESIC numbers,
          bank account and IFSC, and the income-tax declarations. The Employment card above stays
          visible — a name, designation and employee code are not what this gate is for. */}
      <SensitiveGate
        revealed={sensitive.revealed}
        onReveal={sensitive.reveal}
        onHide={sensitive.hide}
        title="Personal & financial details are hidden"
        message="Aadhaar, PAN, UAN, bank account and your tax declarations are on this screen."
      >
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <CardTitle>{section.title}</CardTitle>
          {section.title === 'Personal details' ? (
            <>
              <Select
                label="Gender"
                value={profile?.gender || ''}
                options={[
                  { value: '', label: 'Not set' },
                  ...GENDERS.map((g) => ({ value: g, label: g })),
                ]}
                onChange={(v) => patchProfile('gender', v)}
              />
              <Select
                label="Blood group"
                value={profile?.bloodGroup || ''}
                options={[
                  { value: '', label: 'Not set' },
                  ...BLOOD_GROUPS.map((b) => ({ value: b, label: b })),
                ]}
                onChange={(v) => patchProfile('bloodGroup', v)}
              />
            </>
          ) : null}

          {section.fields.map(([key, label, keyboard, multiline, hint]) => (
            <View key={key}>
              <TextField
                label={label}
                value={profile?.[key] == null ? '' : String(profile[key])}
                onChangeText={(v) => patchProfile(key, v)}
                keyboardType={keyboard || 'default'}
                multiline={!!multiline}
                inputStyle={multiline ? styles.multiline : undefined}
                autoCapitalize={
                  keyboard === 'email-address'
                    ? 'none'
                    : key === 'panNumber' || key === 'bankIfsc'
                      ? 'characters'
                      : 'sentences'
                }
                placeholder={hint || ''}
              />
              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
          ))}
        </Card>
      ))}

      <Card>
        <CardTitle>Income tax — FY {financialYear}</CardTitle>
        <Select
          label="Tax regime"
          value={regime}
          options={TAX_REGIMES}
          onChange={(v) => {
            // Both records carry the regime; keep them in step so the sequential save agrees.
            patchProfile('taxRegime', v);
            patchDeclaration('regime', v);
          }}
        />
        <Select
          label="Professional tax state"
          value={profile?.ptState || ''}
          options={[
            { value: '', label: 'Not set' },
            ...ptStates.map((s) => ({ value: s.code, label: s.name })),
          ]}
          onChange={(v) => patchProfile('ptState', v)}
          searchable
        />

        <Pressable
          onPress={() => patchProfile('metroHra', !profile?.metroHra)}
          style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!profile?.metroHra }}
        >
          <Ionicons
            name={profile?.metroHra ? 'checkbox' : 'square-outline'}
            size={20}
            color={profile?.metroHra ? PALETTE.primaryDark : SLATE[400]}
          />
          <Text style={styles.checkText}>
            I live in a metro (Mumbai, Delhi, Kolkata, Chennai, Bengaluru, Pune, Hyderabad or
            Ahmedabad) — HRA is 50% of Basic instead of 40%
          </Text>
        </Pressable>

        {isOldRegime ? (
          <>
            <Text style={styles.info}>
              Declare your investments so the correct TDS is deducted each month. Section 80C
              already includes your own EPF contribution.
            </Text>
            {DEDUCTIONS.map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={declaration?.[key] == null ? '' : String(declaration[key])}
                onChangeText={(v) => patchDeclaration(key, v.replace(/[^0-9.]/g, ''))}
                keyboardType="numeric"
                placeholder="0"
              />
            ))}
          </>
        ) : (
          <Text style={styles.info}>
            The new regime allows no investment deductions, so there is nothing to declare. Salary
            up to ₹12.75 lakh a year is fully covered by the ₹75,000 standard deduction and the
            ₹60,000 section 87A rebate.
          </Text>
        )}
      </Card>
      </SensitiveGate>

      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => [styles.saveBtn, saving && styles.saveDisabled, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {saving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.saveText}>Save HR details</Text>
        )}
      </Pressable>
    </>
  );
}

const useStyles = makeStyles((p) => ({
  loader: { marginVertical: SPACING.xl },
  error: { fontSize: TYPE.body, color: SLATE[600], textAlign: 'center' },
  retry: { alignSelf: 'center', marginTop: SPACING.sm, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontSize: TYPE.body, fontWeight: '700', color: p.primaryDark },

  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: p.tint,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  photoMeta: { flex: 1, gap: 2 },
  photoName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  photoSub: { fontSize: TYPE.caption, color: SLATE[500] },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: p.tint,
  },
  photoBtnText: { fontSize: TYPE.label, fontWeight: '700', color: p.primaryDark },

  readonlyNote: { fontSize: TYPE.caption, color: SLATE[500], fontStyle: 'italic', marginBottom: 6 },
  readonlyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  readonlyLabel: { flex: 1, fontSize: TYPE.label, color: SLATE[500], fontWeight: '600' },
  readonlyValue: { fontSize: TYPE.body, color: SLATE[800] },

  multiline: { height: 72, textAlignVertical: 'top' },
  hint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: -8, marginBottom: SPACING.sm },
  info: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: p.primaryDark,
    backgroundColor: p.tint,
    borderRadius: 10,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  checkText: { flex: 1, fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[600] },

  saveBtn: {
    marginTop: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: p.primaryDark,
  },
  saveDisabled: { backgroundColor: SLATE[300] },
  saveText: { fontSize: TYPE.heading, fontWeight: '700', color: '#ffffff' },
  pressed: { opacity: 0.75 },
}));
