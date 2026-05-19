import { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SPACING } from '../../constants/theme';
import { api } from '../../services/apiService';

// Mirrors src/components/Chatbot/chatbotData.js from frontendmain
const CHATBOT_DATA = [
  {
    id: 'learning-assessment',
    label: 'Learning & Assessment',
    icon: '📚',
    subOptions: [
      { title: 'The Shreyartha Framework', description: 'Holistic learning model' },
      { title: 'University Bridge Pack', description: 'Transition preparation' },
      { title: 'Excellence Certification', description: 'Recognized credentials' },
      { title: 'Global Leadership Webinars', description: 'World-class insights' },
    ],
  },
  {
    id: 'skills-learning',
    label: 'Skills Learning',
    icon: '🛠️',
    subOptions: [
      { title: 'STEAM Curriculum Integration', description: 'Science, Tech, Engineering, Arts, Math' },
      { title: 'Entrepreneurship Bootcamp', description: 'Build your startup mindset' },
      { title: 'Financial Literacy', description: 'Money skills for life' },
      { title: 'Digital Citizenship', description: 'Responsible online presence' },
    ],
  },
  {
    id: 'students-profile',
    label: 'Students Profile',
    icon: '👤',
    subOptions: [
      { title: '360° Profile Builder', description: 'Comprehensive student portfolio' },
      { title: 'Portfolio Showcase', description: 'Present your achievements' },
      { title: 'Peer Benchmarking', description: 'Compare and improve' },
      { title: 'LinkedIn for Students', description: 'Professional networking early' },
    ],
  },
  {
    id: 'counselling',
    label: 'Counselling',
    icon: '🤝',
    subOptions: [
      { title: 'Career Guidance', description: 'Find your ideal path' },
      { title: 'Academic Counselling', description: 'Subject and stream advice' },
      { title: 'Emotional Support', description: 'Mental wellness sessions' },
      { title: 'Clinical Counselling', description: 'Professional therapy' },
      { title: 'Special Care (Inclusion)', description: 'Tailored support for all' },
      { title: 'Crisis Intervention', description: 'Immediate help when needed' },
    ],
  },
  {
    id: 'psychometric-assessment',
    label: 'Psychometric Assessment',
    icon: '🧠',
    subOptions: [
      { title: 'Aptitude Analysis', description: 'Measure your core abilities' },
      { title: 'Personality Profiling', description: 'Understand who you are' },
      { title: 'Interest Inventory', description: 'Discover your passions' },
      { title: 'Emotional Quotient', description: 'EQ assessment and growth' },
    ],
  },
  {
    id: 'subject-career',
    label: 'Subject & Career',
    icon: '📋',
    subOptions: [
      { title: 'Stream Selector', description: 'Science, Commerce, or Arts?' },
      { title: 'Career Pathway Map', description: 'Visualise your future' },
      { title: 'Industry Mentorship', description: 'Learn from professionals' },
      { title: 'Alumni Network', description: 'Connect with graduates' },
    ],
  },
  {
    id: 'competitive-examination',
    label: 'Competitive Examination',
    icon: '🏆',
    subOptions: [
      { title: 'JEE / NEET Prep', description: 'Crack the top engineering & medical exams' },
      { title: 'CUET Strategy', description: 'Central university entrance mastery' },
      { title: 'Olympiad Training', description: 'Excel in national competitions' },
      { title: 'SAT / ACT Ready', description: 'Ace international admissions tests' },
    ],
  },
  {
    id: 'coding-ai-robotics',
    label: 'AI/Robotics & Coding',
    icon: '🤖',
    subOptions: [
      { title: 'Scratch & Block Coding', description: 'Visual programming for beginners' },
      { title: 'Python & Data Science', description: 'Real-world data skills' },
      { title: 'Web Development', description: 'Build websites and apps' },
      { title: 'AI & Machine Learning', description: 'Cutting-edge AI concepts' },
      { title: 'Robotics & IoT', description: 'Hardware meets software' },
    ],
  },
  {
    id: 'language-learning',
    label: 'Language Learning',
    icon: '🌐',
    subOptions: [
      { title: 'English Proficiency', description: 'Fluency and communication' },
      { title: 'Foreign Languages', description: 'French, German, Spanish & more' },
      { title: 'Communication Skills', description: 'Speak with confidence' },
      { title: 'IELTS / TOEFL Prep', description: 'International language tests' },
    ],
  },
  {
    id: 'global-opportunities',
    label: 'Global Opportunities',
    icon: '🌍',
    subOptions: [
      { title: 'University Shortlisting', description: 'Find your best-fit college abroad' },
      { title: 'Scholarship Finder', description: 'Fund your global education' },
      { title: 'Visa & Application', description: 'Step-by-step guidance' },
      { title: 'Cultural Readiness', description: 'Prepare for life overseas' },
    ],
  },
  {
    id: 'progress-tracking',
    label: 'Progress Tracking',
    icon: '📊',
    subOptions: [
      { title: 'Real-time Dashboard', description: 'Live performance overview' },
      { title: 'Goal Tracker', description: 'Set and achieve milestones' },
      { title: 'Parent Reports', description: 'Keep families informed' },
      { title: 'AI Recommendations', description: 'Personalised next steps' },
    ],
  },
];

