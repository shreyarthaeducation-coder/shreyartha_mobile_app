import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FEEDBACK, SLATE, SPACING, TYPE, leading } from '../../constants/theme';
import { Card, SegmentedTabs } from '../ui';
import { formatDuration, levelLabel } from '../../services/teacher/adaptiveService';

/**
 * A class's results on one test, as the server's ClassTestReportBuilder shapes them (24 Oct 2026) —
 * the native twin of the website's School/shared/ClassTestReport. Used by the teacher's adaptive
 * Class Report; the same shape comes back for Live Test Rooms and school exams, so those can use it
 * too.
 *
 * @param report        the server's class report
 * @param onOpenStudent (row) => void — opens one student's own report from the Top/Bottom lists
 * @param paperLabel    what the "papers" comparison is called ("Question level" for adaptive)
 */

const COLORS = { top: '#4f46e5', class: '#94a3b8', bottom: '#f59e0b' };
const BAND_TONE = {
  Excellent: { bg: FEEDBACK.successBg, fg: FEEDBACK.successText },
  Good: { bg: '#eff6ff', fg: '#1d4ed8' },
  'Needs more practice': { bg: '#fffbeb', fg: '#b45309' },
  'Needs support': { bg: '#fef2f2', fg: '#b91c1c' },
};

const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 10) / 10}%`);
const num = (v) => (v == null ? '—' : Number.isInteger(Number(v)) ? String(v) : String(Math.round(Number(v) * 10) / 10));
const time = (s) => (s == null ? '—' : formatDuration(s));

function Tile({ value, label }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function StudentList({ title, rows, onOpenStudent, accent, emptyText }) {
  return (
    <Card style={[styles.block, { borderTopWidth: 3, borderTopColor: accent }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>{emptyText}</Text>
      ) : (
        rows.map((r) => (
          <Pressable
            key={`${r.rank}-${r.name}`}
            onPress={onOpenStudent && r.link ? () => onOpenStudent(r) : undefined}
            disabled={!onOpenStudent || !r.link}
            style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
            accessibilityRole={onOpenStudent ? 'button' : undefined}
          >
            <Text style={styles.rank}>{r.rank}</Text>
            <View style={styles.flex}>
              <Text style={[styles.studentName, onOpenStudent && r.link ? { color: COLORS.top } : null]} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={styles.studentMeta}>
                {num(r.marks)} / {num(r.outOf)}
                {r.seconds != null ? ` · ${time(r.seconds)}` : ''}
                {r.level ? ` · ${levelLabel(r.level)}` : ''}
              </Text>
            </View>
            <Text style={styles.studentPct}>{pct(r.percent)}</Text>
          </Pressable>
        ))
      )}
    </Card>
  );
}

function ThreeBars({ row }) {
  return (
    <View style={styles.compareGroup}>
      <Text style={styles.compareTag} numberOfLines={2}>
        {row.tag}
      </Text>
      {[
        ['top', 'Top 5'],
        ['class', 'Class'],
        ['bottom', 'Bottom 5'],
      ].map(([key, label]) => (
        <View key={key} style={styles.barRow} accessibilityLabel={`${label} ${pct(row[key])}`}>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.max(0, Math.min(100, Number(row[key]) || 0))}%`, backgroundColor: COLORS[key] }]}
            />
          </View>
          <Text style={[styles.barValue, { color: key === 'class' ? SLATE[500] : COLORS[key] }]}>{pct(row[key])}</Text>
        </View>
      ))}
    </View>
  );
}

