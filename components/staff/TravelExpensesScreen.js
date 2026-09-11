import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { usePalette } from '../ui/PaletteContext';
import {
  Card,
  CardTitle,
  EmptyState,
  MonthNavigator,
  ScreenScaffold,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../ui';
import useStaffResource from '../../hooks/useStaffResource';
import {
  CLAIM_STATUS,
  TRAVEL_MODES,
  addTravelStop,
  deleteTravelStop,
  fetchTravelDay,
  fetchTravelMonth,
  saveTravelDay,
  setTravelHomeBase,
  submitTravelDay,
  uploadTravelReceipt,
} from '../../services/travelExpenseService';
import { captureMarkLocation } from '../../services/teacher/selfAttendanceService';
import { pickImage } from '../../utils/filePicker';
import { formatLongDate, parseLocalDateTime, todayIso } from '../../utils/dates';
import { makeStyles } from '../../utils/makeStyles';
import { inr } from './sales/salesFormat';

/**
 * My Expenses — travel claims, shared by the sales, Shreyartha teacher and Shreyartha counsellor
 * shells. Mirrors frontendmain/src/School/shared/TravelExpenses.js.
 *
 * A day's trips are built on the server from where the employee actually was: each "I'm here" tap,
 * plus a sales rep's school check-ins. Nobody types a distance. The employee picks how each trip was
 * travelled, enters the fare for public transport (with an optional ticket photo), and submits; car
 * and bike are paid per km at the admin's rate.
 *
 * A figure measured straight-line — every figure, until road distances are switched on — carries a
 * "straight-line" badge. It is always shorter than the road and must never pass for a road figure.
 */

const NO_FIX = {
  denied: 'location permission was refused',
  unavailable: 'location services are off',
  error: 'no GPS fix in time',
};

const km = (v) => (v == null ? '—' : `${Number(v).toFixed(2)} km`);

// Not bare `inr`: it reads a missing value as ₹0, which would show a trip with no mode chosen yet
// as a real zero-rupee claim. A missing amount is "—".
const money = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : inr(v, { decimals: true }));

