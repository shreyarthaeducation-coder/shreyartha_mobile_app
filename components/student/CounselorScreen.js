import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import { DateTimeField, FormSheet, Select, useToast } from '../ui';
import { makeStyles } from '../../utils/makeStyles';
import StudentScaffold from './StudentScaffold';
import { StudentCard } from './StudentCard';
import { TAB_BAR_HEIGHT } from '../shared/home/PortalTabBar';
import { fetchProfileSection } from '../../services/student/profileService';
import {
  PREFERRED_MODES,
  QUERY_OPTIONS,
  submitCounselorQuery,
} from '../../services/student/counselorService';
// By PATH, not through components/staff/index.js — a barrel import here is an app-wide import.
import ShreyaChatSheet from '../staff/ShreyaChatSheet';
import { STUDENT_CHATBOT_CONFIG } from '../../constants/studentChatbotConfig';

/**
 * Speak to Counselor — the last student surface that was still a WebView.
 *
 * Ports frontendmain/src/student/platform/counselor.js: a hero line, two cards, and a booking form.
 * Copy comes from the web's own en/translation.json `counselor.*` block, so both platforms say the
 * same thing.
 *
 * ── THE CHAT CARD REUSES THE SHARED SHEET ────────────────────────────────────
 * "Ask Shreya" is the same machine the parent and teacher portals already run natively: the backend
 * DTOs are literally the same classes (SectionSummaryRequest, ShreyaReplyResponse, SubTile and
 * ChapterLink all live in one package and serve all three), and the error contract is identical. So
 * this mounts `ShreyaChatSheet` with a student config rather than porting 653 lines of
 * StudentChatbot.js. See constants/studentChatbotConfig.js.
 *
 * ── TWO WEB FLOURISHES ARE NOT PORTED, DELIBERATELY ──────────────────────────
 * The "Meet Jyora" banner button and the ShreyaIntroModal are onboarding animations that gate the
 * chat behind an intro. On a phone the chat is one tap from here; putting a modal in front of it
 * would be worse, not equal. The chat itself is complete.
 *
 * ── ONE DATETIME FIELD, NOT TWO ──────────────────────────────────────────────
 * The web has separate date and time inputs and joins them by hand. `DateTimeField` already emits
 * `toLocalDateTimeString()` — "2026-08-21T14:30:00" — which is exactly the LocalDateTime the
 * backend parses, so the join (and its chance of a timezone slip) disappears.
 */

const CHATBOT_AVATAR = require('../../assets/images/Chatbot.png');

const EMPTY_FORM = { preferredDateTime: null, preferredMode: '', queryFor: '', queryDetails: '' };

