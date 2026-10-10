import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * The phone's back button goes up one level inside a drill-down screen (skill → topic → objective →
 * module …), the way the screen's own "← Back" does, instead of closing the whole screen.
 *
 * `depth` is how many levels below its start the screen is; at 0 the button is left to the
 * navigator, which closes the screen as usual. Only while the screen is focused, so a screen
 * underneath never catches a press meant for the one on top. Android only: iOS has no back button
 * (its swipe still closes the screen; the on-screen back steps one level).
 *
 * @param {number} depth
 * @param {Function} stepBack the screen's own one-level-up step
 */
export function useDrillBack(depth, stepBack) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (depth <= 0) return false;
        stepBack();
        return true;
      });
      return () => sub.remove();
    }, [depth, stepBack]),
  );
}
