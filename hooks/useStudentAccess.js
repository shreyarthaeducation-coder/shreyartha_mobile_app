import { useCallback, useEffect, useState } from 'react';
import {
  ACCESS,
  fetchHiddenNodes,
  fetchRoleAccess,
  hasComponentRestrictions,
  nodeAccess,
  strictest,
} from '../services/student/accessService';

/**
 * The content-gating hook for student trees — hidden nodes + role access in one.
 *
 * The web splits these across `useStudentHiddenNodes` and `useRoleAccess`, but every screen that
 * wants one wants the other, and both feed the same decision ("do I render this node, and can it
 * be opened?"). Keeping them together means a screen has one loading flag, not two.
 *
 *   const gate = useStudentAccess('SKILLS_EDGE');
 *   gate.visible('CHAPTER', skills)        // hidden-nodes + HIDDEN rules removed
 *   gate.level('CHAPTER', skill.id)        // ACCESSIBLE | LOCKED | HIDDEN
 *   gate.levelOf([['CURRICULUM', a], ['CHAPTER', b]])  // most restrictive of several
 *   gate.limited                            // show the limited-access banner
 *
 * `component` doubles as the hidden-nodes module and the role-access `component` — they use the
 * same identifiers (`SUBJECT_CAREER`, `SKILLS_EDGE`, `ACADEMIC_IQ`).
 */
export default function useStudentAccess(component) {
  const [hidden, setHidden] = useState({});
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    // Neither call can reject — fetchHiddenNodes swallows, fetchRoleAccess catches to EMPTY — so
    // this needs no guard of its own and can never leave the screen stuck loading.
    Promise.all([fetchHiddenNodes(component), fetchRoleAccess()]).then(([h, a]) => {
      if (!alive) return;
      setHidden(h);
      setAccess(a);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [component]);

  const isHidden = useCallback(
    (entityType, entityId) => !!hidden[entityType]?.has(Number(entityId)),
    [hidden],
  );

  /** The configured level for one node. */
  const level = useCallback(
    (entityType, entityId) => nodeAccess(access, component, entityType, entityId),
    [access, component],
  );

  /**
   * The most restrictive level across a node's own type and its ancestors.
   * @param {Array<[string, number|string]>} pairs e.g. [['CURRICULUM', 4], ['TOPIC', 19]]
   */
  const levelOf = useCallback(
    (pairs) => strictest((pairs || []).map(([type, id]) => level(type, id))),
    [level],
  );

  /**
   * Drop everything the student must not see: admin-hidden ids and `HIDDEN` rules alike.
   * LOCKED survives on purpose — a locked node is rendered, with a lock, as the upsell.
   */
  const visible = useCallback(
    (entityType, list, getId = (x) => x?.id) =>
      !Array.isArray(list)
        ? []
        : list.filter((item) => {
            const id = getId(item);
            return !isHidden(entityType, id) && level(entityType, id) !== ACCESS.HIDDEN;
          }),
    [isHidden, level],
  );

  return {
    loading,
    isHidden,
    level,
    levelOf,
    visible,
    // Conservative while loading, as the web is: assume limited so unrestricted content never
    // flashes on screen before the rules land and take it away again.
    limited: loading || hasComponentRestrictions(access, component),
  };
}
