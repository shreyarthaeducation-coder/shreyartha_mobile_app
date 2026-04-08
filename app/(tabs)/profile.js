import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, SHADOWS, FONTS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/profileService';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userType, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editData, setEditData] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const [initialized, setInitialized] = useState(false);

  const loadProfile = useCallback(async (isRefresh = false) => {
    if (!userType) return;
    try {
      if (!isRefresh) setLoadingProfile(true);
      setProfileError(null);
      let result = null;
      if (userType === 'student') result = await profileService.getStudentProfile();
      else if (userType === 'school') result = await profileService.getSchoolProfile();
      else if (userType === 'parent') result = await profileService.getParentProfile();
      else if (userType === 'admin') result = await profileService.getAdminProfile();
      const data = result?.data || result;
      setProfile(data);
      setEditData({
        name: data?.name || data?.fullName || '',
        email: data?.email || '',
        phone: data?.phone || data?.mobile || '',
      });
    } catch (e) {
      setProfileError(e?.message || 'Could not load profile');
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  }, [userType]);

  // Initialize once when screen mounts and user is logged in
  if (!initialized && !authLoading && userType) {
    setInitialized(true);
    loadProfile();
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile(true);
  }, [loadProfile]);

  const handleSaveEdit = async () => {
    setEditLoading(true);
    try {
      await profileService.updateStudentProfile(editData);
      setProfile((prev) => ({ ...prev, ...editData }));
      setEditVisible(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update profile.');
    } finally {
      setEditLoading(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Not logged in
  if (!userType) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.promptIcon}>👤</Text>
          <Text style={styles.promptTitle}>You're not logged in</Text>
          <Text style={styles.promptSubtitle}>
            Sign in to view and manage your profile, track progress, and access your personalized dashboard.
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push('/auth/login-select')}
          >
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.name || profile?.fullName || user?.name || user?.email || 'User';
  const initials = displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  const email = profile?.email || user?.email || '';
  const phone = profile?.phone || profile?.mobile || '';
  const school = profile?.school || profile?.schoolName || '';
  const grade = profile?.class || profile?.grade || '';
  const role = userType?.charAt(0).toUpperCase() + userType?.slice(1);

  const ROLE_COLORS = {
    student: '#1565C0',
    school: '#2E7D32',
    parent: '#6A1B9A',
    admin: COLORS.primary,
  };
  const roleColor = ROLE_COLORS[userType] || COLORS.primary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.header, { backgroundColor: roleColor }]}>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, SHADOWS.md]}>
          <View style={[styles.avatarCircle, { backgroundColor: roleColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{role}</Text>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: roleColor }]}
            onPress={() => setEditVisible(true)}
          >
            <Text style={[styles.editBtnText, { color: roleColor }]}>✏️  Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {loadingProfile && !profile ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile…</Text>
          </View>
        ) : null}

        {profileError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {profileError}</Text>
            <TouchableOpacity onPress={() => loadProfile()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Info cards */}
        {profile ? (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Account Details</Text>

            <InfoRow icon="✉️" label="Email" value={email || '—'} />
            {phone ? <InfoRow icon="📞" label="Phone" value={phone} /> : null}
            {school ? <InfoRow icon="🏫" label="School" value={school} /> : null}
            {grade ? <InfoRow icon="📚" label="Class / Grade" value={grade} /> : null}
            {profile?.rollNumber ? <InfoRow icon="🆔" label="Roll Number" value={profile.rollNumber} /> : null}
            {profile?.city ? <InfoRow icon="📍" label="City" value={profile.city} /> : null}
          </View>
        ) : null}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={editData.name}
              onChangeText={(v) => setEditData((p) => ({ ...p, name: v }))}
              placeholder="Your name"
            />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              value={editData.email}
              onChangeText={(v) => setEditData((p) => ({ ...p, email: v }))}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.textInput}
              value={editData.phone}
              onChangeText={(v) => setEditData((p) => ({ ...p, phone: v }))}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: roleColor }]}
              onPress={handleSaveEdit}
              disabled={editLoading}
            >
              {editLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={[rowStyles.row, SHADOWS.sm]}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={rowStyles.text}>
        <Text style={rowStyles.label}>{label}</Text>
        <Text style={rowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  icon: { fontSize: 22, marginRight: SPACING.md },
  text: { flex: 1 },
  label: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '600', color: COLORS.secondary },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  promptIcon: { fontSize: 64, marginBottom: SPACING.md },
  promptTitle: { fontSize: 22, fontWeight: '700', color: COLORS.secondary, marginBottom: SPACING.sm, textAlign: 'center' },
  promptSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 30,
  },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: SPACING.lg },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  profileName: { fontSize: 20, fontWeight: '700', color: COLORS.secondary, marginBottom: 4 },
  profileEmail: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  roleText: { fontSize: 13, fontWeight: '700' },
  editBtn: {
    borderWidth: 2,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: SPACING.lg,
  },
  editBtnText: { fontWeight: '600', fontSize: 14 },
  loadingText: { color: COLORS.textSecondary, marginTop: SPACING.sm },
  errorBox: {
    backgroundColor: '#fff3f5',
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { color: COLORS.error, flex: 1, fontSize: 13 },
  retryText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  infoSection: { marginHorizontal: SPACING.md },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: SPACING.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.secondary },
  modalClose: { fontSize: 18, color: COLORS.textLight, padding: SPACING.xs },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  saveBtn: {
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
