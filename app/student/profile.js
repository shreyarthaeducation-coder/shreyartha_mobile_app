// app/student/profile.js
// Native student profile screen — displays profile data and supports
// in-app editing of name, phone, and bio fields.

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studentService } from '../../services/studentService';
import { STUDENT } from '../../constants/theme';

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function EditField({ label, value, onChange, placeholder, keyboardType, multiline }) {
  return (
    <View style={styles.editFieldWrap}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        style={[styles.editInput, multiline && styles.editInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={STUDENT.textMuted}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        selectionColor={STUDENT.accent}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [form, setForm] = useState({ name: '', phone: '', bio: '', address: '' });

  const fetchProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await studentService.getProfile();
      setProfile(data);
      setForm({
        name: data?.name || data?.studentName || '',
        phone: data?.phone || data?.mobile || '',
        bio: data?.bio || data?.about || '',
        address: data?.address || '',
      });
    } catch (err) {
      setError(err?.message || 'Could not load profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile(true);
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await studentService.updateProfile(form);
      setProfile((prev) => ({ ...prev, ...form }));
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    profile?.name || profile?.studentName || profile?.fullName || 'Student';
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>My Profile</Text>
        {!loading && !error && (
          <TouchableOpacity
            style={[styles.editToggleBtn, editing && styles.editToggleBtnActive]}
            onPress={() => {
              if (editing) {
                // Cancel — reset form to current profile
                setForm({
                  name: profile?.name || profile?.studentName || '',
                  phone: profile?.phone || profile?.mobile || '',
                  bio: profile?.bio || profile?.about || '',
                  address: profile?.address || '',
                });
              }
              setEditing((v) => !v);
            }}
          >
            <Text style={[styles.editToggleText, editing && styles.editToggleTextActive]}>
              {editing ? '✕ Cancel' : '✏️ Edit'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={STUDENT.accent} />
          <Text style={styles.loaderText}>Loading profile…</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={STUDENT.accent}
                colors={[STUDENT.accent]}
              />
            }
          >
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            ) : null}

            {/* ── Avatar + name hero ── */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>{initials || '👤'}</Text>
              </View>
              <Text style={styles.heroName}>{displayName}</Text>
              {profile?.email ? (
                <Text style={styles.heroEmail}>{profile.email}</Text>
              ) : null}
              {(profile?.class || profile?.grade || profile?.standard) ? (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {profile.class || profile.grade || profile.standard}
                  </Text>
                </View>
              ) : null}
            </View>

            {editing ? (
              /* ── Edit form ── */
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Edit Profile</Text>
                <EditField
                  label="Full Name"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="Your full name"
                />
                <EditField
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="Mobile number"
                  keyboardType="phone-pad"
                />
                <EditField
                  label="Address"
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  placeholder="Your address"
                />
                <EditField
                  label="About / Bio"
                  value={form.bio}
                  onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
                  placeholder="A short bio…"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* ── View mode ── */
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  <InfoRow label="Full Name" value={profile?.name || profile?.studentName || profile?.fullName} />
                  <InfoRow label="Email" value={profile?.email} />
                  <InfoRow label="Phone" value={profile?.phone || profile?.mobile} />
                  <InfoRow label="Address" value={profile?.address} />
                  {(profile?.bio || profile?.about) ? (
                    <InfoRow label="About" value={profile?.bio || profile?.about} />
                  ) : null}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Academic Information</Text>
                  <InfoRow label="Class / Grade" value={profile?.class || profile?.grade || profile?.standard} />
                  <InfoRow label="School" value={profile?.school || profile?.schoolName} />
                  <InfoRow label="Board" value={profile?.board} />
                  <InfoRow label="Roll Number" value={profile?.rollNumber || profile?.rollNo} />
                  <InfoRow label="Student ID" value={profile?.studentId || profile?.id} />
                  <InfoRow label="Section" value={profile?.section} />
                </View>

                {(profile?.skills?.length > 0 || profile?.achievements?.length > 0) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Skills & Achievements</Text>
                    {profile?.skills?.length > 0 && (
                      <View style={styles.tagsWrap}>
                        {profile.skills.map((s, i) => (
                          <View key={i} style={styles.tag}>
                            <Text style={styles.tagText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {profile?.achievements?.length > 0 && (
                      profile.achievements.map((a, i) => (
                        <View key={i} style={styles.achievementRow}>
                          <Text style={styles.achievementIcon}>🏆</Text>
                          <Text style={styles.achievementText}>{a.title || a}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 24 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },

  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: STUDENT.border,
  },
  screenTitle: { fontSize: 22, fontWeight: '800', color: STUDENT.textPrimary },
  editToggleBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: STUDENT.accent,
  },
  editToggleBtnActive: { backgroundColor: 'rgba(244, 63, 94, 0.15)', borderColor: '#f43f5e' },
  editToggleText: { fontSize: 13, fontWeight: '600', color: STUDENT.accent },
  editToggleTextActive: { color: '#f43f5e' },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: STUDENT.textMuted, fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: '#f43f5e', fontSize: 13 },

  // Avatar hero
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: STUDENT.accent + '33',
    borderWidth: 3,
    borderColor: STUDENT.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...STUDENT.shadow,
  },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: STUDENT.accent },
  heroName: { fontSize: 22, fontWeight: '800', color: STUDENT.textPrimary, marginBottom: 4 },
  heroEmail: { fontSize: 13, color: STUDENT.textMuted, marginBottom: 8 },
  heroBadge: {
    backgroundColor: STUDENT.accentCyan + '22',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: STUDENT.accentCyan + '44',
  },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: STUDENT.accentCyan },

  // Sections
  section: {
    backgroundColor: STUDENT.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: STUDENT.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: STUDENT.accent,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoLabel: { fontSize: 13, color: STUDENT.textMuted, flex: 1 },
  infoValue: { fontSize: 13, color: STUDENT.textPrimary, fontWeight: '600', flex: 1.5, textAlign: 'right' },

  // Edit fields
  editFieldWrap: { marginBottom: 14 },
  editLabel: { fontSize: 12, color: STUDENT.textMuted, marginBottom: 6, fontWeight: '600' },
  editInput: {
    backgroundColor: STUDENT.bgCardAlt,
    borderWidth: 1,
    borderColor: STUDENT.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: STUDENT.textPrimary,
  },
  editInputMulti: { height: 80, textAlignVertical: 'top' },

  saveBtn: {
    backgroundColor: STUDENT.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
    ...STUDENT.shadow,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Tags
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tag: {
    backgroundColor: STUDENT.accent + '22',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: STUDENT.accent + '44',
  },
  tagText: { fontSize: 12, color: STUDENT.accent, fontWeight: '600' },

  // Achievements
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  achievementIcon: { fontSize: 18 },
  achievementText: { fontSize: 13, color: STUDENT.textPrimary, flex: 1 },
});
