import { useCallback, useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';

const CHATBOT_IMAGE = require('../../assets/images/Chatbot.png');

const QUERY_OPTIONS = [
  'Profile Development & Resume Crafting',
  'Assessment Insights',
  'Course & College Advisory',
  'Emerging Skills & Competencies',
  'College Admissions Support',
  'Soft Skills & Personal Growth (emotional & mental wellness, time management)',
  'Academic Support (Math, Science, etc.)',
  'Scholarship Opportunities & Financial Aid',
  'Career Pathway Consultation',
  'Parent Engagement, Q&A',
];

const pad = (value) => String(value).padStart(2, '0');

const createInitialForm = (fullName = '') => ({
  fullName,
  preferredDate: null,
  preferredTime: null,
  queryFor: '',
  queryDetails: '',
});

const formatDateLabel = (value) => {
  if (!value) return 'Select date';

  return value.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatTimeLabel = (value) => {
  if (!value) return 'Select time';

  return value.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const combineDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;

  const combined = new Date(dateValue);
  combined.setHours(timeValue.getHours(), timeValue.getMinutes(), 0, 0);
  return combined;
};

const formatApiDateTime = (dateValue, timeValue) => {
  const combined = combineDateTime(dateValue, timeValue);

  if (!combined) return '';

  return `${combined.getFullYear()}-${pad(combined.getMonth() + 1)}-${pad(combined.getDate())}T${pad(combined.getHours())}:${pad(combined.getMinutes())}:00`;
};

const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const getProfilePayload = (value) => {
  const data = unwrap(value);
  return {
    ...unwrap(data?.profile),
    ...unwrap(data?.student),
    ...unwrap(data?.user),
    ...data,
  };
};

function OptionCard({
  title,
  description,
  buttonLabel,
  imageSource,
  emoji,
  onPress,
  wide,
  buttonStyle,
}) {
  return (
    <View style={[styles.optionCard, wide && styles.optionCardWide]}>
      <View style={styles.optionIconWrap}>
        {imageSource ? (
          <Image source={imageSource} style={styles.optionImage} resizeMode="contain" />
        ) : (
          <Text style={styles.optionEmoji}>{emoji}</Text>
        )}
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
      <TouchableOpacity style={[styles.optionButton, buttonStyle]} activeOpacity={0.88} onPress={onPress}>
        <Text style={styles.optionButtonText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return <Text style={styles.fieldError}>{message}</Text>;
}

export default function SpeakToCounsellorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [profileName, setProfileName] = useState(user?.name || '');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(() => createInitialForm(user?.name || ''));
  const [errors, setErrors] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showQueryOptions, setShowQueryOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isWide = width >= 760;
  const minimumDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const data = getProfilePayload(await studentService.getProfile());
        const fullName = data?.fullName || data?.name || data?.studentName || user?.name || '';

        if (active) {
          setProfileName(fullName);
          setForm((current) => ({ ...current, fullName }));
        }
      } catch {
        if (active && user?.name) {
          setProfileName(user.name);
          setForm((current) => ({ ...current, fullName: user.name }));
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.name]);

  const resetForm = useCallback((fullName = profileName || user?.name || '') => {
    setForm(createInitialForm(fullName));
    setErrors({});
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowQueryOptions(false);
  }, [profileName, user?.name]);

  const openBookingModal = useCallback(() => {
    resetForm();
    setModalVisible(true);
  }, [resetForm]);

  const closeBookingModal = useCallback(() => {
    setModalVisible(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowQueryOptions(false);
    setErrors({});
  }, []);

  const updateForm = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  }, []);

  const handleDateChange = (_, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      updateForm('preferredDate', selectedDate);
    }
  };

  const handleTimeChange = (_, selectedTime) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedTime) {
      updateForm('preferredTime', selectedTime);
    }
  };

  const validateForm = useCallback(() => {
    const nextErrors = {};

    if (!form.preferredDate) {
      nextErrors.preferredDate = 'Preferred date is required.';
    }

    if (!form.preferredTime) {
      nextErrors.preferredTime = 'Preferred time is required.';
    }

    if (!form.queryFor) {
      nextErrors.queryFor = 'Please select a query category.';
    }

    if (!form.queryDetails.trim()) {
      nextErrors.queryDetails = 'Query details are required.';
    }

    const combinedDateTime = combineDateTime(form.preferredDate, form.preferredTime);

    if (combinedDateTime && combinedDateTime < new Date()) {
      nextErrors.preferredTime = 'Please choose a future time.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await studentService.createCounselorQuery({
        fullName: form.fullName.trim(),
        preferredDateTime: formatApiDateTime(form.preferredDate, form.preferredTime),
        queryFor: form.queryFor,
        queryDetails: form.queryDetails.trim(),
      });
      closeBookingModal();
      resetForm();
      Alert.alert('Request submitted', 'Your counselor request has been sent successfully.');
    } catch (error) {
      Alert.alert('Request failed', error?.message || 'Unable to submit your request right now.');
    } finally {
      setSubmitting(false);
    }
  }, [closeBookingModal, form, resetForm, validateForm]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Speak to Counselor</Text>
          <Text style={styles.heroSubtitle}>
            Choose how you'd like to get guidance and support.
          </Text>
        </View>

        <View style={[styles.optionsWrap, isWide && styles.optionsWrapWide]}>
          <OptionCard
            title="Chat bot – Ask Shreya"
            description="Get instant answers and guidance from our AI-powered counselor, Shreya."
            buttonLabel="Start Chat"
            imageSource={CHATBOT_IMAGE}
            onPress={() => Alert.alert('Coming Soon', 'Chat coming soon')}
            wide={isWide}
          />
          <OptionCard
            title="Speak to personalised counselor"
            description="Schedule a session with a dedicated counselor tailored to your needs."
            buttonLabel="Book a Session"
            emoji="🧑‍💼"
            onPress={openBookingModal}
            wide={isWide}
            buttonStyle={styles.sessionButton}
          />
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeBookingModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeBookingModal} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book a Session</Text>
              <TouchableOpacity onPress={closeBookingModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={[styles.inputField, styles.inputFieldDisabled]}>
                  <Text style={[styles.inputValue, !form.fullName && styles.placeholderText]}>
                    {form.fullName || 'Profile not available'}
                  </Text>
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Preferred Date</Text>
                <Pressable
                  style={styles.inputField}
                  onPress={() => {
                    setShowQueryOptions(false);
                    setShowTimePicker(false);
                    setShowDatePicker((current) => !current);
                  }}
                >
                  <Text style={[styles.inputValue, !form.preferredDate && styles.placeholderText]}>
                    {formatDateLabel(form.preferredDate)}
                  </Text>
                </Pressable>
                <FieldError message={errors.preferredDate} />
                {showDatePicker ? (
                  <View style={styles.pickerWrap}>
                    <DateTimePicker
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      value={form.preferredDate || minimumDate}
                      minimumDate={minimumDate}
                      onChange={handleDateChange}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Preferred Time</Text>
                <Pressable
                  style={styles.inputField}
                  onPress={() => {
                    setShowQueryOptions(false);
                    setShowDatePicker(false);
                    setShowTimePicker((current) => !current);
                  }}
                >
                  <Text style={[styles.inputValue, !form.preferredTime && styles.placeholderText]}>
                    {formatTimeLabel(form.preferredTime)}
                  </Text>
                </Pressable>
                <FieldError message={errors.preferredTime} />
                {showTimePicker ? (
                  <View style={styles.pickerWrap}>
                    <DateTimePicker
                      mode="time"
                      display="default"
                      value={form.preferredTime || new Date()}
                      onChange={handleTimeChange}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Query For</Text>
                <Pressable
                  style={styles.inputField}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                    setShowQueryOptions((current) => !current);
                  }}
                >
                  <Text style={[styles.inputValue, !form.queryFor && styles.placeholderText]}>
                    {form.queryFor || 'Select a query category'}
                  </Text>
                </Pressable>
                <FieldError message={errors.queryFor} />
                {showQueryOptions ? (
                  <View style={styles.optionsList}>
                    <ScrollView nestedScrollEnabled style={styles.optionsListScroll}>
                      {QUERY_OPTIONS.map((option) => (
                        <Pressable
                          key={option}
                          style={styles.optionRow}
                          onPress={() => {
                            updateForm('queryFor', option);
                            setShowQueryOptions(false);
                          }}
                        >
                          <Text style={styles.optionRowText}>{option}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Query Details</Text>
                <TextInput
                  style={[styles.inputField, styles.textArea]}
                  value={form.queryDetails}
                  onChangeText={(value) => updateForm('queryDetails', value)}
                  multiline
                  numberOfLines={4}
                  placeholder="Tell us more about what you need help with"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  textAlignVertical="top"
                />
                <FieldError message={errors.queryDetails} />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                activeOpacity={0.88}
                disabled={submitting}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  topRow: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#0b1637',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 21,
  },
  optionsWrap: {
    gap: 14,
  },
  optionsWrapWide: {
    flexDirection: 'row',
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionCardWide: {
    maxWidth: '49%',
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    marginBottom: 14,
  },
  optionImage: {
    width: 36,
    height: 36,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  optionDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  optionButton: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: STUDENT.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sessionButton: {
    backgroundColor: '#3b82f6',
  },
  optionButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#0b1637',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  modalClose: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputField: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputFieldDisabled: {
    opacity: 0.85,
  },
  inputValue: {
    color: '#fff',
    fontSize: 14,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.35)',
  },
  textArea: {
    minHeight: 110,
    paddingTop: 14,
    paddingBottom: 14,
    color: '#fff',
  },
  pickerWrap: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  optionsList: {
    marginTop: 10,
    maxHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
  },
  optionsListScroll: {
    maxHeight: 220,
  },
  optionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionRowText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  fieldError: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
