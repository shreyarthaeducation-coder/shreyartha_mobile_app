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
const MAX_IMPORTANT_SKILLS = 2;
const canSelectImportantSkills = (count) => count < MAX_IMPORTANT_SKILLS;

const unwrap = (value) => (value?.data && typeof value.data === 'object' ? value.data : value || {});
const arr = (value) => (Array.isArray(value) ? value : value ? [value] : []);

function Field({ label, required, ...props }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        {...props}
        style={[styles.input, props.multiline && styles.multiline]}
        placeholderTextColor={STUDENT.textMuted}
      />
    </View>
  );
}

function Select({ label, value, setValue, options, required }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.selectWrap}>
        <Picker
          selectedValue={value}
          onValueChange={(next) => setValue(next)}
          style={styles.picker}
          dropdownIconColor={STUDENT.textPrimary}
        >
          <Picker.Item label="Select" value="" />
          {options.map((option) => (
            <Picker.Item key={String(option.value ?? option)} label={option.label ?? option} value={option.value ?? option} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function Tick({ checked, label, onPress }) {
  return (
    <Pressable style={[styles.tickRow, checked && styles.tickRowActive]} onPress={onPress}>
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
  const [personalLocked, setPersonalLocked] = useState(false);
  const [error, setError] = useState('');
  const [media, setMedia] = useState({ pictureUrl: '', videoUrl: '' });

  const [personal, setPersonal] = useState({ fullName: '', email: '', mobile: '', dob: '', gender: '', schoolName: '', board: '', className: '', address: '', curriculum: '', studentType: '' });
  const [survey, setSurvey] = useState({ queryFor: '', queryDetails: '' });
  const [academic, setAcademic] = useState({ id: null, curriculum: '', className: '', selectedChapterIds: [], selectedTopicIds: [], competitiveExamIds: [], targetYear: '' });
  const [skills, setSkills] = useState({ id: null, selectedSkillIds: [], importantSkillIds: [] });
  const [university, setUniversity] = useState({ id: null, preferredCountries: [], intendedCourse: '', intakeYear: '', budgetRange: '' });
  const [education, setEducation] = useState({ id: null, class10School: '', class10Year: '', class10Percentage: '', class12School: '', class12Year: '', class12Percentage: '', englishTestTaken: '', englishCertificateNumber: '' });
  const [additional, setAdditional] = useState({ id: null, hobbies: '', achievements: '', volunteerWork: '', linkedinUrl: '', portfolioUrl: '', aboutMe: '' });
  const [completed, setCompleted] = useState({ personal: false, academic: false, skillsedge: false, university: false, education: false, additional: false });

  const [tree, setTree] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  const [hiddenTopicIds, setHiddenTopicIds] = useState([]);
  const [hiddenExamIds, setHiddenExamIds] = useState([]);
  const [skillsTree, setSkillsTree] = useState([]);

  const progress = useMemo(() => (Object.values(completed).filter(Boolean).length / TABS.length) * 100, [completed]);

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
    setCompleted({
      personal: Boolean((pD.fullName || pD.name || pD.studentName) && (pD.mobile || pD.phone) && pD.email),
      academic: Boolean((aD.curriculum || aD.curriculumName) && (aD.className || aD.class) && arr(aD.selectedTopicIds || aD.topicIds).length),
      skillsedge: Boolean(arr(sD.selectedSkillIds || sD.skillIds).length && arr(sD.importantSkillIds || sD.topSkillIds).length),
      university: Boolean(arr(uD.preferredCountries || uD.countries).length && uD.intendedCourse),
      education: Boolean(eD.class10School && eD.class10Year && eD.class10Percentage && (eD.englishTestTaken !== 'Yes' || eD.englishCertificateNumber)),
      additional: Boolean(adD.hobbies || adD.achievements || adD.aboutMe),
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, surveyRes, aTreeRes, examRes, aRes, sTreeRes, sRes, uRes, eRes, adRes, hTopicRes, hExamRes] = await Promise.all([
        studentService.getProfile(),
        studentService.getStudentSurvey().catch(() => ({})),
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

      const p = unwrap(pRes); const sv = unwrap(surveyRes); const aTree = unwrap(aTreeRes); const a = unwrap(aRes); const sTree = unwrap(sTreeRes);
      const s = unwrap(sRes); const u = unwrap(uRes); const e = unwrap(eRes); const ad = unwrap(adRes);
      setPersonal({
        fullName: p.fullName || p.name || p.studentName || '',
        email: p.email || '',
        mobile: p.mobile || p.phone || '',
        dob: p.dob || p.dateOfBirth || '',
        gender: p.gender || '',
        schoolName: p.schoolName || p.school || '',
        board: p.board || '',
        className: p.className || p.class || '',
        address: p.address || '',
        curriculum: p.curriculum || '', studentType: p.studentType || '',
      });
      setPersonalLocked(Boolean(p.personalLocked || p.personalDetailsSaved || p.isProfileSubmitted));
      setMedia({ pictureUrl: p.profilePictureUrl || p.pictureUrl || p.avatar || '', videoUrl: p.profileVideoUrl || p.videoUrl || '' });
      setSurvey({ queryFor: sv.queryFor || '', queryDetails: sv.queryDetails || '' });

      const curriculumNodes = arr(aTree.curriculums || aTree.nodes || aTree.children || aTree).filter(Boolean);
      setTree(curriculumNodes);
      const selectedCurriculum = curriculumNodes.find((x) => (x.name || x.title) === (a.curriculum || p.curriculum));
      const classNodes = arr(selectedCurriculum?.classes || selectedCurriculum?.children);
      const selectedClassNode = classNodes.find((x) => (x.name || x.title) === (a.className || p.className || p.class));
      setChapters(arr(selectedClassNode?.chapters || selectedClassNode?.children || []));
      setTopics(arr(selectedClassNode?.topics || selectedClassNode?.children || []));
      setExams(arr(unwrap(examRes).exams || unwrap(examRes)));
      setHiddenTopicIds(arr(unwrap(hTopicRes).hiddenNodeIds || unwrap(hTopicRes)));
      setHiddenExamIds(arr(unwrap(hExamRes).hiddenNodeIds || unwrap(hExamRes)));

      setAcademic({
        id: a.id || null, curriculum: a.curriculum || p.curriculum || '', className: a.className || p.className || p.class || '',
        selectedChapterIds: arr(a.selectedChapterIds || a.chapterIds), selectedTopicIds: arr(a.selectedTopicIds || a.topicIds),
        competitiveExamIds: arr(a.competitiveExamIds || a.examIds), targetYear: a.targetYear ? String(a.targetYear) : '',
      });
      setSkills({ id: s.id || null, selectedSkillIds: arr(s.selectedSkillIds || s.skillIds), importantSkillIds: arr(s.importantSkillIds || s.topSkillIds) });
      setSkillsTree(arr(sTree.skills || sTree.nodes || sTree.children || sTree));
      setUniversity({ id: u.id || null, preferredCountries: arr(u.preferredCountries || u.countries), intendedCourse: u.intendedCourse || '', intakeYear: u.intakeYear ? String(u.intakeYear) : '', budgetRange: u.budgetRange || '' });
      setEducation({ id: e.id || null, class10School: e.class10School || '', class10Year: e.class10Year ? String(e.class10Year) : '', class10Percentage: e.class10Percentage ? String(e.class10Percentage) : '', class12School: e.class12School || '', class12Year: e.class12Year ? String(e.class12Year) : '', class12Percentage: e.class12Percentage ? String(e.class12Percentage) : '', englishTestTaken: e.englishTestTaken || '', englishCertificateNumber: e.englishCertificateNumber || '' });
      setAdditional({ id: ad.id || null, hobbies: ad.hobbies || '', achievements: ad.achievements || '', volunteerWork: ad.volunteerWork || '', linkedinUrl: ad.linkedinUrl || '', portfolioUrl: ad.portfolioUrl || '', aboutMe: ad.aboutMe || '' });
      await fetchCompletion();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  }, [fetchCompletion]);

  useEffect(() => { load(); }, [load]);

  const pickMedia = async (kind) => {
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
  };

  const save = async () => {
    setError('');
    if (active === 'skillsedge' && skills.importantSkillIds.length > MAX_IMPORTANT_SKILLS) {
      return setError(`Choose at most ${MAX_IMPORTANT_SKILLS} important skills.`);
    }
    if (active === 'education' && education.englishTestTaken === 'Yes' && !education.englishCertificateNumber.trim()) return setError('English certificate number is required.');
    setSaving(true);
    try {
      if (active === 'personal') {
        await studentService.updateProfile(personal);
        await studentService.saveStudentSurvey(survey);
        setPersonalLocked(true);
      }
      if (active === 'academic') await (academic.id ? studentService.updateAcademicProfile(academic) : studentService.createAcademicProfile(academic));
      if (active === 'skillsedge') await (skills.id ? studentService.updateSkillsProfile(skills) : studentService.createSkillsProfile(skills));
      if (active === 'university') await (university.id ? studentService.updateUniversityProfile(university) : studentService.createUniversityProfile(university));
      if (active === 'education') await (education.id ? studentService.updateEducationProfile(education) : studentService.createEducationProfile(education));
      if (active === 'additional') await (additional.id ? studentService.updateAdditionalProfile(additional) : studentService.createAdditionalProfile(additional));
      await fetchCompletion();
      Alert.alert('Saved', 'Section saved successfully.');
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Could not save this section.');
    } finally {
      setSaving(false);
    }
  };

  const autoAcademicLocked = personal.studentType?.toUpperCase() === 'SCHOOL' && personal.curriculum && personal.className;
  const skillNodes = arr(skillsTree.flatMap((x) => arr(x.children?.length ? x.children : x))).filter(Boolean);
  const selectedCurriculumNode = tree.find((x) => (x.name || x.title) === academic.curriculum);
  const selectedClassOptions = arr(selectedCurriculumNode?.classes || selectedCurriculumNode?.children);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        progress={progress}
        media={media}
        onPhotoPick={() => pickMedia('image')}
        onPhotoDelete={async () => { await studentService.deleteProfilePicture(); await load(); }}
        onVideoPick={() => pickMedia('video')}
        onVideoDelete={async () => { await studentService.deleteProfileVideo(); await load(); }}
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
              <TouchableOpacity key={tab.key} style={[styles.tab, active === tab.key ? styles.tabActive : styles.tabInactive]} onPress={() => setActive(tab.key)}>
                <Text style={[styles.tabText, active === tab.key && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {active === 'personal' ? (
              <>
                <Field label="Full Name" required editable={!personalLocked} value={personal.fullName} onChangeText={(v) => setPersonal((p) => ({ ...p, fullName: v }))} />
                <Field label="Email" required editable={!personalLocked} value={personal.email} onChangeText={(v) => setPersonal((p) => ({ ...p, email: v }))} />
                <Field label="Mobile Number" required editable={!personalLocked} maxLength={15} keyboardType="phone-pad" value={personal.mobile} onChangeText={(v) => setPersonal((p) => ({ ...p, mobile: v }))} />
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowDob(true)}
                  disabled={personalLocked}
                  accessibilityRole="button"
                  accessibilityLabel="Select date of birth"
                >
                  <Text style={styles.dateText}>{personal.dob || 'Date of Birth'}</Text>
                </TouchableOpacity>
                {showDob ? (
                  <DateTimePicker
                    value={personal.dob ? new Date(personal.dob) : new Date()}
                    mode="date"
                    maximumDate={new Date()}
                    onChange={(_, d) => {
                      setShowDob(Platform.OS === 'ios');
                      if (d) {
                        setPersonal((p) => ({ ...p, dob: d.toISOString().slice(0, 10) }));
                      }
                    }}
                  />
                ) : null}
                <Select label="Gender" value={personal.gender} setValue={(v) => setPersonal((p) => ({ ...p, gender: v }))} options={['Male', 'Female', 'Other']} />
                <Field label="School Name" value={personal.schoolName} onChangeText={(v) => setPersonal((p) => ({ ...p, schoolName: v }))} />
                <Field label="Board" value={personal.board} onChangeText={(v) => setPersonal((p) => ({ ...p, board: v }))} />
                <Field label="Class" value={personal.className} onChangeText={(v) => setPersonal((p) => ({ ...p, className: v }))} />
                <Field label="Address" value={personal.address} onChangeText={(v) => setPersonal((p) => ({ ...p, address: v }))} multiline />
                <Select label="Query For" value={survey.queryFor} setValue={(v) => setSurvey((s) => ({ ...s, queryFor: v }))} options={['Profile', 'Academic', 'Career', 'Financial Aid']} />
                <Field label="Query Details" value={survey.queryDetails} onChangeText={(v) => setSurvey((s) => ({ ...s, queryDetails: v }))} multiline />
                {personalLocked ? <Text style={styles.tip}>Core personal fields are locked after first save.</Text> : null}
              </>
            ) : null}

            {active === 'academic' ? (
              <>
                <Text style={styles.subHeader}>Curriculum</Text>
                <View style={styles.chips}>
                  {tree.map((node) => {
                    const label = node.name || node.title || String(node.id);
                    return (
                      <TouchableOpacity
                        key={String(node.id || label)}
                        style={[styles.chip, academic.curriculum === label && styles.chipOn, autoAcademicLocked && styles.disabled]}
                        disabled={autoAcademicLocked}
                        onPress={() => setAcademic((a) => ({ ...a, curriculum: label }))}
                      ><Text style={[styles.chipTxt, academic.curriculum === label && styles.chipTxtOn]}>{label}</Text></TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.subHeader}>Class</Text>
                <View style={styles.chips}>
                  {selectedClassOptions.map((cls) => {
                    const label = cls.name || cls.title || String(cls.id);
                    return (
                      <TouchableOpacity
                        key={String(cls.id || label)}
                        style={[
                          styles.chip,
                          academic.className === label && styles.chipOn,
                          autoAcademicLocked && styles.disabled,
                        ]}
                        disabled={autoAcademicLocked}
                        onPress={() => setAcademic((a) => ({ ...a, className: label }))}
                      >
                        <Text style={[styles.chipTxt, academic.className === label && styles.chipTxtOn]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.subHeader}>Chapters</Text>
                {arr(chapters).map((ch) => {
                  const id = ch.id || ch.name; const checked = academic.selectedChapterIds.includes(id);
                  return <Tick key={String(id)} checked={checked} label={ch.name || ch.title || String(id)} onPress={() => setAcademic((a) => ({ ...a, selectedChapterIds: checked ? a.selectedChapterIds.filter((x) => x !== id) : [...a.selectedChapterIds, id] }))} />;
                })}
                <Text style={styles.subHeader}>Topics</Text>
                {arr(topics).filter((t) => !hiddenTopicIds.includes(t.id || t.name)).map((topic) => {
                  const id = topic.id || topic.name; const checked = academic.selectedTopicIds.includes(id);
                  return <Tick key={String(id)} checked={checked} label={topic.name || topic.title || String(id)} onPress={() => setAcademic((a) => ({ ...a, selectedTopicIds: checked ? a.selectedTopicIds.filter((x) => x !== id) : [...a.selectedTopicIds, id] }))} />;
                })}
                <Select label="Target Year" value={academic.targetYear} setValue={(v) => setAcademic((a) => ({ ...a, targetYear: v }))} options={YEAR_OPTIONS} />
                <Text style={styles.subHeader}>Competitive Exams</Text>
                {arr(exams).filter((x) => !hiddenExamIds.includes(x.id || x.name)).map((exam) => {
                  const id = exam.id || exam.name; const checked = academic.competitiveExamIds.includes(id);
                  return <Tick key={String(id)} checked={checked} label={exam.name || exam.title || String(id)} onPress={() => setAcademic((a) => ({ ...a, competitiveExamIds: checked ? a.competitiveExamIds.filter((x) => x !== id) : [...a.competitiveExamIds, id] }))} />;
                })}
              </>
            ) : null}

            {active === 'skillsedge' ? (
              <>
                {skillNodes.map((node) => {
                  const id = node.id || node.name;
                  const selected = skills.selectedSkillIds.includes(id);
                  const important = skills.importantSkillIds.includes(id);
                  return (
                    <View key={String(id)}>
                      <Tick checked={selected} label={node.name || node.title || String(id)} onPress={() => setSkills((s) => ({ ...s, selectedSkillIds: selected ? s.selectedSkillIds.filter((x) => x !== id) : [...s.selectedSkillIds, id], importantSkillIds: selected ? s.importantSkillIds.filter((x) => x !== id) : s.importantSkillIds }))} />
                      <TouchableOpacity
                        disabled={!selected}
                        style={[styles.important, important && styles.importantOn, !selected && styles.disabled]}
                        onPress={() => setSkills((s) => {
                          if (important) return { ...s, importantSkillIds: s.importantSkillIds.filter((x) => x !== id) };
                          if (!canSelectImportantSkills(s.importantSkillIds.length)) {
                            setError(`Choose at most ${MAX_IMPORTANT_SKILLS} important skills.`);
                            return s;
                          }
                          return { ...s, importantSkillIds: [...s.importantSkillIds, id] };
                        })}
                      ><Text style={[styles.importantTxt, important && styles.importantTxtOn]}>Important</Text></TouchableOpacity>
                    </View>
                  );
                })}
                <Text style={styles.tip}>Choose up to {MAX_IMPORTANT_SKILLS} important skills.</Text>
              </>
            ) : null}

            {active === 'university' ? (
              <>
                <Text style={styles.subHeader}>Preferred Countries</Text>
                {COUNTRIES.map((country) => {
                  const selected = university.preferredCountries.includes(country);
                  return <Tick key={country} checked={selected} label={country} onPress={() => setUniversity((u) => ({ ...u, preferredCountries: selected ? u.preferredCountries.filter((x) => x !== country) : [...u.preferredCountries, country] }))} />;
                })}
                <Field label="Preferred Course" required value={university.intendedCourse} onChangeText={(v) => setUniversity((u) => ({ ...u, intendedCourse: v }))} />
                <Select label="Preferred Intake Year" value={university.intakeYear} setValue={(v) => setUniversity((u) => ({ ...u, intakeYear: v }))} options={YEAR_OPTIONS} />
                <Field label="Budget Range" value={university.budgetRange} onChangeText={(v) => setUniversity((u) => ({ ...u, budgetRange: v }))} />
              </>
            ) : null}

            {active === 'education' ? (
              <>
                <Field label="Class 10 School" required value={education.class10School} onChangeText={(v) => setEducation((e) => ({ ...e, class10School: v }))} />
                <Field label="Class 10 Year" required maxLength={4} keyboardType="number-pad" value={education.class10Year} onChangeText={(v) => setEducation((e) => ({ ...e, class10Year: v }))} />
                <Field label="Class 10 Percentage" required keyboardType="decimal-pad" value={education.class10Percentage} onChangeText={(v) => setEducation((e) => ({ ...e, class10Percentage: v }))} />
                <Field label="Class 12 School" value={education.class12School} onChangeText={(v) => setEducation((e) => ({ ...e, class12School: v }))} />
                <Field label="Class 12 Year" maxLength={4} keyboardType="number-pad" value={education.class12Year} onChangeText={(v) => setEducation((e) => ({ ...e, class12Year: v }))} />
                <Field label="Class 12 Percentage" keyboardType="decimal-pad" value={education.class12Percentage} onChangeText={(v) => setEducation((e) => ({ ...e, class12Percentage: v }))} />
                <Select label="English Test Taken" required value={education.englishTestTaken} setValue={(v) => setEducation((e) => ({ ...e, englishTestTaken: v }))} options={['Yes', 'No']} />
                {education.englishTestTaken === 'Yes' ? <Field label="English Certificate Number" required value={education.englishCertificateNumber} onChangeText={(v) => setEducation((e) => ({ ...e, englishCertificateNumber: v }))} /> : null}
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
            <TouchableOpacity style={[styles.save, saving && styles.disabled]} disabled={saving} onPress={save}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>Save</Text>}
            </TouchableOpacity>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: STUDENT.bg },
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
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 12, paddingBottom: 24 },
  group: { marginBottom: 12 },
  label: { color: STUDENT.textSecondary, marginBottom: 4, fontWeight: '600', fontSize: 13 },
  required: { color: '#a80036' },
  input: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: STUDENT.textPrimary, backgroundColor: STUDENT.bgCard },
  dateText: { color: STUDENT.textPrimary },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  selectWrap: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 10, backgroundColor: STUDENT.bgCard, overflow: 'hidden' },
  picker: { color: STUDENT.textPrimary },
  subHeader: { color: STUDENT.accentCyan, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: STUDENT.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: STUDENT.bgCard },
  chipOn: { borderColor: STUDENT.accent, backgroundColor: 'rgba(79,70,229,0.35)' },
  chipTxt: { color: STUDENT.textSecondary, fontSize: 12 },
  chipTxtOn: { color: '#fff', fontWeight: '700' },
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
