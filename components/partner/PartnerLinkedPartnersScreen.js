import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { Card, EmptyState, ScreenScaffold, StatusChip } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { makeStyles } from '../../utils/makeStyles';
// Despite the name, this hook is portal-agnostic — it takes a fetcher and knows nothing about
// staffApi. The parent screens already reuse it; renaming it would churn ~20 imports for nothing.
import useStaffResource from '../../hooks/useStaffResource';
import { fetchLinkedPartners } from '../../services/partner/analyticsService';

/**
 * Linked Partners — the NORMAL partners sitting under a MASTER.
 *
 * Ports frontendmain/src/Partner/platform/PartnerLinkedPartners.js.
 *
 * ── THE 400 ─────────────────────────────────────────────────────────────────────────────────
 * A NORMAL partner calling this endpoint is refused with **HTTP 400, not 403**:
 * PartnerAnalyticsService throws IllegalStateException("Only Master Partners can view linked
 * partners.") and the controller maps it to 400 + { success:false, message }. So the server's own
 * message is what gets shown, rather than a status-code branch — `isForbidden` is false here and
 * any `status === 403` check would fall through to a generic failure.
 *
 * The web adds a render-time guard on `profile.partnerType !== 'MASTER'`. That is not repeated
 * here: the tile is already master-only (constants/partnerMenu.js), and the server is the real
 * gate. Guessing the tier client-side is how the web silently demotes a Master whose profile call
 * happened to fail — see partnerTypeOf in services/partner/profileService.js.
 */

export default function PartnerLinkedPartnersScreen({ homeRoute = '/partner' }) {
  const styles = useStyles();
  const palette = usePalette();
  // `fetchLinkedPartners` is a module-level function, so its identity is already stable — no
  // useCallback needed. A fetcher rebuilt each render would loop the hook's effect forever.
  //
  // `error` here is the SERVER's message ("Only Master Partners can view linked partners.") —
  // PortalApiError.message is populated from the 400 body, so a NORMAL partner who reaches this
  // screen gets told exactly why rather than "Something went wrong".
  const { data, loading, error, refreshing, refresh, reload } =
    useStaffResource(fetchLinkedPartners);

  const rows = Array.isArray(data) ? data : [];
  const verified = rows.filter((r) => r.verified).length;

  return (
    <ScreenScaffold
      title="Linked Partners"
      fallbackRoute={homeRoute}
      loading={loading}
      error={error}
      onRetry={reload}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No linked partners yet"
          message="Partners who sign up under your Master code will appear here."
        />
      ) : (
        <>
          <View style={styles.stats}>
            {[
              ['Linked', rows.length],
              ['Verified', verified],
              ['Pending', rows.length - verified],
            ].map(([label, value]) => (
              <View key={label} style={styles.stat}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {rows.map((r) => (
            <Card key={r.partnerUserId}>
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.fullName || '—'}
                </Text>
                <StatusChip
                  label={r.verified ? 'Verified' : 'Pending'}
                  tone={r.verified ? 'success' : 'warning'}
                />
              </View>
              <Text style={styles.code}>{r.partnerCode || '—'}</Text>
              {r.email ? (
                <View style={styles.metaRow}>
                  <Ionicons name="mail-outline" size={16} color={palette.primaryDark} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.email}
                  </Text>
                </View>
              ) : null}
              {r.mobile ? (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={16} color={palette.primaryDark} />
                  <Text style={styles.meta}>{r.mobile}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </ScreenScaffold>
  );
}

const useStyles = makeStyles((p) => ({
  stats: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: p.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: p.cardBorder,
  },
  statValue: { fontSize: TYPE.headline, fontWeight: '800', color: p.primaryDark },
  statLabel: {
    fontSize: TYPE.caption,
    color: SLATE[600],
    marginTop: 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: TYPE.title, fontWeight: '700', color: p.primaryDark },
  code: { fontSize: TYPE.label, fontWeight: '600', color: p.primary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  meta: { flex: 1, fontSize: TYPE.label, color: SLATE[600] },
}));
