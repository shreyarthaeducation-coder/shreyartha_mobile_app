import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SLATE, SPACING, TOUCH, TYPE } from '../../constants/theme';
import { EmptyState, ScreenScaffold, SegmentedTabs } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import useStaffResource from '../../hooks/useStaffResource';
import { investorApi as api } from '../../services/portalClients';
import { API_BASE_URL } from '../../services/apiService';
import { loadPdf } from '../staff/ai/lazyPdf';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import { makeStyles } from '../../utils/makeStyles';

/**
 * The Investor portal, native (5 Nov 2026) — the website's Investor/platform: Dashboard, Benefits,
 * Equity, Investor Relations and Agreements & Results. Figures are per financial year, picked as on
 * the website. Documents are view-only, exactly as there: they open in a viewer with no download.
 */

const inr = (v) => (v == null || v === '' ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const pct = (v) => (v == null || v === '' ? '—' : `${Number(v)}%`);

export const INVESTOR_TILES = [
  { key: 'benefits', label: 'Benefits', icon: 'cash-outline', route: '/investor/benefits', blurb: 'Your returns for the year' },
  { key: 'equity', label: 'Equity', icon: 'pie-chart-outline', route: '/investor/equity', blurb: 'Your stake and its value' },
  { key: 'relations', label: 'Investor Relations', icon: 'folder-open-outline', route: '/investor/relations', blurb: 'Advisory and shares documents' },
  { key: 'agreements', label: 'Agreements & Results', icon: 'document-text-outline', route: '/investor/agreements', blurb: 'Signed agreements and results' },
];

export function InvestorHome() {
  const styles = useStyles();
  const palette = usePalette();
  const [profile, setProfile] = useState(null);
  const load = useCallback(async () => {
    try {
      setProfile(await api.get('/api/investor/profile'));
    } catch {
      setProfile(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <PortalHomeScreen portalLabel="Investor" nameKey="investorUserName" tiles={INVESTOR_TILES} onRefresh={load}>
      {profile ? (
        <View style={styles.card}>
          <View style={styles.head}>
            {profile.profilePhotoUrl ? (
              <Image source={{ uri: profile.profilePhotoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, { backgroundColor: palette.tint }]} />
            )}
            <View style={styles.flex}>
              <Text style={[styles.name, { color: palette.primaryDark }]}>{profile.fullName}</Text>
              <Text style={styles.line}>{[profile.email, profile.mobile].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          {profile.details ? <Text style={styles.details}>{profile.details}</Text> : null}
        </View>
      ) : null}
    </PortalHomeScreen>
  );
}

/** The financial years an investor has records for, newest first, and which one is picked. */
function useYear() {
  const [years, setYears] = useState(null);
  const [year, setYear] = useState(null);
  useEffect(() => {
    api
      .get('/api/investor/financials/years')
      .then((ys) => {
        const list = Array.isArray(ys) ? ys : [];
        setYears(list);
        if (list.length) setYear(String(list[0].startYear ?? list[0]));
      })
      .catch(() => setYears([]));
  }, []);
  return { years, year, setYear };
}

function YearTabs({ years, year, setYear }) {
  const styles = useStyles();
  if (!years || years.length < 2) return null;
  return (
    <SegmentedTabs
      scrollable
      options={years.map((y) => ({ value: String(y.startYear ?? y), label: y.fyLabel || `FY ${y.startYear ?? y}` }))}
      value={year}
      onChange={setYear}
      style={styles.years}
    />
  );
}

function useFinancials(year) {
  const fetcher = useCallback(() => api.get(`/api/investor/financials${year ? `?startYear=${year}` : ''}`), [year]);
  return useStaffResource(fetcher, { initialData: null });
}

function Stat({ label, value }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={[styles.stat, { borderColor: palette.tint }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: palette.primaryDark }]}>{value}</Text>
    </View>
  );
}

export function InvestorBenefits() {
  const styles = useStyles();
  const y = useYear();
  const { data: r, loading, error, reload } = useFinancials(y.year);
  return (
    <ScreenScaffold title="Benefits" fallbackRoute="/investor" loading={loading || y.years === null} error={error} onRetry={reload}>
      <YearTabs {...y} />
      {!r ? (
        <EmptyState title="No financial record yet" message="Your returns appear here once the admin adds them." />
      ) : (
        <View style={styles.card}>
          <Text style={styles.section}>Dividend{r.fyLabel ? ` · ${r.fyLabel}` : ''}</Text>
          {r.dividendPaid ? (
            <View style={styles.grid}>
              <Stat label={`Annual (${pct(r.annualRatePercent)})`} value={inr(r.annualBenefit)} />
              <Stat label="Monthly" value={inr(r.monthlyBenefit)} />
              <Stat label="Quarterly" value={inr(r.quarterlyBenefit)} />
            </View>
          ) : (
            <Text style={styles.details}>This is an equity-only holding — no periodic payout is applicable for this financial year.</Text>
          )}
        </View>
      )}
    </ScreenScaffold>
  );
}

export function InvestorEquity() {
  const styles = useStyles();
  const y = useYear();
  const { data: r, loading, error, reload } = useFinancials(y.year);
  return (
    <ScreenScaffold title="Equity" fallbackRoute="/investor" loading={loading || y.years === null} error={error} onRetry={reload}>
      <YearTabs {...y} />
      {!r ? (
        <EmptyState title="No equity record yet" />
      ) : (
        <View style={styles.card}>
          <Text style={styles.section}>Equity holding{r.fyLabel ? ` · ${r.fyLabel}` : ''}</Text>
          <View style={styles.grid}>
            <Stat label="Investment" value={inr(r.investedAmount)} />
            <Stat label="Equity percentage" value={pct(r.equityPercent)} />
            <Stat label="Equity value" value={inr(r.equityAmount)} />
          </View>
          {r.advisoryEquity ? (
            <>
              <Text style={[styles.section, styles.gap]}>Advisory equity / shares</Text>
              <Text style={styles.details}>{r.advisoryEquity}</Text>
            </>
          ) : null}
        </View>
      )}
    </ScreenScaffold>
  );
}

/** Documents in sections (by category) and financial years; tapping one opens the viewer. */
function InvestorDocs({ title, sections }) {
  const styles = useStyles();
  const palette = usePalette();
  const router = useRouter();
  const [section, setSection] = useState(sections[0].key);
  const fetcher = useCallback(() => api.get('/api/investor/attachments'), []);
  const { data, loading, error, reload, refreshing, refresh } = useStaffResource(fetcher, { initialData: null });
  const docs = (Array.isArray(data) ? data : []).filter((a) => a.category === section);
  const years = [...new Set(docs.map((a) => a.fyLabel || 'Other'))];
  return (
    <ScreenScaffold title={title} fallbackRoute="/investor" loading={loading} error={error} onRetry={reload} refreshing={refreshing} onRefresh={refresh}>
      <SegmentedTabs options={sections.map((s) => ({ value: s.key, label: s.label }))} value={section} onChange={setSection} style={styles.years} />
      <Text style={styles.details}>Documents are view-only.</Text>
      {docs.length === 0 ? <EmptyState icon="folder-open-outline" title="No documents here yet" /> : null}
      {years.map((fy) => (
        <View key={fy}>
          <Text style={styles.section}>{fy}</Text>
          {docs
            .filter((a) => (a.fyLabel || 'Other') === fy)
            .map((a) => (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/investor/document', params: { id: String(a.id), name: a.fileName || 'Document' } })}
                style={({ pressed }) => [styles.doc, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name={/\.pdf$/i.test(a.fileName || '') ? 'document-text-outline' : 'image-outline'} size={22} color={palette.primaryDark} />
                <Text style={styles.docName} numberOfLines={2}>
                  {a.fileName}
                </Text>
                <Ionicons name="eye-outline" size={18} color={SLATE[400]} />
              </Pressable>
            ))}
        </View>
      ))}
    </ScreenScaffold>
  );
}

export function InvestorRelations() {
  return <InvestorDocs title="Investor Relations" sections={[{ key: 'ADVISORY', label: 'Advisory' }, { key: 'SHARES', label: 'Shares' }]} />;
}

export function InvestorAgreements() {
  return <InvestorDocs title="Agreements & Results" sections={[{ key: 'AGREEMENT', label: 'Agreements' }, { key: 'RESULTS', label: 'Results' }]} />;
}

/** One document, view-only: a PDF in the in-app viewer, an image as an image. No download. */
export function InvestorDocument() {
  const styles = useStyles();
  const palette = usePalette();
  const { id, name } = useLocalSearchParams();
  const [token, setToken] = useState(null);
  useEffect(() => {
    AsyncStorage.getItem('investorUserToken').then((t) => setToken(t || ''));
  }, []);
  const source = token ? { uri: `${API_BASE_URL}/api/investor/attachments/${id}/view`, headers: { Authorization: `Bearer ${token}` } } : null;
  const isPdf = /\.pdf$/i.test(String(name || ''));
  const { Pdf, available } = loadPdf();
  return (
    <ScreenScaffold title={name || 'Document'} fallbackRoute="/investor" scroll={false}>
      {!source ? (
        <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />
      ) : isPdf ? (
        available ? (
          <Pdf source={{ ...source, cache: false }} style={styles.flex} trustAllCerts={false} />
        ) : (
          <EmptyState title="This document needs the latest app" message="Update the app to view PDF documents here." />
        )
      ) : (
        <Image source={source} style={styles.flex} resizeMode="contain" />
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  loader: { marginTop: SPACING.xl },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  photo: { width: 56, height: 56, borderRadius: 28 },
  name: { fontSize: TYPE.heading, fontWeight: '800' },
  line: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  details: { fontSize: TYPE.body, color: SLATE[600], marginTop: SPACING.sm, marginBottom: SPACING.sm },
  years: { marginBottom: SPACING.md },
  section: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: SPACING.sm },
  gap: { marginTop: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  stat: { flexGrow: 1, flexBasis: '46%', borderWidth: 1.5, borderRadius: 14, padding: SPACING.md },
  statLabel: { fontSize: TYPE.caption, color: SLATE[500] },
  statValue: { fontSize: TYPE.headline, fontWeight: '800', marginTop: 2 },
  doc: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, minHeight: TOUCH.min, marginBottom: SPACING.sm },
  docName: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  pressed: { opacity: 0.8 },
}));
