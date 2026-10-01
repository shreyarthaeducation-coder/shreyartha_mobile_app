import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TYPE, leading } from '../../constants/theme';

const STUDENT_SECTIONS = [
  {
    label: 'Student Profile',
    icon: '👤',
    route: '/student/profile',
    overview: 'Your Student Profile is the central hub for all your personal and academic information.',
    services: [
      'Personal & academic information',
      'School details and contact info',
      'Profile photo upload',
      'Achievements & badges showcase',
      'Password change',
    ],
  },
  {
    label: 'Academic IQ',
    icon: '📚',
    route: '/student/academic-iq',
    overview: 'Academic IQ is your subject-wise learning hub, designed to sharpen your academic skills.',
    services: [
      'Personalized Resources',
      'School Resources',
      'Practice Zone',
      'Competitive Exam Prep access',
    ],
  },
  {
    label: 'Competitive Exams',
    icon: '🏆',
    route: '/student/academic-iq',
    overview: 'Competitive Exams gives you a dedicated space to prepare for national and state-level entrance exams.',
    services: [
      'Mock Tests',
      'Study Material & Notes',
      'Performance Tracking & Analytics',
      'Exam-specific topic coverage',
    ],
  },
  {
    label: 'Psychometric Assessment',
    icon: '🧠',
    route: '/student/psychometric-assessment',
    overview: 'Psychometric Assessment helps you discover your unique personality, strengths, and ideal career path.',
    services: [
      'Personality Assessment',
      'Learning Style Test',
      'Interest Inventory',
      'Stream Aptitude Test',
      'Detailed Report with Career Recommendations',
    ],
  },
  {
    label: 'Subject & Career',
    icon: '📋',
    route: '/student/subject-career',
    overview: 'Subject & Career is your comprehensive guide to exploring academic subjects and future career options.',
    services: [
      'Course & Subject Exploration',
      'Eligibility Criteria',
      'Future Job Options',
      'Top Colleges — India & Abroad',
      'Skill Match Meter Quiz',
    ],
  },
  {
    label: 'Skills Edge',
    icon: '🛠️',
    route: '/student/skills-edge',
    overview: 'Skills Edge equips you with future-ready skills that go beyond the classroom.',
    services: [
      'Digital Skills Programs',
      'AI & Technology Modules',
      'Life Skills & Soft Skills',
    ],
  },
  {
    label: 'Language Pro',
    icon: '🌐',
    route: '/student/language-pro',
    overview: 'Language Pro builds your English and foreign language proficiency with structured learning tracks.',
    services: [
      'English Language Learning',
      'Foreign Language Courses',
      'Personalized Resources Track',
      'School Resources Track',
    ],
  },
  {
    label: 'Coding',
    icon: '💻',
    route: '/student/coding-pro',
    overview: 'Coding introduces you to programming through the Coding Pro module — from basics to real-world projects.',
    services: [
      'Coding Streams (beginner to advanced)',
      'Practice Problems',
      'Projects & Portfolio',
    ],
  },
  {
    label: 'Events & Info',
    icon: '📅',
    route: '/student/events',
    overview: 'Events & Info keeps you up to date with everything happening on the platform and beyond.',
    services: [
      'Upcoming Events Calendar',
      'Workshops & Webinars',
      'Important Announcements',
      'Platform Updates',
    ],
  },
];

const GREETING = {
  role: 'bot',
  text: "Hi! I'm Shreya 👋\n\nI'm your AI student counselor. I can help you explore different sections of your student panel. Which section would you like to know about?",
  extra: { type: 'sections' },
};

