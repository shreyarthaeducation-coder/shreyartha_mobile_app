import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { PALETTE } from './marksParts';

/**
 * The website's marks table — `students × columns`, one input per cell — on a phone.
 *
 * The student column stays put and the rest scrolls sideways, so a teacher on Q9 still sees whose
 * row it is. The header cells are what the website's <th>s say: "Q1" over "/5", "Total" over "/40".
 * Each column is `{ key, title, sub?, width, render(student, index) }`; every row is the same height
 * so the two halves line up.
 */

export const ROW_HEIGHT = 54;
const HEAD_HEIGHT = 46;
const NAME_WIDTH = 138;

export default function MarksGrid({ students, columns }) {
  return (
    <View style={grid.table}>
      <View style={grid.frozen}>
        <View style={[grid.headCell, grid.nameHead]}>
          <Text style={grid.headText}>Student</Text>
        </View>
        {students.map((student, index) => (
          <View key={student.studentId} style={[grid.cell, grid.nameCell]}>
            <Text style={grid.name} numberOfLines={2}>
              <Text style={grid.index}>{index + 1}. </Text>
              {student.studentName}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator
        style={grid.scroller}
      >
        <View>
          <View style={grid.row}>
            {columns.map((column) => (
              <View key={column.key} style={[grid.headCell, { width: column.width }]}>
                <Text style={grid.headText} numberOfLines={1}>
                  {column.title}
                </Text>
                {column.sub ? (
                  <Text style={grid.headSub} numberOfLines={1}>
                    {column.sub}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
          {students.map((student, index) => (
            <View key={student.studentId} style={grid.row}>
              {columns.map((column) => (
                <View key={column.key} style={[grid.cell, { width: column.width }]}>
                  {column.render(student, index)}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export const grid = StyleSheet.create({
  table: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  frozen: { width: NAME_WIDTH, borderRightWidth: 1, borderRightColor: SLATE[200], backgroundColor: '#ffffff' },
  scroller: { flex: 1 },
  row: { flexDirection: 'row' },
  headCell: {
    height: HEAD_HEIGHT,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.tint,
    borderBottomWidth: 1,
    borderBottomColor: SLATE[200],
  },
  nameHead: { alignItems: 'flex-start', paddingHorizontal: 10 },
  headText: { fontSize: TYPE.label, fontWeight: '800', color: PALETTE.primaryDark },
  headSub: { fontSize: TYPE.caption, fontWeight: '600', color: SLATE[500] },
  cell: {
    height: ROW_HEIGHT,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: SLATE[100],
  },
  nameCell: { alignItems: 'flex-start', paddingHorizontal: 10 },
  name: { fontSize: TYPE.label, fontWeight: '600', color: SLATE[800] },
  index: { color: SLATE[500], fontWeight: '700' },

  // The inputs inside the cells.
  input: {
    width: '100%',
    height: 38,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: SLATE[200],
    borderRadius: 7,
    textAlign: 'center',
    fontSize: TYPE.body,
    fontWeight: '700',
    color: SLATE[900],
    backgroundColor: '#ffffff',
  },
  textInput: { textAlign: 'left', fontWeight: '400', paddingHorizontal: 8 },
  idText: { fontSize: TYPE.label, color: SLATE[600] },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3, width: '100%' },
  outOf: { fontSize: TYPE.caption, color: SLATE[500], fontWeight: '600' },
});