const STEP = {
  GREETING: 'greeting',
  SUB_OPTIONS: 'subOptions',
  ASK_NAME: 'askName',
  ASK_EMAIL: 'askEmail',
  ASK_PHONE: 'askPhone',
  ASK_CLASS: 'askClass',
  ASK_CONCERN: 'askConcern',
  SUBMITTING: 'submitting',
  DONE: 'done',
};

const CHATBOT_IMAGE = require('../../assets/images/Chatbot.png');

export default function SupportScreen() {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(false);
  const [step, setStep] = useState(STEP.GREETING);
  const [messages, setMessages] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubOption, setSelectedSubOption] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', classAndStream: '', concern: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = (role, text, extra = null) => {
    setMessages(prev => [...prev, { role, text, extra }]);
    scrollToBottom();
  };

  const openChat = () => {
    setChatOpen(true);
    if (messages.length === 0) {
      setMessages([{
        role: 'bot',
        text: 'Hi, hope you are doing well 😊 What do you want to explore today?',
        extra: { type: 'categories' },
      }]);
      setStep(STEP.GREETING);
    }
  };

  const closeChat = () => setChatOpen(false);

  const resetChat = () => {
    setStep(STEP.GREETING);
    setSelectedCategory(null);
    setSelectedSubOption(null);
    setInputValue('');
    setFormData({ name: '', email: '', phone: '', classAndStream: '', concern: '' });
    setIsSubmitting(false);
    setMessages([{
      role: 'bot',
      text: 'Hi, hope you are doing well 😊 What do you want to explore today?',
      extra: { type: 'categories' },
    }]);
    scrollToBottom();
  };

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    addMessage('user', `${cat.icon} ${cat.label}`);
    setTimeout(() => {
      addMessage('bot', `Great choice! Which area of ${cat.label} interests you?`, { type: 'subOptions', options: cat.subOptions });
      setStep(STEP.SUB_OPTIONS);
      scrollToBottom();
    }, 300);
  };

  const handleSubOptionSelect = (sub) => {
    setSelectedSubOption(sub);
    addMessage('user', sub.title);
    setTimeout(() => {
      addMessage('bot', "I'd love to help! Could you please share your full name?");
      setStep(STEP.ASK_NAME);
      scrollToBottom();
    }, 300);
  };

  const handleTextSubmit = () => {
    const val = inputValue.trim();
    if (!val) return;
    setInputValue('');

    if (step === STEP.ASK_NAME) {
      setFormData(prev => ({ ...prev, name: val }));
      addMessage('user', val);
      setTimeout(() => {
        addMessage('bot', `Nice to meet you, ${val}! 😊 What's your email address?`);
        setStep(STEP.ASK_EMAIL);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_EMAIL) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        addMessage('bot', 'Please enter a valid email address.');
        scrollToBottom();
        return;
      }
      setFormData(prev => ({ ...prev, email: val }));
      addMessage('user', val);
      setTimeout(() => {
        addMessage('bot', "Got it! What's your phone number?");
        setStep(STEP.ASK_PHONE);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_PHONE) {
      setFormData(prev => ({ ...prev, phone: val }));
      addMessage('user', val);
      setTimeout(() => {
        addMessage('bot', "What's your class & stream? (e.g., Class 10, Grade 12 Science)");
        setStep(STEP.ASK_CLASS);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_CLASS) {
      setFormData(prev => ({ ...prev, classAndStream: val }));
      addMessage('user', val);
      setTimeout(() => {
        addMessage('bot', 'Almost done! Please describe your specific concern or query:');
        setStep(STEP.ASK_CONCERN);
        scrollToBottom();
      }, 300);
    } else if (step === STEP.ASK_CONCERN) {
      const finalData = { ...formData, concern: val };
      setFormData(finalData);
      addMessage('user', val);
      setStep(STEP.SUBMITTING);
      setTimeout(() => submitInquiry(finalData), 300);
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
        classAndStream: data.classAndStream,
        category: selectedCategory?.label || '',
        subCategory: selectedSubOption?.title || '',
        concern: data.concern,
      });
      setMessages(prev => prev.filter(m => m.text !== '⏳ Submitting your inquiry...'));
      addMessage('bot', `✅ Thank you, ${data.name}! Your inquiry has been submitted.\n\nOur team will reach out to you at ${data.email} within 24–48 hours.`, { type: 'done' });
      setStep(STEP.DONE);
    } catch {
      setMessages(prev => prev.filter(m => m.text !== '⏳ Submitting your inquiry...'));
      addMessage('bot', "Sorry, I couldn't submit your inquiry right now. Please try again or contact us at support@shreyartha.com", { type: 'retry' });
      setStep(STEP.DONE);
    } finally {
      setIsSubmitting(false);
      scrollToBottom();
    }
  };

  const renderMessageExtra = (msg) => {
    if (!msg.extra) return null;
    const { type, options } = msg.extra;

    if (type === 'categories') {
      return (
        <View style={styles.chipsContainer}>
          {CHATBOT_DATA.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.chip}
              onPress={() => handleCategorySelect(cat)}
              activeOpacity={0.75}
            >
              <Text style={styles.chipText}>{cat.icon} {cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (type === 'subOptions' && options) {
      return (
        <View style={styles.subOptionsContainer}>
          {options.map((sub, i) => (
            <TouchableOpacity
              key={i}
              style={styles.subOptionCard}
              onPress={() => handleSubOptionSelect(sub)}
              activeOpacity={0.75}
            >
              <Text style={styles.subOptionTitle}>{sub.title}</Text>
              {sub.description ? <Text style={styles.subOptionDesc}>{sub.description}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (type === 'done') {
      return (
        <View style={styles.doneButtons}>
          <TouchableOpacity style={styles.doneBtn} onPress={() => { closeChat(); router.push('/auth/student-login'); }}>
            <Text style={styles.doneBtnText}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.doneBtn, styles.doneBtnSecondary]} onPress={() => { closeChat(); router.push('/auth/login-select'); }}>
            <Text style={[styles.doneBtnText, styles.doneBtnTextSecondary]}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.doneBtn, styles.doneBtnOutline]} onPress={resetChat}>
            <Text style={[styles.doneBtnText, styles.doneBtnTextOutline]}>Start Over</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (type === 'retry') {
      return (
        <TouchableOpacity style={styles.chip} onPress={resetChat}>
          <Text style={styles.chipText}>🔄 Try Again</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  const showTextInput = [STEP.ASK_NAME, STEP.ASK_EMAIL, STEP.ASK_PHONE, STEP.ASK_CLASS, STEP.ASK_CONCERN].includes(step);
  const isConcernStep = step === STEP.ASK_CONCERN;
  const inputPlaceholders = {
    [STEP.ASK_NAME]: 'Enter your full name…',
    [STEP.ASK_EMAIL]: 'Enter your email address…',
    [STEP.ASK_PHONE]: 'Enter your phone number…',
    [STEP.ASK_CLASS]: 'e.g., Class 10, Grade 12 Science…',
    [STEP.ASK_CONCERN]: 'Describe your concern…',
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Landing view */}
      <View style={styles.landing}>
        <Image source={CHATBOT_IMAGE} style={styles.chatbotImage} resizeMode="contain" />
        <Text style={styles.title}>AI Support</Text>
        <Text style={styles.subtitle}>Speak to Shreya</Text>
        <Text style={styles.description}>
          Get personalised guidance on career paths, academic subjects, and more — powered by AI.
        </Text>
        <TouchableOpacity style={styles.startBtn} onPress={openChat} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Start Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Modal */}
      <Modal visible={chatOpen} animationType="slide" transparent onRequestClose={closeChat}>
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
                    <Text style={styles.chatHeaderTitle}>AI Support — Speak to Shreya</Text>
                    <Text style={styles.chatHeaderSubtitle}>Here to help you 24/7</Text>
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
                    <View style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}>
                      <Text style={[styles.messageText, msg.role === 'user' && styles.userText]}>
                        {msg.text}
                      </Text>
                    </View>
                    {msg.role === 'bot' && renderMessageExtra(msg)}
                  </View>
                ))}
                {isSubmitting && (
                  <View style={[styles.botBubble, { padding: 12 }]}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  </View>
                )}
              </ScrollView>

              {/* Text Input — shown during data-collection steps */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  // Landing
  landing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  chatbotImage: {
    width: 180,
    height: 180,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  startBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  startBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  // Chat Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a3a4a',
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
  chatHeaderTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chatHeaderSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
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
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  messageText: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
  userText: { color: '#fff' },

  // Category chips
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
    paddingLeft: 4,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  // Sub-option cards
  subOptionsContainer: { marginTop: 8, gap: 8, paddingLeft: 4 },
  subOptionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  subOptionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  subOptionDesc: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  // Done buttons
  doneButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingLeft: 4 },
  doneBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  doneBtnSecondary: { backgroundColor: COLORS.secondary },
  doneBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  doneBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  doneBtnTextSecondary: { color: '#fff' },
  doneBtnTextOutline: { color: COLORS.primary },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8f8f8',
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
  sendBtnText: { color: '#fff', fontSize: 16 },
});
