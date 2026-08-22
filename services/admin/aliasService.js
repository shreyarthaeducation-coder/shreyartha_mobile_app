// services/admin/aliasService.js
// Mirrors: School/Admin/pages/{SchoolTopicAliases,SchoolLanguageProAliases,SchoolCodingProAliases}.js
// Backend: school/controller/SchoolAdmin{TopicAlias,LanguageProAlias,CodingProAlias}Controller.java
//          all three: hasRole('SCHOOL_ADMIN') or hasRole('PRINCIPAL') or hasRole('VICE_PRINCIPAL')
//
// THREE PAGES, ONE SERVICE. The web keeps three near-identical files (330 + 311 + 311 lines). Every
// one calls exactly the same three routes under its own namespace:
//
//   GET    /{ns}/tree
//   PUT    /{ns}/topic/{topicId}   { aliasName, displayOrder }
//   DELETE /{ns}/topic/{topicId}
//
// THE ONE REAL DIFFERENCE IS TREE DEPTH, and it is easy to miss because the files look the same:
//   Academic IQ   class → subject → chapter → topic
//   Language Pro  class → chapter → topic          (NO subject tier)
//   Coding Pro    class → chapter → topic          (NO subject tier)
// Encoded as `levels` in constants/schoolAdminPortals.js → ALIAS_TREES, so the screen walks the
// right keys rather than guessing. Rendering a subject tier for Language Pro yields empty groups;
// omitting it for Academic IQ silently hides every topic.
//
// An alias renames a node for THIS SCHOOL'S users only, across every student-facing surface.

import { staffApi } from '../staffApi';

/**
 * The whole alias tree for one namespace.
 *
 * Nodes carry `id`, `name`, the current `aliasName` and `aliasDisplayOrder`, plus the child array
 * named by the next entry in `ALIAS_TREES[...].levels`.
 */
export async function fetchAliasTree(apiBase, signal) {
  const res = await staffApi.get(`${apiBase}/tree`, { signal });
  return Array.isArray(res) ? res : [];
}

/**
 * Write one topic's alias.
 *
 * BOTH FIELDS ARE NULLABLE AND NULL IS MEANINGFUL — an empty alias name clears the rename while
 * leaving the ordering, so send `null`, never `''`. Mirrors the web's own payload construction.
 *
 * @throws {Error} when displayOrder is present but not a finite number, before any request is made
 */
export function saveAlias(apiBase, topicId, { aliasName, displayOrder }) {
  const order =
    displayOrder === '' || displayOrder == null ? null : Number(displayOrder);
  if (order != null && !Number.isFinite(order)) {
    throw new Error('Display order must be a number.');
  }
  return staffApi.put(`${apiBase}/topic/${topicId}`, {
    aliasName: aliasName ? String(aliasName).trim() : null,
    displayOrder: order,
  });
}

/** Remove the alias entirely, restoring the platform's own name and ordering. */
export function clearAlias(apiBase, topicId) {
  return staffApi.del(`${apiBase}/topic/${topicId}`);
}

/**
 * Walk a tree of unknown depth and count leaves vs aliased leaves.
 *
 * The web hand-rolls this per page with the nesting hardcoded, which is exactly why the two shapes
 * drifted apart unnoticed. Driven by `levels` here, so it is correct for all three.
 */
export function countAliases(roots, levels) {
  let total = 0;
  let aliased = 0;

  const walk = (nodes, depth) => {
    for (const node of nodes || []) {
      if (depth >= levels.length) {
        total += 1;
        if (node.aliasName) aliased += 1;
        continue;
      }
      walk(node[levels[depth]], depth + 1);
    }
  };

  // The roots are classes; `levels` names the arrays hanging below them.
  walk(roots, 0);
  return { total, aliased };
}
