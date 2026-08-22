// constants/skillsEdge.js
// Mirrors: frontendmain/src/student/platform/SkillsEdge/SkillsEdge.js

/**
 * The display name for a learning-content module.
 *
 * MODULES HAVE NO NAME. `SkillsEdgeModule` carries `moduleOrder` and its content, and nothing else
 * identifying — there is no `title` column and the admin authoring screen never asks for one. The
 * website has always known this and renders `Module {index + 1}` in its grid, falling back through
 * `moduleOrder` in its detail header.
 *
 * The app instead read a `title` that is never sent, so every module card, every test header and
 * every AI context rendered an empty string. That is the whole of the "module names not visible"
 * report — the names were not missing from the data, they were never in it.
 *
 * `title` is still consulted first so that if the column is ever added, this starts using it with no
 * further change.
 *
 * @param {object} module  a module from fetchLearningContent
 * @param {number} index   its position in the displayed list, 0-based
 */
export function moduleLabel(module, index = 0) {
  const explicit = module?.title;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  return `Module ${module?.moduleOrder || index + 1}`;
}
