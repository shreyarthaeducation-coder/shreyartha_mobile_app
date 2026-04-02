import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { api } from '../../services/apiService';
import { COLORS, SPACING } from '../../constants/theme';

// Decision-tree data mirroring the website chatbot (frontendmain/src/components/Chatbot)
const CHATBOT_DATA = {
  categories: [
    {
      id: 'academic',
      label: 'Academic Programs',
      icon: '🎓',
      subOptions: [
        'Curriculum Details',
        'Study Materials',
        'Practice Tests',
        'Doubt Solving',
        'Performance Reports',
      ],
    },
    {
      id: 'career',
      label: 'Career Guidance',
      icon: '💼',
      subOptions: [
        'Career Counseling',
        'Psychometric Tests',
        'Stream Selection',
        'College Admissions',
        'Scholarship Info',
      ],
    },
    {
      id: 'admissions',
      label: 'Admissions',
      icon: '📋',
      subOptions: [
        'Admission Process',
        'Fee Structure',
        'Required Documents',
        'Eligibility Criteria',
        'Application Status',
      ],
    },
    {
      id: 'support',
      label: 'Technical Support',
      icon: '🛠️',
      subOptions: [
        'Login Issues',
        'App Navigation',
        'Payment Problems',
        'Account Settings',
        'Other Technical Issues',
      ],
    },
    {
      id: 'school',
      label: 'School Partnership',
      icon: '🏫',
      subOptions: [
        'Partner with Us',
        'School Admin Setup',
        'Teacher Training',
        'Integration Support',
        'Pricing Plans',
      ],
    },
    {
      id: 'other',
      label: 'Other',
      icon: '💬',
      subOptions: [
        'General Inquiry',
        'Feedback',
        'Complaint',
        'Suggestions',
        'Something Else',
      ],
    },
  ],
};

// Chat flow steps
const STEP = {
  GREETING: 'greeting',
  CATEGORY: 'category',
  SUB_OPTION: 'sub_option',
  ASK_NAME: 'ask_name',
  ASK_EMAIL: 'ask_email',
  ASK_PHONE: 'ask_phone',
  ASK_CLASS: 'ask_class',
  ASK_CONCERN: 'ask_concern',
  SUBMITTING: 'submitting',
  DONE: 'done',
};

