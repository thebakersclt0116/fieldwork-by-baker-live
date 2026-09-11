import { Routes, Route } from 'react-router';
import Layout from './components/Layout';
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
import Import from './pages/Import';
import EmilyDashboard from './pages/EmilyDashboard';
import EmilyImport from './pages/EmilyImport';
import SupervisorView from './pages/SupervisorView';
import { isEmilyAccount } from './lib/fieldworkStore';

function AccountDashboard() {
  return isEmilyAccount() ? <EmilyDashboard /> : <Dashboard />;
}

function AccountImport() {
  return isEmilyAccount() ? <EmilyImport /> : <Import />;
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
        <Route path="/dashboard" element={<AccountDashboard />} />
        <Route path="/import" element={<AccountImport />} />
        <Route path="/supervisor/:token" element={<SupervisorView />} />
      </Routes>
    </Layout>
  );
}
