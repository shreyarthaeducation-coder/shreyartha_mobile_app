import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FEEDBACK, SLATE, SPACING, TYPE } from '../../../constants/theme';
import { Card, CardTitle, GaugeChart, GroupedBars, RadarChart } from '../../ui';
import {
  FORM_DATA_SECTIONS,
  GRIFFIN_SECTION,
  RATING_SCALE,
  SECTION_CHARTS,
  hydrateForm,
  parseReportForm,
  sectionRatings,
} from '../../../constants/counsellorReportConfig';
import { formatShortDate } from '../../../utils/currency';

/**
 * ONE counsellor report, rendered read-only. Shared by the staff panels and the parent panel.
 *
 * The web works the same way: `School/shared/CounsellorReportView.js` is a single component serving
 * the parent portal and both teacher panels, so a parent and a teacher see a byte-identical report
 * body. This is the native equivalent, extracted out of components/staff/CounsellorReportScreen.js
 * when the parent panel needed it.
 *
 * ── WHY THIS IS SAFE TO SHARE ACROSS PORTALS ─────────────────────────────────
 * It is deliberately PALETTE-FREE. Every colour here is SLATE, FEEDBACK or a literal, and none of
 * the three charts it uses is palette-aware either. That is what lets it drop into the purple
 * parent panel unchanged. Do NOT "improve" it onto makeStyles/usePalette — the neutrality is the
 * feature, and it matches the web.
 *
 * ── TWO DTOs, ONE BODY ───────────────────────────────────────────────────────
 * `CounsellorReportResponse` (staff, 20 fields) and `ParentCounsellorReportResponse` (13 fields)
 * differ only in the envelope — the parent DTO drops eight counsellor-side internals
 * (`studentId`, `createdById`, `createdByRole`, `schoolCode`, `classId`, `academicYearId`, …) so
 * they never reach the parent portal. `formData` is the SAME raw JSON string in both, unfiltered,
 * and all four scalar columns are identical.
 *
 * The one field that is not a straight subset is the author's name: the staff DTO calls it
 * `createdByName`, the parent DTO calls it `counsellorName`, and both are populated from
 * `report.getCreatedBy().getFullName()`. Reading only one of them would make the author silently
 * vanish on the other portal — hence the fallback below.
 *
 * ── parseReportForm, NEVER hydrateForm ───────────────────────────────────────
 * `hydrateForm` belongs to the AUTHORING screen: it backfills 0/''/[] so controlled inputs never
 * go uncontrolled. A read-only body wants `parseReportForm`, which returns `{}` on absent or
 * malformed JSON and lets every missing value render as an em-dash — "not assessed" rather than
 * "rated zero".
 */

function Stars({ value }) {
  const n = Math.max(0, Math.min(RATING_SCALE, Number(value) || 0));
  if (n <= 0) return <Text style={styles.value}>—</Text>;
  return (
    <View style={styles.starRow}>
      {Array.from({ length: RATING_SCALE }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < n ? 'star' : 'star-outline'}
          size={16}
          color={i < n ? '#f59e0b' : SLATE[300]}
        />
      ))}
      <Text style={styles.starValue}>{n}/{RATING_SCALE}</Text>
    </View>
  );
}

