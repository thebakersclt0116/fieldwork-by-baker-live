import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
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
import EmilyDashboard from './pages/EmilyDashboard';
import EmilyImport from './pages/EmilyImport';
import BakerAI from './pages/BakerAI';
import SupervisorView from './pages/SupervisorView';
import ApplySupervisorFeedback from './pages/ApplySupervisorFeedback';
import { useAuth } from './hooks/useAuth';

function AccountDashboard() {
  const { isOwner } = useAuth();
  return isOwner ? <Dashboard /> : <EmilyDashboard />;
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
        <Route path="/import" element={<ProtectedRoute><EmilyImport /></ProtectedRoute>} />
        <Route path="/baker-ai" element={<ProtectedRoute><BakerAI /></ProtectedRoute>} />
        <Route path="/supervisor/:token" element={<SupervisorView />} />
        <Route path="/feedback/:token" element={<ApplySupervisorFeedback />} />
      </Routes>
    </Layout>
  );
}
