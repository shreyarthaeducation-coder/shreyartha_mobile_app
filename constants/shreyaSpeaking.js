/**
 * Learn with Shreya — Speaking Challenge (1 Nov 2026).
 *
 * The vocabulary categories' colours, the same as the website's `VocabularyTab.CATEGORY_STYLE` and
 * the admin's preview: a word is one colour everywhere it is shown. Identity colours, not feedback,
 * which is why they live here rather than in the theme's semantic tokens.
 */
export const CATEGORY_STYLE = {
  NEW_WORD: { label: 'New word', colour: '#7c3aed' },
  ACTION: { label: 'Action word', colour: '#2563eb' },
  DESCRIBING: { label: 'Describing word', colour: '#db2777' },
  PHRASE: { label: 'Phrase', colour: '#ea580c' },
  GREETING: { label: 'Greeting', colour: '#16a34a' },
};

/** The four student characters, in the order the passage's unknown names are given to them. */
export const STUDENT_KEYS = ['SHRI', 'SHREYA', 'DARSH', 'KRISH'];

/**
 * The cast's portraits, by band and character key. Empty until the two cast pictures are cropped
 * into `assets/shreya-cast/{junior,senior}/<key>.png` — a `require` has to name a file that exists,
 * so each entry is added with its file. Until then the card draws the character's initial in their
 * colour.
 */
export const CAST_IMAGES = {
  JUNIOR: {},
  SENIOR: {},
};

/** Word states from `utils/shreyaAlign`, as the line draws them. */
export const WORD_TINT = {
  READ: { color: '#15803d' },
  WRONG: { color: '#b91c1c', backgroundColor: '#fee2e2' },
  SKIPPED: { color: '#b91c1c', backgroundColor: '#fee2e2', textDecorationLine: 'line-through' },
  MISPRONOUNCED: { color: '#b45309', backgroundColor: '#fef3c7' },
  CURRENT: { textDecorationLine: 'underline' },
  PENDING: {},
};
