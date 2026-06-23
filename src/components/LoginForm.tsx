import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';

interface LoginFormProps {
  onLoginSuccess: (profile: UserProfile) => void;
  onShowMessage: (text: string, type: 'success' | 'error' | 'warning') => void;
}

export default function LoginForm({ onLoginSuccess, onShowMessage }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAdminRegisterMode, setIsAdminRegisterMode] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [activeLoginTab, setActiveLoginTab] = useState<'peserta' | 'admin'>('peserta');
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminPortalUnlocked, setAdminPortalUnlocked] = useState(false);
  
  // Custom manual login and registration states
  const [manualEmail, setManualEmail] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [manualName, setManualName] = useState('');

  // Unified Manual Account Login Handler
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) {
      onShowMessage('Email tidak boleh kosong.', 'warning');
      return;
    }
    if (!manualPassword) {
      onShowMessage('Kata sandi tidak boleh kosong.', 'warning');
      return;
    }
    const cleanEmail = manualEmail.toLowerCase().trim();
    setLoading(true);

    try {
      const isAdminDirect = (cleanEmail === 'admin' || cleanEmail === 'lukepoktlampung@gmail.com') && manualPassword === 'Kejaksaan2026';

      if (isAdminDirect) {
        // Special Admin Direct Login Bypass - Instantiate profile immediately
        let profileData: UserProfile = {
          uid: 'admin_kejati_lampung_direct',
          email: 'lukepoktlampung@gmail.com',
          displayName: 'Admin Kejati (Utama)',
          photoURL: 'https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F',
          role: 'admin',
          isSetup: true,
          status: 'Aktif',
          createdAt: new Date().toISOString(),
        };
        (profileData as any).password = 'Kejaksaan2026';

        // Perform Firestore synchronization and audit logging in the background without blocking the login experience
        setTimeout(async () => {
          try {
            const usersCol = collection(db, 'users');
            const adminQuery = query(usersCol, where('email', '==', 'lukepoktlampung@gmail.com'));
            const adminSnap = await getDocs(adminQuery);

            let finalProfile = { ...profileData };

            if (!adminSnap.empty) {
              const dbData = adminSnap.docs[0].data() as UserProfile;
              finalProfile = {
                ...finalProfile,
                ...dbData,
                role: 'admin',
                isSetup: true,
              };
              (finalProfile as any).password = 'Kejaksaan2026';
            }

            // Sync user back to ensure it exists with correct role and password
            const adminDocRef = doc(db, 'users', finalProfile.uid);
            await setDoc(adminDocRef, {
              ...finalProfile,
              role: 'admin',
              isSetup: true,
              password: 'Kejaksaan2026'
            }, { merge: true });

            // Log login audit trail
            const auditRef = doc(db, 'audit', `login_direct_admin_${finalProfile.uid}_${Date.now()}`);
            await setDoc(auditRef, {
              id: auditRef.id,
              uid: finalProfile.uid,
              email: 'lukepoktlampung@gmail.com',
              namaLengkap: finalProfile.displayName,
              role: 'admin',
              aktivitas: 'Login Admin Direct',
              detail: `Admin berhasil masuk secara langsung dengan kredensial utama`,
              timestamp: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('Firestore background sync failed', dbErr);
          }
        }, 50);

        onShowMessage(`Selamat datang kembali, ${profileData.displayName}!`, 'success');
        onLoginSuccess(profileData);
        setLoading(false);
        return;
      }

      const usersCol = collection(db, 'users');
      // Look up if user has this email registered
      const emailQuery = query(usersCol, where('email', '==', cleanEmail));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        // Exists! Let's check password
        const docSnap = emailSnap.docs[0];
        const profileData = docSnap.data() as UserProfile;
        
        // Retrieve password from the Firestore doc
        const dbPassword = (profileData as any).password || '';
        
        // If password is set in DB and matches, OR if password is not set in DB yet (for backward compatibility, we auto-save it)
        if (dbPassword && dbPassword !== manualPassword) {
          onShowMessage('Kata sandi salah. Silakan coba lagi.', 'error');
          setLoading(false);
          return;
        }

        // Auto check if status is "Selesai" based on date
        if (profileData.dataMagang?.tanggalSelesai) {
          const todayStr = new Date().toISOString().split('T')[0];
          if (todayStr > profileData.dataMagang.tanggalSelesai && profileData.status === 'Aktif') {
            profileData.status = 'Selesai';
            await setDoc(doc(db, 'users', profileData.uid), { status: 'Selesai' }, { merge: true });
          }
        }

        // If user document didn't have password saved, let's update it so it gets protected
        if (!dbPassword) {
          await setDoc(doc(db, 'users', profileData.uid), { password: manualPassword }, { merge: true });
        }

        // Log login audit trail
        try {
          const auditRef = doc(db, 'audit', `login_manual_${profileData.uid}_${Date.now()}`);
          await setDoc(auditRef, {
            id: auditRef.id,
            uid: profileData.uid,
            email: cleanEmail,
            namaLengkap: profileData.displayName,
            role: profileData.role,
            aktivitas: 'Login Akun',
            detail: `User berhasil masuk secara manual menggunakan email & kata sandi`,
            timestamp: new Date().toISOString()
          });
        } catch (auditErr) {
          console.error(auditErr);
        }

        onShowMessage(`Selamat datang kembali, ${profileData.displayName}!`, 'success');
        onLoginSuccess(profileData);
      } else {
        // Email not found
        onShowMessage('Email tidak ditemukan. Jika Anda belum memiliki akun, silakan klik "Daftar Akun Baru" di bawah.', 'warning');
      }
    } catch (error: any) {
      console.error('Manual Sign-In Error:', error);
      onShowMessage(`Gagal masuk ke akun: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Unified Manual Account Registration Handler
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) {
      onShowMessage('Email tidak boleh kosong.', 'warning');
      return;
    }
    if (!manualName.trim()) {
      onShowMessage('Nama lengkap tidak boleh kosong.', 'warning');
      return;
    }
    if (!manualPassword) {
      onShowMessage('Kata sandi tidak boleh kosong.', 'warning');
      return;
    }
    if (manualPassword.length < 5) {
      onShowMessage('Kata sandi minimal 5 karakter demi keamanan.', 'warning');
      return;
    }

    const assignedRole = isAdminRegisterMode ? 'admin' : 'peserta';

    // Verification check for admin register mode
    if (assignedRole === 'admin') {
      const cleanPasscode = adminPasscode.trim().toUpperCase();
      const cleanEmail = manualEmail.toLowerCase().trim();
      if (!cleanPasscode) {
        onShowMessage('Kode Verifikasi Admin diperlukan!', 'error');
        return;
      }
      if (cleanPasscode !== 'KEJATI2026' && cleanPasscode !== 'KEJATILAMPUNG' && cleanEmail !== 'lukepoktlampung@gmail.com') {
        onShowMessage('Kode Verifikasi Staf salah. Hubungi Koordinator S.IPKL.', 'error');
        return;
      }
    }

    setLoading(true);
    const cleanEmail = manualEmail.toLowerCase().trim();

    try {
      // Check if email already registered first to prevent duplicates
      const usersCol = collection(db, 'users');
      const emailQuery = query(usersCol, where('email', '==', cleanEmail));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        onShowMessage('Alamat email sudah terdaftar! Silakan gunakan menu Masuk.', 'error');
        setLoading(false);
        return;
      }

      // Automatically force admin role for specialized admin email
      const isLukepokt = cleanEmail === 'lukepoktlampung@gmail.com';
      const finalRole = isLukepokt ? 'admin' : assignedRole;

      const customUid = `manual_user_${Date.now().toString().slice(-6)}`;
      const profileData: UserProfile = {
        uid: customUid,
        email: cleanEmail,
        displayName: manualName.trim(),
        photoURL: finalRole === 'admin'
          ? 'https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F'
          : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&auto=format&fit=crop',
        role: finalRole,
        isSetup: finalRole === 'admin' ? true : false,
        status: 'Aktif',
        createdAt: new Date().toISOString(),
      };

      // Store password
      (profileData as any).password = manualPassword;

      const userRef = doc(db, 'users', customUid);
      await setDoc(userRef, profileData);

      // Audit Trail
      try {
        const auditRef = doc(db, 'audit', `register_manual_${customUid}_${Date.now()}`);
        await setDoc(auditRef, {
          id: auditRef.id,
          uid: customUid,
          email: cleanEmail,
          namaLengkap: profileData.displayName,
          role: profileData.role,
          aktivitas: 'Registrasi Akun Baru',
          detail: finalRole === 'admin'
            ? `Staff/Admin baru mendaftarkan diri secara terpisah dengan kode otorisasi`
            : `User mendaftarkan akun baru manual dengan kata sandi`,
          timestamp: new Date().toISOString()
        });
      } catch (ae) {
        console.error(ae);
      }

      if (finalRole === 'admin') {
        onShowMessage('Akun Staf Admin berhasil dibuat! Selamat datang.', 'success');
      } else {
        onShowMessage('Akun berhasil dibuat! Silakan melengkapi biodata Anda.', 'success');
      }
      onLoginSuccess(profileData);
    } catch (error: any) {
      console.error('Manual Registration Error:', error);
      onShowMessage(`Gagal melakukan pendaftaran: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Quick Trial/Bypass Helper
  const handleQuickDemoLogin = async (role: 'admin' | 'peserta') => {
    setLoading(true);
    try {
      if (role === 'admin') {
        const mockUid = 'mock_admin_kejati_9';
        const userRef = doc(db, 'users', mockUid);
        const userSnap = await getDoc(userRef);
        let profileDataObj: UserProfile;
        if (userSnap.exists()) {
          profileDataObj = userSnap.data() as UserProfile;
        } else {
          profileDataObj = {
            uid: mockUid,
            email: 'lukepoktlampung@gmail.com',
            displayName: 'Admin Kejati (Demo)',
            photoURL: 'https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F',
            role: 'admin',
            isSetup: true,
            status: 'Aktif',
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, profileDataObj);
        }
        onShowMessage('Masuk sebagai Admin Demo!', 'success');
        onLoginSuccess(profileDataObj);
      } else {
        const mockUid = `mock_peserta_${Date.now().toString().slice(-4)}`;
        const userRef = doc(db, 'users', mockUid);
        const profileDataObj: UserProfile = {
          uid: mockUid,
          email: 'pesertademo@example.com',
          displayName: 'Peserta Uji Coba',
          photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=256&auto=format&fit=crop',
          role: 'peserta',
          isSetup: false,
          status: 'Aktif',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, profileDataObj);
        onShowMessage('Masuk sebagai Peserta Demo!', 'success');
        onLoginSuccess(profileDataObj);
      }
    } catch (e: any) {
      onShowMessage('Gagal login demo: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoClick = () => {
    const nextCount = logoClicks + 1;
    if (nextCount >= 4) {
      setLogoClicks(0);
      setAdminPortalUnlocked(true);
      setActiveLoginTab('admin');
      setManualEmail('admin');
      setManualPassword('Kejaksaan2026');
      onShowMessage('🔑 Portal Akun Utama Admin Kejati Lampung Terbuka!', 'success');
    } else {
      setLogoClicks(nextCount);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f4f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" id="login-screen">
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-600 via-[#D4AF37] to-blue-600" />
      <div className="absolute top-2 left-0 w-full h-1 bg-emerald-700/25" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-fade-in font-sans">
        <div className="flex justify-center mb-4">
          <div 
            onClick={handleLogoClick}
            className="bg-white/95 p-3 rounded-2xl border-2 border-[#D4AF37] shadow-lg cursor-pointer active:scale-95 hover:scale-105 transition-transform select-none"
            title="S.IPKL Kejaksaan Tinggi Lampung"
          >
            <img 
              src="https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F" 
              alt="Logo Kejati Lampung" 
              referrerPolicy="no-referrer" 
              className="h-16 w-16 object-contain shadow-sm rounded pointer-events-none" 
            />
          </div>
        </div>

        <h2 className="text-center text-3xl font-extrabold tracking-tight text-neutral-900 font-display uppercase">
          {isAdminRegisterMode 
            ? 'REGISTRASI ADMIN' 
            : isRegistering 
              ? 'DAFTAR AKUN BARU' 
              : 'PORTAL MASUK'}
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-600 max-w">
          Sistem Informasi PKL & Magang
          <span className="block font-bold text-emerald-800 mt-1 uppercase font-mono tracking-wider">
            Kejaksaan Tinggi Lampung
          </span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 font-sans">
        <div className="bg-white py-8 px-4 shadow-2xl rounded-2xl border border-neutral-200/80 sm:px-10 space-y-6">
          
          {isAdminRegisterMode ? (
            /* ================= REGISTRASI ADMIN (TERSEMBUNYI) ================= */
            <form onSubmit={handleManualRegister} className="space-y-4">
              <div className="bg-[#6B0D18]/5 rounded-xl p-3 border border-[#6B0D18]/20 text-xs text-red-950 font-medium flex gap-2">
                <span className="text-sm">🛡️</span>
                <span>Portal Khusus Registrasi Pejabat & Admin Kejaksaan Tinggi Lampung. Sifatnya tersembunyi.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-email-admin">
                  Alamat Email Admin/Staf
                </label>
                <input
                  id="register-email-admin"
                  type="email"
                  required
                  placeholder="contoh: staf@kejati.go.id"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-name-admin">
                  Nama Lengkap Pegawai
                </label>
                <input
                  id="register-name-admin"
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap pendaftar"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-password-admin">
                  Kata Sandi Baru Staf
                </label>
                <input
                  id="register-password-admin"
                  type="password"
                  required
                  placeholder="Minimal 5 karakter"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-medium bg-white"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-neutral-700 uppercase" htmlFor="admin-token">
                    Kode Otorisasi Admin
                  </label>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Petunjuk: KEJATI2026</span>
                </div>
                <input
                  id="admin-token"
                  type="text"
                  required
                  placeholder="Masukkan kode rahasia admin Kejati"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-medium bg-white font-mono uppercase tracking-widest"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200/60 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminRegisterMode(false);
                    setAdminPasscode('');
                  }}
                  className="flex-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Kembali ke Login
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-[#6B0D18] hover:bg-[#520a12] text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Daftar...' : 'Otorisasi & Daftar ✓'}
                </button>
              </div>
            </form>
          ) : !isRegistering ? (
            /* ================= TABBED LOGIN FORM ================= */
            <div className="space-y-4">
              {/* Tab Selector - Only visible when admin portal is unlocked via logo 4-taps */}
              {adminPortalUnlocked && (
                <div className="flex border-b border-neutral-200">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLoginTab('peserta');
                      setManualEmail('');
                      setManualPassword('');
                    }}
                    className={`flex-1 pb-3 text-center text-xs font-bold border-b-2 uppercase tracking-wider transition-all ${
                      activeLoginTab === 'peserta'
                        ? 'border-emerald-700 text-emerald-800'
                        : 'border-transparent text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    🎓 Peserta Magang
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLoginTab('admin');
                      setManualEmail('admin');
                      setManualPassword('Kejaksaan2026');
                    }}
                    className={`flex-1 pb-3 text-center text-xs font-bold border-b-2 uppercase tracking-wider transition-all ${
                      activeLoginTab === 'admin'
                        ? 'border-[#6B0D18] text-[#6B0D18]'
                        : 'border-transparent text-neutral-400 hover:text-neutral-600'
                    }`}
                  >
                    💼 Staf / Admin
                  </button>
                </div>
              )}

              {activeLoginTab === 'peserta' ? (
                /* ================= LOGIN PESERTA MAGANG ================= */
                <form onSubmit={handleManualLogin} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="login-email">
                      Alamat Email
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      required
                      placeholder="Masukkan alamat email peserta"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full px-3.5 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="login-password">
                      Kata Sandi (Password)
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      required
                      placeholder="Masukkan kata sandi Anda"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="w-full px-3.5 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#6B0D18] hover:bg-[#520a12] text-white py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? 'Memproses...' : 'Masuk Sebagai Peserta ➔'}
                  </button>

                  <div className="text-center pt-2 border-t border-neutral-100 mt-4 text-xs">
                    <span className="text-neutral-500">Belum memiliki akun? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                      }}
                      className="text-emerald-800 font-bold hover:underline cursor-pointer"
                    >
                      Daftar Akun Baru
                    </button>
                  </div>
                </form>
              ) : (
                /* ================= LOGIN STAFF/ADMIN DIRECT ================= */
                <form onSubmit={handleManualLogin} className="space-y-4 pt-2">
                  <div className="bg-[#6B0D18]/5 border border-[#6B0D18]/20 p-3 rounded-xl text-[11px] text-[#6B0D18] font-medium leading-relaxed">
                    <p className="font-bold flex items-center gap-1 text-[12px] uppercase">
                      <span>⚡</span> Akun Utama Admin Kejati
                    </p>
                    <p className="mt-1">
                      Gunakan username <strong className="font-mono bg-white px-1 py-0.5 rounded border border-red-200 text-neutral-900">admin</strong> dan kata sandi <strong className="font-mono bg-white px-1 py-0.5 rounded border border-red-200 text-neutral-900">Kejaksaan2026</strong>. Informasi di bawah telah terisi otomatis untuk kemudahan Anda.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="admin-email">
                      Username / Email
                    </label>
                    <input
                      id="admin-email"
                      type="text"
                      required
                      placeholder="Masukkan 'admin'"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      className="w-full px-3.5 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-mono font-bold bg-neutral-50 text-neutral-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="admin-password">
                      Kata Sandi (Password)
                    </label>
                    <input
                      id="admin-password"
                      type="password"
                      required
                      placeholder="Masukkan 'Kejaksaan2026'"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="w-full px-3.5 py-3 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B0D18] font-mono font-bold bg-neutral-50 text-neutral-800"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#6B0D18] hover:bg-[#520a12] text-white py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? 'Menghubungkan...' : 'Masuk Sebagai Admin ➔'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* ================= REGISTER FORM (PESERTA SAJA) ================= */
            <form onSubmit={handleManualRegister} className="space-y-4">
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-xs text-emerald-950 font-medium flex gap-2">
                <span>🎓</span>
                <span>Khusus pendaftaran Peserta PKL & Magang di Kejaksaan Tinggi Lampung.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-email">
                  Alamat Email Aktif
                </label>
                <input
                  id="register-email"
                  type="email"
                  required
                  placeholder="contoh: nama@gmail.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-name">
                  Nama Lengkap Sesuai KTP/KTM
                </label>
                <input
                  id="register-name"
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap pendaftar"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-password">
                  Kata Sandi Baru
                </label>
                <input
                  id="register-password"
                  type="password"
                  required
                  placeholder="Kata sandi minimal 5 karakter"
                  value={manualPassword}
                  onChange={(e) => setManualPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200/60 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="flex-1 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Mendaftarkan...' : 'Daftar & Masuk Otomatis ✓'}
                </button>
              </div>

              <div className="text-center pt-2 border-t border-neutral-100 mt-2 text-xs">
                <span className="text-neutral-500">Sudah memiliki akun? </span>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-emerald-800 font-bold hover:underline cursor-pointer"
                >
                  Masuk Saja
                </button>
              </div>
            </form>
          )}

          {/* Secure database badge */}
          <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-xl text-[10.5px] text-neutral-600 leading-normal flex gap-1.5 font-sans">
            <span className="text-base select-none shrink-0" role="img" aria-label="shield">🛡️</span>
            <div>
              <strong>Otentikasi Mandiri S.IPKL</strong>: Akun pendaftaran, absensi harian, logbook kegiatan, lampiran surat bebas magang, dan riwayat dienkripsi secara penuh di Cloud Firestore Kejaksaan Tinggi Lampung.
            </div>
          </div>


          <div className="mt-4 text-center text-xs text-neutral-400 font-mono border-t border-neutral-100 pt-3 flex items-center justify-between">
            <span>Kejaksaan Tinggi Lampung S.IPKL v1.1.0</span>
            {adminPortalUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setIsAdminRegisterMode(false);
                  setIsRegistering(false);
                  setActiveLoginTab('admin');
                  setManualEmail('admin');
                  setManualPassword('Kejaksaan2026');
                }}
                className="text-[10.5px] text-[#6B0D18] hover:underline font-sans flex items-center gap-1 cursor-pointer transition-colors font-bold animate-pulse"
                title="Portal Khusus Staf Kejaksaan"
              >
                <span>🔒</span> Pegawai/Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
