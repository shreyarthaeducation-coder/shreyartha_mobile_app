import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import {
  CalendarGrid,
  Card,
  CardTitle,
  EmptyState,
  FormSheet,
  MonthNavigator,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../ui';
import { usePalette } from '../../ui/PaletteContext';
import makeStyles from '../../../utils/makeStyles';
import useStaffResource from '../../../hooks/useStaffResource';
import { takePhoto } from '../../../utils/filePicker';
import { captureVisitLocation, mapEmbedUrl, resolvePincode } from '../../../utils/salesLocation';
import { captureStampedPhoto, fetchMapThumbnail } from '../../../utils/salesPhotoStamp';
import SalesPhotoStamp from './SalesPhotoStamp';
import SchoolSearchSheet from './SchoolSearchSheet';
import {
  VISIT_TYPES,
  fetchVisitCalendar,
  fetchVisitedSchools,
  planVisit,
  updateVisit,
} from '../../../services/sales/salesService';
import { enqueueVisit, flushQueue, newDedupeKey, queueSize } from '../../../services/sales/visitQueue';
import {
  CUSTOMER_READINGS,
  PLANNED_COLOR,
  VISIT_TYPE_COLOR,
  dateTime,
  hasReading,
  humanise,
  isRemoteVisit,
  monthDates,
  readingLabel,
  readingTone,
  shortDate,
} from './salesFormat';

/**
 * Field visits — the month calendar, the check-in flow, and the offline queue.
 *
 * ── EVERY CHECK-IN GOES THROUGH THE QUEUE ───────────────────────────────────
 * Even online. The rep gets the same confirmation either way, and the send is one code path
 * instead of two — a "post directly, queue on failure" split is how the offline branch ends up
 * being the one nobody ever exercises.
 *
 * ── THE MAP IS A WEBVIEW, NOT react-native-maps ─────────────────────────────
 * A native map module would force a full store release (versionCode is bumped by hand here and
 * there is no OTA channel) and would need a Google key inside the bundle. The keyless embed
 * renders the same read-only pin. There is nothing to drag: captured GPS is immutable by design,
 * because a draggable pin is a fraud vector when visit counts feed incentive.
 */

const EMPTY_CHECK_IN = {
  leadId: '',
  visitType: 'SALES',
  metPersonName: '',
  metPersonDesignation: '',
  metPersonPhone: '',
  remarks: '',
  customerReading: '',
  nextFollowUpDate: '',
  pincode: '',
};

export default function SalesVisitsScreen({ homeRoute = '/staff/sales' }) {
  const palette = usePalette();
  const styles = useStyles();
  const { toast, showToast } = useToast();

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [detail, setDetail] = useState(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [pending, setPending] = useState(0);
  // What the follow-up rail hands the check-in sheet: the school, and the last visit's details.
  const [prefill, setPrefill] = useState(null);

  const calendarFetcher = useCallback(
    (signal) => fetchVisitCalendar(year, month, signal),
    [year, month],
  );
  const {
    data: calendar,
    loading,
    error,
    refreshing,
    reload,
    refresh,
    revalidate,
  } = useStaffResource(calendarFetcher);

  // No /leads fetch here any more. The calendar payload carries `schoolName` on every row, so a
  // second request purely to resolve names was both redundant and wrong: a visit whose lead had
  // since been deleted fell back to rendering its visit TYPE where a school name belongs. The web
  // dropped the same call for the same reason — see the comment in SalesVisits.js.
  //
  // `leadOptions` went with it: the lead dropdown it fed was replaced by SchoolSearchSheet, which
  // queries the org-wide directory itself.

  const visitedFetcher = useCallback((signal) => fetchVisitedSchools(signal), []);
  const { data: visitedData, reload: reloadVisited } = useStaffResource(visitedFetcher);
  const visited = useMemo(() => (Array.isArray(visitedData) ? visitedData : []), [visitedData]);

  /**
   * Opens check-in already filled in from that school's last visit.
   *
   * The point of the rail: a follow-up is the commonest thing a rep does and used to mean
   * re-typing the school, the person met, their designation and their number.
   */
  const followUp = useCallback((row) => {
    setPrefill({
      school: {
        leadId: row.leadId,
        schoolName: row.schoolName,
        city: row.city,
        pincode: row.pincode,
        mine: true,
      },
      form: {
        visitType: 'FOLLOW_UP',
        metPersonName: row.lastMetPersonName || '',
        metPersonDesignation: row.lastMetPersonDesignation || '',
        metPersonPhone: row.lastMetPersonPhone || '',
        customerReading: hasReading(row.currentReading) ? String(row.currentReading) : '',
      },
    });
    setCheckInOpen(true);
  }, []);

  // Try to drain anything captured offline whenever the screen loads.
  const syncQueue = useCallback(async () => {
    const before = await queueSize();
    if (before === 0) {
      setPending(0);
      return;
    }
    const result = await flushQueue();
    setPending(result.remaining);
    if (result.sent > 0) {
      showToast(`${result.sent} offline visit${result.sent > 1 ? 's' : ''} synced.`, 'success');
      revalidate();
    }
    if (result.failed > 0) {
      showToast(`${result.failed} queued visit could not be sent and was discarded.`, 'error');
    }
  }, [revalidate, showToast]);

  useEffect(() => {
    syncQueue();
  }, [syncQueue]);

  const dates = useMemo(() => monthDates(year, month), [year, month]);
  const visitsByDate = calendar?.visits || {};

  const getDay = useCallback(
    (dateStr) => {
      const dayVisits = visitsByDate[dateStr] || [];
      if (dayVisits.length === 0) return {};
      const logged = dayVisits.find((v) => v.checkInAt);
      const colour = logged ? VISIT_TYPE_COLOR[logged.visitType] || palette.primary : PLANNED_COLOR;
      return { dot: colour, bold: true };
    },
    [visitsByDate, palette.primary],
  );

  const dayVisits = selectedDate ? visitsByDate[selectedDate] || [] : [];

  return (
    <ScreenScaffold
      title="Visits"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      notice={
        pending > 0
          ? `${pending} visit${pending > 1 ? 's are' : ' is'} waiting to sync. They will be sent automatically when you are back online.`
          : ''
      }
      toast={toast}
    >
      <View style={styles.bar}>
        <Pressable
          onPress={() => setPlanOpen(true)}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
        >
          <Text style={[styles.ghostBtnText, { color: palette.link }]}>Plan a visit</Text>
        </Pressable>
        <Pressable
          onPress={() => setCheckInOpen(true)}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: palette.primaryDark },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>Check in</Text>
        </Pressable>
      </View>

      {/* Above the calendar on purpose: a rep opens this screen to act, and the calendar is
          reference. A horizontal list inside the screen's vertical ScrollView is fine — different
          axis, no gesture conflict. */}
      <FollowUpRail schools={visited} onFollowUp={followUp} />

      <Card>
        <MonthNavigator
          year={year}
          month={month}
          onChange={({ year: y, month: m }) => {
            setYear(y);
            setMonth(m);
            setSelectedDate(null);
          }}
        />
        <CalendarGrid
          dates={dates}
          getDay={getDay}
          selectedDate={selectedDate}
          onDayPress={setSelectedDate}
        />
        <View style={styles.legend}>
          {VISIT_TYPES.map((t) => (
            <View key={t.value} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: VISIT_TYPE_COLOR[t.value] }]} />
              <Text style={styles.legendText}>{t.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PLANNED_COLOR }]} />
            <Text style={styles.legendText}>Planned</Text>
          </View>
        </View>
      </Card>

      {selectedDate ? (
        <Card>
          <CardTitle>{shortDate(selectedDate)}</CardTitle>
          {dayVisits.length === 0 ? (
            <Text style={styles.meta}>Nothing logged on this day.</Text>
          ) : (
            dayVisits.map((v) => (
              <Pressable key={v.id} onPress={() => setDetail(v)} style={styles.visitRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitTitle}>
                    {v.schoolName || humanise(v.visitType)}
                  </Text>
                  <Text style={styles.meta}>
                    {humanise(v.visitType)}
                    {v.checkInAt ? ` · ${dateTime(v.checkInAt)}` : ' · planned'}
                  </Text>
                </View>
                {v.geoFlagged ? <StatusChip label="Flagged" tone="error" /> : null}
                {/* hasReading, not truthiness — 0 is "Sales lost", a real reading. */}
                {hasReading(v.customerReading) ? (
                  <StatusChip
                    label={readingLabel(v.customerReading)}
                    tone={readingTone(v.customerReading)}
                  />
                ) : null}
              </Pressable>
            ))
          )}
        </Card>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Pick a day"
          message="Tap a date to see the visits logged on it."
        />
      )}

      <CheckInSheet
        visible={checkInOpen}
        prefill={prefill}
        onClose={() => {
          setCheckInOpen(false);
          setPrefill(null);
        }}
        onQueued={async (message) => {
          setCheckInOpen(false);
          setPrefill(null);
          showToast(message, 'success');
          setPending(await queueSize());
          revalidate();
          reloadVisited();
        }}
        onError={(message) => showToast(message, 'error')}
      />

      <PlanSheet
        visible={planOpen}
        onClose={() => setPlanOpen(false)}
        onDone={() => {
          setPlanOpen(false);
          showToast('Visit planned.', 'success');
          revalidate();
        }}
        onError={(message) => showToast(message, 'error')}
      />

      <VisitDetailSheet
        visit={detail}
        leadLabel={detail?.schoolName || ''}
        onClose={() => setDetail(null)}
        onSaved={() => {
          setDetail(null);
          showToast('Visit updated.', 'success');
          revalidate();
        }}
        onError={(message) => showToast(message, 'error')}
      />
    </ScreenScaffold>
  );
}

