import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * The question paper as a PDF, handed to the share sheet — the website's "Download PDF" of the
 * printable paper. The page is built by utils/questionPaper.paperHtml; expo-print already ships
 * with the app (the sales quotation and the psychometric report use it the same way).
 *
 * @returns {Promise<{ shared: boolean, uri: string }>}
 */
export async function sharePaperPdf(html, filename) {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Named as the website names it — Question_Paper_<code>[_Set_2].pdf — so two sets are two files.
  const target = `${FileSystem.cacheDirectory}${filename}`;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.moveAsync({ from: uri, to: target });
  } catch {
    // Keep expo-print's own name rather than fail the download over a file name.
  }
  const finalUri = (await FileSystem.getInfoAsync(target)).exists ? target : uri;
  if (!(await Sharing.isAvailableAsync())) return { shared: false, uri: finalUri };
  await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', dialogTitle: filename, UTI: 'com.adobe.pdf' });
  return { shared: true, uri: finalUri };
}
