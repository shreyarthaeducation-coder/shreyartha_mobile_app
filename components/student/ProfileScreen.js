import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
import { useToast } from '../ui';
import usePortalLogout from '../../hooks/usePortalLogout';
import { TAB_BAR_HEIGHT } from '../shared/home/PortalTabBar';
import StudentScaffold from './StudentScaffold';
import { StudentCard, StudentCardTitle } from './StudentCard';
import ProfileFormTab from './ProfileFormTab';
import SkillsTab from './profile/SkillsTab';
import CareerTab from './profile/CareerTab';
import SurveyTab from './profile/SurveyTab';
import UniversityTab from './profile/UniversityTab';
import { PROFILE_TABS } from '../../constants/studentProfileForms';
import {
  fetchProfileSection,
  tabComplete,
  removeProfilePicture,
  removeProfileVideo,
  uploadProfilePicture,
  uploadProfileVideo,
} from '../../services/student/profileService';
import { pickFile, pickPhoto } from '../../utils/filePicker';

/**
 * Student Profile — the eight-tab shell.
 *
 * The web (`platform/profile.js`) is a left rail of tabs with a completion dot on each, plus the
 * avatar and video upload. On a phone the rail becomes a horizontally scrolling chip row, which
 * is the only shape that fits eight tabs.
 *
 * THE COMPLETION DOTS ARE THE POINT of this screen — they are how a student knows what is left to
 * fill in. Each is computed from that tab's own record by `tabComplete`, whose predicates are
 * copied from the web exactly; inventing simpler ones would tell students they are done when the
 * website disagrees.
 *
 * Five tabs are plain forms and share one config-driven renderer (`ProfileFormTab` over
 * `constants/studentProfileForms.js`). Three are not forms and have their own components: Skills
 * (a picker sourced from the live Skills Edge tree), Career (a cascading chooser whose slots lock
 * once saved) and Survey (a questionnaire that locks once submitted).
 */

