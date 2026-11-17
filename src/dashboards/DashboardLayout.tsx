import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: any;
  badge?: number;
}

interface DashboardLayoutProps {
  title: string;
  subtitle: string;
  navItems: DashboardNavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  subtitle,
  navItems,
  activeTab,
  onSelectTab,
  children,
}: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between p-4">
      <div>
        <div className="px-3 py-2 mb-4 border-b border-stone-200 dark:border-stone-800">
          <div className="text-xs font-medium text-amber-800 dark:text-amber-400">{user?.role} Portal</div>
          <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate mt-0.5">{user?.name}</div>
          <div className="text-xs text-stone-500 truncate">{user?.email}</div>
        </div>

        <nav className="space-y-1" aria-label="Dashboard sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-amber-700 text-white'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-1">
        <Link
          to="/menu"
          className="block px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          Browse Food Catalog
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 self-start sticky top-20">
          {navContent}
        </aside>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-72 bg-white dark:bg-stone-900 h-full shadow-xl z-10 overflow-y-auto">
              <div className="flex justify-end p-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close dashboard navigation"
                  className="p-2 rounded-lg text-stone-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {navContent}
            </div>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 min-w-0 space-y-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-0.5">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open dashboard menu"
              className="lg:hidden px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Menu className="w-4 h-4" /> Menu
            </button>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
