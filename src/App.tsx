import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages';
import { VerifyQrPage } from './pages/VerifyQrPage';

const MenuPage = lazy(() => import('./pages/MenuPage').then((m) => ({ default: m.MenuPage })));
const PackagesPage = lazy(() => import('./pages/PackagesPage').then((m) => ({ default: m.PackagesPage })));
const AiSuitePage = lazy(() => import('./pages/AiSuitePage').then((m) => ({ default: m.AiSuitePage })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const VenueMapPage = lazy(() => import('./pages/VenueMapPage').then((m) => ({ default: m.VenueMapPage })));
const BanquetStudio3DPage = lazy(() =>
  import('./pages/BanquetStudio3DPage').then((m) => ({ default: m.BanquetStudio3DPage }))
);
const CaterRushGamePage = lazy(() =>
  import('./pages/CaterRushGamePage').then((m) => ({ default: m.CaterRushGamePage }))
);
const CustomerDashboard = lazy(() =>
  import('./dashboards/customer/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard }))
);
const AdminDashboard = lazy(() =>
  import('./dashboards/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const StaffDashboard = lazy(() =>
  import('./dashboards/staff/StaffDashboard').then((m) => ({ default: m.StaffDashboard }))
);

function RouteSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <div className="h-48 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
    </div>
  );
}

function roleHome(role: UserRole) {
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'STAFF') return '/dashboard/staff';
  return '/dashboard/customer';
}

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <>{children}</>;
}

function AppShell() {
  const location = useLocation();
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const isStandaloneViewport =
    location.pathname === '/studio-3d' || location.pathname === '/game';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      <Toaster richColors position="bottom-right" />

      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 w-full bg-amber-100 dark:bg-amber-950 border-b border-amber-300 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-100 flex items-center justify-center gap-3 text-center"
        >
          <span>
            Google Maps demo key daily quota reached. To continue testing with your own Cloud key, configure{' '}
            <code className="font-mono font-semibold">VITE_GOOGLE_MAPS_API_KEY</code>.{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noreferrer"
              className="underline font-semibold"
            >
              Quota Troubleshooting Guide
            </a>
          </span>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            className="px-2 py-0.5 rounded border border-amber-400 dark:border-amber-700 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {!isStandaloneViewport && <Navbar />}
      <div className="flex-1">
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/ai" element={<AiSuitePage />} />
            <Route path="/venue-map" element={<VenueMapPage />} />
            <Route path="/studio-3d" element={<BanquetStudio3DPage />} />
            <Route path="/game" element={<CaterRushGamePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/verify/:token" element={<VerifyQrPage />} />

            <Route
              path="/dashboard/customer"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/customer/bookings/:bookingId"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CustomerDashboard initialTab="bookings" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/customer/*"
              element={
                <ProtectedRoute allowedRoles={['CUSTOMER']}>
                  <CustomerDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/admin/*"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/staff/*"
              element={
                <ProtectedRoute allowedRoles={['STAFF']}>
                  <StaffDashboard />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {!isStandaloneViewport && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <AppShell />
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
