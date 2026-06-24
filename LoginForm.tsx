import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { safeGetDoc as getDoc, safeSetDoc as setDoc } from './utils/firestoreHelper';
import { UserProfile } from './types';
import Navbar from './components/Navbar';
import LoginForm from './components/LoginForm';
import SetupBiodata from './components/SetupBiodata';
import PesertaDashboard from './components/PesertaDashboard';
import AdminDashboard from './components/AdminDashboard';
import { CheckCircle2, AlertTriangle, Info, Landmark, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Toast notifications state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  // Auto clear toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
  };

  // Check user session on mount
  useEffect(() => {
    // 1. First, check if there is a cached mock profile inside localStorage (for high resiliency inside the iframe)
    const cachedMock = localStorage.getItem('sipkl_mock_profile');
    if (cachedMock) {
      try {
        const parsed = JSON.parse(cachedMock) as UserProfile;
        setUser(parsed);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Stale cache, clearing...', e);
        localStorage.removeItem('sipkl_mock_profile');
      }
    }

    // 2. Otherwise, hook into global Firebase Auth state tracking
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Prioritize manual cached session to prevent race condition when direct login completes
      const cached = localStorage.getItem('sipkl_mock_profile');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as UserProfile;
          setUser(parsed);
          setLoading(false);
          return;
        } catch (e) {
          console.error(e);
        }
      }

      if (firebaseUser) {
        setLoading(true);
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const profile = userSnap.data() as UserProfile;
            if (profile.email === 'lukepoktlampung@gmail.com' && profile.role !== 'admin') {
              profile.role = 'admin';
              await setDoc(userRef, { role: 'admin' }, { merge: true });
            }
            setUser(profile);
          } else {
            // New user registration defaults
            const isAdmin = firebaseUser.email === 'lukepoktlampung@gmail.com';
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || (isAdmin ? 'Admin Kejati' : 'Peserta Magang'),
              photoURL: firebaseUser.photoURL || '',
              role: isAdmin ? 'admin' : 'peserta',
              isSetup: isAdmin ? true : false,
              status: 'Aktif',
              createdAt: new Date().toISOString()
            };
            await setDoc(userRef, newProfile);
            setUser(newProfile);
          }
        } catch (err: any) {
          console.error('Error fetching onAuth profile', err);
          showToast(`Gagal menyinkronkan profil: ${err.message}`, 'error');
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Safe localStorage helper to avoid quota exceeded crashes
  const safeSetLocalStorage = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('LocalStorage error, could be quota exceeded:', e);
    }
  };

  // Login handler
  const handleLoginSuccess = (profile: UserProfile) => {
    setUser(profile);
    // Cache any user profile in storage to persist session across HMR/refreshes/reloads
    safeSetLocalStorage('sipkl_mock_profile', JSON.stringify(profile));
  };

  // Profile update handler that keeps cache fully synchronized
  const handleUpdateProfile = (updatedProfile: UserProfile) => {
    setUser(updatedProfile);
    safeSetLocalStorage('sipkl_mock_profile', JSON.stringify(updatedProfile));
  };

  // Logout handler
  const handleLogout = async () => {
    const prevUser = user;
    
    // Clear standard session and cache immediately for instantaneous UI response
    localStorage.removeItem('sipkl_mock_profile');
    setUser(null);

    // Run remote registration non-blockingly to guarantee zero full-screen loader hangs
    try {
      if (prevUser && prevUser.isSetup) {
        const auditRef = doc(db, 'audit', `logout_${prevUser.uid}_${Date.now()}`);
        setDoc(auditRef, {
          id: auditRef.id,
          uid: prevUser.uid,
          email: prevUser.email,
          namaLengkap: prevUser.displayName,
          role: prevUser.role,
          aktivitas: 'Logout',
          detail: `User sukses melakukan logout dan merilis sesi aktif`,
          timestamp: new Date().toISOString()
        }).catch((ae) => console.warn('Audit trail failed', ae));
      }

      // Clear standard Firebase session in the background
      signOut(auth).catch((authErr) => console.warn('Signout auth soft fail', authErr));
      showToast('Sesi Anda berhasil diakhiri.', 'success');
    } catch (err: any) {
      console.error(err);
    }
  };

  // Setup profile completation
  const handleSetupComplete = (updatedProfile: UserProfile) => {
    setUser(updatedProfile);
    safeSetLocalStorage('sipkl_mock_profile', JSON.stringify(updatedProfile));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center text-white" id="loading-screen">
        <div className="bg-white p-3.5 rounded-2xl border-2 border-[#D4AF37] animate-pulse shadow-2xl">
          <img 
            src="https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F" 
            alt="Logo Kejati Lampung" 
            referrerPolicy="no-referrer" 
            className="h-12 w-12 object-contain" 
          />
        </div>
        <p className="mt-5 font-bold tracking-widest text-[11px] text-neutral-300 font-mono uppercase">MEMUAT SISTEM PORTAL PKL</p>
        <span className="text-[10px] text-neutral-500 font-mono mt-1">S.IPKL Kejaksaan Tinggi Lampung</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f4f7] flex flex-col text-neutral-900 selection:bg-emerald-700/20 transition-all" id="app-root">
      
      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-in slide-in-from-bottom" id="toast-notif">
          <div className="p-4 flex gap-3">
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />}
            {toast.type === 'warning' && <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />}
            
            <div className="text-left flex-1 min-w-0">
              <p className="text-xs font-bold text-neutral-900">{toast.message}</p>
            </div>
            
            <button
              onClick={() => setToast(null)}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`h-1.5 w-full ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-[#D4AF37]'}`} />
        </div>
      )}

      {/* Navbar layer */}
      <Navbar
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main body viewport */}
      <main className="flex-1 w-full bg-[#f4f4f7]">
        {!user ? (
          <LoginForm
            onLoginSuccess={handleLoginSuccess}
            onShowMessage={showToast}
          />
        ) : (!user.isSetup && user.role !== 'admin') ? (
          <SetupBiodata
            user={user}
            onSetupComplete={handleSetupComplete}
            onShowMessage={showToast}
          />
        ) : user.role === 'admin' ? (
          <AdminDashboard
            adminUser={user}
            onShowMessage={showToast}
          />
        ) : (
          <PesertaDashboard
            user={user}
            onUpdateProfile={handleUpdateProfile}
            onShowMessage={showToast}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Footer Branding line */}
      <footer className="bg-neutral-950 text-neutral-500 py-6 border-t border-neutral-800 text-center text-[11px] font-mono select-none" id="app-footer">
        <p className="uppercase tracking-widest text-[#D4AF37] font-sans font-bold">PORTAL MAGANG</p>
        <p className="mt-1">Sistem Informasi PKL dan Magang Kejaksaan Tinggi Lampung</p>
        <p className="mt-2 text-neutral-600">Copyright © 2026 Kejati Lampung. All Rights Reserved.</p>
      </footer>
    </div>
  );
}