/**
 * The server's own caps, mirrored exactly (`StudentController`).
 *
 * Checking client-side turns a wasted upload over mobile data into an instant message — and above
 * 100 MB the servlet container aborts with an opaque error instead of the friendly JSON, so for a
 * large video this check is the only thing keeping the failure legible.
 */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export default function ProfileScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const insets = useSafeAreaInsets();
  // Bare `logout` only clears storage — it does not navigate, so the user stayed put on a
  // signed-out screen. See hooks/usePortalLogout.js.
  const { confirmLogout } = usePortalLogout({ loginRoute: '/auth/student-login' });

  /**
   * `?tab=career` opens straight on that tab.
   *
   * The dashboard's identity card deep-links here: tapping the Career Preferences row must land on
   * the tab that edits it, not on Personal with seven chips to scroll past. Read once as the
   * initial state rather than kept in sync — once the student is here, the chip row owns the tab.
   */
  const { tab: initialTab } = useLocalSearchParams();
  const [tab, setTab] = useState(() =>
    PROFILE_TABS.some((t) => t.key === initialTab) ? String(initialTab) : 'personal',
  );
  const [me, setMe] = useState(null);
  const [completion, setCompletion] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  /**
   * Completion is eight independent reads. Guarded individually — a free student legitimately
   * 403s on some of these, and losing the whole dot row over one refusal would be worse than
   * showing that tab as incomplete.
   */
  const loadCompletion = useCallback(async () => {
    const keys = PROFILE_TABS.map((t) => t.key);
    const results = await Promise.allSettled(keys.map((k) => fetchProfileSection(k)));
    const next = {};
    keys.forEach((key, i) => {
      const r = results[i];
      next[key] = r.status === 'fulfilled' && tabComplete(key, r.value);
      if (key === 'personal' && r.status === 'fulfilled') setMe(r.value);
    });
    setCompletion(next);
  }, []);

  useEffect(() => {
    loadCompletion();
  }, [loadCompletion]);

  const changePhoto = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    if (picked.denied) {
      showToast('Allow photo access to change your picture.', 'error');
      return;
    }
    // The server caps at 5 MB and answers 400. Checking first turns a wasted upload over mobile
    // data into an instant, specific message.
    if (picked.size && picked.size > MAX_PHOTO_BYTES) {
      showToast('Image must be less than 5MB.', 'error');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadProfilePicture(picked);
      if (res?.url || res?.profilePicture) {
        setMe((prev) => ({ ...prev, profilePicture: res.url || res.profilePicture }));
      }
      showToast('Photo uploaded!', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not upload the picture.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await removeProfilePicture();
      setMe((prev) => ({ ...prev, profilePicture: null }));
      showToast('Photo removed', 'success');
    } catch (e) {
      showToast(e?.message || 'Failed to remove', 'error');
    } finally {
      setUploading(false);
    }
  };

  /**
   * The video, which is a SEPARATE control with its own endpoint and its own limit.
   *
   * `pickFile(['video/*'])` rather than the image picker. Note the MIME fallback: DocumentPicker
   * hands back `application/octet-stream` when the OS reports no type, and the server rejects that
   * outright with "Only video files are allowed" — so a perfectly good MP4 would be refused for a
   * reason the student cannot act on.
   */
  const changeVideo = async () => {
    const picked = await pickFile(['video/*']);
    if (!picked) return;
    if (picked.size && picked.size > MAX_VIDEO_BYTES) {
      // Above 100 MB the servlet container aborts with an opaque error instead of the friendly
      // JSON, so this check is what keeps every oversized file legible.
      showToast('Video must be less than 50MB.', 'error');
      return;
    }
    setUploadingVideo(true);
    try {
      const file = {
        ...picked,
        type: picked.type?.startsWith('video/') ? picked.type : 'video/mp4',
      };
      const res = await uploadProfileVideo(file);
      if (res?.url || res?.profileVideo) {
        setMe((prev) => ({ ...prev, profileVideo: res.url || res.profileVideo }));
      }
      showToast('Video uploaded!', 'success');
    } catch (e) {
      showToast(e?.message || 'Could not upload the video.', 'error');
    } finally {
      setUploadingVideo(false);
    }
  };

  const removeVideo = async () => {
    setUploadingVideo(true);
    try {
      await removeProfileVideo();
      setMe((prev) => ({ ...prev, profileVideo: null }));
      showToast('Video removed', 'success');
    } catch (e) {
      showToast(e?.message || 'Failed to remove', 'error');
    } finally {
      setUploadingVideo(false);
    }
  };


  return (
    <StudentScaffold title="Student Profile" toast={toast}>
      <StudentCard style={styles.identity}>
        <Pressable
          onPress={changePhoto}
          disabled={uploading}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
        >
          {me?.profilePicture ? (
            <Image source={{ uri: me.profilePicture }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={30} color={palette.deep} />
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'camera'} size={12} color="#ffffff" />
          </View>
        </Pressable>
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {me?.fullName || 'Your profile'}
          </Text>
          {me?.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {me.email}
            </Text>
          ) : null}
        </View>
      </StudentCard>

      {/* TWO SEPARATE CONTROLS, as on the website — different pickers, different endpoints,
          different size caps (5 MB / 50 MB). Collapsing them into one "upload media" button would
          make it impossible to tell the app which of the two you meant. */}
      <StudentCard>
        <StudentCardTitle>Photo & video</StudentCardTitle>

        <View style={styles.mediaRow}>
          <View style={styles.mediaCol}>
            <Text style={styles.mediaLabel}>
              {me?.profilePicture ? '📷 Photo added' : '📷 No photo yet'}
            </Text>
            <Pressable
              onPress={changePhoto}
              disabled={uploading}
              style={({ pressed }) => [styles.mediaBtn, uploading && styles.dim, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.mediaBtnText}>
                {uploading ? 'Uploading…' : me?.profilePicture ? 'Change Photo' : 'Upload Photo'}
              </Text>
            </Pressable>
            {me?.profilePicture ? (
              <Pressable
                onPress={removePhoto}
                disabled={uploading}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.mediaCol}>
            <Text style={styles.mediaLabel}>
              {me?.profileVideo ? '🎥 Video added' : '🎥 No video yet'}
            </Text>
            <Pressable
              onPress={changeVideo}
              disabled={uploadingVideo}
              style={({ pressed }) => [
                styles.mediaBtn,
                uploadingVideo && styles.dim,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.mediaBtnText}>
                {uploadingVideo ? 'Uploading…' : me?.profileVideo ? 'Change Video' : 'Upload Video'}
              </Text>
            </Pressable>
            {me?.profileVideo ? (
              <Pressable
                onPress={removeVideo}
                disabled={uploadingVideo}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={styles.mediaNote}>Photo up to 5 MB · video up to 50 MB.</Text>
      </StudentCard>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {PROFILE_TABS.map((t) => {
          const on = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={on ? palette.onPrimary : palette.onDark}
              />
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              {/* The dot is the whole reason the web has this rail. */}
              {completion[t.key] ? (
                <View style={styles.dot}>
                  <Ionicons name="checkmark" size={9} color="#ffffff" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* The three `custom` tabs are not static forms — a live-sourced picker, a cascading
          locked-slot chooser and a questionnaire — so each has its own component. The other five
          all run through the one config-driven renderer. */}
      {tab === 'skillsedge' ? (
        <SkillsTab showToast={showToast} />
      ) : tab === 'career' ? (
        <CareerTab showToast={showToast} />
      ) : tab === 'survey' ? (
        <SurveyTab showToast={showToast} />
      ) : tab === 'university' ? (
        <UniversityTab showToast={showToast} />
      ) : (
        <ProfileFormTab key={tab} tabKey={tab} showToast={showToast} />
      )}

      {/* LOG OUT LIVES HERE NOW.
          It was a header icon on the dashboard, which the redesign replaced with the brand bar —
          and the design's footer has exactly three tabs, none of them an account menu. Profile is
          where every other app of this shape keeps it, and it is one of the three tab roots, so it
          is never more than one tap away.

          `confirmLogout`, not `logout`: the bare call empties AsyncStorage without navigating, and
          the layout guard reads its token once on mount, so the student would sit on a fully
          rendered signed-out profile until some unrelated request happened to 401. */}
      <Pressable
        onPress={confirmLogout}
        style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={18} color={FEEDBACK.errorText} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      {/* Clears the footer, which the layout paints over this screen. */}
      <View style={{ height: TAB_BAR_HEIGHT + (insets.bottom || SPACING.sm) }} />
    </StudentScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.min,
    borderRadius: 14,
    backgroundColor: FEEDBACK.errorBg,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    marginTop: SPACING.sm,
  },
  logoutText: { fontSize: TYPE.heading, fontWeight: '700', color: FEEDBACK.errorText },

  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.tint,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 32 },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: p.primaryDark,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  identityText: { flex: 1 },
  name: { fontSize: TYPE.title, fontWeight: '700', color: SLATE[800] },
  email: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },

  tabRow: { gap: 7, paddingBottom: SPACING.md, paddingRight: SPACING.md },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: p.headerBorder,
  },
  tabOn: { backgroundColor: p.primary, borderColor: p.primary },
  tabText: { fontSize: TYPE.label, fontWeight: '600', color: p.onDark },
  tabTextOn: { color: p.onPrimary },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34d399',
  },

  mediaRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.sm },
  mediaCol: { flex: 1, alignItems: 'center', gap: 7 },
  mediaLabel: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[600], textAlign: 'center' },
  mediaBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: p.primary,
    minHeight: TOUCH.min,
    justifyContent: 'center',
  },
  mediaBtnText: { fontSize: TYPE.label, fontWeight: '700', color: p.onPrimary },
  removeBtn: { minHeight: TOUCH.min, justifyContent: 'center', paddingHorizontal: 10 },
  removeText: { fontSize: TYPE.caption, fontWeight: '700', color: FEEDBACK.errorText },
  mediaNote: { fontSize: TYPE.caption, color: SLATE[400], textAlign: 'center', marginTop: SPACING.sm },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.78 },
}));
