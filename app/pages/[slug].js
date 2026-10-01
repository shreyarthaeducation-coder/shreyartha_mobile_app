import { useLocalSearchParams } from 'expo-router';
import LearningAssessmentScreen from '../../components/pages/screens/LearningAssessmentScreen';
import SkillsLearningScreen from '../../components/pages/screens/SkillsLearningScreen';
import StudentsProfileScreen from '../../components/pages/screens/StudentsProfileScreen';
import CounsellingScreen from '../../components/pages/screens/CounsellingScreen';
import PsychometricSuiteScreen from '../../components/pages/screens/PsychometricSuiteScreen';
import SubjectCareerScreen from '../../components/pages/screens/SubjectCareerScreen';
import CompetitiveExamScreen from '../../components/pages/screens/CompetitiveExamScreen';
import CodingAIRoboticsScreen from '../../components/pages/screens/CodingAIRoboticsScreen';
import LanguageLearningScreen from '../../components/pages/screens/LanguageLearningScreen';
import GlobalOpportunitiesScreen from '../../components/pages/screens/GlobalOpportunitiesScreen';
import ProgressTrackingScreen from '../../components/pages/screens/ProgressTrackingScreen';

const SCREEN_MAP = {
  'learning-assessment': LearningAssessmentScreen,
  'skills-learning': SkillsLearningScreen,
  'students-profile': StudentsProfileScreen,
  'counselling': CounsellingScreen,
  'psychometric-assessment': PsychometricSuiteScreen,
  'subject-career': SubjectCareerScreen,
  'competitive-examination': CompetitiveExamScreen,
  'coding-ai-robotics': CodingAIRoboticsScreen,
  'language-learning': LanguageLearningScreen,
  'global-opportunities': GlobalOpportunitiesScreen,
  'progress-tracking': ProgressTrackingScreen,
};

export default function PageRouter() {
  const { slug } = useLocalSearchParams();
  const Screen = SCREEN_MAP[slug];
  if (!Screen) {
    const FallbackScreen = GlobalOpportunitiesScreen;
    return <FallbackScreen />;
  }
  return <Screen />;
}
