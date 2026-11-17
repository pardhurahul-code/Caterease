import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-stone-950 text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <Link to="/" className="font-display text-2xl font-bold text-white tracking-tight">
              CaterEase
            </Link>
            <p className="mt-3 text-sm text-stone-400 leading-relaxed">
              Smart Catering. Seamless Celebrations. Precision culinary planning, transparent pricing, and dedicated event hospitality.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Explore</h3>
            <ul className="space-y-2.5 text-sm text-stone-400">
              <li><Link to="/menu" className="hover:text-amber-400 transition-colors">Food Catalog</Link></li>
              <li><Link to="/packages" className="hover:text-amber-400 transition-colors">Catering Packages</Link></li>
              <li><Link to="/ai" className="hover:text-amber-400 transition-colors">CaterEase AI Planner</Link></li>
              <li><Link to="/venue-map" className="hover:text-amber-400 transition-colors">Venue & Dispatch Map</Link></li>
              <li><Link to="/studio-3d" className="hover:text-amber-400 transition-colors">3D Banquet Studio</Link></li>
              <li><Link to="/game" className="hover:text-amber-400 transition-colors">Banquet Rush 3D Game</Link></li>
              <li><Link to="/checkout" className="hover:text-amber-400 transition-colors">Book an Event</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Portals</h3>
            <ul className="space-y-2.5 text-sm text-stone-400">
              <li><Link to="/login" className="hover:text-amber-400 transition-colors">Sign In</Link></li>
              <li><Link to="/register" className="hover:text-amber-400 transition-colors">Customer Registration</Link></li>
              <li><Link to="/dashboard/customer" className="hover:text-amber-400 transition-colors">Customer Dashboard</Link></li>
              <li><Link to="/dashboard/admin" className="hover:text-amber-400 transition-colors">Admin & Staff Access</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Concierge Contact</h3>
            <ul className="space-y-3 text-sm text-stone-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span>Level 4, Culinary Guild House, Bandra Kurla Complex, Mumbai 400051</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="tabular-nums">+91 22 4890 2200</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                <span>concierge@caterease.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} CaterEase Culinary & Events Pvt. Ltd. All rights reserved.</p>
          <p>ISO 22000 Certified Kitchens · FSSAI Compliant Operations</p>
        </div>
      </div>
    </footer>
  );
}
