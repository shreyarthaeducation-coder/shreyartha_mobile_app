import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/apiService';
import { deleteStudentAccount } from '../../services/authService';

const ROW_ICON = { name: '👤', email: '✉️', phone: '📱', class: '🎓', board: '📋', stream: '📚' };

export default function StudentProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get('/api/students/profile');
      setProfile(data);
    } catch {
      const stored = await AsyncStorage.getItem('userData');
      if (stored) {
        try { setProfile(JSON.parse(stored)); } catch { /* empty */ }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleLogout = async () => {
    await logout();
    router.replace('/(tabs)');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and all your data, progress, and subscriptions will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const token = await AsyncStorage.getItem('studentToken');
      await deleteStudentAccount(token);
      await logout();
      Alert.alert(
        'Account Deleted',
        'Your account has been successfully deleted. We\'re sorry to see you go.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to delete account. Please try again or contact support@shreyartha.com.');
    } finally {
      setDeleting(false);
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#b0003a" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/'))}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(profile?.fullName || profile?.name || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.fullName || profile?.name || 'Student'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
        </View>

        {/* Info card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          <InfoRow icon={ROW_ICON.name}  label="Full Name"    value={profile?.fullName || profile?.name} />
          <InfoRow icon={ROW_ICON.email} label="Email"        value={profile?.email} />
          <InfoRow icon={ROW_ICON.phone} label="Mobile"       value={profile?.mobile || profile?.phone} />
          <InfoRow icon={ROW_ICON.class} label="Class"        value={profile?.className || profile?.currentClass || profile?.class} />
          <InfoRow icon={ROW_ICON.board} label="Board"        value={profile?.board || profile?.schoolBoard} />
          <InfoRow icon={ROW_ICON.stream} label="Stream"      value={profile?.stream} />
        </View>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Account Actions</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push({
              pathname: '/student/learn',
              params: { label: 'Edit Profile', path: '/student/platform/dashboard' },
            })}
          >
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionLabel}>Edit Profile</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push({
              pathname: '/student/learn',
              params: { label: 'Change Password', path: '/student/platform/dashboard' },
            })}
          >
            <Text style={styles.actionIcon}>🔑</Text>
            <Text style={styles.actionLabel}>Change Password</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://shreyartha.com/privacy')}
          >
            <Text style={styles.actionIcon}>🔒</Text>
            <Text style={styles.actionLabel}>Privacy Policy</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://shreyartha.com/privacy')}
          >
            <Text style={styles.actionIcon}>📄</Text>
            <Text style={styles.actionLabel}>Terms &amp; Conditions</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity
          style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <>
              <Text style={styles.deleteIcon}>🗑️</Text>
              <Text style={styles.deleteBtnText}>Delete My Account</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.deleteWarning}>
          Deleting your account is permanent and cannot be reversed.
          All progress, data, and active subscriptions will be lost.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 15 },
  headerSpacer: { width: 56 },

  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 20 },

  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#b0003a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 2 },
  profileEmail: { fontSize: 13, color: '#64748b' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoIcon: { fontSize: 16, marginRight: 10, marginTop: 1 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginBottom: 1 },
  infoValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  actionIcon: { fontSize: 18, marginRight: 12 },
  actionLabel: { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '500' },
  actionArrow: { fontSize: 20, color: '#94a3b8' },

  logoutBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  logoutBtnText: { color: '#64748b', fontSize: 15, fontWeight: '700' },

  deleteBtn: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteIcon: { fontSize: 18 },
  deleteBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  deleteWarning: { fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
});
