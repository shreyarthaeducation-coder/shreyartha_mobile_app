// Static "used but not in scope" check for the RN app.
//
//   node scripts/checkscope.js .
//
// WHY THIS EXISTS. `npx expo export` compiles happily through an identifier that is used but never
// imported — the reference is only resolved at runtime — so a clean bundle proves nothing about
// this class of mistake. It has now shipped three times from this repo:
//   * a top-level react-native-pdf import that boot-crashed every route
//   * a try/catch that Metro reported around anyway
//   * `makeStyles` used in 16 files after a codemod that never added the import
// Run it after any mechanical/codemod-style edit, before believing a green build.
//
// KNOWN FALSE POSITIVES (five, all benign): a named function expression (`return function X()`),
// a couple of services whose single-line import the scope extractor misses, and `Card`/`CardTitle`
// in components/student/analytics/AnalyticsBody.js — those two are COMPONENT PROPS, injected by
// each portal precisely so the body does not hardcode either card style. The extractor has no way
// to tell a capitalised prop from a missing import. Treat a report as "look at the file", not as
// proof — the direct check is:
//   for f in $(grep -rl "NAME(" components); do grep -q "import.*NAME" "$f" || echo "BAD $f"; done
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const SKIP = new Set(['node_modules', 'dist', '.git', '_student_native', '.expo']);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

// Identifiers worth checking: things a refactor typically leaves dangling.
const NAMES = [
  'makeStyles', 'usePalette', 'useStyles', 'StyleSheet', 'PORTALS', 'SLATE', 'SPACING',
  'SHADOWS', 'FEEDBACK', 'LineChart', 'SchoolClassPicker', 'EMPTY_SCHOOL_SCOPE', 'EMPTY_SCOPE',
  'PaletteProvider', 'ScopePicker', 'Select', 'FormSheet', 'EmptyState', 'ScreenScaffold',
  'StatusChip', 'SegmentedTabs', 'TextField', 'DateTimeField', 'MonthNavigator', 'CalendarGrid',
  'Card', 'CardTitle', 'useToast', 'Toast', 'Ionicons', 'useStaffResource', 'staffApi',
  'useMemo', 'useCallback', 'useEffect', 'useState', 'useRef',
];

const dirs = ['components', 'app', 'utils', 'constants', 'hooks', 'services']
  .map((d) => path.join(ROOT, d))
  .filter((d) => fs.existsSync(d));

let bad = 0;
for (const p of dirs.flatMap((d) => walk(d))) {
  const raw = fs.readFileSync(p, 'utf8');
  // Comments mention names constantly ("see makeStyles", "usePalette defaults to…") and are not
  // usage. Strip them or the checker drowns in false positives and stops being read.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // Everything the file brings into scope: imports (incl. multi-line) + top-level declarations.
  const scope = new Set();
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/g)) {
    for (const tok of m[1].replace(/[{}]/g, ',').split(',')) {
      const n = tok.trim().split(/\s+as\s+/).pop().trim();
      if (n && n !== '*') scope.add(n);
    }
  }
  for (const m of src.matchAll(/^\s*(?:export\s+(?:default\s+)?)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    scope.add(m[1]);
  }
  // A module that exports a name is allowed to mention it (barrels, self-referential docs).
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const tok of m[1].split(',')) {
      const n = tok.trim().split(/\s+as\s+/).pop().trim();
      if (n) scope.add(n);
    }
  }
  // Destructured locals, e.g. `const { toast, showToast } = useToast();`
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const tok of m[1].split(',')) {
      const n = tok.trim().split(':').pop().trim();
      if (n) scope.add(n);
    }
  }

  for (const name of NAMES) {
    // used as a call, member access, index, or JSX element
    const used = new RegExp(`\\b${name}\\s*[(.\\[<]`).test(src) || new RegExp(`<${name}[\\s/>]`).test(src);
    if (used && !scope.has(name)) {
      console.log(`MISSING  ${name.padEnd(20)} ${path.relative(ROOT, p)}`);
      bad++;
    }
  }
}
console.log(bad === 0 ? '--- clean ---' : `--- ${bad} UNDECLARED ---`);
process.exit(bad === 0 ? 0 : 1);
