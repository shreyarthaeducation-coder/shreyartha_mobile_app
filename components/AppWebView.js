import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';

export const FORCE_DESKTOP_VIEWPORT_JS = `
document.addEventListener('DOMContentLoaded', function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.content = 'width=1024';
  } else {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=1024';
    document.head.appendChild(meta);
  }
}, { once: true });
true;
`;

export default function AppWebView(props) {
  return (
    <WebView
      cacheEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      androidLayerType="hardware"
      {...(Platform.OS === 'android' ? { cacheMode: 'LOAD_CACHE_ELSE_NETWORK' } : {})}
      {...props}
    />
  );
}
