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

// Defaults to the app root so `node scripts/checkscope.js` just works. It used to require the
// directory as argv[2] and crash with an unrelated `path.join` TypeError without it — which reads
// like a broken checker rather than a missing argument, and is easily mistaken for a real failure.
const ROOT = process.argv[2] || path.resolve(__dirname, '..');
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
  //
  // LINE COMMENTS GO FIRST, and the order is load-bearing. A `//` header that names an API path
  // — `// … use these `/api/counselor/psychometric/*` paths unchanged.` — contains `/*`. Stripping
  // block comments first treats that as an opening delimiter and eats everything up to the next
  // `*/`, which in that file swallowed the `import { staffApi }` line and reported staffApi as
  // undeclared in two services that import it perfectly well. Removing `//` lines first means
  // the `/*` is gone before anything looks for it.
  const src = raw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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
  // Named function and class EXPRESSIONS, which the line-anchored rule above cannot see:
  // `return function useStyles() { … }` in utils/makeStyles.js binds `useStyles` and then gets
  // reported as using an undeclared `useStyles`. The name is bound wherever the keyword appears,
  // so matching the keyword anywhere is correct rather than merely convenient.
  for (const m of src.matchAll(/\b(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) {
    scope.add(m[1]);
  }
  // A module that exports a name is allowed to mention it (barrels, self-referential docs).
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const tok of m[1].split(',')) {
      const n = tok.trim().split(/\s+as\s+/).pop().trim();
      if (n) scope.add(n);
    }
  }
  // One level of nesting is allowed inside the pattern so a default value like `parts = {}` or
  // `opts = { a: 1 }` does not terminate the match early — which is what used to cut a parameter
  // list short and hide every name after the first defaulted one.
  const OBJECT_PATTERN = '\\{((?:[^{}]|\\{[^{}]*\\})*)\\}';

  // `{ a, b: c, d = 1 }` → a, c, d. The default is dropped before the rename, so `{ a: b = 1 }`
  // correctly yields the local name `b`.
  const addPattern = (body) => {
    for (const tok of body.split(',')) {
      const n = tok.split('=')[0].split(':').pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) scope.add(n);
    }
  };

  // Destructured locals, e.g. `const { toast, showToast } = useToast();`
  for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s*${OBJECT_PATTERN}\\s*=`, 'g'))) {
    addPattern(m[1]);
  }

  // Destructured function PARAMETERS, e.g. `function Body({ analytics, Card, CardTitle })` and
  // `({ value, onChange }) => …`. Components in this codebase routinely take a UI primitive as a
  // prop rather than importing it — AnalyticsBody receives `Card` and `CardTitle` from whichever
  // panel renders it, so the student and parent versions can pass differently-themed cards. Not
  // counting parameters made every such component a permanent false positive, and a checker with
  // permanent false positives is one nobody reads.
  for (const m of src.matchAll(new RegExp(`\\(\\s*${OBJECT_PATTERN}\\s*(?:=[^)]*)?\\)`, 'g'))) {
    addPattern(m[1]);
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