function QuestionList({ title, rows }) {
  return (
    <Card style={styles.block}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No questions to show.</Text>
      ) : (
        rows.map((q, i) => (
          <View key={q.key || q.label} style={styles.questionRow}>
            <View style={styles.questionHead}>
              <Text style={styles.questionLabel}>
                {i + 1}. {q.label}
                {q.paper ? ` · ${q.paper}` : ''}
              </Text>
              <Text style={styles.questionPct}>{pct(q.percentCorrect)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, Number(q.percentCorrect) || 0))}%`, backgroundColor: COLORS.top }]} />
            </View>
            {q.text ? (
              <Text style={styles.questionText} numberOfLines={3}>
                {q.text}
              </Text>
            ) : null}
            {q.commonWrong ? (
              <Text style={styles.muted}>
                Most chosen wrong answer: {q.commonWrong.option} ({q.commonWrong.count})
              </Text>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

export default function ClassTestReportView({ report, onOpenStudent, paperLabel = 'Paper' }) {
  const compare = report?.compare || {};
  const tabs = useMemo(
    () =>
      [
        ['blooms', "Bloom's"],
        ['skills', 'Skill'],
        ['papers', paperLabel],
        ['chapters', 'Chapter'],
      ]
        .filter(([key]) => (compare[key] || []).length > 0)
        .map(([value, label]) => ({ value, label })),
    [compare, paperLabel],
  );
  const [tab, setTab] = useState(null);
  const activeTab = tab && tabs.some((t) => t.value === tab) ? tab : tabs[0]?.value;

  if (!report) return null;
  const s = report.summary || {};
  const bins = report.distribution || [];
  const maxBin = Math.max(1, ...bins.map((b) => b.count || 0));

  return (
    <View>
      <View style={styles.tiles}>
        <Tile value={num(s.took)} label="Took it" />
        <Tile value={num(s.absent)} label="Absent" />
        <Tile value={pct(s.average)} label="Average" />
      </View>
      <View style={styles.tiles}>
        <Tile value={pct(s.median)} label="Median" />
        <Tile value={pct(s.highest)} label="Highest" />
        <Tile value={pct(s.lowest)} label="Lowest" />
      </View>
      {(s.bands || []).length > 0 ? (
        <View style={styles.bands}>
          {s.bands.map((b) => {
            const tone = BAND_TONE[b.label] || { bg: SLATE[100], fg: SLATE[600] };
            return (
              <View key={b.label} style={[styles.band, { backgroundColor: tone.bg }]}>
                <Text style={[styles.bandText, { color: tone.fg }]}>
                  {b.label}: {b.count}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <StudentList
        title="Top 5"
        rows={report.top || []}
        onOpenStudent={onOpenStudent}
        accent={COLORS.top}
        emptyText="Nobody has taken it yet."
      />
      <StudentList
        title="Bottom 5"
        rows={report.bottom || []}
        onOpenStudent={onOpenStudent}
        accent={COLORS.bottom}
        emptyText="Everyone who took it is in the top five."
      />

      {bins.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.cardTitle}>Spread of scores</Text>
          {bins.map((b) => (
            <View key={`${b.from}-${b.to}`} style={styles.binRow}>
              <Text style={styles.binLabel}>
                {b.from}–{b.to}%
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${((b.count || 0) / maxBin) * 100}%`, backgroundColor: COLORS.top }]} />
              </View>
              <Text style={styles.binCount}>{b.count || 0}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {tabs.length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.cardTitle}>Top 5 · Class · Bottom 5</Text>
          <SegmentedTabs options={tabs} value={activeTab} onChange={setTab} />
          <View style={styles.legend}>
            {[
              ['top', 'Top 5'],
              ['class', 'Class'],
              ['bottom', 'Bottom 5'],
            ].map(([key, label]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: COLORS[key] }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
          {(compare[activeTab] || []).map((row) => (
            <ThreeBars key={row.tag} row={row} />
          ))}
        </Card>
      ) : null}

      <QuestionList title="Hardest questions" rows={report.hardest || []} />
      <QuestionList title="Easiest questions" rows={report.easiest || []} />

      {report.time ? (
        <Card style={styles.block}>
          <Text style={styles.cardTitle}>Time taken</Text>
          <View style={styles.tiles}>
            <Tile value={time(report.time.average)} label="Average" />
            <Tile value={time(report.time.fastest)} label="Fastest" />
            <Tile value={time(report.time.slowest)} label="Slowest" />
          </View>
        </Card>
      ) : null}

      {(report.levels || []).length > 0 ? (
        <Card style={styles.block}>
          <Text style={styles.cardTitle}>Levels reached</Text>
          <View style={styles.tiles}>
            {report.levels.map((l) => (
              <Tile key={l.level} value={num(l.count)} label={levelLabel(l.level)} />
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  block: { marginTop: SPACING.sm },
  tiles: { flexDirection: 'row', gap: 8, marginTop: SPACING.sm },
  tile: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLATE[200],
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  tileValue: { fontSize: TYPE.title, fontWeight: '800', color: SLATE[800] },
  tileLabel: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600', marginTop: 2 },
  bands: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  band: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bandText: { fontSize: TYPE.caption, fontWeight: '700' },
  cardTitle: { fontSize: TYPE.heading, fontWeight: '800', color: SLATE[800], marginBottom: SPACING.sm },
  muted: { fontSize: TYPE.label, color: SLATE[500], lineHeight: leading(TYPE.label) },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: SLATE[100],
  },
  rank: { width: 20, fontSize: TYPE.body, fontWeight: '800', color: SLATE[500] },
  studentName: { fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  studentMeta: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 1 },
  studentPct: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  binRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  binLabel: { width: 64, fontSize: TYPE.caption, color: SLATE[500] },
  binCount: { width: 24, textAlign: 'right', fontSize: TYPE.caption, fontWeight: '700', color: SLATE[600] },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: SLATE[100], overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  legend: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: TYPE.caption, color: SLATE[600], fontWeight: '600' },
  compareGroup: { marginTop: SPACING.sm },
  compareTag: { fontSize: TYPE.label, fontWeight: '700', color: SLATE[700], marginBottom: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  barValue: { width: 52, textAlign: 'right', fontSize: TYPE.caption, fontWeight: '700' },
  questionRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: SLATE[100], gap: 5 },
  questionHead: { flexDirection: 'row', alignItems: 'center' },
  questionLabel: { flex: 1, fontSize: TYPE.body, fontWeight: '700', color: SLATE[800] },
  questionPct: { fontSize: TYPE.body, fontWeight: '800', color: SLATE[800] },
  questionText: { fontSize: TYPE.label, color: SLATE[600], lineHeight: leading(TYPE.label) },
  pressed: { opacity: 0.72 },
});
