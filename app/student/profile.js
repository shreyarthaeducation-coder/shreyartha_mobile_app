import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { STUDENT } from '../../constants/theme';
import { studentService } from '../../services/studentService';

const TABS = [
  { key: 'personal', label: 'Personal Details' },
  { key: 'academic', label: 'Academic IQ' },
  { key: 'skillsedge', label: 'Skills Edge' },
  { key: 'university', label: 'University & Course Preference' },
  { key: 'education', label: 'Education and Certification details' },
  { key: 'additional', label: 'Additional Details' },
];

const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() + 5 - i));
const COUNTRIES = ['India', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'Singapore'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh',
];
const SKILLS_EDGE_OPTIONS = [
  { id: 'financial_awareness', label: 'Financial Awareness', emoji: '💰' },
  { id: 'entrepreneurship', label: 'Entrepreneurship', emoji: '🚀' },
  { id: 'art_craft', label: 'Art & Craft', emoji: '🎨' },
  { id: 'coding_technology', label: 'Coding & Technology', emoji: '💻' },
  { id: 'digital_arts', label: 'Digital Arts', emoji: '🎭' },
  { id: 'life_skills', label: 'Life Skills', emoji: '🌱' },
  { id: 'performing_arts', label: 'Performing Arts', emoji: '🎤' },
  { id: 'world_languages', label: 'World Languages', emoji: '🌍' },
  { id: 'sports_yoga', label: 'Sports & Yoga', emoji: '⚽' },
  { id: 'toefl', label: 'TOEFL', emoji: '📘' },
  { id: 'beauty_wellness', label: 'Beauty & Wellness', emoji: '💄' },
  { id: 'ielts', label: 'IELTS', emoji: '📗' },
  { id: 'fashion_design', label: 'Fashion Design', emoji: '👗' },
];
const COMMUNICATION_ROWS = ['Listening', 'Speaking', 'Reading', 'Writing'];
const COMMUNICATION_LEVELS = ['Beginner', 'Average', 'Proficient'];
const ACADEMIC_CHALLENGING_SUBJECT_OPTIONS = [
  'Science',
  'Mathematics',
  'Social Science',
  'English Literature',
  'English Writing Skills',
];
const ACADEMIC_COMPETITIVE_EXAM_OPTIONS = [
  'Engineering & Technology',
  'Medical & Healthcare',
  'CUET UG',
  'Commerce, Accounting & Finance',
  'Defense & Paramilitary',
  'Arts & Humanities',
  'Govt Examination',
];
// Keeps card height aligned for one- and two-line skill labels in the grid.
const SKILL_LABEL_MIN_HEIGHT = 34;
const DEFAULT_SKILL_EMOJI = '✨';
const SKILL_ALIAS_MAP = SKILLS_EDGE_OPTIONS.reduce((acc, skill) => {
  const variants = [
    skill.id.toLowerCase(),
    skill.label.toLowerCase(),
    `${skill.emoji} ${skill.label}`.toLowerCase(),
    skill.label.toLowerCase().replace(/&/g, 'and'),
    skill.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
  ];
  variants.forEach((v) => { acc[v] = skill.id; });
  return acc;
}, {});

const GENDER_OPTIONS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
const CLASS_OPTIONS = [6, 7, 8, 9, 10, 11, 12];
const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const STREAM_OPTIONS = ['Science', 'Commerce', 'Arts'];
const STREAM_SUBJECTS = {
  Science: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English'],
  Commerce: ['Economics', 'Business Studies', 'Accountancy', 'Mathematics', 'English'],
  Arts: ['History', 'Geography', 'Political Science', 'Economics', 'English'],
};
const PERSONAL_SUB_TABS = [
  { key: 'information', label: 'Personal Information' },
  { key: 'reflection', label: 'Student Reflection' },
];
const PERSONAL_INFO_REQUIRED = ['fullName', 'email', 'gender', 'dob', 'mobile', 'currentClass'];
const REFLECTION_PROFILE_REQUIRED = ['strengths', 'weakness', 'stream'];
const REFLECTION_SUBJECT_OPTIONS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'English'];
const REFLECTION_DEFAULT_QUESTIONS = [
  { id: 'q6', questionText: 'How satisfied are you with your current academic performance?', required: true, type: 'single', options: ['Very satisfied', 'Satisfied', 'Needs improvement', 'Strongly dissatisfied'] },
  { id: 'q7', questionText: 'How organized are your study habits and daily routine?', required: true, type: 'single', options: ['Very organized', 'Mostly organized', 'Sometimes irregular', 'Disorganized'] },
  { id: 'q8', questionText: 'How often do you feel anxious due to exams or expectations?', required: true, type: 'single', options: ['Rarely', 'Sometimes', 'Often', 'Almost always'] },
  { id: 'q9', questionText: 'When you fall behind in studies, your reaction is:', required: true, type: 'single', options: ['I calmly plan recovery', 'I feel stressed but act', 'I panic and delay', 'I avoid it'] },
  { id: 'q10', questionText: 'How well can you focus without being distracted by screens?', required: true, type: 'single', options: ['Very well', 'Mostly manageable', 'Often distracted', 'Unable to focus'] },
  { id: 'q11', questionText: 'In the past two weeks, how often have you felt emotionally low?', required: true, type: 'single', options: ['Never', 'Sometimes', 'Often', 'Almost daily'] },
  { id: 'q12', questionText: 'Do worries interfere with sleep or relaxation?', required: true, type: 'single', options: ['Not at all', 'Sometimes', 'Frequently', 'Almost always'] },
  { id: 'q13', questionText: 'When facing difficulty, you usually:', required: true, type: 'single', options: ['Ask for help early', 'Try alone first', 'Delay help', 'Give up'] },
  { id: 'q14', questionText: 'How confident are you in handling academic workload?', required: true, type: 'single', options: ['Very confident', 'Mostly confident', 'Unsure', 'Overwhelmed'] },
  { id: 'q15', questionText: 'How motivated do you feel toward your goals?', required: true, type: 'single', options: ['Highly motivated', 'Moderately motivated', 'Low motivation', 'No motivation'] },
  { id: 'q16', questionText: 'When results are poor, you:', required: true, type: 'single', options: ['Reflect and improve', 'Feel upset briefly', 'Lose confidence', 'Feel hopeless'] },
  { id: 'q17', questionText: 'How supported do you feel academically and emotionally?', required: true, type: 'single', options: ['Fully supported', 'Mostly supported', 'Sometimes unsupported', 'Often alone'] },
  { id: 'q18', questionText: 'How often does late screen use affect your sleep?', required: true, type: 'single', options: ['Almost never', 'Occasionally', 'Frequently', 'Almost daily'] },
  { id: 'q19', questionText: 'After long screen use, you feel:', required: true, type: 'single', options: ['Normal', 'Slightly tired', 'Mentally drained', 'Irritable/exhausted'] },
  { id: 'q20', questionText: 'How quickly do you recover from stress?', required: true, type: 'single', options: ['Very quickly', 'With effort', 'Slowly', 'I feel stuck'] },
  { id: 'q21', questionText: 'When you feel overwhelmed, you believe:', required: true, type: 'single', options: ['I can get help and things improve', 'Help is available but I hesitate', 'I usually handle it alone', 'No one really understands or helps'] },
];

