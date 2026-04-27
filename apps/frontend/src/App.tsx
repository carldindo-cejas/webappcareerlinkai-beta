import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import CheckYourEmail from './pages/CheckYourEmail';
import ProfileBasics from './pages/ProfileBasics';
import StartEvaluation from './pages/StartEvaluation';
import Onboarding from './pages/Onboarding';
import RiasecAssessment from './pages/RiasecAssessment';
import ScctAssessment from './pages/ScctAssessment';
import StudentDashboard from './pages/StudentDashboard';
import StudentResults from './pages/StudentResults';
import StudentDepartments from './pages/StudentDepartments';
import StudentActivity from './pages/StudentActivity';
import StudentAICounselor from './pages/StudentAICounselor';
import StudentSettings from './pages/StudentSettings';
import CounselorDashboard from './pages/CounselorDashboard';
import DepartmentDetail from './pages/DepartmentDetail';
import JoinDepartment from './pages/JoinDepartment';
import CounselorStudentDetail from './pages/CounselorStudentDetail';
import CounselorDepartments from './pages/CounselorDepartments';
import CounselorAnalytics from './pages/CounselorAnalytics';
import CounselorActivity from './pages/CounselorActivity';
import CounselorSettings from './pages/CounselorSettings';
import { useAuth } from './lib/auth';

function Protected({ children, role }: { children: JSX.Element; role?: 'student' | 'counselor' }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-ink-500">Loading…</div>;
  if (!user) return <Navigate to="/signin" state={{ from: location }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignIn mode="signup" />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/check-your-email" element={<CheckYourEmail />} />

      <Route path="/profile/basics" element={<Protected role="student"><ProfileBasics /></Protected>} />
      <Route path="/start-evaluation" element={<Protected role="student"><StartEvaluation /></Protected>} />
      <Route path="/onboarding" element={<Protected role="student"><Onboarding /></Protected>} />
      <Route path="/assessment/riasec" element={<Protected role="student"><RiasecAssessment /></Protected>} />
      <Route path="/assessment/scct" element={<Protected role="student"><ScctAssessment /></Protected>} />
      <Route path="/portal/student/dashboard" element={<Protected role="student"><StudentDashboard /></Protected>} />
      <Route path="/portal/student/result" element={<Protected role="student"><StudentResults /></Protected>} />
      <Route path="/portal/student/departments" element={<Protected role="student"><StudentDepartments /></Protected>} />
      <Route path="/portal/student/activity" element={<Protected role="student"><StudentActivity /></Protected>} />
      <Route path="/portal/student/ai-counselor" element={<Protected role="student"><StudentAICounselor /></Protected>} />
      <Route path="/portal/student/settings" element={<Protected role="student"><StudentSettings /></Protected>} />
      <Route path="/join/:code" element={<JoinDepartment />} />

      <Route path="/portal/counselor" element={<Protected role="counselor"><CounselorDashboard /></Protected>} />
      <Route path="/portal/counselor/events" element={<Protected role="counselor"><CounselorActivity /></Protected>} />
      <Route path="/portal/counselor/activity" element={<Protected role="counselor"><CounselorActivity /></Protected>} />
      <Route path="/portal/counselor/departments" element={<Protected role="counselor"><CounselorDepartments /></Protected>} />
      <Route path="/portal/counselor/analytics" element={<Protected role="counselor"><CounselorAnalytics /></Protected>} />
      <Route path="/portal/counselor/departments/:id" element={<Protected role="counselor"><DepartmentDetail /></Protected>} />
      <Route path="/portal/counselor/students/:id" element={<Protected role="counselor"><CounselorStudentDetail /></Protected>} />
      <Route path="/portal/counselor/settings" element={<Protected role="counselor"><CounselorSettings /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
