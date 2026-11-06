import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SLATE, SPACING, TYPE, leading } from '../../constants/theme';

/**
 * Registering in two layers of tiles (6 Nov 2026) — the website's Get Started picker: the kind of
 * organisation first (School, University, Industry, Partner & Investor), then the role in it, each
 * tile with its logo. The roles are LOGIN_GROUPS' own cards (routes, labels), grouped here.
 *
 * @param options LOGIN_GROUPS.general.options
 * @param onPick  called with the chosen card
 */
export const SIGNUP_SEGMENTS = [
  { key: 'school', label: 'School', blurb: 'Students, parents, school staff and alumni', icon: 'school-outline', accent: '#4f46e5', roles: ['student', 'school', 'parent', 'alumni'] },
  { key: 'university', label: 'University', blurb: 'The university, and the people who work there', icon: 'library-outline', accent: '#0e7490', roles: ['university', 'universityStaff'] },
  { key: 'industry', label: 'Industry', blurb: 'Companies that hire and train students', icon: 'business-outline', accent: '#c2410c', roles: ['industry'] },
  { key: 'partnerInvestor', label: 'Partner & Investor', blurb: 'Partners who bring schools, and investors', icon: 'trending-up-outline', accent: '#15803d', roles: ['partner', 'investor'] },
];

const ROLE_ICONS = {
  student: 'school',
  school: 'easel-outline',
  parent: 'people-outline',
  alumni: 'ribbon-outline',
  university: 'library',
  universityStaff: 'person-circle-outline',
  industry: 'business',
  partner: 'link-outline',
  investor: 'cash-outline',
};

export default function SignupTiles({ options = [], onPick }) {
  const [segmentKey, setSegmentKey] = useState(null);
  const segment = SIGNUP_SEGMENTS.find((s) => s.key === segmentKey);
  const byKey = Object.fromEntries(options.map((o) => [o.key, o]));

  const tile = ({ key, label, blurb, icon, accent, onPress, a11y, foot }) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <View style={[styles.logo, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={24} color="#ffffff" />
      </View>
      <Text style={styles.title}>{label}</Text>
      {blurb ? (
        <Text style={styles.blurb} numberOfLines={3}>
          {blurb}
        </Text>
      ) : null}
      <Text style={[styles.foot, { color: accent }]}>{foot}</Text>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.head}>
        {segment ? (
          <Pressable onPress={() => setSegmentKey(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.step}>
          {segment ? `Step 2 of 2 · ${segment.label} — who are you?` : 'Step 1 of 2 · Where are you from?'}
        </Text>
      </View>
      <View style={styles.grid}>
        {!segment
          ? SIGNUP_SEGMENTS.map((s) =>
              tile({
                key: s.key,
                label: s.label,
                blurb: s.blurb,
                icon: s.icon,
                accent: s.accent,
                onPress: () => setSegmentKey(s.key),
                a11y: `${s.label}: ${s.blurb}`,
                foot: `${s.roles.length} ${s.roles.length === 1 ? 'option' : 'options'} ›`,
              }),
            )
          : segment.roles
              .map((k) => byKey[k])
              .filter(Boolean)
              .map((o) =>
                tile({
                  key: o.key,
                  label: o.label,
                  blurb: o.sublabel,
                  icon: ROLE_ICONS[o.key] || 'person-outline',
                  accent: segment.accent,
                  onPress: () => onPick(o),
                  a11y: `Register as ${o.label}`,
                  foot: 'Sign up ›',
                }),
              )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  back: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700] },
  step: { flex: 1, fontSize: TYPE.caption, color: SLATE[500] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACING.sm },
  tile: {
    width: '48.5%',
    minHeight: 150,
    padding: SPACING.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: '#ffffff',
    gap: 4,
  },
  logo: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: TYPE.label, fontWeight: '800', color: SLATE[800] },
  blurb: { fontSize: TYPE.caption, color: SLATE[500], lineHeight: leading(TYPE.caption) },
  foot: { marginTop: 'auto', fontSize: TYPE.caption, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
