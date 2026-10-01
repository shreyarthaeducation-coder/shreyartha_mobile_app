import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { SLATE, TYPE } from '../../../../constants/theme';
import { uploadQuestionImage } from '../../../../services/teacher/examService';
import { normaliseDoubtImage } from '../../../../utils/doubtImage';
import { pickImage, takePhoto } from '../../../../utils/filePicker';
import { LinkButton, PALETTE } from '../marks/marksParts';

/**
 * One picture slot — attach, preview, replace, remove — the website's ImageSlot.
 *
 * The upload happens the moment a picture is chosen rather than when the question is saved: the
 * teacher needs to see what they attached, and a half-written question has no id to hang a file
 * off. Photos are re-encoded to JPEG (an iPhone's HEIC is refused by the server, which takes png,
 * jpeg, gif and webp only) and kept under 1600 px.
 */
export default function ImageSlot({ label, url, onChange, disabled, onError }) {
  const [uploading, setUploading] = useState(false);

  const attach = async (source) => {
    const picked = source === 'camera' ? await takePhoto() : await pickImage();
    if (!picked) return;
    if (picked.denied) {
      onError?.(source === 'camera' ? 'Allow camera access to take the picture.' : 'Allow photo access to choose the picture.');
      return;
    }
    setUploading(true);
    try {
      const file = await normaliseDoubtImage(picked.uri);
      const stored = await uploadQuestionImage({ ...file, name: 'question.jpg' });
      onChange(stored);
    } catch (e) {
      onError?.(e?.message || 'Could not upload the picture.');
    } finally {
      setUploading(false);
    }
  };

  const choose = () => {
    const options = [
      { text: 'Take photo', onPress: () => attach('camera') },
      { text: 'Choose photo', onPress: () => attach('library') },
    ];
    if (Platform.OS === 'ios') options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(`A picture for ${label}`, undefined, options, { cancelable: true });
  };

  return (
    <View style={styles.wrap}>
      {url ? <Image source={{ uri: url }} style={styles.preview} resizeMode="contain" /> : null}
      <View style={styles.row}>
        <LinkButton
          icon={url ? 'swap-horizontal-outline' : 'image-outline'}
          label={uploading ? 'Uploading…' : url ? 'Replace picture' : `Add a picture`}
          onPress={choose}
          disabled={disabled || uploading}
          accessibilityLabel={`${url ? 'Replace' : 'Add'} a picture for ${label}`}
        />
        {url ? (
          <LinkButton
            icon="trash-outline"
            label="Remove"
            onPress={() => onChange('')}
            disabled={disabled || uploading}
            accessibilityLabel={`Remove the picture for ${label}`}
          />
        ) : null}
        {uploading ? <ActivityIndicator size="small" color={PALETTE.primary} /> : null}
      </View>
      {!url && !uploading ? <Text style={styles.hint}>Optional</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SLATE[200],
    backgroundColor: SLATE[50],
    marginBottom: 6,
  },
  hint: { fontSize: TYPE.caption, color: SLATE[500], marginTop: 2 },
});