const GREETING_MESSAGE =
  "Hi! I'm the Shreyartha Assistant 👋\n\nI'm here to help you with information about our programs and services. Please select a category to get started.";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(STEP.GREETING);
  const [messages, setMessages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubOption, setSelectedSubOption] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', classGrade: '', concern: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = (role, text, options = null) => {
    setMessages(prev => [...prev, { role, text, options }]);
    scrollToBottom();
  };

  const openChat = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      // Show greeting and category buttons
      setMessages([
        {
          role: 'bot',
          text: GREETING_MESSAGE,
          options: CHATBOT_DATA.categories.map(c => ({ label: `${c.icon} ${c.label}`, value: c.id })),
        },
      ]);
      setStep(STEP.CATEGORY);
    }
  };

  const closeChat = () => setIsOpen(false);

  const resetChat = () => {
    setMessages([]);
    setStep(STEP.GREETING);
    setSelectedCategory(null);
    setSelectedSubOption(null);
    setInputValue('');
    setFormData({ name: '', email: '', phone: '', classGrade: '', concern: '' });
    setIsSubmitting(false);
    // Re-open with greeting
    setMessages([
      {
        role: 'bot',
        text: GREETING_MESSAGE,
        options: CHATBOT_DATA.categories.map(c => ({ label: `${c.icon} ${c.label}`, value: c.id })),
      },
    ]);
    setStep(STEP.CATEGORY);
    scrollToBottom();
  };

  const handleOptionSelect = (value) => {
    if (step === STEP.CATEGORY) {
      const cat = CHATBOT_DATA.categories.find(c => c.id === value);
      if (!cat) return;
      setSelectedCategory(cat);
      // Show user selection
      addMessage('user', `${cat.icon} ${cat.label}`);
      // Show sub-options
      setTimeout(() => {
        addMessage('bot', `Great! What specifically would you like to know about **${cat.label}**?`, cat.subOptions.map(s => ({ label: s, value: s })));
        setStep(STEP.SUB_OPTION);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.SUB_OPTION) {
      setSelectedSubOption(value);
      addMessage('user', value);
      setTimeout(() => {
        addMessage('bot', "I'd love to help you with that! Could you please tell me your **full name**?");
        setStep(STEP.ASK_NAME);
        scrollToBottom();
      }, 300);
    }
  };

  const handleTextSubmit = () => {
    const val = inputValue.trim();
    if (!val) return;

    if (step === STEP.ASK_NAME) {
      setFormData(prev => ({ ...prev, name: val }));
      addMessage('user', val);
      setInputValue('');
      setTimeout(() => {
        addMessage('bot', `Nice to meet you, ${val}! 😊 What's your **email address**?`);
        setStep(STEP.ASK_EMAIL);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_EMAIL) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        addMessage('bot', 'Please enter a valid email address.');
        setInputValue('');
        scrollToBottom();
        return;
      }
      setFormData(prev => ({ ...prev, email: val }));
      addMessage('user', val);
      setInputValue('');
      setTimeout(() => {
        addMessage('bot', "Got it! What's your **phone number**?");
        setStep(STEP.ASK_PHONE);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_PHONE) {
      setFormData(prev => ({ ...prev, phone: val }));
      addMessage('user', val);
      setInputValue('');
      setTimeout(() => {
        addMessage('bot', "What's your **class / grade**? (e.g., Class 10, Grade 12)");
        setStep(STEP.ASK_CLASS);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_CLASS) {
      setFormData(prev => ({ ...prev, classGrade: val }));
      addMessage('user', val);
      setInputValue('');
      setTimeout(() => {
        addMessage('bot', "Almost done! Please describe your **specific concern or query** in detail:");
        setStep(STEP.ASK_CONCERN);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_CONCERN) {
      setFormData(prev => ({ ...prev, concern: val }));
      addMessage('user', val);
      setInputValue('');
      setStep(STEP.SUBMITTING);
      setTimeout(() => submitInquiry({ ...formData, concern: val }), 300);
    }
  };

  const submitInquiry = async (data) => {
    setIsSubmitting(true);
    addMessage('bot', '⏳ Submitting your inquiry...');
    try {
      await api.post('/api/chatbot/inquiry', {
        name: data.name,
        email: data.email,
        phone: data.phone,
        classGrade: data.classGrade,
        category: selectedCategory?.label || '',
        subCategory: selectedSubOption || '',
        concern: data.concern,
      });
      setMessages(prev => prev.filter(m => m.text !== '⏳ Submitting your inquiry...'));
      addMessage(
        'bot',
        `✅ Thank you, ${data.name}! Your inquiry has been submitted successfully.\n\nOur team will reach out to you at **${data.email}** within 24–48 hours.\n\nIs there anything else I can help you with?`,
        [{ label: '🔄 Start over', value: '__reset__' }, { label: '✕ Close', value: '__close__' }],
      );
      setStep(STEP.DONE);
    } catch {
      setMessages(prev => prev.filter(m => m.text !== '⏳ Submitting your inquiry...'));
      addMessage(
        'bot',
        "Sorry, I couldn't submit your inquiry right now. Please try again or contact us directly at support@shreyartha.com",
        [{ label: '🔄 Try again', value: '__reset__' }],
      );
      setStep(STEP.DONE);
    } finally {
      setIsSubmitting(false);
      scrollToBottom();
    }
  };

  const handleSpecialOption = (value) => {
    if (value === '__reset__') resetChat();
    else if (value === '__close__') closeChat();
  };

  const renderOptionButton = (opt) => {
    const isSpecial = opt.value?.startsWith('__');
    return (
      <TouchableOpacity
        key={opt.value}
        style={[styles.optionBtn, isSpecial && styles.optionBtnSecondary]}
        onPress={() => {
          if (isSpecial) handleSpecialOption(opt.value);
          else handleOptionSelect(opt.value);
        }}
        activeOpacity={0.75}
      >
        <Text style={[styles.optionBtnText, isSpecial && styles.optionBtnTextSecondary]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const showTextInput = [STEP.ASK_NAME, STEP.ASK_EMAIL, STEP.ASK_PHONE, STEP.ASK_CLASS, STEP.ASK_CONCERN].includes(step);
  const isConcernStep = step === STEP.ASK_CONCERN;
  const inputPlaceholders = {
    [STEP.ASK_NAME]: 'Enter your full name…',
    [STEP.ASK_EMAIL]: 'Enter your email address…',
    [STEP.ASK_PHONE]: 'Enter your phone number…',
    [STEP.ASK_CLASS]: 'Enter your class / grade…',
    [STEP.ASK_CONCERN]: 'Describe your concern…',
  };

  return (
    <>
      {/* Floating Chat Button */}
      <TouchableOpacity style={styles.fab} onPress={openChat} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={closeChat}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.overlay}>
            <View style={styles.chatContainer}>
              {/* Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>🤖</Text>
                  </View>
                  <View>
                    <Text style={styles.chatHeaderTitle}>Shreyartha Assistant</Text>
                    <Text style={styles.chatHeaderSubtitle}>Here to help you</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={closeChat} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.lg }}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.map((msg, idx) => (
                  <View key={idx} style={styles.messageGroup}>
                    <View
                      style={[
                        styles.messageBubble,
                        msg.role === 'user' ? styles.userBubble : styles.botBubble,
                      ]}
                    >
                      <Text style={[styles.messageText, msg.role === 'user' && styles.userText]}>
                        {msg.text}
                      </Text>
                    </View>
                    {/* Option buttons below bot messages */}
                    {msg.role === 'bot' && msg.options && (
                      <View style={styles.optionsContainer}>
                        {msg.options.map(opt => renderOptionButton(opt))}
                      </View>
                    )}
                  </View>
                ))}
                {isSubmitting && (
                  <View style={[styles.botBubble, { padding: 12 }]}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                )}
              </ScrollView>

              {/* Text Input (only shown during data-collection steps) */}
              {showTextInput && (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder={inputPlaceholders[step] || 'Type here…'}
                    placeholderTextColor="#aaa"
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="send"
                    multiline={isConcernStep}
                    blurOnSubmit={!isConcernStep}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !inputValue.trim() && styles.sendBtnDisabled]}
                    onPress={handleTextSubmit}
                    disabled={!inputValue.trim()}
                  >
                    <Text style={styles.sendBtnText}>➤</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  fabIcon: { fontSize: 24 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20 },
  chatHeaderTitle: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  chatHeaderSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: COLORS.white, fontSize: 18, fontWeight: '600' },
  messageList: { flex: 1 },
  messageGroup: { marginBottom: 12 },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageText: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  userText: { color: COLORS.white },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
    paddingLeft: 4,
  },
  optionBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  optionBtnSecondary: {
    borderColor: COLORS.textSecondary,
  },
  optionBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  optionBtnTextSecondary: {
    color: COLORS.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    marginRight: 8,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },
  sendBtnText: { color: COLORS.white, fontSize: 16 },
});

