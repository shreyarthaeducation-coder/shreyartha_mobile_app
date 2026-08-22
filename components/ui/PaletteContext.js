import { createContext, useContext } from 'react';
import { PORTALS } from '../../constants/theme';

/**
 * The palette the surrounding screens should paint with.
 *
 * THE DEFAULT IS THE ENTIRE SAFETY DESIGN. It is `PORTALS.school` — today's teal — so anything not
 * wrapped in a provider behaves exactly as it did before this context existed. The teacher panel
 * needs no provider and therefore cannot be turned purple by accident; only
 * `app/staff/[role]/_layout.js` wraps, and only for the two counsellor roles.
 *
 * Read it with `usePalette()` for inline colours, or through `utils/makeStyles.js` when the colour
 * lives inside a `StyleSheet.create` block (which cannot see a hook).
 *
 * The 13 kit components in components/ui already accept an optional `palette` prop; they now
 * default to this instead of the constant, so they theme with no call-site changes at all.
 */

const PaletteContext = createContext(PORTALS.school);

export function PaletteProvider({ palette, children }) {
  return (
    <PaletteContext.Provider value={palette || PORTALS.school}>{children}</PaletteContext.Provider>
  );
}

export function usePalette() {
  return useContext(PaletteContext);
}

export default PaletteContext;
