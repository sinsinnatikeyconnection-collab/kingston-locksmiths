import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import I18nController from '@/components/i18n/I18nController';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';
import Home from './pages/Home';

// Lazy-load secondary page viewports so each route ships as its own chunk.
const Services = React.lazy(() => import('./pages/Services'));
const ServiceLocksmithing = React.lazy(() => import('./pages/ServiceLocksmithing'));
const ServiceElectrical = React.lazy(() => import('./pages/ServiceElectrical'));
const ServicePerformance = React.lazy(() => import('./pages/ServicePerformance'));
const ServiceMechanical = React.lazy(() => import('./pages/ServiceMechanical'));
const ServiceAreas = React.lazy(() => import('./pages/ServiceAreas'));
const Faq = React.lazy(() => import('./pages/Faq'));
const Ar = React.lazy(() => import('./pages/Ar'));
const About = React.lazy(() => import('./pages/About'));
const Testimonials = React.lazy(() => import('./pages/Testimonials'));
const Contact = React.lazy(() => import('./pages/Contact'));
const MailIn = React.lazy(() => import('./pages/MailIn'));
const Login = React.lazy(() => import('@/pages/Login'));
const Register = React.lazy(() => import('@/pages/Register'));
const ForgotPassword = React.lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('@/pages/ResetPassword'));
const Portal = React.lazy(() => import('./pages/Portal'));
const Admin = React.lazy(() => import('./pages/Admin'));
const Diagnostics = React.lazy(() => import('./pages/Diagnostics'));
const KnowledgeBase = React.lazy(() => import('./pages/KnowledgeBase'));
const VinScan = React.lazy(() => import('./pages/VinScan'));
const BtDiagnostic = React.lazy(() => import('./pages/BtDiagnostic'));

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-titanium">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/70">Initializing viewport…</span>
      </div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public + auth routes */}
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/locksmithing" element={<ServiceLocksmithing />} />
        <Route path="/services/electrical" element={<ServiceElectrical />} />
        <Route path="/services/performance" element={<ServicePerformance />} />
        <Route path="/services/mechanical" element={<ServiceMechanical />} />
        <Route path="/service-areas" element={<ServiceAreas />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/ar" element={<Ar />} />
        <Route path="/about" element={<About />} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/mail-in" element={<MailIn />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="/vin-scan" element={<VinScan />} />
        <Route path="/bt-diagnostic" element={<BtDiagnostic />} />
        <Route path="/knowledge" element={<KnowledgeBase />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Authenticated routes */}
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin-dashboard" element={<Admin />} />
          <Route path="/godmode" element={<Admin />} />
          <Route path="/portal" element={<Portal />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <I18nController />
          <ErrorBoundary>
            <AuthenticatedApp />
          </ErrorBoundary>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App