import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import PaidFeatureRoute from './components/PaidFeatureRoute';
import Home from './pages/Home';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import Enterprise from './pages/Enterprise';
import About from './pages/About';
import Blog from './pages/Blog';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import SignUp from './pages/SignUp';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MemberDashboard from './pages/MemberDashboard';
import SmartImportBridge from './pages/SmartImportBridge';
import BakerAI from './pages/BakerAI';
import Upgrade from './pages/Upgrade';
import UpgradeSuccess from './pages/UpgradeSuccess';
import ExportCenter from './pages/ExportCenter';
import SupervisorView from './pages/SupervisorView';
import ApplySupervisorFeedback from './pages/ApplySupervisorFeedback';
import { useAuth } from './hooks/useAuth';

function AccountDashboard() {
  const { isOwner } = useAuth();
  return isOwner ? <Dashboard /> : <MemberDashboard />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><AccountDashboard /></ProtectedRoute>} />
        <Route path="/upgrade" element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />
        <Route path="/upgrade/success" element={<ProtectedRoute><UpgradeSuccess /></ProtectedRoute>} />
        <Route path="/export" element={<ProtectedRoute><ExportCenter /></ProtectedRoute>} />
        <Route path="/import" element={<ProtectedRoute><PaidFeatureRoute><SmartImportBridge /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/baker-ai" element={<ProtectedRoute><PaidFeatureRoute><BakerAI /></PaidFeatureRoute></ProtectedRoute>} />
        <Route path="/supervisor/:token" element={<SupervisorView />} />
        <Route path="/feedback/:token" element={<ApplySupervisorFeedback />} />
      </Routes>
    </Layout>
  );
}