const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;
const normalizeText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const classToken = (value) => {
  const match = String(value || '').match(/\d+/);
  return match ? match[0] : String(value || '').trim();
};
const normalizeSkillId = (raw) => {
  if (raw == null) return '';
  const text = String(raw).trim().toLowerCase();
  return SKILL_ALIAS_MAP[text] || SKILL_ALIAS_MAP[text.replace(/&/g, 'and')] || SKILL_ALIAS_MAP[text.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')] || '';
};
const resolveSkillOptionId = (raw) => normalizeSkillId(raw)
  || String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const skillOptionFromNode = (node) => {
  const label = String(node?.name || node?.title || node?.label || '').trim();
  if (!label) return null;
  const aliasId = resolveSkillOptionId(node?.id || node?.key || node?.slug || label);
  const fallbackMatch = SKILLS_EDGE_OPTIONS.find((skill) => normalizeText(skill.label) === normalizeText(label));
  return {
    id: aliasId || fallbackMatch?.id,
    label,
    emoji: node?.emoji || node?.icon || fallbackMatch?.emoji || DEFAULT_SKILL_EMOJI,
  };
};
const flattenSkillOptions = (nodes) => arr(nodes).flatMap((node) => {
  const children = arr(node?.skills || node?.children || node?.items || node?.subskills || node?.categories);
  if (children.length > 0) return flattenSkillOptions(children);
  const option = skillOptionFromNode(node);
  return option ? [option] : [];
});
const REFLECTION_PROFILE_TEXT_MATCHERS = [
  'mention two of your strengths',
  'mention one weakness',
  'stream',
  'favourite subjects',
  'favorite subjects',
  'hobbies or interests',
];
const questionKey = (question, index = 0) => String(question?.id || question?.questionId || question?.key || `question_${index}`);
const normalizeQuestionType = (question) => {
  const declaredType = String(question?.type || question?.questionType || question?.inputType || '').toLowerCase();
  if (declaredType.includes('multi') || declaredType.includes('checkbox')) return 'multi';
  if (declaredType.includes('single') || declaredType.includes('select') || declaredType.includes('radio') || declaredType.includes('choice')) return 'single';
  const opts = arr(question?.options || question?.choices || question?.answers || question?.answerOptions);
  return opts.length > 0 ? 'single' : 'text';
};
const normalizeQuestionOptions = (question) => arr(question?.options || question?.choices || question?.answers || question?.answerOptions)
  .map((option) => (typeof option === 'string'
    ? option
    : option?.label || option?.value || option?.text || option?.name || ''))
  .map((option) => String(option || '').trim())
  .filter(Boolean);
const normalizeSurveyQuestions = (rawQuestions) => arr(rawQuestions)
  .map((question, index) => ({
    id: questionKey(question, index),
    questionText: String(question?.questionText || question?.question || question?.text || question?.label || '').trim(),
    required: Boolean(question?.required ?? question?.mandatory),
    type: normalizeQuestionType(question),
    options: normalizeQuestionOptions(question),
    raw: question,
  }))
  .filter((question) => question.questionText);
const isReflectionProfileQuestion = (questionText) => {
  const text = normalizeText(questionText);
  return REFLECTION_PROFILE_TEXT_MATCHERS.some((needle) => text.includes(needle));
};
const normalizeAnswerValue = (answer, type) => {
  if (type === 'multi') {
    if (Array.isArray(answer)) return answer.map((item) => String(item || '').trim()).filter(Boolean);
    if (typeof answer === 'string') return answer.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  }
  if (Array.isArray(answer)) return String(answer[0] || '').trim();
  return String(answer || '').trim();
};
const formatSurveyAnswersForSubmit = (answers, questions) => questions.reduce((acc, question) => {
  const value = answers[question.id];
  if (question.type === 'multi') {
    if (Array.isArray(value) && value.length > 0) acc[question.id] = value.join(', ');
    return acc;
  }
  if (typeof value === 'string' && value.trim()) acc[question.id] = value.trim();
  return acc;
}, {});

function SectionHeader({ title, dark }) {
  return <Text style={dark ? styles.sectionHeaderDark : styles.sectionHeader}>{title}</Text>;
}

function Field({ label, required, errorKey, errors, ...props }) {
  const hasError = Boolean(errorKey && errors && errors[errorKey]);
  return (
    <View style={styles.group}>
      <Text style={[styles.label, hasError && styles.labelError]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.multiline, hasError && styles.inputError]}
        placeholderTextColor={STUDENT.textMuted}
      />
    </View>
  );
}

