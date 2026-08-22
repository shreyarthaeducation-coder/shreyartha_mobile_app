import { useLocalSearchParams } from 'expo-router';
import { AliasManagerScreen } from '../../../components/staff';
import { ALIAS_TREES, getAdminPortal } from '../../../constants/schoolAdminPortals';

/**
 * One of the three alias managers. All three render the same screen — the namespace and the TREE
 * DEPTH are the only differences, and both come from the descriptor. See ALIAS_TREES.
 */
export default function StaffAliases() {
  const { role } = useLocalSearchParams();
  const roleKey = String(role || '').toLowerCase();
  const portal = getAdminPortal(roleKey);
  // Guard on the KEY, not just the descriptor: SCHOOL_ADMIN_PORTALS now also holds a
  // vice_principal entry that carries HR only, so `portal` alone is truthy for a role that
  // has no languageProAliases base — and an undefined apiBase produces requests to "undefined/...".
  if (!portal?.languageProAliases) return null;

  const tree = ALIAS_TREES.languageProAliases;
  return (
    <AliasManagerScreen
      homeRoute={`/staff/${roleKey}`}
      apiBase={portal.languageProAliases}
      title={tree.title}
      levels={tree.levels}
    />
  );
}
