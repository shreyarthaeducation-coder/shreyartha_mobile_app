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
 * The cast's portraits, by band and character key (3 Nov 2026).
 * - JUNIOR (classes 1–5): the school's Gemini portraits, 384 px.
 * - SENIOR (classes 6–12): cropped from the school's senior cast picture, 256 px — the same files as
 *   the website's public/shreya-cast/senior/.
 * A `require` must name a file that exists; the card draws the initial while a picture loads.
 */
export const CAST_IMAGES = {
  JUNIOR: {
    SONIA: require('../assets/shreya-cast/junior/sonia.png'),
    SHRI: require('../assets/shreya-cast/junior/shri.png'),
    SHREYA: require('../assets/shreya-cast/junior/shreya.png'),
    DARSH: require('../assets/shreya-cast/junior/darsh.png'),
    KRISH: require('../assets/shreya-cast/junior/krish.png'),
  },
  SENIOR: {
    SONIA: require('../assets/shreya-cast/senior/sonia.png'),
    SHRI: require('../assets/shreya-cast/senior/shri.png'),
    SHREYA: require('../assets/shreya-cast/senior/shreya.png'),
    DARSH: require('../assets/shreya-cast/senior/darsh.png'),
    KRISH: require('../assets/shreya-cast/senior/krish.png'),
  },
};

/**
 * The talking faces' patch sheets (4 Nov 2026): six mouth shapes side by side, and the closed eyes,
 * cut from Gemini edits of each portrait. Where they sit is in `constants/shreyaFaceRects`.
 */
export const CAST_FACES = {
  JUNIOR: {
    SONIA: { mouth: require('../assets/shreya-cast/junior/sonia-mouth.png'), blink: require('../assets/shreya-cast/junior/sonia-blink.png') },
    SHRI: { mouth: require('../assets/shreya-cast/junior/shri-mouth.png'), blink: require('../assets/shreya-cast/junior/shri-blink.png') },
    SHREYA: { mouth: require('../assets/shreya-cast/junior/shreya-mouth.png'), blink: require('../assets/shreya-cast/junior/shreya-blink.png') },
    DARSH: { mouth: require('../assets/shreya-cast/junior/darsh-mouth.png'), blink: require('../assets/shreya-cast/junior/darsh-blink.png') },
    KRISH: { mouth: require('../assets/shreya-cast/junior/krish-mouth.png'), blink: require('../assets/shreya-cast/junior/krish-blink.png') },
  },
  SENIOR: {
    SONIA: { mouth: require('../assets/shreya-cast/senior/sonia-mouth.png'), blink: require('../assets/shreya-cast/senior/sonia-blink.png') },
    SHRI: { mouth: require('../assets/shreya-cast/senior/shri-mouth.png'), blink: require('../assets/shreya-cast/senior/shri-blink.png') },
    SHREYA: { mouth: require('../assets/shreya-cast/senior/shreya-mouth.png'), blink: require('../assets/shreya-cast/senior/shreya-blink.png') },
    DARSH: { mouth: require('../assets/shreya-cast/senior/darsh-mouth.png'), blink: require('../assets/shreya-cast/senior/darsh-blink.png') },
    KRISH: { mouth: require('../assets/shreya-cast/senior/krish-mouth.png'), blink: require('../assets/shreya-cast/senior/krish-blink.png') },
  },
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
