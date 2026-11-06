import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SLATE, SPACING, TYPE } from '../../constants/theme';
import { EmptyState } from '../ui';
import { usePalette } from '../ui/PaletteContext';
import { universityStaffApi as api } from '../../services/portalClients';
import PortalHomeScreen from '../portal/PortalHomeScreen';
import { makeStyles } from '../../utils/makeStyles';

/**
 * Faculty — Professor and Associate Dean (5 Nov 2026). On the website this dashboard shows the
 * college's programmes and their semesters; the course rosters behind a semester are not built
 * there yet, so the app shows exactly what exists: each programme and how many semesters it runs.
 */
export default function FacultyHome() {
  const styles = useStyles();
  const palette = usePalette();
  const [state, setState] = useState({ me: null, programmes: null });

  const load = useCallback(async () => {
    const [me, programmes] = await Promise.all([
      api.get('/api/college-faculty/me').catch(() => null),
      api.get('/api/college-faculty/programmes').catch(() => []),
    ]);
    setState({ me, programmes: Array.isArray(programmes) ? programmes : [] });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PortalHomeScreen
      portalLabel={state.me?.universityName ? `Faculty · ${state.me.universityName}` : 'Faculty'}
      nameKey="universityStaffName"
      tiles={[]}
      onRefresh={load}
      changePasswordRoute="/unistaff/change-password"
    >
      <Text style={styles.title}>Programmes</Text>
      {state.programmes && state.programmes.length === 0 ? (
        <EmptyState title="No programmes yet" message="Your college's programmes appear here once its admin adds them." />
      ) : null}
      {(state.programmes || []).map((p) => (
        <View key={p.id} style={styles.card}>
          <Text style={[styles.name, { color: palette.primaryDark }]}>{p.name}</Text>
          <Text style={styles.meta}>{[p.code, p.degreeLevel].filter(Boolean).join(' · ')}</Text>
          <View style={styles.sems}>
            {Array.from({ length: p.totalSemesters || 0 }, (_, i) => (
              <View key={i} style={[styles.sem, { backgroundColor: palette.tint }]}>
                <Text style={[styles.semText, { color: palette.primaryDark }]}>Sem {i + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </PortalHomeScreen>
  );
}

const useStyles = makeStyles(() => ({
  title: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[500], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  card: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: SLATE[200], padding: SPACING.md, marginBottom: SPACING.sm },
  name: { fontSize: TYPE.heading, fontWeight: '800' },
  meta: { fontSize: TYPE.caption, color: SLATE[600], marginTop: 2 },
  sems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  sem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  semText: { fontSize: TYPE.caption, fontWeight: '800' },
}));