export default function CounselorScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const { toast, showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { chat: chatParam } = useLocalSearchParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Shown INSIDE the sheet. The toast is rendered by StudentScaffold, which sits behind the modal,
  // so a failure surfaced as a toast while the sheet is still open is invisible.
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProfileSection('personal');
      setProfile(data);
      // Seed the name the chat sheet greets with. That sheet reads storage rather than taking a
      // prop, so one component can serve four portals; this is the only writer of the student key,
      // and the key is in ALL_AUTH_KEYS so it cannot outlive the session.
      const name = data?.fullName || data?.name || '';
      if (name) await AsyncStorage.setItem('studentUserName', name);
    } catch {
      // The page still works without it — only the read-only Full Name row and the greeting are
      // affected, and the server resolves the student from the JWT regardless.
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * `?chat=1` opens the sheet on arrival.
   *
   * The dashboard's Shreya card promises a conversation ("Ask anything, get instant answers"), so
   * landing on a menu with a Start Chat button would make the student tap twice for the thing they
   * already asked for. Deliberately gated on `!loading`: the sheet greets by name, and that name
   * comes from the profile `load()` writes to storage — opening first would greet a blank.
   */
  useEffect(() => {
    if (chatParam === '1' && !loading) setChatOpen(true);
  }, [chatParam, loading]);

  const queryOptions = useMemo(() => QUERY_OPTIONS.map((o) => ({ value: o, label: o })), []);

  const patch = (next) => {
    setForm((prev) => ({ ...prev, ...next }));
    setErrors((prev) => {
      const cleared = { ...prev };
      Object.keys(next).forEach((k) => delete cleared[k]);
      return cleared;
    });
  };

  const openBooking = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError('');
    setBookOpen(true);
  };

  const validate = () => {
    const errs = {};
    // The web validates date and time separately; one field means one message.
    if (!form.preferredDateTime) errs.preferredDateTime = 'Please select a date and time.';
    if (!form.preferredMode) errs.preferredMode = 'Please select a preferred mode.';
    if (!form.queryFor) errs.queryFor = 'Please select a query type.';
    if (!form.queryDetails.trim()) errs.queryDetails = 'Please explain your query.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitCounselorQuery({
        preferredDateTime: form.preferredDateTime,
        preferredMode: form.preferredMode,
        queryFor: form.queryFor,
        queryDetails: form.queryDetails.trim(),
      });
      setBookOpen(false);
      setForm(EMPTY_FORM);
      // Toast only AFTER the sheet closes, so it is on screen rather than behind the modal.
      showToast('Your counseling session request has been submitted successfully!');
    } catch (e) {
      // A rejected preferredMode is a 400 whose `message` names the allowed values — show it.
      setSubmitError(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = profile?.fullName || profile?.name || '';

  return (
    <>
      <StudentScaffold title="Speak to Counselor" loading={loading} toast={toast}>
        <Text style={styles.subtitle}>Choose how you would like to get guidance and support.</Text>

        <StudentCard style={styles.card}>
          <View style={styles.iconWrap}>
            <Image source={CHATBOT_AVATAR} style={styles.avatar} resizeMode="cover" />
          </View>
          <Text style={styles.cardTitle}>Chat bot – Ask Shreya</Text>
          <Text style={styles.cardText}>
            Get instant answers and guidance from our AI-powered counselor, Shreya.
          </Text>
          <Pressable
            onPress={() => setChatOpen(true)}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Start Chat</Text>
          </Pressable>
        </StudentCard>

        <StudentCard style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.emoji}>🧑‍💼</Text>
          </View>
          <Text style={styles.cardTitle}>Speak to personalised counselor</Text>
          <Text style={styles.cardText}>
            Schedule a session with a dedicated counselor tailored to your needs.
          </Text>
          <Pressable
            onPress={openBooking}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: palette.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Book a Session</Text>
          </Pressable>
        </StudentCard>

        {/* This screen is the footer's Support tab, and the layout paints that bar over it. */}
        <View style={{ height: TAB_BAR_HEIGHT + (insets.bottom || SPACING.sm) }} />
      </StudentScaffold>

      <FormSheet
        visible={bookOpen}
        title="Book Counseling Session"
        onClose={() => setBookOpen(false)}
        onSubmit={handleSubmit}
        submitLabel="Submit Request"
        submitting={submitting}
        fullHeight
      >
        {fullName ? (
          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>Full Name</Text>
            <Text style={styles.readonlyValue}>{fullName}</Text>
          </View>
        ) : null}

        <DateTimeField
          label="Preferred Date & Time"
          mode="datetime"
          value={form.preferredDateTime}
          onChange={(preferredDateTime) => patch({ preferredDateTime })}
          // The web puts `min={TODAY}` on the date input; a session cannot be booked in the past.
          minimumDate={new Date()}
          placeholder="Select a date and time"
        />
        {errors.preferredDateTime ? (
          <Text style={styles.error}>{errors.preferredDateTime}</Text>
        ) : null}

        <Select
          label="Preferred Method"
          value={form.preferredMode}
          options={PREFERRED_MODES}
          onChange={(preferredMode) => patch({ preferredMode })}
          placeholder="Select preferred method"
          error={errors.preferredMode}
        />

        <Select
          label="Query For"
          value={form.queryFor}
          options={queryOptions}
          onChange={(queryFor) => patch({ queryFor })}
          placeholder="Select a query type"
          error={errors.queryFor}
        />

        <Text style={styles.label}>Query Details</Text>
        <TextInput
          style={styles.textarea}
          value={form.queryDetails}
          onChangeText={(queryDetails) => patch({ queryDetails })}
          placeholder="Describe your query in detail..."
          placeholderTextColor={SLATE[500]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!submitting}
        />
        {errors.queryDetails ? <Text style={styles.error}>{errors.queryDetails}</Text> : null}

        {submitError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{submitError}</Text>
          </View>
        ) : null}
      </FormSheet>

      <ShreyaChatSheet
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
        basePath="/student"
        config={STUDENT_CHATBOT_CONFIG}
      />
    </>
  );
}

const useStyles = makeStyles((p) => ({
  subtitle: {
    fontSize: TYPE.heading,
    color: SLATE[600],
    lineHeight: leading(TYPE.heading),
    marginBottom: SPACING.md,
  },
  card: { marginBottom: SPACING.md, alignItems: 'center' },
  iconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    backgroundColor: p.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: { width: '100%', height: '100%' },
  emoji: { fontSize: 30 },
  cardTitle: {
    fontSize: TYPE.title,
    fontWeight: '800',
    color: SLATE[800],
    textAlign: 'center',
    marginBottom: 6,
  },
  cardText: {
    fontSize: TYPE.body,
    color: SLATE[600],
    textAlign: 'center',
    lineHeight: leading(TYPE.body),
    marginBottom: SPACING.md,
  },
  btn: {
    alignSelf: 'stretch',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnText: { color: '#ffffff', fontSize: TYPE.heading, fontWeight: '700' },
  pressed: { opacity: 0.78 },

  readonly: { marginBottom: SPACING.md },
  readonlyLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[600], marginBottom: 5 },
  readonlyValue: {
    fontSize: TYPE.heading,
    color: SLATE[600],
    backgroundColor: SLATE[100],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  label: {
    fontSize: TYPE.body,
    fontWeight: '700',
    color: SLATE[700],
    marginTop: SPACING.md,
    marginBottom: 6,
  },
  textarea: {
    minHeight: 104,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: TYPE.heading,
    color: SLATE[800],
    backgroundColor: '#ffffff',
  },
  error: { color: FEEDBACK.errorText, fontSize: TYPE.label, marginTop: 5 },
  errorBox: {
    marginTop: SPACING.md,
    backgroundColor: FEEDBACK.errorBg,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: FEEDBACK.errorBorder,
  },
  errorBoxText: { color: FEEDBACK.errorText, fontSize: TYPE.body, lineHeight: leading(TYPE.body) },
}));
