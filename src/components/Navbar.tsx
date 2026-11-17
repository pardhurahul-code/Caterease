import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, ShoppingBag, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { totalItemCount } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const dashboardPath =
    user?.role === 'ADMIN'
      ? '/dashboard/admin'
      : user?.role === 'STAFF'
        ? '/dashboard/staff'
        : '/dashboard/customer';

  const navLinks = [
    { label: 'Menu', to: '/menu' },
    { label: 'Packages', to: '/packages' },
    { label: 'Venue Map', to: '/venue-map' },
    { label: '3D Studio', to: '/studio-3d' },
    { label: 'Game', to: '/game' },
    { label: 'CaterEase AI', to: '/ai' },
    user ? { label: 'Dashboard', to: dashboardPath } : { label: 'Login', to: '/login' },
  ];

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#FAF9F6]/90 dark:bg-stone-950/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0"
        >
          CaterEase
        </Link>

        {/* Zone 2: Concise single-line text links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                isActive(link.to)
                  ? 'text-amber-700 dark:text-amber-400 border-amber-700 dark:border-amber-400'
                  : 'text-stone-600 dark:text-stone-300 border-transparent hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Zone 3: Primary Action + Compact Theme & Cart */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <Link
            to="/checkout"
            aria-label={`View catering cart with ${totalItemCount} items`}
            className="relative w-10 h-10 rounded-lg flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            {totalItemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-700 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {totalItemCount}
              </span>
            )}
          </Link>

          <Link
            to="/checkout"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Book Catering
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileOpen}
            className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 py-4 space-y-2 shadow-lg">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              {link.label}
            </Link>
          ))}
          {!user && (
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Register
            </Link>
          )}
          {user && (
            <button
              type="button"
              onClick={async () => {
                await logout();
                setMobileOpen(false);
                navigate('/');
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Logout
            </button>
          )}
          <Link
            to="/checkout"
            onClick={() => setMobileOpen(false)}
            className="block text-center mt-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-amber-700"
          >
            Book Catering
          </Link>
        </div>
      )}
    </header>
  );
}
