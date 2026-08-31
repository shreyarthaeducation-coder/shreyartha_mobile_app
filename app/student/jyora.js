import JyoraHubScreen from '../../components/student/JyoraHubScreen';

/**
 * Jyora — the dashboard tutor card's destination.
 *
 * Deliberately NOT a free-text chat: the website has no Jyora input by design, so this gives the
 * existing sheet a real topic instead. See the header of components/student/JyoraHubScreen.js.
 */
export default function StudentJyora() {
  return <JyoraHubScreen />;
}