/** "2026-09-10T10:42" -> "10:42 am" */
function clock(value) {
  const date = parseLocalDateTime(value);
  if (!date) return '';
  const h = date.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(date.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

const mapUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

function Chip({ status }) {
  const meta = CLAIM_STATUS[status];
  return <StatusChip label={meta ? meta.label : 'Not started'} tone={meta ? meta.tone : 'neutral'} />;
}

export default function TravelExpensesScreen({ homeRoute = '/staff/sales' }) {
  const styles = useStyles();
  const PALETTE = usePalette();
  const { toast, showToast } = useToast();
  const now = new Date();
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [day, setDay] = useState(null);
  const [dayError, setDayError] = useState('');
  const [choices, setChoices] = useState({});
  const [returnHome, setReturnHome] = useState(false);
  const [stopLabel, setStopLabel] = useState('');
  const [busy, setBusy] = useState('');

  const monthFetcher = useCallback(
    (signal) => fetchTravelMonth(period.year, period.month, signal),
    [period.year, period.month],
  );
  const { data: month, loading, refreshing, error, reload, refresh, revalidate } =
    useStaffResource(monthFetcher);

  // The day from the server becomes the form: each leg's saved mode and fare are the starting
  // choices, keyed by seq and carrying the leg's key so a stale choice is never applied to a
  // different trip after the stops change.
  const applyDay = useCallback((d) => {
    setDay(d);
    setReturnHome(!!d?.returnHome);
    const next = {};
    (d?.legs || []).forEach((leg) => {
      next[leg.seq] = {
        legKey: leg.legKey,
        mode: leg.mode || null,
        fareInr: leg.fareInr == null ? '' : String(leg.fareInr),
      };
    });
    setChoices(next);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setDayError('');
    fetchTravelDay(selectedDate, controller.signal)
      .then((d) => {
        if (active) applyDay(d);
      })
      .catch((e) => {
        if (active) setDayError(e?.message || 'Could not load that day.');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedDate, applyDay]);

  const payload = () => ({
    date: selectedDate,
    returnHome,
    legs: Object.entries(choices).map(([seq, c]) => ({
      seq: Number(seq),
      legKey: c.legKey,
      mode: c.mode || null,
      fareInr: c.fareInr === '' ? null : c.fareInr,
    })),
  });

  const run = async (key, action) => {
    if (busy) return;
    setBusy(key);
    try {
      await action();
    } catch (e) {
      // The server's words — they say what to fix ("Enter the fare you paid…").
      showToast(e?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setBusy('');
    }
  };

  const addStop = () =>
    run('stop', async () => {
      const loc = await captureMarkLocation();
      if (loc.locationStatus !== 'ok') {
        showToast(`Couldn't record a stop — ${NO_FIX[loc.locationStatus] || 'no location'}.`, 'error');
        return;
      }
      const d = await addTravelStop({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        label: stopLabel.trim() || null,
      });
      setStopLabel('');
      if (d?.date && d.date !== selectedDate) setSelectedDate(d.date);
      applyDay(d);
      await revalidate();
      showToast('Stop recorded.', 'success');
    });

  const setHome = () =>
    run('home', async () => {
      const loc = await captureMarkLocation();
      if (loc.locationStatus !== 'ok') {
        showToast(`Couldn't save your home base — ${NO_FIX[loc.locationStatus] || 'no location'}.`, 'error');
        return;
      }
      await setTravelHomeBase({
        latitude: loc.latitude,
        longitude: loc.longitude,
        address: loc.resolvedAddress || null,
      });
      applyDay(await fetchTravelDay(selectedDate));
      await revalidate();
      showToast('Home base saved. Your trips now start and end there.', 'success');
    });

  const removeStop = (stop) =>
    Alert.alert('Remove this stop?', `${stop.label} at ${clock(stop.at)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          run('stop', async () => {
            applyDay(await deleteTravelStop(stop.id));
            await revalidate();
          }),
      },
    ]);

  const save = () =>
    run('save', async () => {
      applyDay(await saveTravelDay(payload()));
      await revalidate();
      showToast('Saved as a draft.', 'success');
    });

  const submit = () =>
    Alert.alert(
      'Submit for approval?',
      "You won't be able to change this day's travel after it is submitted.",
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Submit',
          onPress: () =>
            run('submit', async () => {
              applyDay(await submitTravelDay(payload()));
              await revalidate();
              showToast('Submitted for approval.', 'success');
            }),
        },
      ],
    );

  const attachTicket = (leg) =>
    run('receipt', async () => {
      const file = await pickImage();
      if (!file) return;
      if (file.denied) {
        showToast('Photo access was refused. Allow it in Settings to attach a ticket.', 'error');
        return;
      }
      // Save first, so the choices on screen are not lost when the day comes back.
      await saveTravelDay(payload());
      applyDay(await uploadTravelReceipt(selectedDate, leg.legKey, file));
      showToast('Ticket photo attached.', 'success');
    });

  const setChoice = (seq, patch) =>
    setChoices((current) => ({ ...current, [seq]: { ...current[seq], ...patch } }));

  // Today is always listed in the current month, so there is somewhere to start the day.
  const days = useMemo(() => {
    const list = month?.days || [];
    const today = todayIso();
    const inMonth = today.startsWith(`${period.year}-${String(period.month).padStart(2, '0')}`);
    return inMonth && !list.some((d) => d.date === today)
      ? [{ date: today, stops: 0, status: null }, ...list]
      : list;
  }, [month, period]);

  const rates = day?.rates || month?.rates;
  const homeBase = month?.homeBase;
  const editable = !!day?.editable;
  const legs = day?.legs || [];

  // What a trip comes to with the choices on screen — the server's figure replaces it on save.
  const preview = (leg) => {
    const c = choices[leg.seq] || {};
    if (!c.mode) return null;
    if (c.mode === 'PUBLIC_TRANSPORT') return c.fareInr === '' ? null : Number(c.fareInr);
    const rate = c.mode === 'CAR' ? rates?.carRatePerKm : rates?.bikeRatePerKm;
    return Number(leg.distanceKm || 0) * Number(rate || 0);
  };
  const previewTotal = legs.reduce((sum, leg) => sum + (preview(leg) || 0), 0);

  return (
    <ScreenScaffold
      title="My Expenses"
      fallbackRoute={homeRoute}
      loading={loading && !month}
      error={month ? '' : error}
      notice={month && error ? error : ''}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
      toast={toast}
    >
      <Card>
        <CardTitle>Where are you now?</CardTitle>
        <TextField
          label="What is this place? (optional)"
          value={stopLabel}
          onChangeText={setStopLabel}
          maxLength={120}
          placeholder="e.g. Sunrise School, Head office"
        />
        <Pressable
          onPress={addStop}
          disabled={!!busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: PALETTE.primaryDark },
            !!busy && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Record a stop here"
        >
          {busy === 'stop' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="location" size={21} color="#ffffff" />
              <Text style={styles.primaryText}>I'm here</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.hint}>Adds a stop to today, with your location and the time.</Text>

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>Home base</Text>
        <Text style={styles.body}>
          {homeBase
            ? `Saved${homeBase.address ? ` — ${homeBase.address}` : ''}. Each day's first trip starts here.`
            : "Not set. Save it while you're at home, and each day's first trip will start there."}
        </Text>
        <Pressable
          onPress={setHome}
          disabled={!!busy}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {busy === 'home' ? (
            <ActivityIndicator size="small" color={PALETTE.primaryDark} />
          ) : (
            <>
              <Ionicons name="home-outline" size={19} color={PALETTE.primaryDark} />
              <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>
                {homeBase ? 'Update to where I am' : 'Set to where I am'}
              </Text>
            </>
          )}
        </Pressable>

        {/* With no rates set, the car/bike half is simply left out rather than announced — the
            employee can do nothing about it, and submit() refuses a per-km leg with a message that
            explains it at the moment it matters. The fare rule is true either way. */}
        <Text style={styles.rates}>
          {rates?.set
            ? `Car ${money(rates.carRatePerKm)}/km · Bike ${money(rates.bikeRatePerKm)}/km · Public transport: the fare you paid`
            : 'Public transport: the fare you paid'}
        </Text>
      </Card>

      <MonthNavigator year={period.year} month={period.month} onChange={setPeriod} disabled={!!busy} />

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{money(month?.totals?.awaitingApprovalInr)}</Text>
          <Text style={styles.tileLabel}>Awaiting</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{money(month?.totals?.approvedInr)}</Text>
          <Text style={styles.tileLabel}>Approved</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{money(month?.totals?.paidInr)}</Text>
          <Text style={styles.tileLabel}>Paid</Text>
        </View>
      </View>

      <Card>
        <CardTitle>Days</CardTitle>
        {days.length === 0 ? (
          <Text style={styles.hint}>No travel recorded this month.</Text>
        ) : (
          days.map((d) => (
            <Pressable
              key={d.date}
              onPress={() => setSelectedDate(d.date)}
              style={({ pressed }) => [
                styles.dayRow,
                d.date === selectedDate && { backgroundColor: SLATE[50] },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: d.date === selectedDate }}
            >
              <View style={styles.dayRowText}>
                <Text style={styles.dayRowDate}>{formatLongDate(d.date)}</Text>
                <Text style={styles.dayRowMeta}>
                  {d.stops} stop{d.stops === 1 ? '' : 's'}
                  {d.totalKm != null ? ` · ${km(d.totalKm)} · ${money(d.totalInr)}` : ''}
                </Text>
              </View>
              <Chip status={d.status} />
            </Pressable>
          ))
        )}
      </Card>

      {dayError ? <Text style={styles.errorText}>{dayError}</Text> : null}

      {day ? (
        <Card>
          <View style={styles.dayHead}>
            <CardTitle>{formatLongDate(day.date)}</CardTitle>
            <Chip status={day.status} />
          </View>

          {day.rejectionReason ? (
            <Text style={styles.returned}>
              Returned by admin: {day.rejectionReason}
              {editable ? ' Correct it and submit again.' : ''}
            </Text>
          ) : null}
          {(day.notes || []).map((note) => (
            <Text key={note} style={styles.note}>
              {note}
            </Text>
          ))}

          <Text style={styles.sectionLabel}>Stops</Text>
          {(day.stops || []).length === 0 ? (
            <Text style={styles.hint}>No stops on this day.</Text>
          ) : (
            day.stops.map((s, i) => (
              <View key={`${s.source}-${s.id ?? s.visitId}-${i}`} style={styles.stopRow}>
                <Text style={styles.stopTime}>{clock(s.at)}</Text>
                <View style={styles.stopText}>
                  <Text style={styles.body}>{s.label}</Text>
                  <Text style={styles.stopMeta}>{s.source === 'CHECK_IN' ? 'School check-in' : "I'm here"}</Text>
                </View>
                <Pressable
                  onPress={() => Linking.openURL(mapUrl(s.latitude, s.longitude)).catch(() => {})}
                  hitSlop={8}
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                  accessibilityRole="link"
                  accessibilityLabel={`Open ${s.label} in Maps`}
                >
                  <Ionicons name="map-outline" size={19} color={PALETTE.primaryDark} />
                </Pressable>
                {editable && s.deletable ? (
                  <Pressable
                    onPress={() => removeStop(s)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove the stop ${s.label}`}
                  >
                    <Ionicons name="trash-outline" size={19} color={FEEDBACK.errorText} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.sectionLabel}>Trips</Text>
          {legs.length === 0 ? (
            <EmptyState
              icon="navigate-outline"
              title="No trips yet"
              message="A trip needs two places — your home base and a stop, or two stops."
            />
          ) : (
            legs.map((leg) => {
              const c = choices[leg.seq] || {};
              const mode = editable ? c.mode : leg.mode;
              const amount = editable ? preview(leg) : leg.amountInr;
              return (
                <View key={leg.legKey} style={styles.leg}>
                  <Text style={styles.legTitle}>
                    {leg.seq}. {leg.fromLabel} → {leg.toLabel}
                  </Text>
                  <View style={styles.legMetaRow}>
                    <Text style={styles.legMeta}>{km(leg.distanceKm)}</Text>
                    {leg.distanceSource === 'STRAIGHT_LINE' ? (
                      <Text style={styles.badge}>straight-line</Text>
                    ) : null}
                  </View>

                  {editable ? (
                    <>
                      <Select
                        label="How you travelled"
                        value={c.mode || null}
                        options={TRAVEL_MODES}
                        onChange={(value) => setChoice(leg.seq, { mode: value })}
                        placeholder="Choose…"
                      />
                      {mode === 'PUBLIC_TRANSPORT' ? (
                        <>
                          <TextField
                            label="Fare you paid (₹)"
                            value={c.fareInr ?? ''}
                            onChangeText={(text) => setChoice(leg.seq, { fareInr: text.replace(/[^0-9.]/g, '') })}
                            keyboardType="decimal-pad"
                            placeholder="0"
                          />
                          <Pressable
                            onPress={() => attachTicket(leg)}
                            disabled={!!busy}
                            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                            accessibilityRole="button"
                          >
                            <Ionicons name="camera-outline" size={18} color={PALETTE.primaryDark} />
                            <Text style={[styles.linkText, { color: PALETTE.primaryDark }]}>
                              {leg.receiptUrl ? 'Replace ticket photo' : 'Add ticket photo'}
                            </Text>
                          </Pressable>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.body}>
                      {TRAVEL_MODES.find((m) => m.value === leg.mode)?.label || '—'}
                      {leg.mode === 'PUBLIC_TRANSPORT'
                        ? ` · fare ${money(leg.fareInr)}`
                        : leg.ratePerKm != null
                          ? ` · ${money(leg.ratePerKm)}/km`
                          : ''}
                    </Text>
                  )}

                  {leg.receiptUrl ? (
                    <Pressable
                      onPress={() => Linking.openURL(leg.receiptUrl).catch(() => {})}
                      style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                      accessibilityRole="link"
                    >
                      <Ionicons name="receipt-outline" size={18} color={PALETTE.primaryDark} />
                      <Text style={[styles.linkText, { color: PALETTE.primaryDark }]}>View ticket</Text>
                    </Pressable>
                  ) : null}

                  <Text style={styles.amount}>{money(amount)}</Text>
                </View>
              );
            })
          )}

          {legs.length > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total · {km(day.totalKm)}</Text>
              <Text style={styles.totalValue}>{money(editable ? previewTotal : day.totalInr)}</Text>
            </View>
          ) : null}

          {editable ? (
            <>
              <Pressable
                onPress={() => homeBase && setReturnHome((v) => !v)}
                disabled={!homeBase}
                style={styles.checkRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: returnHome, disabled: !homeBase }}
              >
                <Ionicons
                  name={returnHome ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={homeBase ? PALETTE.primaryDark : SLATE[500]}
                />
                <Text style={styles.body}>
                  I returned home at the end of the day{homeBase ? '' : ' (set a home base first)'}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  onPress={save}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.secondaryBtn, styles.flex1, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  {busy === 'save' ? (
                    <ActivityIndicator size="small" color={PALETTE.primaryDark} />
                  ) : (
                    <Text style={[styles.secondaryText, { color: PALETTE.primaryDark }]}>Save draft</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={submit}
                  disabled={!!busy || legs.length === 0}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    styles.flex1,
                    { backgroundColor: PALETTE.primaryDark },
                    (!!busy || legs.length === 0) && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  {busy === 'submit' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryText}>Submit</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  body: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), color: SLATE[700] },
  hint: { fontSize: TYPE.label, lineHeight: leading(TYPE.label), color: SLATE[600], marginTop: SPACING.sm },
  sectionLabel: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: SLATE[600],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  divider: { height: 1, backgroundColor: SLATE[100], marginVertical: SPACING.md },
  rates: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    fontWeight: '600',
    color: SLATE[700],
    marginTop: SPACING.md,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: TYPE.heading, fontWeight: '800', color: '#ffffff' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    marginTop: SPACING.sm,
  },
  secondaryText: { fontSize: TYPE.heading, fontWeight: '700' },
  btnDisabled: { backgroundColor: SLATE[300] },
  flex1: { flex: 1 },

  tiles: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  tile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileValue: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  tileLabel: {
    fontSize: TYPE.caption,
    fontWeight: '600',
    color: SLATE[600],
    textTransform: 'uppercase',
    marginTop: 2,
  },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
    borderRadius: 8,
  },
  dayRowText: { flex: 1 },
  dayRowDate: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  dayRowMeta: { fontSize: TYPE.label, color: SLATE[600], marginTop: 2 },

  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  returned: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: FEEDBACK.errorOnBg,
    backgroundColor: FEEDBACK.errorBg,
    borderWidth: 1,
    borderColor: FEEDBACK.errorBorder,
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  note: {
    fontSize: TYPE.label,
    lineHeight: leading(TYPE.label),
    color: SLATE[700],
    backgroundColor: SLATE[50],
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  errorText: { fontSize: TYPE.label, color: FEEDBACK.errorText, marginTop: SPACING.md, textAlign: 'center' },

  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  stopTime: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[800], minWidth: 72 },
  stopText: { flex: 1 },
  stopMeta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 1 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLATE[50],
  },

  leg: { paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: SLATE[100], gap: 6 },
  legTitle: { fontSize: TYPE.body, lineHeight: leading(TYPE.body), fontWeight: '700', color: SLATE[800] },
  legMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  legMeta: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[700] },
  badge: {
    fontSize: TYPE.caption,
    fontWeight: '700',
    color: FEEDBACK.warningOnBg,
    backgroundColor: FEEDBACK.warningBg,
    borderWidth: 1,
    borderColor: FEEDBACK.warningBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  amount: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], textAlign: 'right' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, alignSelf: 'flex-start' },
  linkText: { fontSize: TYPE.label, fontWeight: '700', textDecorationLine: 'underline' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 2,
    borderTopColor: SLATE[200],
  },
  totalLabel: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[700] },
  totalValue: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  pressed: { opacity: 0.75 },
}));
