import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';

export function VerifyQrPage() {
  const { token } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/qr/verify/${token}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Verification failed.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
        {loading ? (
          <p className="text-sm text-stone-500">Verifying CaterEase QR token...</p>
        ) : error ? (
          <>
            <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">Invalid Verification Code</h1>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">{error}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-10 h-10 text-teal-700 dark:text-teal-400 mx-auto mb-3" />
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">Verified CaterEase Booking</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
              {data.eventName}
            </h1>
            <div className="mt-6 space-y-2.5 text-left text-sm bg-stone-50 dark:bg-stone-950 p-5 rounded-xl border border-stone-200 dark:border-stone-800">
              <div className="flex justify-between">
                <span className="text-stone-500">Booking ID</span>
                <span className="font-mono font-semibold">{data.bookingCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Event Type</span>
                <span>{data.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Schedule</span>
                <span className="tabular-nums">{data.eventDate} at {data.eventTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Guests</span>
                <span className="tabular-nums">{data.guestCount}</span>
              </div>
              {data.packageName && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Package</span>
                  <span>{data.packageName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-stone-500">Booking Status</span>
                <span className="font-semibold text-amber-800 dark:text-amber-400">{data.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Payment Status</span>
                <span className="font-semibold">{data.paymentStatus}</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-stone-500">
              Personal contact and financial details are redacted on public QR verification.
            </p>
          </>
        )}

        <Link
          to="/"
          className="inline-block mt-6 px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
        >
          Return to CaterEase
        </Link>
      </div>
    </div>
  );
}
