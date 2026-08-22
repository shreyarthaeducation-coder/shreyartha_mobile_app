import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING } from '../../../constants/theme';
import { usePalette } from '../../ui/PaletteContext';
import {
  Card,
  DateTimeField,
  EmptyState,
  FormSheet,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import useStaffResource from '../../../hooks/useStaffResource';
import {
  bannerUrl,
  createEvent,
  deleteEvent,
  fetchEventClasses,
  fetchEvents,
  targetClassList,
  validateEvent,
} from '../../../services/admin/eventService';
import { fetchAcademicYears, defaultAcademicYear } from '../../../services/teacher/scopeService';
import { pickPhoto } from '../../../utils/filePicker';
import { formatLongDateTime } from '../../../utils/dates';
import { makeStyles } from '../../../utils/makeStyles';

/**
 * Events — create and delete school events with a banner and a class audience.
 *
 * `targetClasses` is a comma-separated string of class NAMES, not ids, so the audience picker
 * keys on names throughout. Creating is multipart with flat form fields (see eventService).
 *
 * There is no edit here: the backend has a `PUT /{id}` the web never calls, and wiring an edit the
 * website does not have would put the app ahead of it on a destructive path (the PUT overwrites
 * every field, banner included).
 */

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'https://shreyartha.com'
).replace(/\/+$/, '');

const EMPTY_FORM = {
  title: '',
  description: '',
  startDateTime: '',
  endDateTime: '',
  targetClasses: [],
  bannerImage: null,
};

