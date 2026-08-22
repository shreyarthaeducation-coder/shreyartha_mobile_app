/**
 * A new array with the elements shuffled (Fisher-Yates). Does not mutate the input.
 *
 * Copied from frontendmain/src/utils/shuffle.js. Several student question sets are shuffled
 * client-side before display — Subject & Career's Skill Match Meter and Skills Edge's
 * understanding test — so the order must not be treated as meaningful anywhere downstream.
 */
export function shuffleArray(array) {
  const arr = [...(array || [])];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default shuffleArray;
