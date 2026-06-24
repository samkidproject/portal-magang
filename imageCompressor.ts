import { LogOut, Shield, User } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ user, onLogout, activeTab, setActiveTab }: NavbarProps) {
  return (
    <nav className="bg-emerald-800 text-white shadow-md border-b-2 border-[#D4AF37]" id="app-navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo and Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <img 
              src="https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F" 
              alt="Logo Kejati Lampung" 
              referrerPolicy="no-referrer" 
              className="h-8 w-auto object-contain" 
            />
            <div>
              <span className="block text-base font-extrabold tracking-tight font-display text-white">
                PORTAL MAGANG
              </span>
              <span className="block text-[9px] text-yellow-300 uppercase font-mono tracking-wider leading-3">
                Kejaksaan Tinggi Lampung
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 text-yellow-300 bg-black/20 px-3 py-1.5 rounded-full text-xs font-mono">
                {user.role === 'admin' ? (
                  <Shield className="h-3.5 w-3.5 mr-1 text-yellow-300" />
                ) : (
                  <User className="h-3.5 w-3.5 mr-1 text-yellow-300" />
                )}
                {user.role === 'admin' ? 'ADMINISTRATOR' : 'PESERTA MAGANG'}
              </div>

              {/* User Identity avatar */}
              <div className="flex items-center space-x-2 border-l border-emerald-700 pl-4">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full border-2 border-[#D4AF37] object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full border border-yellow-300 bg-emerald-900 flex items-center justify-center text-xs font-bold text-yellow-300">
                    {user.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold leading-3 max-w-[120px] truncate">{user.displayName}</p>
                  <p className="text-[9px] text-yellow-300 leading-3 mt-0.5 truncate max-w-[120px]">
                    {user.email.endsWith('@sipkl.local') ? user.email.replace('@sipkl.local', '') : user.email}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 bg-blue-900/40 hover:bg-blue-800 text-white rounded-lg px-2.5 py-1.5 transition-colors border border-blue-700 hover:border-[#D4AF37] cursor-pointer text-xs"
                title="Log Keluar"
                id="btn-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
