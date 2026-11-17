import { Download, AlertTriangle } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { api, formatINR } from '../../services/api';

const CHART_PALETTE = ['#b45309', '#0f766e', '#d97706', '#2563eb', '#78716c', '#dc2626'];

interface AdminAnalyticsViewProps {
  analytics: any;
  loading: boolean;
  onJumpInventory: () => void;
}

export function AdminAnalyticsView({ analytics, loading, onJumpInventory }: AdminAnalyticsViewProps) {
  const handleExportCsv = async () => {
    try {
      const res = await api.get('/analytics/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'caterease-bookings-report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV analytics report downloaded.');
    } catch {
      toast.error('Failed to export CSV report.');
    }
  };

  if (loading || !analytics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-stone-200/70 dark:bg-stone-800/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { kpis, lowStockItems = [], recentTransactions = [], charts = {} } = analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
            Executive Revenue & Operations Telemetry
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Real-time metrics computed directly from PostgreSQL bookings, payments, customers, and kitchen stock.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-amber-700 hover:bg-stone-800 dark:hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          Export Bookings CSV
        </button>
      </div>

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Paid Revenue', value: formatINR(kpis.totalRevenue) },
          { label: 'Total Bookings', value: kpis.totalBookings },
          { label: 'Registered Customers', value: kpis.totalCustomers },
          { label: 'Active Staff', value: kpis.totalStaff },
          { label: 'Pending Confirmations', value: kpis.pendingBookings },
          { label: 'Completed Events', value: kpis.completedEvents },
          { label: 'Cancelled Bookings', value: kpis.cancelledBookings },
          { label: 'Low Stock Alerts', value: kpis.lowStockCount },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800"
          >
            <div className="text-xs text-stone-500 dark:text-stone-400">{kpi.label}</div>
            <div className="mt-1.5 text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert Strip */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {lowStockItems.length} ingredient{lowStockItems.length > 1 ? 's' : ''} below minimum threshold
              </div>
              <div className="text-amber-800 dark:text-amber-300 mt-0.5">
                {lowStockItems.map((i: any) => `${i.ingredientName} (${i.quantity} ${i.unit})`).join(' · ')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onJumpInventory}
            className="px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0"
          >
            Restock Inventory
          </button>
        </div>
      )}

      {/* 7 Recharts Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Monthly Revenue BarChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            1. Monthly Catering Revenue (INR)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.35} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Bar dataKey="revenue" name="Revenue" fill="#b45309" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Weekly Bookings AreaChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            2. Weekly Booking Intake Velocity
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.weeklyBookings || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.35} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#0f766e" fill="#0f766e" fillOpacity={0.22} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Booking Status PieChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            3. Booking Pipeline Status Breakdown
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.bookingStatusChart || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {(charts.bookingStatusChart || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Popular Food Items BarChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            4. Most Ordered Culinary Dishes
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.popularItems || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.35} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={125} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="orders" name="Portions" fill="#d97706" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Revenue by Event Category BarChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            5. Revenue by Event Category
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.revenueByEventCategory || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.35} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Bar dataKey="revenue" name="Revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Customer Growth LineChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            6. Customer Acquisition Growth
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.customerGrowth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.35} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="newCustomers" name="New Customers" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7. Payment Method Distribution PieChart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            7. Payment Method Distribution
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.paymentMethods || []}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={78}
                >
                  {(charts.paymentMethods || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={CHART_PALETTE[(idx + 1) % CHART_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions Feed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-4">
            Recent Payment Ledger Entries
          </h3>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 text-xs">
            {recentTransactions.length === 0 ? (
              <p className="text-stone-500 py-6 text-center">No recent transactions recorded.</p>
            ) : (
              recentTransactions.map((tx: any) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                      {tx.transactionId}
                    </div>
                    <div className="text-stone-500">
                      {tx.method} · {tx.paymentType} · {tx.status}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    {formatINR(tx.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
