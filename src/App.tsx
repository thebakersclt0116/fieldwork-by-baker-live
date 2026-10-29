import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import FieldworkProfileGate from './components/FieldworkProfileGate';
const FieldworkProfile = lazy(() => import('./pages/FieldworkProfile'));
import PaidFeatureRoute from './components/PaidFeatureRoute';
import AdminFeatureRoute from './components/AdminFeatureRoute';
import PlatformHome from './pages/PlatformHome';
const AcquisitionStart=lazy(()=>import('./pages/AcquisitionStart'));
const AdminFunnel=lazy(()=>import('./pages/AdminFunnel'));
const WorkspacePreview=lazy(()=>import('./pages/WorkspacePreview'));
const Suggestions=lazy(()=>import('./pages/Suggestions'));
const AccountRecovery=lazy(()=>import('./pages/AccountRecovery'));
const AdMeasurementTest=lazy(()=>import('./pages/AdMeasurementTest'));
import { useAuth } from './hooks/useAuth';
import MeasuredTab from './components/MeasuredTab';
import FeatureUsage from './components/FeatureUsage';
import AdMeasurementChoice from './components/AdMeasurementChoice';

const Features = lazy(() => import('./pages/Features'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Enterprise = lazy(() => import('./pages/Enterprise'));
const About = lazy(() => import('./pages/About'));
const Blog = lazy(() => import('./pages/Blog'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Contact = lazy(() => import('./pages/Contact'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard'));
const MyHours = lazy(() => import('./pages/MyHours'));
const AdminArchive = lazy(() => import('./pages/AdminArchive'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const DetailedMigration = lazy(() => import('./pages/DetailedMigration'));
const BakerAI = lazy(() => import('./pages/BakerAI'));
const BakerBrainHub = lazy(() => import('./pages/BakerBrainHub'));
const MyPathV2 = lazy(() => import('./pages/MyPathV2'));
const BCBARoadmap = lazy(() => import('./pages/BCBARoadmap'));
const BakerCommons = lazy(() => import('./pages/BakerCommons'));
const ExamLab = lazy(() => import('./pages/ExamLab'));
const ResourceVault = lazy(() => import('./pages/ResourceVault'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const UpgradeSuccess = lazy(() => import('./pages/UpgradeSuccess'));
const ExportCenter = lazy(() => import('./pages/ExportCenter'));
const SupervisorView = lazy(() => import('./pages/SupervisorView'));
const ApplySupervisorFeedback = lazy(() => import('./pages/ApplySupervisorFeedback'));
const AdminSupervisorPreview = lazy(() => import('./pages/AdminSupervisorPreview'));
const AdminLaunchCheck = lazy(() => import('./pages/AdminLaunchCheck'));
const Legal = lazy(() => import('./pages/Legal'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-[#FFFCF9] text-sm text-[#A8998E]" role="status">
      Loading Fieldwork by Baker…
    </div>
  );
}

function AccountDashboard() {
  const { hasPaidFeatures } = useAuth();
  if (!hasPaidFeatures) return <WorkspacePreview />;
  return <MyHours />;
}

function HomeRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <RouteFallback />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <PlatformHome />;
}

export default function App() {
  return (
    <>
    <FeatureUsage />
    <Layout>
      <AdMeasurementChoice />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/start" element={<AcquisitionStart />} />
        <Route path="/admin/funnel" element={<ProtectedRoute><AdminFeatureRoute><AdminFunnel /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/archive" element={<ProtectedRoute><AdminFeatureRoute><AdminArchive /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/legacy-dashboard" element={<ProtectedRoute><AdminFeatureRoute><Dashboard /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/legacy-member-dashboard" element={<ProtectedRoute><AdminFeatureRoute><MemberDashboard /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/demo" element={<WorkspacePreview demo />} />
        <Route path="/features" element={<ProtectedRoute><AdminFeatureRoute><Features /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/enterprise" element={<ProtectedRoute><AdminFeatureRoute><Enterprise /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<ProtectedRoute><AdminFeatureRoute><Blog /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/cookies" element={<Legal />} />
        <Route path="/security" element={<Legal />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<AccountRecovery />} />
        <Route path="/reset-password" element={<AccountRecovery />} />

        <Route path="/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
        <Route path="/fieldwork-profile" element={<ProtectedRoute><FieldworkProfile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><MeasuredTab feature="settings"><AccountSettings /></MeasuredTab></ProtectedRoute>} />
        <Route path="/my-path" element={<ProtectedRoute><AdminFeatureRoute><MyPathV2 /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/roadmap" element={<ProtectedRoute><AdminFeatureRoute><BCBARoadmap /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/commons" element={<ProtectedRoute><AdminFeatureRoute><BakerCommons /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/baker-brain" element={<ProtectedRoute><AdminFeatureRoute><BakerBrainHub /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/exam-lab" element={<ProtectedRoute><PaidFeatureRoute><MeasuredTab feature="exam_lab"><ExamLab /></MeasuredTab></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/resources" element={<ProtectedRoute><AdminFeatureRoute><ResourceVault /></AdminFeatureRoute></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><FieldworkProfileGate><MeasuredTab feature="fieldwork"><AccountDashboard /></MeasuredTab></FieldworkProfileGate></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="/upgrade/success" element={<ProtectedRoute><UpgradeSuccess /></ProtectedRoute>} />
        <Route path="/export" element={<ProtectedRoute><FieldworkProfileGate><MeasuredTab feature="exports"><ExportCenter /></MeasuredTab></FieldworkProfileGate></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><FieldworkProfileGate><PaidFeatureRoute><MeasuredTab feature="imports"><DetailedMigration /></MeasuredTab></PaidFeatureRoute></FieldworkProfileGate></ProtectedRoute>} />
        <Route path="/import/ripley" element={<ProtectedRoute><FieldworkProfileGate><PaidFeatureRoute><MeasuredTab feature="imports"><DetailedMigration /></MeasuredTab></PaidFeatureRoute></FieldworkProfileGate></ProtectedRoute>} />
        <Route path="/audit-history" element={<ProtectedRoute><MeasuredTab feature="audit_history"><DetailedMigration /></MeasuredTab></ProtectedRoute>} />
        <Route path="/import-monthly" element={<Navigate to="/import" replace />} />
        <Route path="/baker-ai" element={<ProtectedRoute><AdminFeatureRoute><BakerAI /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/supervisor-preview" element={<ProtectedRoute><AdminFeatureRoute><AdminSupervisorPreview /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/launch-check" element={<ProtectedRoute><AdminFeatureRoute><AdminLaunchCheck /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/ad-measurement-test" element={<ProtectedRoute><AdminFeatureRoute><AdMeasurementTest /></AdminFeatureRoute></ProtectedRoute>} />
        <Route path="/supervisor/:token" element={<SupervisorView />} />
        <Route path="/feedback/:token" element={<ApplySupervisorFeedback />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
    </>
  );
}