export default function EventManagementScreen({ homeRoute, apiBase, classesBase }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [yearId, setYearId] = useState(null);
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);

  const fetcher = useCallback((signal) => fetchEvents(apiBase, signal), [apiBase]);
  const { data, loading, error, refreshing, reload, refresh, revalidate } = useStaffResource(
    fetcher,
    { initialData: [] },
  );

  const events = data || [];

  // Academic years drive the audience picker only, so they load with the sheet rather than the
  // screen. `defaultAcademicYear` lands on `current === true` — never index 0, since startDate is
  // nullable and tail order is DB-dependent.
  useEffect(() => {
    if (!sheetOpen || years.length) return;
    let alive = true;
    (async () => {
      try {
        const rows = await fetchAcademicYears();
        if (!alive) return;
        setYears(rows);
        setYearId(defaultAcademicYear(rows)?.id ?? null);
      } catch {
        // A missing year list only costs the class picker; the rest of the form still works.
      }
    })();
    return () => {
      alive = false;
    };
  }, [sheetOpen, years.length]);

  useEffect(() => {
    if (!yearId) {
      setClasses([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const rows = await fetchEventClasses(classesBase, yearId);
        if (alive) setClasses(rows);
      } catch {
        if (alive) setClasses([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [yearId, classesBase]);

  // Changing the year changes which classes exist, so a stale selection would post names that are
  // no longer offered. The web clears it too.
  useEffect(() => {
    setForm((prev) => ({ ...prev, targetClasses: [] }));
  }, [yearId]);

  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

  const toggleClass = (className) =>
    setForm((prev) => ({
      ...prev,
      targetClasses: prev.targetClasses.includes(className)
        ? prev.targetClasses.filter((c) => c !== className)
        : [...prev.targetClasses, className],
    }));

  const pickBanner = async () => {
    const file = await pickPhoto();
    if (!file) return;
    if (file.denied) {
      showToast('Photo permission is needed to add a banner.', 'error');
      return;
    }
    patch({ bannerImage: file });
  };

  const submit = async () => {
    const problem = validateEvent(form);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      await createEvent(apiBase, form);
      showToast('Event created.', 'success');
      setSheetOpen(false);
      setForm(EMPTY_FORM);
      await revalidate();
    } catch (e) {
      showToast(e?.message || 'Failed to create event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (event) =>
    Alert.alert('Delete event?', `"${event.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(apiBase, event.id);
            showToast('Event deleted.', 'success');
            await revalidate();
          } catch (e) {
            showToast(e?.message || 'Failed to delete event.', 'error');
          }
        },
      },
    ]);

  return (
    <ScreenScaffold
      title="Events"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      {events.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          title="No events yet"
          message="Create an event to announce it to your classes."
          actionLabel="Create event"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        events.map((event) => {
          const banner = bannerUrl(event, BASE_URL);
          return (
            <Card key={event.id} style={styles.item}>
              {banner ? (
                <Image source={{ uri: banner }} style={styles.banner} resizeMode="cover" />
              ) : null}
              <View style={styles.head}>
                <Text style={styles.title} numberOfLines={2}>
                  {event.title}
                </Text>
                <Pressable
                  onPress={() => confirmDelete(event)}
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${event.title}`}
                >
                  <Ionicons name="trash-outline" size={17} color={SLATE[500]} />
                </Pressable>
              </View>
              {event.description ? (
                <Text style={styles.description} numberOfLines={3}>
                  {event.description}
                </Text>
              ) : null}
              <Text style={styles.when}>
                {formatLongDateTime(event.startDateTime)} → {formatLongDateTime(event.endDateTime)}
              </Text>
              <View style={styles.classRow}>
                {targetClassList(event.targetClasses).map((cls) => (
                  <StatusChip key={cls} label={cls} tone="info" />
                ))}
              </View>
            </Card>
          );
        })
      )}

      {events.length > 0 ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: PALETTE.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create event"
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      <FormSheet
        visible={sheetOpen}
        title="New event"
        onClose={() => setSheetOpen(false)}
        onSubmit={submit}
        submitLabel="Create"
        submitting={saving}
        fullHeight
      >
        <TextField
          label="Title"
          required
          value={form.title}
          onChangeText={(title) => patch({ title })}
          placeholder="e.g. Annual Day"
        />
        <TextField
          label="Description"
          value={form.description}
          onChangeText={(description) => patch({ description })}
          multiline
          inputStyle={styles.multiline}
        />
        <DateTimeField
          label="Starts"
          value={form.startDateTime}
          onChange={(startDateTime) => patch({ startDateTime })}
        />
        <DateTimeField
          label="Ends"
          value={form.endDateTime}
          onChange={(endDateTime) => patch({ endDateTime })}
        />

        <Select
          label="Academic year"
          value={yearId}
          onChange={setYearId}
          options={years.map((year) => ({
            value: year.id,
            // The DTO field is `yearLabel` — there is no `name`/`yearName`. Matches ScopePicker.
            label: year.current ? `${year.yearLabel} (Current)` : year.yearLabel,
          }))}
          placeholder="Choose a year"
        />

        <Text style={styles.pickerLabel}>Audience</Text>
        {classes.length === 0 ? (
          <Text style={styles.pickerHint}>
            {yearId ? 'No classes in this year.' : 'Choose an academic year first.'}
          </Text>
        ) : (
          <View style={styles.classPicker}>
            {classes.map((cls) => {
              const selected = form.targetClasses.includes(cls.className);
              return (
                <Pressable
                  key={cls.id}
                  onPress={() => toggleClass(cls.className)}
                  style={({ pressed }) => [
                    styles.classChip,
                    selected && { backgroundColor: PALETTE.tint, borderColor: PALETTE.primary },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Text
                    style={[styles.classChipText, selected && { color: PALETTE.primaryDark }]}
                  >
                    {cls.className}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.pickerLabel}>Banner</Text>
        <Pressable
          onPress={pickBanner}
          style={({ pressed }) => [styles.bannerPick, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {form.bannerImage ? (
            <Image
              source={{ uri: form.bannerImage.uri }}
              style={styles.bannerPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.bannerEmpty}>
              <Ionicons name="image-outline" size={22} color={SLATE[400]} />
              <Text style={styles.bannerEmptyText}>Choose a banner image</Text>
            </View>
          )}
        </Pressable>
      </FormSheet>
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  item: { marginBottom: SPACING.sm },
  banner: { width: '100%', height: 130, borderRadius: 10, marginBottom: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '700', color: SLATE[800] },
  deleteBtn: { padding: 4 },
  description: { fontSize: 13, color: SLATE[500], lineHeight: 19, marginTop: 4 },
  when: { fontSize: 12.5, color: SLATE[600], fontWeight: '600', marginTop: 8 },
  classRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pressed: { opacity: 0.7 },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  pickerLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: SLATE[600],
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  pickerHint: { fontSize: 12.5, color: SLATE[400] },
  classPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  classChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  classChipText: { fontSize: 13, fontWeight: '700', color: SLATE[600] },
  bannerPick: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    overflow: 'hidden',
    backgroundColor: SLATE[50],
  },
  bannerPreview: { width: '100%', height: 140 },
  bannerEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 26, gap: 6 },
  bannerEmptyText: { fontSize: 13, color: SLATE[500], fontWeight: '600' },
}));