function Select({ label, value, setValue, options, required, errorKey, errors, disabled }) {
  const hasError = Boolean(errorKey && errors && errors[errorKey]);
  return (
    <View style={styles.group}>
      <Text style={[styles.label, hasError && styles.labelError]}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={[styles.selectWrap, hasError && styles.inputError, disabled && { opacity: 0.6 }]}>
        <Picker
          selectedValue={value}
          onValueChange={(next) => { if (!disabled) setValue(next); }}
          style={styles.picker}
          dropdownIconColor={STUDENT.textPrimary}
          enabled={!disabled}
        >
          <Picker.Item label="Select" value="" />
          {options.map((option) => (
            <Picker.Item key={String(option.value ?? option ?? '')} label={String(option.label ?? option ?? '')} value={option.value ?? option ?? ''} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function ReadOnly({ label, value }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, styles.readOnly]}>
        <Text style={styles.readOnlyText}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function Tick({ checked, label, onPress, disabled, accessibilityHint }) {
  return (
    <Pressable
      style={[styles.tickRow, checked && styles.tickRowActive, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
    >
      <View style={[styles.tickBox, checked && styles.tickBoxActive]}>{checked ? <Text style={styles.tickText}>✓</Text> : null}</View>
      <Text style={styles.tickLabel}>{label}</Text>
    </Pressable>
  );
}

function Drawer({ open, onClose, progress, media, onPhotoPick, onPhotoDelete, onVideoPick, onVideoDelete }) {
  const x = useRef(new Animated.Value(-320)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: open ? 0 : -320, duration: 180, useNativeDriver: true }).start();
  }, [open, x]);

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateX: x }] }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeTxt}>✕</Text></TouchableOpacity>
          <Text style={styles.drawerTitle}>Students Profile</Text>
          <Text style={styles.progressLabel}>Completed: {progress.toFixed(0)}%</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>

          <Text style={styles.subTitle}>Profile Picture</Text>
          <View style={styles.mediaCircle}>{media.pictureUrl ? <Animated.Image source={{ uri: media.pictureUrl }} style={styles.mediaImg} /> : <Text>👤</Text>}</View>
          <TouchableOpacity style={[styles.actionBtn, styles.greenBtn]} onPress={onPhotoPick}><Text style={styles.actionTxt}>Change Photo</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.redBtn]} onPress={onPhotoDelete}><Text style={styles.redTxt}>Remove</Text></TouchableOpacity>

          <Text style={styles.subTitle}>Profile Video</Text>
          <View style={styles.videoTile}>
            <Text style={styles.videoIcon}>{media.videoUrl ? '🎬' : '📹'}</Text>
            <Text style={styles.videoMsg}>{media.videoUrl ? 'Video uploaded' : 'No video uploaded'}</Text>
          </View>
          <TouchableOpacity style={[styles.actionBtn, styles.greenBtn]} onPress={onVideoPick}>
            <Text style={styles.actionTxt}>{media.videoUrl ? 'Change Video' : 'Upload Video'}</Text>
          </TouchableOpacity>
          {media.videoUrl ? (
            <TouchableOpacity style={[styles.actionBtn, styles.redBtn]} onPress={onVideoDelete}><Text style={styles.redTxt}>Remove</Text></TouchableOpacity>
          ) : null}
          <Text style={styles.note}>Note: Please complete all sections to unlock the final submission.</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function StudentProfileScreen() {
  const router = useRouter();
  const [active, setActive] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showDob, setShowDob] = useState(false);
  const [personalSubTab, setPersonalSubTab] = useState('information');
  const [personalLocked, setPersonalLocked] = useState(false);
  const [personalInfoLoading, setPersonalInfoLoading] = useState(false);
  const [personalInfoError, setPersonalInfoError] = useState('');
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState('');
  const [reflectionLoaded, setReflectionLoaded] = useState(false);
  const [error, setError] = useState('');
  const [personalErrors, setPersonalErrors] = useState({});
  const [media, setMedia] = useState({ pictureUrl: '', videoUrl: '' });

  const [personal, setPersonal] = useState({
    fullName: '', email: '', mobile: '', dob: '', gender: '',
    schoolName: '', curriculum: '',
    currentClass: '', section: '',
    strengths: '', weakness: '', stream: '', favSubjects: [], hobbies: '',
    studentType: '',
  });
  const [reflectionErrors, setReflectionErrors] = useState({});
  const [surveyQuestions, setSurveyQuestions] = useState([]);
  const [surveyAnswers, setSurveyAnswers] = useState({});
  const [academic, setAcademic] = useState({
    id: null,
    curriculumId: null,
    classId: null,
    classLabel: '',
    challengingSubjectIds: [],
    challengingSubjects: [],
    chapters: {},
    topics: {},
    preparingCompetitiveExam: null,
    competitiveExamId: null,
    competitiveExamName: '',
    entranceExamIds: [],
  });
  const [skills, setSkills] = useState({ id: null, selectedSkillIds: [], communicationRatings: { Listening: '', Speaking: '', Reading: '', Writing: '' }, locked: false });
  const [university, setUniversity] = useState({
    id: null,
    country: '',
    state: '',
    universityPreference1: '',
    coursePreference1: '',
    universityPreference2: '',
    coursePreference2: '',
    personalStatement: '',
    careerReason: '',
  });
  const [education, setEducation] = useState({
    id: null,
    class10School: '',
    class10Year: '',
    class10Percentage: '',
    englishTestTaken: '',
    ieltsScore: '',
    toeflScore: '',
    englishCertificateNumber: '',
  });
  const [additional, setAdditional] = useState({ id: null, hobbies: '', achievements: '', volunteerWork: '', linkedinUrl: '', portfolioUrl: '', aboutMe: '' });
  const [completed, setCompleted] = useState({ personal: false, academic: false, skillsedge: false, university: false, education: false, additional: false });

  const [tree, setTree] = useState([]);
  const [exams, setExams] = useState([]);
  const [hiddenNodeIds, setHiddenNodeIds] = useState([]);
  const [hiddenExamIds, setHiddenExamIds] = useState([]);
  const [skillsTree, setSkillsTree] = useState([]);

  const progress = useMemo(() => (Object.values(completed).filter(Boolean).length / TABS.length) * 100, [completed]);

  const isSchoolStudent = personal.studentType?.toUpperCase() === 'SCHOOL';

  const fetchCompletion = useCallback(async () => {
    const [p, a, s, u, e, ad] = await Promise.all([
      studentService.getProfile().catch(() => ({})),
      studentService.getAcademicProfile().catch(() => ({})),
      studentService.getSkillsProfile().catch(() => ({})),
      studentService.getUniversityProfile().catch(() => ({})),
      studentService.getEducationProfile().catch(() => ({})),
      studentService.getAdditionalProfile().catch(() => ({})),
    ]);
    const pD = unwrap(p); const aD = unwrap(a); const sD = unwrap(s); const uD = unwrap(u); const eD = unwrap(e); const adD = unwrap(ad);
    const personalFavoriteSubjects = typeof (pD.favSubjects || pD.favoriteSubjects) === 'string'
      ? (pD.favSubjects || pD.favoriteSubjects).split(',').map((item) => item.trim()).filter(Boolean)
      : arr(pD.favSubjects || pD.favoriteSubjects);
    const academicPreparing = aD.preparingCompetitiveExam != null
      ? Boolean(aD.preparingCompetitiveExam)
      : Boolean(aD.competitiveExamId || aD.competitiveExamName || arr(aD.entranceExamIds).length);
    setCompleted({
      personal: Boolean(
        (pD.fullName || pD.name || pD.studentName)
        && pD.email
        && (pD.mobile || pD.phone)
        && pD.gender
        && (pD.dob || pD.dateOfBirth)
        && (pD.currentClass || pD.className || pD.class)
        && pD.strengths
        && pD.weakness
        && pD.stream
        && personalFavoriteSubjects.length > 0
      ),
      academic: Boolean(
        (aD.curriculumId || aD.curriculum || aD.curriculumName)
        && (aD.classId || aD.className || aD.class)
        && (arr(aD.challengingSubjectIds).length || arr(aD.challengingSubjects || aD.subjectNames).length || arr(aD.selectedTopicIds || aD.topicIds).length)
        && (
          aD.preparingCompetitiveExam != null
          || aD.competitiveExamId
          || aD.competitiveExamName
          || arr(aD.entranceExamIds).length
        )
        && (
          !academicPreparing
          || aD.competitiveExamId
          || aD.competitiveExamName
        )
        && arr(aD.entranceExamIds).length <= 2
      ),
      skillsedge: Boolean(arr(sD.selectedSkillIds || sD.skillIds || sD.selectedSkills).length),
      university: Boolean(
        (uD.universityPreference1 || uD.preferredUniversity1)
        && (uD.coursePreference1 || uD.intendedCourse)
        && countWords(uD.personalStatement || uD.statementOfPurpose || '') >= 250
        && countWords(uD.personalStatement || uD.statementOfPurpose || '') <= 500
        && countWords(uD.careerReason || uD.courseCareerReason || uD.whyThisCourse || '') >= 1
        && countWords(uD.careerReason || uD.courseCareerReason || uD.whyThisCourse || '') <= 200
      ),
      education: Boolean(eD.class10School && eD.class10Year && eD.class10Percentage && (eD.englishTestTaken !== 'Yes' || eD.ieltsScore || eD.toeflScore || eD.englishCertificateNumber)),
      additional: Boolean(adD.hobbies || adD.achievements || adD.aboutMe),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPersonalInfoLoading(true);
    setPersonalInfoError('');
    try {
      const [pRes, aTreeRes, examRes, aRes, sTreeRes, sRes, uRes, eRes, adRes, hNodeRes, hExamRes] = await Promise.all([
        studentService.getProfile(),
        studentService.getAcademicIQTree().catch(() => ({})),
        studentService.getCompetitiveExams().catch(() => ([])),
        studentService.getAcademicProfile().catch(() => ({})),
        studentService.getSkillsEdgeTree().catch(() => ({})),
        studentService.getSkillsProfile().catch(() => ({})),
        studentService.getUniversityProfile().catch(() => ({})),
        studentService.getEducationProfile().catch(() => ({})),
        studentService.getAdditionalProfile().catch(() => ({})),
        studentService.getStudentHiddenNodes('ACADEMIC_IQ').catch(() => ([])),
        studentService.getStudentHiddenNodes('COMPETITIVE_EXAM').catch(() => ([])),
      ]);

      const p = unwrap(pRes); const aTree = unwrap(aTreeRes); const a = unwrap(aRes); const sTree = unwrap(sTreeRes);
      const s = unwrap(sRes); const u = unwrap(uRes); const e = unwrap(eRes); const ad = unwrap(adRes);

      const favSubjectsRaw = p.favSubjects || p.favoriteSubjects || '';
      const favSubjectsArr = typeof favSubjectsRaw === 'string'
        ? favSubjectsRaw.split(',').map((x) => x.trim()).filter(Boolean)
        : arr(favSubjectsRaw);

      setPersonal({
        fullName: p.fullName || p.name || p.studentName || '',
        email: p.email || '',
        mobile: p.mobile || p.phone || '',
        dob: p.dob || p.dateOfBirth || '',
        gender: p.gender || '',
        schoolName: p.schoolName || (p.school && typeof p.school === 'object' ? p.school.name : p.school) || '',
        curriculum: p.schoolBoard || p.board || (p.school && typeof p.school === 'object' ? p.school.board : '') || '',
        currentClass: p.currentClass ? String(p.currentClass) : (p.className || p.class || ''),
        section: p.section || '',
        strengths: p.strengths || '',
        weakness: p.weakness || '',
        stream: p.stream || '',
        favSubjects: favSubjectsArr,
        hobbies: p.hobbies || '',
        studentType: p.studentType || '',
      });
      setPersonalLocked(Boolean(p.personalLocked || p.personalDetailsSaved || p.isProfileSubmitted));
      setMedia({ pictureUrl: p.profilePictureUrl || p.pictureUrl || p.avatar || '', videoUrl: p.profileVideoUrl || p.videoUrl || '' });

      const curriculumNodes = arr(aTree.curriculums || aTree.nodes || aTree.children || aTree).filter(Boolean);
      setTree(curriculumNodes);
      setExams(arr(unwrap(examRes).exams || unwrap(examRes)));
      setHiddenNodeIds(arr(unwrap(hNodeRes).hiddenNodeIds || unwrap(hNodeRes)));
      setHiddenExamIds(arr(unwrap(hExamRes).hiddenNodeIds || unwrap(hExamRes)));

      // Map academic profile — support both new ID-based and legacy name-based shapes
      const chapterMap = {};
      if (a.chapters && typeof a.chapters === 'object' && !Array.isArray(a.chapters)) {
        Object.assign(chapterMap, a.chapters);
      }
      const topicMap = {};
      if (a.topics && typeof a.topics === 'object' && !Array.isArray(a.topics)) {
        Object.assign(topicMap, a.topics);
      }
      const competitiveExamId = a.competitiveExamId || arr(a.competitiveExamIds || a.examIds)[0] || null;
      const challengingSubjectsRaw = a.challengingSubjects || a.subjectNames || a.challengingSubjectNames;
      const challengingSubjects = typeof challengingSubjectsRaw === 'string'
        ? challengingSubjectsRaw.split(',').map((item) => item.trim()).filter(Boolean)
        : arr(challengingSubjectsRaw);
      setAcademic({
        id: a.id || null,
        curriculumId: a.curriculumId || null,
        classId: a.classId || null,
        classLabel: a.className || a.class || '',
        challengingSubjectIds: arr(a.challengingSubjectIds || a.subjectIds),
        challengingSubjects: challengingSubjects.length ? challengingSubjects : [],
        chapters: chapterMap,
        topics: topicMap,
        preparingCompetitiveExam: a.preparingCompetitiveExam != null ? Boolean(a.preparingCompetitiveExam) : (competitiveExamId ? true : null),
        competitiveExamId,
        competitiveExamName: a.competitiveExamName || a.examName || '',
        entranceExamIds: arr(a.entranceExamIds),
      });

      const loadedSkillsTree = arr(sTree.skills || sTree.categories || sTree.nodes || sTree.children || sTree);
      const availableSkillOptions = flattenSkillOptions(loadedSkillsTree);
      const availableSkillIds = new Set((availableSkillOptions.length > 0 ? availableSkillOptions : SKILLS_EDGE_OPTIONS).map((option) => option.id));
      const selectedSkillIds = arr(s.selectedSkillIds || s.skillIds || s.selectedSkills).map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.id || item.key || item.name || item.label;
        return item;
      }).map(resolveSkillOptionId).filter((id) => availableSkillIds.has(id));
      const communicationRatings = {
        Listening: s.communicationRatings?.Listening || s.englishCommunicationRating?.Listening || s.listeningRating || '',
        Speaking: s.communicationRatings?.Speaking || s.englishCommunicationRating?.Speaking || s.speakingRating || '',
        Reading: s.communicationRatings?.Reading || s.englishCommunicationRating?.Reading || s.readingRating || '',
        Writing: s.communicationRatings?.Writing || s.englishCommunicationRating?.Writing || s.writingRating || '',
      };
      setSkills({
        id: s.id || null,
        selectedSkillIds,
        communicationRatings,
        locked: Boolean(
          s.locked
          || s.isLocked
          || s.selectionsLocked
          || s.selectionLocked
          || s.selectionsSaved
          || s.isSelectionSaved
        ),
      });
      setSkillsTree(loadedSkillsTree);
      setUniversity({
        id: u.id || null,
        country: u.country || arr(u.preferredCountries || u.countries)[0] || '',
        state: u.state || u.indiaState || '',
        universityPreference1: u.universityPreference1 || u.preferredUniversity1 || '',
        coursePreference1: u.coursePreference1 || u.intendedCourse || '',
        universityPreference2: u.universityPreference2 || u.preferredUniversity2 || '',
        coursePreference2: u.coursePreference2 || '',
        personalStatement: u.personalStatement || u.statementOfPurpose || '',
        careerReason: u.careerReason || u.courseCareerReason || u.whyThisCourse || '',
      });
      setEducation({
        id: e.id || null,
        class10School: e.class10School || '',
        class10Year: e.class10Year ? String(e.class10Year) : '',
        class10Percentage: e.class10Percentage ? String(e.class10Percentage) : '',
        englishTestTaken: e.englishTestTaken || '',
        ieltsScore: e.ieltsScore ? String(e.ieltsScore) : '',
        toeflScore: e.toeflScore ? String(e.toeflScore) : '',
        englishCertificateNumber: e.englishCertificateNumber || '',
      });
      setAdditional({ id: ad.id || null, hobbies: ad.hobbies || '', achievements: ad.achievements || '', volunteerWork: ad.volunteerWork || '', linkedinUrl: ad.linkedinUrl || '', portfolioUrl: ad.portfolioUrl || '', aboutMe: ad.aboutMe || '' });
      await fetchCompletion();
    } catch (err) {
      setPersonalInfoError(err?.message || 'Unable to load personal information.');
      Alert.alert('Error', err?.message || 'Unable to load profile');
    } finally {
      setPersonalInfoLoading(false);
      setLoading(false);
    }
  }, [fetchCompletion]);

  useEffect(() => { load(); }, [load]);

  const loadReflection = useCallback(async () => {
    setReflectionLoading(true);
    setReflectionError('');
    try {
      const response = await studentService.getStudentSurvey();
      const payload = unwrap(response);
      const dynamicQuestions = normalizeSurveyQuestions(payload.questions || payload.surveyQuestions || (Array.isArray(payload) ? payload : []));
      const reflectionQuestions = dynamicQuestions.filter((question) => !isReflectionProfileQuestion(question.questionText));
      const questionsToUse = reflectionQuestions.length > 0 ? reflectionQuestions : REFLECTION_DEFAULT_QUESTIONS;
      const answerMap = {};
      const rawAnswers = payload.answers || {};
      questionsToUse.forEach((question) => {
        const qid = question.id;
        const seededAnswer = rawAnswers[qid]
          ?? rawAnswers[String(question.raw?.id || '')]
          ?? rawAnswers[String(question.raw?.questionId || '')]
          ?? question.raw?.answer
          ?? '';
        answerMap[qid] = normalizeAnswerValue(seededAnswer, question.type);
      });
      setSurveyQuestions(questionsToUse);
      setSurveyAnswers(answerMap);
      setReflectionLoaded(true);
    } catch (err) {
      setReflectionError(err?.message || 'Unable to load student reflection.');
      setSurveyQuestions(REFLECTION_DEFAULT_QUESTIONS);
      setSurveyAnswers((prev) => ({ ...prev }));
    } finally {
      setReflectionLoaded(true);
      setReflectionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active === 'personal' && personalSubTab === 'reflection' && !reflectionLoaded && !loading) {
      loadReflection();
    }
  }, [active, personalSubTab, reflectionLoaded, loading, loadReflection]);

  const pickMedia = async (kind) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Permission denied', 'Media permission is required.');
      const mediaTypes = kind === 'video'
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: kind === 'image',
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const form = new FormData();
      const extension = asset.fileName?.split('.').pop()
        || asset.mimeType?.split('/').pop()
        || (kind === 'video' ? 'mp4' : 'jpg');
      form.append('file', {
        uri: asset.uri,
        name: asset.fileName || `${kind}-${Date.now()}.${extension}`,
        type: asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
      });
      await (kind === 'video' ? studentService.uploadProfileVideo(form) : studentService.uploadProfilePicture(form));
      await load();
    } catch (err) {
      Alert.alert('Upload failed', err?.message || `Could not ${kind === 'video' ? 'upload the video' : 'change the photo'}.`);
    }
  };

  const save = async () => {
    setError('');
    setPersonalErrors({});
    setReflectionErrors({});

    if (active === 'personal') {
      const profilePayload = {
        fullName: personal.fullName,
        email: personal.email,
        mobile: personal.mobile,
        dob: personal.dob,
        gender: personal.gender,
        stream: personal.stream,
        currentClass: personal.currentClass,
        section: personal.section,
        strengths: personal.strengths,
        weakness: personal.weakness,
        favSubjects: personal.favSubjects.join(','),
        hobbies: personal.hobbies,
      };

      if (personalSubTab === 'information') {
        const errs = {};
        PERSONAL_INFO_REQUIRED.forEach((key) => {
          const val = personal[key];
          if (!val || (typeof val === 'string' && !val.trim())) errs[key] = true;
        });
        if (personal.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim())) errs.email = true;
        if (personal.mobile && !/^[0-9]{10,15}$/.test(personal.mobile.trim())) errs.mobile = true;
        if (Object.keys(errs).length > 0) {
          setPersonalErrors(errs);
          setError('Please fill in all required fields correctly.');
          return;
        }
      } else {
        const errs = {};
        REFLECTION_PROFILE_REQUIRED.forEach((key) => {
          const val = personal[key];
          if (!val || (typeof val === 'string' && !val.trim())) errs[key] = true;
        });
        if (!personal.favSubjects || personal.favSubjects.length === 0) errs.favSubjects = true;
        surveyQuestions.forEach((question) => {
          if (!question.required) return;
          const answer = surveyAnswers[question.id];
          if (question.type === 'multi') {
            if (!Array.isArray(answer) || answer.length === 0) errs[question.id] = true;
            return;
          }
          if (!String(answer || '').trim()) errs[question.id] = true;
        });
        if (Object.keys(errs).length > 0) {
          setReflectionErrors(errs);
          setError('Please fill in all required reflection fields.');
          return;
        }
      }

      setSaving(true);
      try {
        await studentService.updateProfile(profilePayload);
        if (personalSubTab === 'reflection' && surveyQuestions.length > 0) {
          const surveyPayload = formatSurveyAnswersForSubmit(surveyAnswers, surveyQuestions);
          await studentService.saveStudentSurvey(surveyPayload);
        }
        if (personalSubTab === 'reflection') setPersonalLocked(true);
        await fetchCompletion();
        Alert.alert(
          'Updated!',
          personalSubTab === 'reflection'
            ? 'Student reflection saved successfully.'
            : 'Personal information saved successfully.',
        );
      } catch (err) {
        Alert.alert(
          'Save failed',
          err?.message || (personalSubTab === 'reflection'
            ? 'Could not save student reflection.'
            : 'Could not save personal information.'),
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    if (active === 'academic') {
      if (!academic.curriculumId) return setError('Please select a curriculum.');
      if (!academic.classId && !academic.classLabel) return setError('Please select a class.');
      if (!academic.challengingSubjects.length && !academic.challengingSubjectIds.length) return setError('Please select at least one challenging subject.');
      if ((academic.challengingSubjects.length + academic.challengingSubjectIds.length) > 2) return setError('You can select up to 2 challenging subjects.');
      if (academic.preparingCompetitiveExam == null) return setError('Please select whether you are preparing for a competitive examination.');
      if (academic.preparingCompetitiveExam && !academic.competitiveExamId && !academic.competitiveExamName) {
        return setError('Please choose a competitive examination category.');
      }
      if (academic.entranceExamIds.length > 2) return setError('You can select up to 2 entrance exams.');
    }
    if (active === 'skillsedge') {
      if (!skills.selectedSkillIds.length) return setError('Please select at least one skill.');
      if (COMMUNICATION_ROWS.some((row) => !skills.communicationRatings[row])) {
        return setError('Please select an English communication rating for Listening, Speaking, Reading, and Writing.');
      }
    }
    if (active === 'university') {
      const personalStatementWords = countWords(university.personalStatement);
      const careerReasonWords = countWords(university.careerReason);
      if (!university.country) return setError('Please select a country.');
      if (university.country === 'India' && !university.state) return setError('Please select a state.');
      if (!university.universityPreference1.trim() || !university.coursePreference1.trim()) return setError('University Preference 1 and Course Preference 1 are required.');
      if (personalStatementWords < 250 || personalStatementWords > 500) return setError('Personal Statement must be between 250 and 500 words.');
      if (!university.careerReason.trim()) return setError('Please provide a reason for why you want to pursue this course/career.');
      if (careerReasonWords > 200) return setError('Why do you want to pursue this course/career? must be 200 words or less.');
    }
    if (active === 'education') {
      if (!education.class10School.trim() || !education.class10Year.trim() || !education.class10Percentage.trim()) {
        return setError('Class 10 School Name, Year of Passing and Percentage are required.');
      }
      if (!/^\d{4}$/.test(education.class10Year.trim())) return setError('Class 10 Year of Passing must be a valid 4-digit year.');
      const yearValue = Number(education.class10Year.trim());
      if (Number.isNaN(yearValue)) return setError('Class 10 Year of Passing must be numeric.');
      const currentYear = new Date().getFullYear();
      if (yearValue < 1950 || yearValue > currentYear + 1) return setError('Class 10 Year of Passing must be within a valid range.');
      const percentageRaw = education.class10Percentage.trim();
      if (!percentageRaw) return setError('Class 10 Percentage is required.');
      const percentageValue = Number(percentageRaw);
      if (Number.isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) return setError('Class 10 Percentage must be between 0 and 100.');
      if (!education.englishTestTaken) return setError('Please select if you have taken an English proficiency test.');
      if (education.englishTestTaken === 'Yes' && !education.ieltsScore.trim() && !education.toeflScore.trim() && !education.englishCertificateNumber.trim()) {
        return setError('Please provide IELTS/TOEFL score details.');
      }
    }
    setSaving(true);
    try {
      if (active === 'academic') {
        const payload = {
          curriculumId: academic.curriculumId,
          classId: academic.classId,
          className: academic.classLabel,
          class: academic.classLabel,
          challengingSubjectIds: academic.challengingSubjectIds,
          challengingSubjects: academic.challengingSubjects,
          subjectNames: academic.challengingSubjects,
          chapters: academic.chapters,
          topics: academic.topics,
          preparingCompetitiveExam: academic.preparingCompetitiveExam,
          competitiveExamId: academic.preparingCompetitiveExam ? academic.competitiveExamId : null,
          competitiveExamName: academic.preparingCompetitiveExam ? academic.competitiveExamName : '',
          entranceExamIds: academic.preparingCompetitiveExam ? academic.entranceExamIds : [],
        };
        await (academic.id ? studentService.updateAcademicProfile(payload) : studentService.createAcademicProfile(payload));
      }
      if (active === 'skillsedge') {
        const payload = {
          ...skills,
          selectedSkills: skills.selectedSkillIds,
          englishCommunicationRating: skills.communicationRatings,
          listeningRating: skills.communicationRatings.Listening,
          speakingRating: skills.communicationRatings.Speaking,
          readingRating: skills.communicationRatings.Reading,
          writingRating: skills.communicationRatings.Writing,
        };
        await (skills.id ? studentService.updateSkillsProfile(payload) : studentService.createSkillsProfile(payload));
        setSkills((prev) => ({ ...prev, locked: true }));
      }
      if (active === 'university') {
        const payload = {
          ...university,
          preferredCountries: university.country ? [university.country] : [],
          countries: university.country ? [university.country] : [],
          intendedCourse: university.coursePreference1,
          preferredUniversity1: university.universityPreference1,
          preferredUniversity2: university.universityPreference2,
          state: university.country === 'India' ? university.state : '',
        };
        await (university.id ? studentService.updateUniversityProfile(payload) : studentService.createUniversityProfile(payload));
      }
      if (active === 'education') {
        const payload = {
          ...education,
          ieltsScore: education.englishTestTaken === 'Yes' ? education.ieltsScore : '',
          toeflScore: education.englishTestTaken === 'Yes' ? education.toeflScore : '',
          englishCertificateNumber: education.englishTestTaken === 'Yes' ? education.englishCertificateNumber : '',
        };
        await (education.id ? studentService.updateEducationProfile(payload) : studentService.createEducationProfile(payload));
      }
      if (active === 'additional') await (additional.id ? studentService.updateAdditionalProfile(additional) : studentService.createAdditionalProfile(additional));
      await fetchCompletion();
      Alert.alert('Saved', 'Section saved successfully.');
    } catch (err) {
      Alert.alert('Save failed', err?.message || 'Could not save this section.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCurriculumNode = tree.find((x) => x.id === academic.curriculumId);
  const filteredCurriculums = tree.filter((c) => !hiddenNodeIds.includes(c.id));
  const filteredClasses = arr(selectedCurriculumNode?.classes || selectedCurriculumNode?.children).filter((c) => !hiddenNodeIds.includes(c.id));
  const orderedClassOptions = filteredClasses.length > 0
    ? filteredClasses
      .map((node) => ({ label: classToken(node.name || node.title), id: node?.id || null }))
      .sort((a, b) => {
        const aNum = Number(a.label);
        const bNum = Number(b.label);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
        return String(a.label).localeCompare(String(b.label));
      })
    : Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), id: null }));
  const selectedClassNode = filteredClasses.find((c) => c.id === academic.classId)
    || filteredClasses.find((c) => classToken(c.name || c.title) === classToken(academic.classLabel));
  const classSubjects = arr(selectedClassNode?.subjects || selectedClassNode?.children).filter((s) => !hiddenNodeIds.includes(s.id));
  const subjectByName = classSubjects.reduce((acc, subj) => {
    const key = normalizeText(subj.name || subj.title);
    if (key) acc[key] = subj;
    return acc;
  }, {});
  const filteredExams = arr(exams).filter((x) => !hiddenExamIds.includes(x.id));
  const examByName = filteredExams.reduce((acc, exam) => {
    const key = normalizeText(exam.name || exam.title);
    if (key) acc[key] = exam;
    return acc;
  }, {});
  const selectedExam = filteredExams.find((x) => x.id === academic.competitiveExamId)
    || examByName[normalizeText(academic.competitiveExamName)];
  const entranceExamOptions = arr(selectedExam?.entranceExams || selectedExam?.exams || []);
  const challengingSubjectOptions = classSubjects.length > 0
    ? classSubjects.map((subject) => ({ id: subject?.id, label: subject?.name || subject?.title || String(subject?.id) }))
    : ACADEMIC_CHALLENGING_SUBJECT_OPTIONS.map((label) => ({ id: subjectByName[normalizeText(label)]?.id, label }));
  const competitiveExamOptions = filteredExams.length > 0
    ? filteredExams.map((exam) => ({ id: exam?.id, label: exam?.name || exam?.title || String(exam?.id) }))
    : ACADEMIC_COMPETITIVE_EXAM_OPTIONS.map((label) => ({ id: examByName[normalizeText(label)]?.id, label }));
  const skillsEdgeOptions = useMemo(() => {
    const resolvedSkillOptions = flattenSkillOptions(skillsTree);
    const source = resolvedSkillOptions.length > 0 ? resolvedSkillOptions : SKILLS_EDGE_OPTIONS;
    const seen = new Set();
    return source.filter((option) => {
      if (seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    });
  }, [skillsTree]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        progress={progress}
        media={media}
        onPhotoPick={() => pickMedia('image')}
        onPhotoDelete={async () => {
          try {
            await studentService.deleteProfilePicture();
            await load();
          } catch (err) {
            Alert.alert('Delete failed', err?.message || 'Could not remove the profile photo.');
          }
        }}
        onVideoPick={() => pickMedia('video')}
        onVideoDelete={async () => {
          try {
            await studentService.deleteProfileVideo();
            await load();
          } catch (err) {
            Alert.alert('Delete failed', err?.message || 'Could not remove the profile video.');
          }
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}><Text style={styles.headerBtnText}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Student Profile</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setDrawerOpen(true)}><Text style={styles.headerBtnText}>☰</Text></TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={STUDENT.accentGreen} size="large" /></View>
      ) : (
        <>
          <ScrollView horizontal style={styles.tabs} showsHorizontalScrollIndicator={false}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, active === tab.key ? styles.tabActive : styles.tabInactive]}
                onPress={() => {
                  setActive(tab.key);
                  setError('');
                  if (tab.key === 'personal') setPersonalSubTab('information');
                }}
              >
                <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* ─── Personal Details ─────────────────────────────────── */}
            {active === 'personal' ? (
              <>
                <View style={styles.subTabs}>
                  {PERSONAL_SUB_TABS.map((tab) => {
                    const selected = personalSubTab === tab.key;
                    return (
                      <TouchableOpacity
                        key={tab.key}
                        style={[styles.subTab, selected && styles.subTabActive]}
                        onPress={() => {
                          setError('');
                          setPersonalErrors({});
                          setReflectionErrors({});
                          setPersonalSubTab(tab.key);
                        }}
                      >
                        <Text style={[styles.subTabText, selected && styles.subTabTextActive]}>{tab.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {personalSubTab === 'information' ? (
                  <>
                    <SectionHeader title="Personal Information" />
                    {personalInfoError ? (
                      <View style={styles.inlineErrorWrap}>
                        <Text style={styles.err}>{personalInfoError}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={load}>
                          <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {personalInfoLoading ? (
                      <View style={styles.inlineLoader}><ActivityIndicator color={STUDENT.accentGreen} /></View>
                    ) : (
                      <>
                        <Field
                          label="Full Name" required
                          errorKey="fullName" errors={personalErrors}
                          editable={!personalLocked}
                          value={personal.fullName}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, fullName: v }))}
                        />
                        <Field
                          label="Email ID" required
                          errorKey="email" errors={personalErrors}
                          editable
                          keyboardType="email-address"
                          autoCapitalize="none"
                          value={personal.email}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, email: v }))}
                        />
                        <Select
                          label="Gender" required
                          errorKey="gender" errors={personalErrors}
                          value={personal.gender}
                          setValue={(v) => setPersonal((p) => ({ ...p, gender: v }))}
                          options={GENDER_OPTIONS}
                          disabled={personalLocked}
                        />
                        <View style={styles.group}>
                          <Text style={[styles.label, personalErrors.dob && styles.labelError]}>
                            Date of Birth <Text style={styles.required}>*</Text>
                          </Text>
                          <TouchableOpacity
                            style={[styles.input, personalErrors.dob && styles.inputError]}
                            onPress={() => { if (!personalLocked) setShowDob(true); }}
                            disabled={personalLocked}
                            accessibilityRole="button"
                            accessibilityLabel="Select date of birth"
                          >
                            <Text style={personal.dob ? styles.dateText : { color: STUDENT.textMuted }}>
                              {personal.dob || 'Select date of birth'}
                            </Text>
                          </TouchableOpacity>
                          {showDob ? (
                            <DateTimePicker
                              value={personal.dob ? new Date(personal.dob) : new Date()}
                              mode="date"
                              maximumDate={new Date()}
                              onChange={(_, d) => {
                                setShowDob(Platform.OS === 'ios');
                                if (d) setPersonal((p) => ({ ...p, dob: d.toISOString().slice(0, 10) }));
                              }}
                            />
                          ) : null}
                        </View>
                        <Field
                          label="Mobile No." required
                          errorKey="mobile" errors={personalErrors}
                          editable
                          keyboardType="phone-pad"
                          maxLength={15}
                          value={personal.mobile}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, mobile: v }))}
                        />
                        <Select
                          label="Current Class" required
                          errorKey="currentClass" errors={personalErrors}
                          value={personal.currentClass ? String(personal.currentClass) : ''}
                          setValue={(v) => setPersonal((p) => ({ ...p, currentClass: v }))}
                          options={CLASS_OPTIONS.map((c) => ({ label: `Class ${c}`, value: String(c) }))}
                          disabled={personalLocked}
                        />
                        {isSchoolStudent ? (
                          <Select
                            label="Section"
                            value={personal.section}
                            setValue={(v) => setPersonal((p) => ({ ...p, section: v }))}
                            options={SECTION_OPTIONS}
                            disabled={personalLocked}
                          />
                        ) : null}
                        <ReadOnly label="Your School Name" value={personal.schoolName} />
                        <ReadOnly label="Curriculum" value={personal.curriculum} />
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <SectionHeader title="Student Reflection" dark />
                    {reflectionError ? (
                      <View style={styles.inlineErrorWrap}>
                        <Text style={styles.err}>{reflectionError}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={loadReflection}>
                          <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {reflectionLoading ? (
                      <View style={styles.inlineLoader}><ActivityIndicator color={STUDENT.accentGreen} /></View>
                    ) : (
                      <>
                        <Field
                          label="Mention two of your strengths." required
                          errorKey="strengths" errors={reflectionErrors}
                          editable={!personalLocked}
                          multiline
                          maxLength={120}
                          numberOfLines={2}
                          value={personal.strengths}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, strengths: v }))}
                        />
                        <Field
                          label="Mention one weakness or area of improvement." required
                          errorKey="weakness" errors={reflectionErrors}
                          editable={!personalLocked}
                          multiline
                          maxLength={120}
                          numberOfLines={2}
                          value={personal.weakness}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, weakness: v }))}
                        />
                        <Select
                          label="Stream" required
                          errorKey="stream" errors={reflectionErrors}
                          value={personal.stream}
                          setValue={(v) => setPersonal((p) => ({ ...p, stream: v, favSubjects: [] }))}
                          options={STREAM_OPTIONS}
                          disabled={personalLocked}
                        />
                        <View style={styles.group}>
                          <Text style={[styles.label, reflectionErrors.favSubjects && styles.labelError]}>
                            What are your favourite subjects? <Text style={styles.required}>*</Text>
                          </Text>
                          {personal.stream && STREAM_SUBJECTS[personal.stream] ? (
                            STREAM_SUBJECTS[personal.stream].map((subj) => {
                              const checked = personal.favSubjects.includes(subj);
                              return (
                                <Tick
                                  key={subj}
                                  checked={checked}
                                  label={subj}
                                  onPress={() => {
                                    if (personalLocked) return;
                                    setPersonal((p) => ({
                                      ...p,
                                      favSubjects: checked
                                        ? p.favSubjects.filter((x) => x !== subj)
                                        : [...p.favSubjects, subj],
                                    }));
                                  }}
                                />
                              );
                            })
                          ) : (
                            REFLECTION_SUBJECT_OPTIONS.map((subj) => {
                              const checked = personal.favSubjects.includes(subj);
                              return (
                                <Tick
                                  key={subj}
                                  checked={checked}
                                  label={subj}
                                  onPress={() => {
                                    if (personalLocked) return;
                                    setPersonal((p) => ({
                                      ...p,
                                      favSubjects: checked
                                        ? p.favSubjects.filter((x) => x !== subj)
                                        : [...p.favSubjects, subj],
                                    }));
                                  }}
                                />
                              );
                            })
                          )}
                        </View>
                        <Field
                          label="What are your hobbies or interests?"
                          editable={!personalLocked}
                          value={personal.hobbies}
                          onChangeText={(v) => setPersonal((p) => ({ ...p, hobbies: v }))}
                        />
                        {surveyQuestions.map((question) => {
                          const hasError = Boolean(reflectionErrors[question.id]);
                          if (question.type === 'single') {
                            return (
                              <Select
                                key={question.id}
                                label={question.questionText}
                                required={question.required}
                                errorKey={question.id}
                                errors={reflectionErrors}
                                value={surveyAnswers[question.id] || ''}
                                setValue={(next) => setSurveyAnswers((prev) => ({ ...prev, [question.id]: next }))}
                                options={question.options}
                                disabled={personalLocked}
                              />
                            );
                          }
                          if (question.type === 'multi') {
                            const selectedOptions = Array.isArray(surveyAnswers[question.id]) ? surveyAnswers[question.id] : [];
                            return (
                              <View key={question.id} style={styles.group}>
                                <Text style={[styles.label, hasError && styles.labelError]}>
                                  {question.questionText}
                                  {question.required ? <Text style={styles.required}> *</Text> : null}
                                </Text>
                                {question.options.map((option) => {
                                  const checked = selectedOptions.includes(option);
                                  return (
                                    <Tick
                                      key={option}
                                      checked={checked}
                                      label={option}
                                      disabled={personalLocked}
                                      onPress={() => setSurveyAnswers((prev) => {
                                        const current = Array.isArray(prev[question.id]) ? prev[question.id] : [];
                                        return {
                                          ...prev,
                                          [question.id]: checked ? current.filter((item) => item !== option) : [...current, option],
                                        };
                                      })}
                                    />
                                  );
                                })}
                              </View>
                            );
                          }
                          return (
                            <Field
                              key={question.id}
                              label={question.questionText}
                              required={question.required}
                              errorKey={question.id}
                              errors={reflectionErrors}
                              editable={!personalLocked}
                              value={surveyAnswers[question.id] || ''}
                              onChangeText={(next) => setSurveyAnswers((prev) => ({ ...prev, [question.id]: next }))}
                              multiline
                            />
                          );
                        })}
                        {personalLocked ? <Text style={styles.tip}>Core personal fields are locked after first save.</Text> : null}
                      </>
                    )}
                  </>
                )}
              </>
            ) : null}

            {/* ─── Academic IQ ──────────────────────────────────────── */}
            {active === 'academic' ? (
              <>
                <Text style={styles.subHeader}>Curriculum</Text>
                <View style={styles.chips}>
                  {filteredCurriculums.map((node) => (
                    <TouchableOpacity
                      key={String(node.id)}
                      style={[styles.chip, academic.curriculumId === node.id && styles.chipOn]}
                      onPress={() => setAcademic((a) => ({
                        ...a,
                        curriculumId: node.id,
                        classId: null,
                        classLabel: '',
                        challengingSubjectIds: [],
                        challengingSubjects: [],
                        chapters: {},
                        topics: {},
                      }))}
                    >
                      <Text style={[styles.chipTxt, academic.curriculumId === node.id && styles.chipTxtOn]}>
                        {node.name || node.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.subHeader}>Class</Text>
                <View style={styles.chips}>
                  {orderedClassOptions.map((cls) => {
                    const selected = academic.classId === cls.id || classToken(academic.classLabel) === cls.label;
                    return (
                      <TouchableOpacity
                        key={cls.label}
                        style={[styles.chip, selected && styles.chipOn]}
                        onPress={() => setAcademic((a) => ({
                          ...a,
                          classId: cls.id,
                          classLabel: cls.label,
                          challengingSubjectIds: [],
                          challengingSubjects: [],
                          chapters: {},
                          topics: {},
                        }))}
                      >
                        <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>{cls.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.subHeader}>Subjects you find challenging (Max 2)</Text>
                {(() => {
                  const selectedSubjectCount = challengingSubjectOptions.filter(({ label: subjectName }) => {
                    const subjectNode = subjectByName[normalizeText(subjectName)];
                    return academic.challengingSubjects.includes(subjectName)
                      || (subjectNode?.id && academic.challengingSubjectIds.includes(subjectNode.id));
                  }).length;
                  return challengingSubjectOptions.map(({ id: optionId, label: subjectName }) => {
                    const subjectNode = subjectByName[normalizeText(subjectName)];
                    const subjectId = subjectNode?.id || optionId;
                    const checked = academic.challengingSubjects.includes(subjectName)
                      || (subjectId && academic.challengingSubjectIds.includes(subjectId));
                    const disableNew = !checked && selectedSubjectCount >= 2;
                    return (
                      <Tick
                        key={subjectName}
                        checked={checked}
                        label={subjectName}
                        disabled={disableNew}
                        accessibilityHint={disableNew ? 'Maximum 2 subjects can be selected' : undefined}
                        onPress={() => {
                          setError('');
                          setAcademic((a) => {
                            if (checked) {
                              return {
                                ...a,
                                challengingSubjects: a.challengingSubjects.filter((x) => x !== subjectName),
                                challengingSubjectIds: subjectId ? a.challengingSubjectIds.filter((x) => x !== subjectId) : a.challengingSubjectIds,
                              };
                            }
                            if (selectedSubjectCount >= 2) {
                              setError('You can select up to 2 subjects');
                              return a;
                            }
                            return {
                              ...a,
                              challengingSubjects: [...a.challengingSubjects, subjectName],
                              challengingSubjectIds: subjectId && !a.challengingSubjectIds.includes(subjectId)
                                ? [...a.challengingSubjectIds, subjectId]
                                : a.challengingSubjectIds,
                            };
                          });
                        }}
                      />
                    );
                  });
                })()}

                <Select
                  label="Are you preparing for any competitive examination?"
                  required
                  value={academic.preparingCompetitiveExam == null ? '' : (academic.preparingCompetitiveExam ? 'Yes' : 'No')}
                  setValue={(v) => {
                    const isYes = v === 'Yes';
                    setAcademic((a) => ({
                      ...a,
                      preparingCompetitiveExam: v ? isYes : null,
                      competitiveExamId: isYes ? a.competitiveExamId : null,
                      competitiveExamName: isYes ? a.competitiveExamName : '',
                      entranceExamIds: isYes ? a.entranceExamIds : [],
                    }));
                  }}
                  options={['Yes', 'No']}
                />

                {academic.preparingCompetitiveExam === true ? (
                  <>
                    <Text style={styles.subHeader}>Which Competitive Examination are you preparing for? (Max 1)</Text>
                    {competitiveExamOptions.map(({ id, label: examName }) => {
                      const examNode = filteredExams.find((exam) => exam.id === id) || examByName[normalizeText(examName)];
                      const selected = normalizeText(academic.competitiveExamName) === normalizeText(examName)
                        || (examNode?.id && academic.competitiveExamId === examNode.id);
                      return (
                        <TouchableOpacity
                          key={examName}
                          style={[styles.ratingOption, selected && styles.ratingOptionOn]}
                          onPress={() => setAcademic((a) => ({
                            ...a,
                            competitiveExamId: examNode?.id || null,
                            competitiveExamName: examName,
                            entranceExamIds: [],
                          }))}
                        >
                          <View style={[styles.radioOuter, selected && styles.radioOuterOn]}>
                            {selected ? <View style={styles.radioInner} /> : null}
                          </View>
                          <Text style={styles.ratingText}>{examName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {entranceExamOptions.length > 0 ? (
                      <>
                        <Text style={styles.subHeader}>Entrance Exams under {academic.competitiveExamName || (selectedExam?.name || selectedExam?.title || 'selected category')}</Text>
                        {entranceExamOptions.map((ee) => {
                          const id = ee.id;
                          const checked = academic.entranceExamIds.includes(id);
                          const disableNew = !checked && academic.entranceExamIds.length >= 2;
                          return (
                            <Tick
                              key={String(id)}
                              checked={checked}
                              label={ee.name || ee.title || String(id)}
                              disabled={disableNew}
                              accessibilityHint={disableNew ? 'Maximum 2 entrance exams can be selected' : undefined}
                              onPress={() => setAcademic((a) => ({
                                ...a,
                                entranceExamIds: checked
                                  ? a.entranceExamIds.filter((x) => x !== id)
                                  : [...a.entranceExamIds, id],
                              }))}
                            />
                          );
                        })}
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : null}

            {/* ─── Skills Edge ──────────────────────────────────────── */}
            {active === 'skillsedge' ? (
              <>
                <Text style={styles.subHeader}>Which of these skills are important for your future career? <Text style={styles.required}>*</Text></Text>
                <View style={styles.skillsGrid}>
                  {skillsEdgeOptions.map((skillOpt) => {
                    const selected = skills.selectedSkillIds.includes(skillOpt.id);
                    return (
                      <TouchableOpacity
                        key={skillOpt.id}
                        style={[styles.skillCard, selected && styles.skillCardOn, skills.locked && styles.disabled]}
                        disabled={skills.locked}
                        onPress={() => setSkills((prev) => ({
                          ...prev,
                          selectedSkillIds: selected
                            ? prev.selectedSkillIds.filter((x) => x !== skillOpt.id)
                            : [...prev.selectedSkillIds, skillOpt.id],
                        }))}
                      >
                        <Text style={styles.skillEmoji}>{skillOpt.emoji}</Text>
                        <Text style={styles.skillLabel}>{skillOpt.label}</Text>
                        <View style={[styles.tickBox, selected && styles.tickBoxActive]}>{selected ? <Text style={styles.tickText}>✓</Text> : null}</View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.subHeader}>English Communication Rating</Text>
                {COMMUNICATION_ROWS.map((row) => (
                  <View key={row} style={styles.ratingRow}>
                    <Text style={styles.ratingLabel}>{row}</Text>
                    <View style={styles.ratingOptions}>
                      {COMMUNICATION_LEVELS.map((level) => {
                        const activeRating = skills.communicationRatings[row] === level;
                        return (
                          <TouchableOpacity
                            key={level}
                            style={[styles.ratingOption, activeRating && styles.ratingOptionOn, skills.locked && styles.disabled]}
                            disabled={skills.locked}
                            onPress={() => setSkills((prev) => ({
                              ...prev,
                              communicationRatings: { ...prev.communicationRatings, [row]: level },
                            }))}
                          >
                            <View style={[styles.radioOuter, activeRating && styles.radioOuterOn]}>
                              {activeRating ? <View style={styles.radioInner} /> : null}
                            </View>
                            <Text style={styles.ratingText}>{level}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <Text style={styles.tip}>{skills.locked ? 'Selections locked' : 'Selections not saved yet'}</Text>
              </>
            ) : null}

            {active === 'university' ? (
              <>
                <Select label="Where do you want to study?" required value={university.country} setValue={(v) => setUniversity((u) => ({ ...u, country: v, state: v === 'India' ? u.state : '' }))} options={COUNTRIES} />
                {university.country === 'India' ? (
                  <Select label="Select State (India)" required value={university.state} setValue={(v) => setUniversity((u) => ({ ...u, state: v }))} options={INDIAN_STATES} />
                ) : null}
                <Field label="University Preference 1" required value={university.universityPreference1} onChangeText={(v) => setUniversity((u) => ({ ...u, universityPreference1: v }))} />
                <Field label="Course Preference 1" required value={university.coursePreference1} onChangeText={(v) => setUniversity((u) => ({ ...u, coursePreference1: v }))} />
                <Field label="University Preference 2" value={university.universityPreference2} onChangeText={(v) => setUniversity((u) => ({ ...u, universityPreference2: v }))} />
                <Field label="Course Preference 2" value={university.coursePreference2} onChangeText={(v) => setUniversity((u) => ({ ...u, coursePreference2: v }))} />
                <Field
                  label="Personal Statement (250 – 500 words)" required
                  multiline
                  numberOfLines={6}
                  value={university.personalStatement}
                  onChangeText={(v) => setUniversity((u) => ({ ...u, personalStatement: v }))}
                />
                <Text style={styles.counter}>Words: {countWords(university.personalStatement)} / 500</Text>
                <Field
                  label="Why do you want to pursue this course/career? (max 200 words)" required
                  multiline
                  numberOfLines={5}
                  value={university.careerReason}
                  onChangeText={(v) => setUniversity((u) => ({ ...u, careerReason: v }))}
                />
                <Text style={styles.counter}>Words: {countWords(university.careerReason)} / 200</Text>
              </>
            ) : null}

            {active === 'education' ? (
              <>
                <Field label="Class 10 School Name" required value={education.class10School} onChangeText={(v) => setEducation((e) => ({ ...e, class10School: v }))} />
                <Field label="Class 10 Year of Passing" required maxLength={4} keyboardType="number-pad" value={education.class10Year} onChangeText={(v) => setEducation((e) => ({ ...e, class10Year: v }))} />
                <Field label="Class 10 Percentage" required keyboardType="decimal-pad" value={education.class10Percentage} onChangeText={(v) => setEducation((e) => ({ ...e, class10Percentage: v }))} />
                <Select label="Have you taken any English Proficiency Test (IELTS/TOEFL)?" required value={education.englishTestTaken} setValue={(v) => setEducation((e) => ({ ...e, englishTestTaken: v }))} options={['Yes', 'No']} />
                {education.englishTestTaken === 'Yes' ? (
                  <>
                    <Field label="IELTS Score" keyboardType="decimal-pad" value={education.ieltsScore} onChangeText={(v) => setEducation((e) => ({ ...e, ieltsScore: v }))} />
                    <Field label="TOEFL Score" keyboardType="number-pad" value={education.toeflScore} onChangeText={(v) => setEducation((e) => ({ ...e, toeflScore: v }))} />
                    <Field label="English Certificate Number" value={education.englishCertificateNumber} onChangeText={(v) => setEducation((e) => ({ ...e, englishCertificateNumber: v }))} />
                  </>
                ) : null}
              </>
            ) : null}

            {active === 'additional' ? (
              <>
                <Field label="Hobbies" value={additional.hobbies} onChangeText={(v) => setAdditional((a) => ({ ...a, hobbies: v }))} multiline />
                <Field label="Achievements" value={additional.achievements} onChangeText={(v) => setAdditional((a) => ({ ...a, achievements: v }))} multiline />
                <Field label="Volunteer Work" value={additional.volunteerWork} onChangeText={(v) => setAdditional((a) => ({ ...a, volunteerWork: v }))} multiline />
                <Field label="LinkedIn URL" value={additional.linkedinUrl} onChangeText={(v) => setAdditional((a) => ({ ...a, linkedinUrl: v }))} />
                <Field label="Portfolio URL" value={additional.portfolioUrl} onChangeText={(v) => setAdditional((a) => ({ ...a, portfolioUrl: v }))} />
                <Field label="About Me" value={additional.aboutMe} onChangeText={(v) => setAdditional((a) => ({ ...a, aboutMe: v }))} multiline />
              </>
            ) : null}

            {error ? <Text style={styles.err}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.save, (saving || (active === 'skillsedge' && skills.locked)) && styles.disabled]}
              disabled={
                saving
                || (active === 'skillsedge' && skills.locked)
                || (active === 'personal' && personalSubTab === 'information' && personalInfoLoading)
                || (active === 'personal' && personalSubTab === 'reflection' && reflectionLoading)
              }
              onPress={save}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.saveTxt}>
                  {active === 'personal'
                    ? (personalSubTab === 'reflection' ? 'Save Student Reflection' : 'Save Personal Information')
                    : active === 'skillsedge'
                      ? (skills.locked ? 'Selections Saved' : 'Save & Continue')
                      : 'Save & Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  headerBtn: { minWidth: 64, paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bgCard },
  headerBtnText: { color: STUDENT.textPrimary, fontWeight: '700' },
  title: { color: STUDENT.textPrimary, fontWeight: '800', fontSize: 17 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { maxHeight: 52, paddingHorizontal: 10 },
  tab: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14, marginRight: 8, alignSelf: 'center' },
  tabActive: { backgroundColor: 'rgba(79,70,229,0.35)', borderColor: STUDENT.accent },
  tabInactive: { backgroundColor: 'rgba(168,0,54,0.16)', borderColor: 'rgba(168,0,54,0.6)' },
  tabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  subTabs: { flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 4 },
  subTab: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bgCard, paddingVertical: 8, alignItems: 'center' },
  subTabActive: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(6, 182, 212, 0.15)' },
  subTabText: { color: STUDENT.textSecondary, fontSize: 12, fontWeight: '700' },
  subTabTextActive: { color: STUDENT.textPrimary },
  inlineLoader: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  inlineErrorWrap: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, padding: 10, marginBottom: 12 },
  retryBtn: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: STUDENT.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: STUDENT.bg },
  retryBtnText: { color: STUDENT.textPrimary, fontWeight: '700', fontSize: 12 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 12, paddingBottom: 24 },
  group: { marginBottom: 12 },
  label: { color: STUDENT.textSecondary, marginBottom: 4, fontWeight: '600', fontSize: 13 },
  labelError: { color: '#a80036' },
  required: { color: '#a80036' },
  input: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: STUDENT.textPrimary, backgroundColor: STUDENT.bgCard },
  inputError: { borderColor: '#a80036' },
  dateText: { color: STUDENT.textPrimary },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  selectWrap: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, overflow: 'hidden' },
  picker: { color: STUDENT.textPrimary },
  readOnly: { justifyContent: 'center' },
  readOnlyText: { color: STUDENT.textMuted },
  sectionHeader: { color: '#ffffff', fontWeight: '800', fontSize: 15, marginBottom: 10, marginTop: 6, backgroundColor: '#162a6a', padding: 8, borderRadius: 8 },
  sectionHeaderDark: { color: '#ffffff', fontWeight: '800', fontSize: 15, marginBottom: 10, marginTop: 6, backgroundColor: '#162a6a', padding: 8, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: STUDENT.accentCyan },
  subHeader: { color: STUDENT.accentCyan, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  subHeaderSm: { color: STUDENT.accentGold, fontWeight: '600', fontSize: 12, marginBottom: 4, marginTop: 4, paddingLeft: 8 },
  mutedHint: { color: STUDENT.textMuted, fontStyle: 'italic', fontSize: 13, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: STUDENT.bgCard },
  chipOn: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.35)' },
  chipTxt: { color: STUDENT.textSecondary, fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700' },
  yesNoRow: { flexDirection: 'row', marginBottom: 8 },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  skillCard: { width: '48%', borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, padding: 10 },
  skillCardOn: { borderColor: STUDENT.accentCyan },
  skillEmoji: { fontSize: 18, marginBottom: 6 },
  skillLabel: { color: STUDENT.textPrimary, fontWeight: '600', marginBottom: 8, minHeight: SKILL_LABEL_MIN_HEIGHT },
  ratingRow: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, padding: 10, marginBottom: 8 },
  ratingLabel: { color: STUDENT.textPrimary, fontWeight: '700', marginBottom: 6 },
  ratingOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratingOption: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: STUDENT.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: STUDENT.bg },
  ratingOptionOn: { borderColor: STUDENT.accentCyan, backgroundColor: 'rgba(22,163,74,0.18)' },
  ratingText: { color: STUDENT.textPrimary, fontSize: 12 },
  radioOuter: { width: 14, height: 14, borderRadius: 999, borderWidth: 1, borderColor: STUDENT.textMuted, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  radioOuterOn: { borderColor: STUDENT.accentCyan },
  radioInner: { width: 7, height: 7, borderRadius: 999, backgroundColor: STUDENT.accentCyan },
  tickRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, padding: 10, marginBottom: 8 },
  tickRowActive: { borderColor: STUDENT.accentCyan },
  tickBox: { width: 20, height: 20, borderWidth: 1, borderColor: STUDENT.textMuted, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  tickBoxActive: { backgroundColor: STUDENT.accentGreen, borderColor: STUDENT.accentGreen },
  tickText: { color: '#fff', fontWeight: '800' },
  tickLabel: { color: STUDENT.textPrimary, flex: 1 },
  important: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: STUDENT.border },
  importantOn: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.2)' },
  importantTxt: { color: STUDENT.textMuted, fontSize: 12 },
  importantTxtOn: { color: '#f59e0b', fontWeight: '700' },
  counter: { color: STUDENT.textMuted, fontSize: 12, marginTop: -8, marginBottom: 10, textAlign: 'right' },
  tip: { color: '#f59e0b', fontSize: 12, marginBottom: 8 },
  err: { color: '#a80036', marginBottom: 10, fontSize: 12 },
  save: { borderRadius: 10, backgroundColor: STUDENT.accentGreen, alignItems: 'center', paddingVertical: 13, marginTop: 6 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawer: { width: 315, height: '100%', backgroundColor: STUDENT.bgCard, borderRightWidth: 1, borderRightColor: STUDENT.border, padding: 14 },
  closeBtn: { alignSelf: 'flex-end', padding: 2 },
  closeTxt: { color: '#fff', fontSize: 18 },
  drawerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  progressLabel: { color: STUDENT.textSecondary, marginBottom: 6 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#d4d4d4', overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', backgroundColor: '#2ea043' },
  subTitle: { color: STUDENT.textPrimary, fontWeight: '700', marginBottom: 8 },
  mediaCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: STUDENT.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 },
  mediaImg: { width: '100%', height: '100%' },
  actionBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  greenBtn: { backgroundColor: STUDENT.accentGreen },
  redBtn: { backgroundColor: 'rgba(251,113,133,0.18)', borderWidth: 1, borderColor: '#fb7185' },
  actionTxt: { color: '#fff', fontWeight: '700' },
  redTxt: { color: '#fb7185', fontWeight: '700' },
  videoTile: { borderWidth: 1, borderColor: STUDENT.border, backgroundColor: STUDENT.bg, borderRadius: 10, padding: 10, alignItems: 'center', marginBottom: 8 },
  videoIcon: { fontSize: 30 },
  videoMsg: { color: STUDENT.textSecondary, fontSize: 12, marginTop: 4 },
  note: { color: STUDENT.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