export default function StudentChatbotModal({ visible, onClose, onBook }) {
  const router = useRouter();
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState([GREETING]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const addMessage = (role, text, extra = null) => {
    setMessages(prev => [...prev, { role, text, extra }]);
    scrollToBottom();
  };

  const resetChat = () => {
    setMessages([GREETING]);
  };

  const handleModalClose = () => {
    onClose();
    setTimeout(resetChat, 400);
  };

  const handleSectionSelect = (section) => {
    addMessage('user', `${section.icon} ${section.label}`);
    const serviceList = section.services.map(s => `• ${s}`).join('\n');
    setTimeout(() => {
      addMessage(
        'bot',
        `**${section.label}**\n\n${section.overview}\n\n**What you can do here:**\n${serviceList}`,
        { type: 'sectionActions', section },
      );
    }, 300);
  };

  const handleGoToSection = (section) => {
    onClose();
    setTimeout(resetChat, 400);
    router.push(section.route);
  };

  const handleBookAppointment = () => {
    onClose();
    setTimeout(resetChat, 400);
    onBook?.();
  };

  const handleExploreMore = () => {
    addMessage('user', 'Explore more sections');
    setTimeout(() => {
      addMessage(
        'bot',
        'Sure! Which other section would you like to learn about?',
        { type: 'sections' },
      );
    }, 300);
  };

  const renderBoldText = (text) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return (
      <Text style={styles.messageText}>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <Text key={i} style={styles.boldText}>{part}</Text>
            : <Text key={i}>{part}</Text>
        )}
      </Text>
    );
  };

  const renderExtra = (msg) => {
    if (!msg.extra) return null;
    const { type, section } = msg.extra;

    if (type === 'sections') {
      return (
        <View style={styles.chipsContainer}>
          {STUDENT_SECTIONS.map((sec, i) => (
            <TouchableOpacity
              key={i}
              style={styles.chip}
              onPress={() => handleSectionSelect(sec)}
              activeOpacity={0.75}
            >
              <Text style={styles.chipText}>{sec.icon} {sec.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (type === 'sectionActions' && section) {
      return (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionBtnPrimary}
            onPress={() => handleGoToSection(section)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnTextLight}>Go to {section.label} ›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnBlue}
            onPress={handleBookAppointment}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnTextLight}>Book Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={handleExploreMore}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnTextOutline}>Explore More Sections</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtnGhost}
            onPress={handleModalClose}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnTextGhost}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleModalClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
          <View style={styles.chatContainer}>
            <View style={styles.chatHeader}>
              <View style={styles.chatHeaderLeft}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>🎓</Text>
                </View>
                <View>
                  <Text style={styles.chatHeaderTitle}>Ask Shreya</Text>
                  <Text style={styles.chatHeaderSubtitle}>AI Student Counselor • Online</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleModalClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, idx) => (
                <View key={idx} style={styles.messageGroup}>
                  <View style={[
                    styles.messageBubble,
                    msg.role === 'user' ? styles.userBubble : styles.botBubble,
                  ]}>
                    {msg.role === 'user'
                      ? <Text style={[styles.messageText, styles.userText]}>{msg.text}</Text>
                      : renderBoldText(msg.text)
                    }
                  </View>
                  {msg.role === 'bot' && renderExtra(msg)}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '88%',
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20 },
  chatHeaderTitle: { color: '#fff', fontWeight: '700', fontSize: TYPE.title },
  chatHeaderSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: TYPE.caption, marginTop: 1 },
  closeBtn: { padding: 4 },
  closeBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  messageList: { flex: 1 },
  messageListContent: { padding: 16, paddingBottom: 28 },
  messageGroup: { marginBottom: 14 },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  messageText: { fontSize: TYPE.body, color: '#1e293b', lineHeight: leading(TYPE.body) },
  boldText: { fontWeight: '700', color: '#1e293b' },
  userText: { color: '#fff' },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
    paddingLeft: 2,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipText: { color: '#4f46e5', fontSize: TYPE.label, fontWeight: '600' },
  actionsContainer: {
    marginTop: 10,
    gap: 8,
    paddingLeft: 2,
  },
  actionBtnPrimary: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionBtnBlue: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionBtnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionBtnTextLight: { color: '#fff', fontSize: TYPE.body, fontWeight: '700' },
  actionBtnTextOutline: { color: '#4f46e5', fontSize: TYPE.body, fontWeight: '700' },
  actionBtnTextGhost: { color: '#94a3b8', fontSize: TYPE.body, fontWeight: '600' },
});