/* ── Follow-up rail ───────────────────────────────────────────────────────── */

/**
 * The schools this rep has already been to, most recent first.
 *
 * Tapping one opens check-in with the school and the last visit's contact details already in
 * place, which is the whole reason it exists: a second visit should not mean typing the same
 * person's name and number again.
 *
 * Renders nothing at all before the first check-in — an empty rail above the calendar would be
 * pure furniture on a new rep's screen.
 */
function FollowUpRail({ schools, onFollowUp }) {
  const styles = useStyles();
  if (!schools.length) return null;

  return (
    <View style={styles.railWrap}>
      <Text style={styles.railTitle}>Follow up</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {schools.map((s) => (
          <Pressable
            key={s.leadId}
            onPress={() => onFollowUp(s)}
            style={({ pressed }) => [styles.railCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Follow up at ${s.schoolName}`}
          >
            <Text style={styles.railName} numberOfLines={1}>
              {s.schoolName}
            </Text>
            <Text style={styles.railMeta} numberOfLines={1}>
              {[s.city, s.pincode].filter(Boolean).join(' · ') || '—'}
            </Text>
            <Text style={styles.railMeta} numberOfLines={1}>
              {`${s.visitCount} visit${s.visitCount === 1 ? '' : 's'} · ${shortDate(s.lastVisitDate)}`}
            </Text>
            {hasReading(s.currentReading) ? (
              <View style={styles.railChip}>
                <StatusChip
                  label={readingLabel(s.currentReading)}
                  tone={readingTone(s.currentReading)}
                />
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/* ── Check in ─────────────────────────────────────────────────────────────── */

function CheckInSheet({ visible, prefill, onClose, onQueued, onError }) {
  const styles = useStyles();
  const [form, setForm] = useState(EMPTY_CHECK_IN);
  // The chosen school, as the search sheet returned it — kept whole, because the form only holds
  // `leadId` and the trigger has to show a name.
  const [school, setSchool] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [location, setLocation] = useState(null);
  // `photo` is the RAW camera file; `stampUri` is what actually gets uploaded. They are kept
  // apart so retaking a shot re-stamps from the original rather than stamping a stamp.
  const [photo, setPhoto] = useState(null);
  const [mapUri, setMapUri] = useState(null);
  const [saving, setSaving] = useState(false);
  const stampRef = useRef(null);

  // Ask for the fix the moment the sheet opens. A rep is standing outside a school; making them
  // fill the form first and then wait for GPS wastes the one thing they have least of.
  // A work-from-home day has no school to attach, no site to geo-fence and nothing to photograph,
  // so the whole evidence half of this sheet is off for it — matching the server, which relaxes
  // the lead requirement for this type alone.
  const remote = isRemoteVisit(form.visitType);

  /**
   * Seeds the form — on the OPEN/CLOSE edge only.
   *
   * Deliberately a separate effect from the GPS one below, which is also keyed on `remote`. If
   * the seed lived there, every change of "Nature of visit" would re-run it and **wipe everything
   * the rep had typed**. Keyed on `visible` alone, it runs exactly twice per sheet: once to fill,
   * once to clear.
   *
   * `prefill` comes from the follow-up rail and carries the last visit's contact details, so a
   * second visit to the same school is a couple of taps rather than a re-type.
   */
  useEffect(() => {
    if (!visible) {
      setForm(EMPTY_CHECK_IN);
      setSchool(null);
      return;
    }
    setForm({ ...EMPTY_CHECK_IN, ...(prefill?.form || {}) });
    setSchool(prefill?.school || null);
    // `prefill` is read only on the open edge; it is intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setLocation(null);
      setMapUri(null);
      setPhoto(null);
      return;
    }
    // Keyed on `remote` as well as `visible`: the nature is chosen inside the form, after this
    // effect has already run once, so switching to Work from home has to be able to stand the
    // GPS request down rather than leave a stale fix attached to a desk day.
    if (remote) {
      setLocation(null);
      setMapUri(null);
      setPhoto(null);
      return;
    }
    let alive = true;
    (async () => {
      const fix = await captureVisitLocation();
      if (!alive) return;
      setLocation(fix);
      if (fix.status === 'ok') {
        const resolved = await resolvePincode(fix.latitude, fix.longitude);
        // Each field on its own merit. This used to store BOTH only `if (resolved.pincode)`, so a
        // reverse-geocode that produced a street address but no postal code — the normal shape of
        // the answer outside a town — threw the address away, and the rep's visit went in with no
        // record of where they had been beyond the raw coordinates.
        if (alive && (resolved.pincode || resolved.address)) {
          setForm((f) => ({
            ...f,
            ...(resolved.pincode ? { pincode: resolved.pincode } : {}),
            ...(resolved.address ? { resolvedAddress: resolved.address } : {}),
          }));
        }
        // Fetched here rather than at capture time so the thumbnail is already on disk by the
        // time the rep presses the shutter — and null whenever it is not, which is most of the
        // time in the field. The stamp lays out correctly without it.
        const thumb = await fetchMapThumbnail(fix.latitude, fix.longitude);
        if (alive) setMapUri(thumb);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, remote]);

  const capture = async () => {
    const result = await takePhoto();
    if (result?.denied) {
      onError('Camera permission is needed to log a visit.');
      return;
    }
    if (result?.uri) setPhoto(result);
  };

  const submit = async () => {
    if (!remote && !school?.leadId) {
      onError('Search for the school you are visiting.');
      return;
    }
    if (!remote && !photo) {
      onError('A photo at the school is required for every check-in.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        // A desk day has no school. The server accepts a null lead for this type alone.
        // The id may belong to a colleague — the server clones it into a lead of this rep's own.
        leadId: remote ? null : String(school.leadId),
        dedupeKey: newDedupeKey(),
        // The moment of capture, not of sending — a visit that syncs on Thursday still belongs to
        // the Tuesday it happened.
        checkInAt: new Date().toISOString(),
        latitude: remote ? undefined : location?.latitude,
        longitude: remote ? undefined : location?.longitude,
        accuracy: remote ? undefined : location?.accuracy,
      };
      // Explicit emptiness check, NOT truthiness. `0` is "Sales lost" — a real reading — and the
      // old `if (!payload.closureRating)` would have thrown it away on every lost deal, silently,
      // while working correctly for all five other values.
      if (!hasReading(payload.customerReading)) delete payload.customerReading;
      if (!payload.nextFollowUpDate) delete payload.nextFollowUpDate;

      // STAMP BEFORE ENQUEUE, always. A queued visit can sync days later, and the server never
      // sees the photo until it does — so stamping anywhere downstream would leave every offline
      // check-in unstamped, which is exactly the case the stamp matters most for.
      // Falls back to the raw photo if the capture fails: an unstamped visit beats a lost one.
      const stamped = (await captureStampedPhoto(stampRef).catch(() => null)) || photo;

      await enqueueVisit({ payload, photo: remote ? null : stamped });
      const result = await flushQueue();

      onQueued(
        result.sent > 0
          ? remote
            ? 'Work-from-home day logged.'
            : 'Visit logged.'
          : 'Saved on your phone. It will sync automatically when you are back online.',
      );
    } catch (err) {
      onError(err?.message || 'Could not log the visit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Check in"
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Log visit"
      submitting={saving}
      fullHeight
    >
      {/* Nature comes FIRST now: it decides whether the rest of this sheet is even shown. */}
      <Select
        label="Nature of visit *"
        value={form.visitType}
        options={VISIT_TYPES}
        onChange={(v) => setForm({ ...form, visitType: v })}
      />

      {remote ? (
        <Text style={[styles.banner, styles.bannerInfo]}>
          A work-from-home day needs no school, location or photo — just say what you worked on.
          It appears on your calendar like any other logged day.
        </Text>
      ) : (
        <>
          <LocationBanner location={location} address={form.resolvedAddress} />
          <SchoolPicker school={school} onPress={() => setSearchOpen(true)} />
          <TextField
            label="Pincode"
            value={form.pincode}
            onChangeText={(v) => setForm({ ...form, pincode: v.replace(/\D/g, '').slice(0, 6) })}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="Resolved from your location"
          />
          <TextField
            label="Whom did you meet?"
            value={form.metPersonName}
            onChangeText={(v) => setForm({ ...form, metPersonName: v })}
          />
          <TextField
            label="Their designation"
            value={form.metPersonDesignation}
            onChangeText={(v) => setForm({ ...form, metPersonDesignation: v })}
            placeholder="Principal, Director, Trustee…"
          />
          <TextField
            label="Their phone"
            value={form.metPersonPhone}
            onChangeText={(v) => setForm({ ...form, metPersonPhone: v })}
            keyboardType="phone-pad"
          />

          <CustomerReading
            value={form.customerReading}
            onChange={(v) => setForm({ ...form, customerReading: v })}
          />
        </>
      )}

      <TextField
        label="Remarks"
        value={form.remarks}
        onChangeText={(v) => setForm({ ...form, remarks: v })}
        multiline
        placeholder={remote ? 'What you worked on today.' : undefined}
      />
      <TextField
        label="Next follow up (YYYY-MM-DD)"
        value={form.nextFollowUpDate}
        onChangeText={(v) => setForm({ ...form, nextFollowUpDate: v })}
        placeholder="2026-09-15"
      />

      {!remote && (
        <>
          <Text style={styles.fieldLabel}>Photo at the school *</Text>
          <Text style={styles.hint}>
            The address, coordinates and time are stamped onto the picture.
          </Text>
          <Pressable
            onPress={capture}
            style={({ pressed }) => [styles.photoBtn, pressed && styles.pressed]}
          >
            <Text style={styles.photoBtnText}>{photo ? 'Retake photo' : 'Take photo'}</Text>
          </Pressable>
          {/* This preview IS the thing that gets screenshotted — it must stay visible and
              on-screen. Hiding it with opacity:0 would make captureRef return a blank bitmap on
              Android. The upside is that the rep approves exactly the image that will be
              uploaded. */}
          {photo?.uri ? (
            <View style={styles.stampWrap}>
              <SalesPhotoStamp
                ref={stampRef}
                photoUri={photo.uri}
                mapUri={mapUri}
                stamp={{
                  address: form.resolvedAddress,
                  latitude: location?.latitude,
                  longitude: location?.longitude,
                  accuracy: location?.accuracy,
                  pincode: form.pincode,
                  capturedAt: location?.capturedAt,
                }}
              />
            </View>
          ) : null}
        </>
      )}

      <SchoolSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(picked) => {
          setSchool(picked);
          setSearchOpen(false);
        }}
      />
    </FormSheet>
  );
}

/**
 * The school field: a tap target showing what is chosen, opening the search sheet.
 *
 * Not a `Select`. The list it picks from lives on the server, so there is no options array to
 * derive a label from — the chosen school is held whole in state instead.
 */
function SchoolPicker({ school, onPress }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.pickerWrap}>
      <Text style={styles.fieldLabel}>School *</Text>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <View style={styles.pickerText}>
          {school ? (
            <>
              <Text style={styles.pickerName}>{school.schoolName}</Text>
              <Text style={styles.pickerMeta}>
                {[school.city, school.pincode].filter(Boolean).join(' · ')}
              </Text>
            </>
          ) : (
            <Text style={styles.pickerPlaceholder}>Search for the school…</Text>
          )}
        </View>
        <Ionicons name="search" size={19} color={palette.primary} />
      </Pressable>
    </View>
  );
}

/**
 * What the rep is told about where they are.
 *
 * ── IT USED TO SHOW ONLY AN ACCURACY FIGURE ─────────────────────────────────
 * "Location captured (±23 m)" and nothing else — no address, no coordinates. The address was
 * already being resolved on the device and was already being burned into the check-in photograph,
 * so the one place a rep could read where the app thought they were was by opening the picture
 * afterwards. These are the same three facts the stamp prints, shown before the shutter instead of
 * only after it — which is what makes a wrong fix correctable rather than discovered later.
 */
function LocationBanner({ location, address }) {
  const styles = useStyles();
  if (!location) {
    return <Text style={[styles.banner, styles.bannerInfo]}>Getting your location…</Text>;
  }
  if (location.status === 'ok') {
    return (
      <View style={[styles.banner, styles.bannerOk]}>
        <Text style={styles.bannerOkText}>
          {`Location captured (±${Math.round(location.accuracy || 0)} m). It is recorded with the visit and cannot be changed later.`}
        </Text>
        {/* Absent rather than a placeholder while the geocoder is still working, and absent for
            good if it never answers — a coordinate pair is a fact, an invented address is not. */}
        {address ? (
          <Text style={styles.bannerAddress} numberOfLines={3}>
            {address}
          </Text>
        ) : null}
        {/* Six decimal places, matching the photo stamp, so the two can be compared at a glance. */}
        <Text style={styles.bannerCoords}>
          {`${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)}`}
        </Text>
      </View>
    );
  }
  return (
    <Text style={[styles.banner, styles.bannerBad]}>
      {location.status === 'denied'
        ? 'Location permission was denied. You can still log the visit, but it will carry no GPS and cannot be location-verified.'
        : 'Your location is unavailable. The visit will be logged without GPS.'}
    </Text>
  );
}

/**
 * The 0–5 Customer Reading picker.
 *
 * Shows the stage names, which the old 1–5 "closure likelihood" widget did not: that was five
 * bare digits under a one-line hint, and the five word labels for it existed only in the reports
 * screen. A rep knows whether they gave a demo; they were being asked to guess a probability.
 *
 * A wrapping list of pills, not a row of squares — "Closure / Sales win" does not fit in a 42px
 * box, and there are six options now rather than five.
 */
function CustomerReading({ value, onChange }) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <View style={styles.ratingWrap}>
      <Text style={styles.fieldLabel}>Customer Reading</Text>
      <View style={styles.readingWrap}>
        {CUSTOMER_READINGS.map((r) => {
          const on = String(value) === String(r.value);
          return (
            <Pressable
              key={r.value}
              onPress={() => onChange(on ? '' : String(r.value))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.readingPill,
                on && { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}
            >
              <Text style={[styles.readingNum, on && styles.readingTextOn]}>{r.value}</Text>
              <Text style={[styles.readingLabel, on && styles.readingTextOn]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>0 means the sale is lost · 5 means it is won</Text>
    </View>
  );
}

/* ── Plan ─────────────────────────────────────────────────────────────────── */

function PlanSheet({ visible, onClose, onDone, onError }) {
  const [form, setForm] = useState({ visitType: 'SALES', plannedFor: '', remarks: '' });
  const [school, setSchool] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const remote = isRemoteVisit(form.visitType);

  useEffect(() => {
    if (!visible) {
      setForm({ visitType: 'SALES', plannedFor: '', remarks: '' });
      setSchool(null);
    }
  }, [visible]);

  const submit = async () => {
    if ((!remote && !school?.leadId) || !form.plannedFor) {
      onError(remote ? 'Pick a date.' : 'Pick a school and a date.');
      return;
    }
    setSaving(true);
    try {
      // Same rule as check-in: only a work-from-home day may be planned without a school.
      await planVisit({ ...form, leadId: remote ? null : String(school.leadId) });
      onDone();
    } catch (err) {
      onError(err?.message || 'Could not plan the visit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet
      visible={visible}
      title="Plan a visit"
      subtitle="Blocks the day on your calendar. Check in on the day to turn it into a logged visit."
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Plan visit"
      submitting={saving}
    >
      {!remote ? (
        <SchoolPicker school={school} onPress={() => setSearchOpen(true)} />
      ) : null}
      <Select
        label="Nature of visit"
        value={form.visitType}
        options={VISIT_TYPES}
        onChange={(v) => setForm({ ...form, visitType: v })}
      />
      <TextField
        label="Date (YYYY-MM-DD) *"
        value={form.plannedFor}
        onChangeText={(v) => setForm({ ...form, plannedFor: v })}
        placeholder="2026-09-15"
      />
      <TextField
        label="Remarks"
        value={form.remarks}
        onChangeText={(v) => setForm({ ...form, remarks: v })}
        multiline
      />

      <SchoolSearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(picked) => {
          setSchool(picked);
          setSearchOpen(false);
        }}
      />
    </FormSheet>
  );
}

/* ── Detail ───────────────────────────────────────────────────────────────── */

function VisitDetailSheet({ visit, leadLabel, onClose, onSaved, onError }) {
  const styles = useStyles();
  const [remarks, setRemarks] = useState('');
  const [rating, setRating] = useState('');
  const [saving, setSaving] = useState(false);
  const remote = isRemoteVisit(visit?.visitType);

  useEffect(() => {
    setRemarks(visit?.remarks || '');
    // hasReading, not truthiness: a stored 0 ("Sales lost") would otherwise hydrate as unset and
    // be silently cleared the next time the rep saved this visit.
    setRating(hasReading(visit?.customerReading) ? String(visit.customerReading) : '');
  }, [visit]);

  if (!visit) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateVisit(visit.id, { remarks, customerReading: rating === '' ? null : rating });
      onSaved();
    } catch (err) {
      onError(err?.message || 'Could not update the visit.');
    } finally {
      setSaving(false);
    }
  };

  const embed = mapEmbedUrl(visit.latitude, visit.longitude);

  return (
    <FormSheet
      visible={!!visit}
      title={leadLabel || 'Visit'}
      subtitle={`${humanise(visit.visitType)} · ${shortDate(visit.visitDate)}`}
      onClose={onClose}
      onSubmit={save}
      submitLabel="Save"
      submitting={saving}
      fullHeight
    >
      {visit.geoFlagged ? (
        <Text style={[styles.banner, styles.bannerBad]}>
          {`Flagged: this check-in was ${visit.distanceFromLeadKm} km from the school's recorded location.`}
        </Text>
      ) : null}

      <Text style={styles.meta}>Checked in {dateTime(visit.checkInAt)}</Text>
      {/* A work-from-home day has no school, so it has no pincode, nobody met and no reading. */}
      {!remote ? <Text style={styles.meta}>Pincode {visit.pincode || '—'}</Text> : null}

      {/* WHERE THE VISIT ACTUALLY WAS.
          `resolvedAddress` has been stored on every visit and returned by SalesVisitService.toMap
          since the module was built, and was read by nothing — the only place a rep could see it
          was inside the check-in photograph. The coordinates and accuracy were likewise reachable
          only through the map embed. All three are facts about a record the rep cannot edit
          afterwards, so they belong on the sheet that shows that record. */}
      {!remote && visit.resolvedAddress ? (
        <Text style={styles.detailAddress}>{visit.resolvedAddress}</Text>
      ) : null}
      {!remote && visit.latitude != null && visit.longitude != null ? (
        <Text style={styles.detailCoords}>
          {`${Number(visit.latitude).toFixed(6)}, ${Number(visit.longitude).toFixed(6)}`}
          {visit.accuracyMetres != null
            ? `  ·  ±${Math.round(visit.accuracyMetres)} m`
            : ''}
        </Text>
      ) : null}

      {!remote && visit.metPersonName ? (
        <Text style={styles.meta}>
          {`Met ${visit.metPersonName}${visit.metPersonDesignation ? ` · ${visit.metPersonDesignation}` : ''}`}
        </Text>
      ) : null}

      {embed ? (
        <View style={styles.mapWrap}>
          <WebView
            source={{ uri: embed }}
            style={styles.map}
            scrollEnabled={false}
            // A read-only pin: nothing here should navigate away inside the sheet.
            onShouldStartLoadWithRequest={(req) => req.url === embed}
          />
        </View>
      ) : null}

      {visit.photoUrl ? (
        <Image source={{ uri: visit.photoUrl }} style={styles.photoPreview} resizeMode="cover" />
      ) : null}

      {!remote ? <CustomerReading value={rating} onChange={setRating} /> : null}
      <TextField label="Remarks" value={remarks} onChangeText={setRemarks} multiline />
    </FormSheet>
  );
}

const useStyles = makeStyles((p) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  pressed: { opacity: 0.85 },
  ghostBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  ghostBtnText: { fontWeight: '600', fontSize: TYPE.body },
  primaryBtn: { paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: 10 },
  primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: TYPE.body },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginTop: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: TYPE.caption, color: SLATE[500] },

  visitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  visitTitle: { fontSize: TYPE.heading, fontWeight: '600', color: SLATE[800] },
  meta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },

  // Darker and heavier than `meta`: on the detail sheet the address is the answer to "where was
  // this", not a secondary label beside it.
  detailAddress: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800], marginTop: 6 },
  detailCoords: {
    fontSize: TYPE.caption,
    color: SLATE[500],
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  banner: {
    borderRadius: 10,
    padding: SPACING.sm,
    fontSize: TYPE.label,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  bannerInfo: { backgroundColor: p.tint, color: p.primaryDark },
  bannerOk: { backgroundColor: FEEDBACK.successBg, color: FEEDBACK.successOnBg },
  bannerBad: { backgroundColor: FEEDBACK.errorBg, color: FEEDBACK.errorOnBg },

  // The OK banner is a View now, not a Text, because it carries three lines. `banner`'s own
  // `fontSize`/`color` are inert on a View, so each line restates what it needs — and the ink is
  // `successOnBg`, not `successText`: theme.js is explicit that the plain variants are tuned for
  // white and drop to about 3:1 on their own tint, which fails at this size.
  bannerOkText: { fontSize: TYPE.label, color: FEEDBACK.successOnBg },
  bannerAddress: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: FEEDBACK.successOnBg,
    marginTop: 6,
  },
  // Monospaced so the digits line up with the same pair printed on the photo stamp.
  bannerCoords: {
    fontSize: TYPE.caption,
    color: FEEDBACK.successOnBg,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },

  fieldLabel: {
    fontSize: TYPE.label,
    fontWeight: '600',
    color: SLATE[600],
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  hint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 4 },

  // ── Follow-up rail ────────────────────────────────────────────────────────
  railWrap: { marginBottom: SPACING.md },
  railTitle: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: SLATE[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.sm,
  },
  railRow: { gap: SPACING.sm, paddingRight: SPACING.sm },
  railCard: {
    width: 190,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    padding: 12,
  },
  railName: { fontSize: TYPE.heading, fontWeight: '700', color: SLATE[800] },
  railMeta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
  railChip: { marginTop: 6, alignSelf: 'flex-start' },

  // ── School picker (opens the search sheet) ────────────────────────────────
  pickerWrap: { marginBottom: SPACING.sm },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  pickerText: { flex: 1 },
  pickerName: { fontSize: TYPE.heading, color: SLATE[900], fontWeight: '600' },
  pickerMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },
  pickerPlaceholder: { fontSize: TYPE.heading, color: SLATE[500] },

  ratingWrap: { marginBottom: SPACING.sm },

  // The Customer Reading picker. A WRAPPING pill list, not the fixed 42px square row the old
  // 1-5 widget used: six options carrying names like "Closure / Sales win" cannot sit in a row
  // of boxes on a phone.
  readingWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  readingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
  },
  readingNum: {
    fontSize: TYPE.label,
    fontWeight: '700',
    color: SLATE[500],
    minWidth: 14,
    textAlign: 'center',
  },
  readingLabel: { fontSize: TYPE.body, color: SLATE[600] },
  readingTextOn: { color: '#ffffff' },

  photoBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    paddingVertical: 11,
    alignItems: 'center',
  },
  photoBtnText: { fontSize: TYPE.body, fontWeight: '600', color: p.link },
  stampWrap: { marginTop: SPACING.sm },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: SPACING.sm,
    backgroundColor: SLATE[100],
  },

  mapWrap: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: SLATE[200],
  },
  map: { flex: 1 },
}));
