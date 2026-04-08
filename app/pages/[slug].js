import { useLocalSearchParams } from 'expo-router';
import LearningAssessmentScreen from './screens/LearningAssessmentScreen';
import SkillsLearningScreen from './screens/SkillsLearningScreen';
import StudentsProfileScreen from './screens/StudentsProfileScreen';
import CounsellingScreen from './screens/CounsellingScreen';
import PsychometricSuiteScreen from './screens/PsychometricSuiteScreen';
import SubjectCareerScreen from './screens/SubjectCareerScreen';
import CompetitiveExamScreen from './screens/CompetitiveExamScreen';
import CodingAIRoboticsScreen from './screens/CodingAIRoboticsScreen';
import LanguageLearningScreen from './screens/LanguageLearningScreen';
import GlobalOpportunitiesScreen from './screens/GlobalOpportunitiesScreen';
import ProgressTrackingScreen from './screens/ProgressTrackingScreen';

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
