import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PaidFeatureRoute from './components/PaidFeatureRoute';
import PlatformHome from './pages/PlatformHome';
import { useAuth } from './hooks/useAuth';

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
const SmartImportBridge = lazy(() => import('./pages/SmartImportBridge'));
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
  const { isOwner } = useAuth();
  return isOwner ? <Dashboard /> : <MemberDashboard />;
}

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/" element={<PlatformHome />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/cookies" element={<Legal />} />
        <Route path="/security" element={<Legal />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />

        <Route path="/my-path" element={<ProtectedRoute><PaidFeatureRoute><MyPathV2 /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/roadmap" element={<BCBARoadmap />} />
        <Route path="/commons" element={<ProtectedRoute><PaidFeatureRoute><BakerCommons /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/baker-brain" element={<ProtectedRoute><PaidFeatureRoute><BakerBrainHub /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/exam-lab" element={<ProtectedRoute><PaidFeatureRoute><ExamLab /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/resources" element={<ProtectedRoute><PaidFeatureRoute><ResourceVault /></PaidFeatureRoute></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><PaidFeatureRoute><AccountDashboard /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="/upgrade/success" element={<ProtectedRoute><UpgradeSuccess /></ProtectedRoute>} />
        <Route path="/export" element={<ProtectedRoute><ExportCenter /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><PaidFeatureRoute><SmartImportBridge /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/baker-ai" element={<ProtectedRoute><PaidFeatureRoute><BakerAI /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/admin/supervisor-preview" element={<ProtectedRoute><AdminSupervisorPreview /></ProtectedRoute>} />
        <Route path="/admin/launch-check" element={<ProtectedRoute><AdminLaunchCheck /></ProtectedRoute>} />
        <Route path="/supervisor/:token" element={<SupervisorView />} />
        <Route path="/feedback/:token" element={<ApplySupervisorFeedback />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
