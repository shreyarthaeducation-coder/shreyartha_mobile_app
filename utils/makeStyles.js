import { StyleSheet } from 'react-native';
import { usePalette } from '../components/ui/PaletteContext';

/**
 * Palette-aware `StyleSheet.create`.
 *
 * `StyleSheet.create` runs at module scope, so a colour baked into a style object cannot respond
 * to a hook. This turns the style block into a factory and hands back a `useStyles()` hook:
 *
 *   const useStyles = makeStyles((p) => ({
 *     header: { backgroundColor: p.headerBg },
 *     title:  { fontSize: 15, color: SLATE[800] },   // neutral values stay literal
 *   }));
 *
 *   function Screen() {
 *     const styles = useStyles();
 *     …
 *   }
 *
 * **JSX does not change** — every `styles.foo` reference stays exactly as it was. The conversion
 * is mechanical: wrap the object in `makeStyles((p) => …)`, swap `PALETTE.` for `p.`, and add one
 * line inside the component.
 *
 * Results are cached per `palette.key`, so with two palettes in the app `StyleSheet.create` runs
 * at most twice per style block for the life of the process — not once per render.
 */
export function makeStyles(factory) {
  const cache = new Map();

  return function useStyles() {
    const palette = usePalette();
    const key = palette?.key || 'school';
    if (!cache.has(key)) {
      cache.set(key, StyleSheet.create(factory(palette)));
    }
    return cache.get(key);
  };
}

export default makeStyles;