function FieldValue({ field, form }) {
  const value = form[field.key];

  if (field.type === 'rating') return <Stars value={value} />;

  if (field.type === 'boolean') {
    if (value === null || value === undefined) return <Text style={styles.value}>—</Text>;
    // THE COLOURS ARE INVERTED ON PURPOSE. The only boolean in the schema is `learningGaps`, where
    // Yes is the bad news — so Yes reads as an error tint and No as a success tint.
    return (
      <View style={[styles.pill, value ? styles.pillYes : styles.pillNo]}>
        <Text style={[styles.pillText, { color: value ? FEEDBACK.errorText : FEEDBACK.successText }]}>
          {value ? 'Yes' : 'No'}
        </Text>
      </View>
    );
  }

  if (field.type === 'multiselect') {
    const items = Array.isArray(value) ? [...value] : [];
    const other = field.otherKey ? form[field.otherKey] : null;
    if (other) items.push(other);
    if (items.length === 0) return <Text style={styles.value}>—</Text>;
    return (
      <View style={styles.chipWrap}>
        {items.map((item) => (
          <View key={item} style={styles.chip}>
            <Text style={styles.chipText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (field.type === 'select') {
    // `optionLabels` is what turns the stored `they` into "they / them". Without this branch the
    // raw value printed, which reads as a typo rather than a pronoun choice.
    if (value === null || value === undefined || value === '') {
      return <Text style={styles.value}>—</Text>;
    }
    return <Text style={styles.value}>{field.optionLabels?.[value] || String(value)}</Text>;
  }

  // `text` and `textarea` share this fall-through; there is no separate multi-line branch.
  return <Text style={styles.value}>{value ? String(value) : '—'}</Text>;
}

function SectionChart({ section, form }) {
  const kind = SECTION_CHARTS[section.key];
  if (!kind) return null;

  const ratings = sectionRatings(section, form);
  // Nothing rated yet — a chart of zeroes says less than no chart.
  if (!ratings.some((r) => r.value > 0)) return null;

  if (kind === 'radar') {
    return (
      <RadarChart
        metrics={ratings.map((r) => ({
          key: r.key,
          label: r.label,
          // The kit's radar is 0–100; these are 0–5.
          value: (r.value / RATING_SCALE) * 100,
        }))}
        style={styles.chart}
      />
    );
  }

  if (kind === 'gauge') {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gauges}>
        {ratings.map((r) => (
          <GaugeChart key={r.key} tag={r.label} percentage={(r.value / RATING_SCALE) * 100} />
        ))}
      </ScrollView>
    );
  }

  return (
    <GroupedBars
      rows={ratings.map((r) => ({ tag: r.label, percentage: (r.value / RATING_SCALE) * 100 }))}
      style={styles.chart}
    />
  );
}

/**
 * @param {object} props
 * @param {object} props.report a row from either counsellor-report endpoint
 */
export default function ReportBody({ report }) {
  const saved = parseReportForm(report);

  /**
   * Section 11 shows here ONLY once it has been published.
   *
   * That gate is the reason the AI narrative lives on its own row rather than inside `formData`:
   * a draft the model wrote about a child, mid-session and unreviewed, must not reach that
   * child's parent. The server already withholds an unpublished `griffin` from both the parent
   * and teacher DTOs — this is the second lock, not the only one.
   */
  const griffin = report.griffin;
  const griffinVisible = !!GRIFFIN_SECTION && griffin?.status === 'PUBLISHED';
  const sections = griffinVisible ? [...FORM_DATA_SECTIONS, GRIFFIN_SECTION] : FORM_DATA_SECTIONS;

  // hydrateForm, not the raw parse: it is the only thing that merges the two tables into one
  // form, and it backfills the blanks the renderer below expects to be present.
  const form = hydrateForm(saved, griffinVisible ? griffin : null);

  // Staff DTO says `createdByName`; parent DTO says `counsellorName`. Same person, same source.
  const author = report.counsellorName || report.createdByName;

  return (
    <View>
      <View style={styles.reportHead}>
        <Text style={styles.reportTitle}>
          {report.className}
          {report.sectionName ? ` – ${report.sectionName}` : ''}
        </Text>
        <Text style={styles.reportMeta}>
          {formatShortDate(report.reportDate)}
          {author ? ` · by ${author}` : ''}
          {report.yearLabel ? ` · ${report.yearLabel}` : ''}
        </Text>
      </View>

      {/* All ten always render, even when empty — matching the web, so a blank section reads as
          "not assessed" rather than "not in this report". The eleventh joins them only when
          published, which is why this maps `sections` and not REPORT_SECTIONS: numbering off the
          raw array would show a parent a section that is not in their copy. */}
      {sections.map((sec, index) => (
        <Card key={sec.key}>
          <CardTitle>
            {index + 1}. {sec.title}
          </CardTitle>
          {sec.fields.map((field) => (
            <View key={field.key} style={styles.field}>
              {field.hideLabel ? null : <Text style={styles.fieldLabel}>{field.label}</Text>}
              <FieldValue field={field} form={form} />
            </View>
          ))}
          <SectionChart section={sec} form={form} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  reportHead: { marginTop: SPACING.lg },
  reportTitle: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  reportMeta: { fontSize: TYPE.label, color: SLATE[500], marginTop: 2 },

  field: { paddingVertical: 6 },
  fieldLabel: { fontSize: TYPE.caption, fontWeight: '700', color: SLATE[500], marginBottom: 3 },
  value: { fontSize: TYPE.body, color: SLATE[800] },

  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starValue: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '700', marginLeft: 5 },

  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pillYes: { backgroundColor: FEEDBACK.errorBg },
  pillNo: { backgroundColor: FEEDBACK.successBg },
  pillText: { fontSize: TYPE.caption, fontWeight: '700' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: SLATE[100] },
  chipText: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[600] },

  chart: { marginTop: SPACING.sm },
  gauges: { gap: SPACING.md, paddingVertical: SPACING.sm },
});
