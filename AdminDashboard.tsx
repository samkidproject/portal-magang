import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { safeGetDoc as getDoc, safeGetDocs as getDocs, safeSetDoc as setDoc } from '../utils/firestoreHelper';
import { UserProfile } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { PILIHAN_KOTA_KABUPATEN } from './SetupBiodata';
import { BookOpen, User, Mail, Phone, MapPin, Landmark, Calendar, Camera, UploadCloud, Shield, CheckCircle2 } from 'lucide-react';

// Safe promise timeout handler to prevent infinite loading screens
const promiseWithTimeout = <T,>(promise: Promise<T>, ms = 5000, timeoutErrorMsg = 'Koneksi lambat. Silakan periksa koneksi internet Anda.'): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

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

  // Biodata registration states for a simple, unified sign-up
  const [registerUsername, setRegisterUsername] = useState('');
  const [nim, setNim] = useState('');
  const [universitas, setUniversitas] = useState('');
  const [fakultas, setFakultas] = useState('');
  const [prodi, setProdi] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('Laki-Laki');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [noHp, setNoHp] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('Kota Bandar Lampung');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [photoURL, setPhotoURL] = useState('');

  // Unified Manual Account Login Handler
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = manualEmail.trim();
    if (!inputVal) {
      onShowMessage('Username atau Email tidak boleh kosong.', 'warning');
      return;
    }
    if (!manualPassword) {
      onShowMessage('Kata sandi tidak boleh kosong.', 'warning');
      return;
    }
    const cleanEmail = inputVal.includes('@') || inputVal.toLowerCase() === 'admin'
      ? inputVal.toLowerCase()
      : `${inputVal.toLowerCase()}@sipkl.local`;
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
      // Look up if user has this email registered with a safety timeout
      const emailQuery = query(usersCol, where('email', '==', cleanEmail));
      const emailSnap = await promiseWithTimeout(
        getDocs(emailQuery),
        5000,
        'Gagal menghubungi server database. Koneksi terputus atau lambat.'
      );

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
        // Email/Username not found
        onShowMessage('Username atau Email tidak ditemukan. Jika Anda belum memiliki akun, silakan klik "Daftar Akun Baru" di bawah.', 'warning');
      }
    } catch (error: any) {
      console.error('Manual Sign-In Error:', error);

      const cleanEmail = manualEmail.toLowerCase().trim();
      const isPermissionOrConnectionError = 
        error.message?.toLowerCase().includes('permission') || 
        error.message?.toLowerCase().includes('insufficient') ||
        error.message?.toLowerCase().includes('offline') ||
        error.message?.toLowerCase().includes('database') ||
        error.message?.toLowerCase().includes('connection');

      if (isPermissionOrConnectionError && cleanEmail) {
        console.warn('Database connection/permission issue, trying local login fallback...');
        try {
          const rawLocal = localStorage.getItem('sipkl_local_users');
          const localMap = rawLocal ? JSON.parse(rawLocal) : {};
          const matchedUser = Object.values(localMap).find(
            (u: any) => u.email === cleanEmail
          ) as UserProfile | undefined;

          if (matchedUser) {
            const dbPassword = (matchedUser as any).password || '';
            if (dbPassword && dbPassword !== manualPassword) {
              onShowMessage('Kata sandi salah. Silakan coba lagi. (Mode Lokal)', 'error');
              setLoading(false);
              return;
            }
            onShowMessage(`Selamat datang kembali, ${matchedUser.displayName}! (Mode Lokal)`, 'success');
            onLoginSuccess(matchedUser);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Failed to resolve local login fallback:', e);
        }
      }

      onShowMessage(`Gagal masuk ke akun: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Unified Manual Account Registration Handler
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const assignedRole = isAdminRegisterMode ? 'admin' : 'peserta';

    // 1. Validate Admin Credentials
    if (assignedRole === 'admin') {
      if (!manualEmail.trim()) {
        onShowMessage('Email Admin tidak boleh kosong.', 'warning');
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

      setLoading(true);

      try {
        const usersCol = collection(db, 'users');
        const emailQuery = query(usersCol, where('email', '==', cleanEmail));
        const emailSnap = await promiseWithTimeout(
          getDocs(emailQuery),
          5000,
          'Koneksi pendaftaran lambat. Silakan coba klik daftar lagi.'
        );

        if (!emailSnap.empty) {
          const existingDoc = emailSnap.docs[0];
          const existingData = existingDoc.data() as UserProfile;
          const dbPassword = (existingData as any).password || '';
          if (dbPassword && dbPassword !== manualPassword) {
            onShowMessage('Alamat email sudah terdaftar! Silakan gunakan menu Masuk.', 'error');
            setLoading(false);
            return;
          }
          // Log in automatically!
          onShowMessage('Akun Staf Admin sudah terdaftar! Anda berhasil masuk otomatis.', 'success');
          onLoginSuccess(existingData);
          setLoading(false);
          return;
        }

        const customUid = `manual_user_${Date.now().toString().slice(-6)}`;
        const profileData: UserProfile = {
          uid: customUid,
          email: cleanEmail,
          displayName: manualName.trim(),
          photoURL: 'https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F',
          role: 'admin',
          isSetup: true,
          status: 'Aktif',
          createdAt: new Date().toISOString(),
        };

        (profileData as any).password = manualPassword;

        const userRef = doc(db, 'users', customUid);
        await setDoc(userRef, profileData);

        onShowMessage('Akun Staf Admin berhasil dibuat! Selamat datang.', 'success');
        onLoginSuccess(profileData);
      } catch (error: any) {
        onShowMessage(`Gagal melakukan pendaftaran admin: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Validate Participant (Peserta Magang) Account & Biodata Credentials
    const cleanUsername = registerUsername.trim().toLowerCase();
    if (!cleanUsername) {
      onShowMessage('Username tidak boleh kosong.', 'warning');
      return;
    }
    if (cleanUsername.includes(' ') || cleanUsername.includes('@')) {
      onShowMessage('Username tidak boleh mengandung spasi atau karakter @.', 'warning');
      return;
    }
    if (!manualName.trim()) {
      onShowMessage('Nama Lengkap tidak boleh kosong.', 'warning');
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

    // Validate Participant Biodata Fields
    if (!nim.trim()) {
      onShowMessage('NIM / Nomor Induk Mahasiswa wajib diisi.', 'warning');
      return;
    }
    if (!universitas.trim()) {
      onShowMessage('Nama Universitas / Sekolah wajib diisi.', 'warning');
      return;
    }
    if (!fakultas.trim()) {
      onShowMessage('Nama Fakultas wajib diisi.', 'warning');
      return;
    }
    if (!prodi.trim()) {
      onShowMessage('Program Studi wajib diisi.', 'warning');
      return;
    }
    if (!tempatLahir.trim()) {
      onShowMessage('Tempat Lahir wajib diisi.', 'warning');
      return;
    }
    if (!tanggalLahir) {
      onShowMessage('Tanggal Lahir wajib diisi.', 'warning');
      return;
    }
    if (!noHp.trim()) {
      onShowMessage('Nomor HP / WhatsApp wajib diisi.', 'warning');
      return;
    }
    if (!alamat.trim()) {
      onShowMessage('Alamat Domisili Lengkap wajib diisi.', 'warning');
      return;
    }
    if (!tanggalMulai || !tanggalSelesai) {
      onShowMessage('Tanggal Mulai dan Tanggal Selesai Magang wajib diisi.', 'warning');
      return;
    }
    if (tanggalMulai > tanggalSelesai) {
      onShowMessage('Tanggal mulai tidak boleh melebihi tanggal selesai magang.', 'error');
      return;
    }

    setLoading(true);
    const cleanEmail = `${cleanUsername}@sipkl.local`;

    try {
      // Check if username already registered first to prevent duplicates
      const usersCol = collection(db, 'users');
      const emailQuery = query(usersCol, where('email', '==', cleanEmail));
      const emailSnap = await promiseWithTimeout(
        getDocs(emailQuery),
        5000,
        'Koneksi pendaftaran lambat. Silakan coba klik daftar lagi.'
      );

      if (!emailSnap.empty) {
        const existingDoc = emailSnap.docs[0];
        const existingData = existingDoc.data() as UserProfile;
        const dbPassword = (existingData as any).password || '';
        if (dbPassword && dbPassword !== manualPassword) {
          onShowMessage('Username sudah terdaftar! Silakan gunakan username lain.', 'error');
          setLoading(false);
          return;
        }
        // Log in automatically!
        onShowMessage('Akun Anda sudah terdaftar! Anda berhasil masuk otomatis.', 'success');
        onLoginSuccess(existingData);
        setLoading(false);
        return;
      }

      const customUid = `manual_user_${Date.now().toString().slice(-6)}`;

      // Construct Unified Biodata and Magang objects
      const biodataVal = {
        namaLengkap: manualName.trim(),
        nim: nim.trim(),
        universitas: universitas.trim(),
        fakultas: fakultas.trim(),
        prodi: prodi.trim(),
        jenisKelamin,
        tempatLahir: tempatLahir.trim(),
        tanggalLahir,
        noHp: noHp.trim(),
        email: cleanEmail,
        alamat: alamat.trim(),
        kota
      };

      const dataMagangVal = {
        bidang: 'Belum Ditentukan',
        tanggalMulai,
        tanggalSelesai
      };

      const todayStr = new Date().toISOString().split('T')[0];
      const initialStatus = todayStr > tanggalSelesai ? 'Selesai' : 'Aktif';

      const profileData: UserProfile = {
        uid: customUid,
        email: cleanEmail,
        displayName: manualName.trim(),
        photoURL: photoURL || '',
        role: 'peserta',
        isSetup: true, // Auto set to setup: true since biodata is fully provided!
        biodata: biodataVal,
        dataMagang: dataMagangVal,
        status: initialStatus,
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
          detail: `User mendaftarkan akun baru manual dengan username & kata sandi, serta biodata lengkap`,
          timestamp: new Date().toISOString()
        });
      } catch (ae) {
        console.error(ae);
      }

      onShowMessage('Akun dan Biodata Anda berhasil didaftarkan! Selamat datang.', 'success');
      onLoginSuccess(profileData);
    } catch (error: any) {
      console.error('Manual Registration Error:', error);
      
      const isPermissionOrConnectionError = 
        error.message?.toLowerCase().includes('permission') || 
        error.message?.toLowerCase().includes('insufficient') ||
        error.message?.toLowerCase().includes('offline') ||
        error.message?.toLowerCase().includes('database') ||
        error.message?.toLowerCase().includes('connection');

      if (isPermissionOrConnectionError && cleanUsername && manualName) {
        console.warn('Database connection issues detected, using local storage registration...');
        const customUid = `manual_user_${Date.now().toString().slice(-6)}`;
        
        const biodataVal = {
          namaLengkap: manualName.trim(),
          nim: nim.trim(),
          universitas: universitas.trim(),
          fakultas: fakultas.trim(),
          prodi: prodi.trim(),
          jenisKelamin,
          tempatLahir: tempatLahir.trim(),
          tanggalLahir,
          noHp: noHp.trim(),
          email: cleanEmail,
          alamat: alamat.trim(),
          kota
        };

        const dataMagangVal = {
          bidang: 'Belum Ditentukan',
          tanggalMulai,
          tanggalSelesai
        };

        const todayStr = new Date().toISOString().split('T')[0];
        const initialStatus = todayStr > tanggalSelesai ? 'Selesai' : 'Aktif';

        const fallbackProfile: UserProfile = {
          uid: customUid,
          email: cleanEmail,
          displayName: manualName.trim(),
          photoURL: photoURL || '',
          role: 'peserta',
          isSetup: true,
          biodata: biodataVal,
          dataMagang: dataMagangVal,
          status: initialStatus,
          createdAt: new Date().toISOString(),
        };
        (fallbackProfile as any).password = manualPassword;

        try {
          const rawLocal = localStorage.getItem('sipkl_local_users');
          const localMap = rawLocal ? JSON.parse(rawLocal) : {};
          localMap[customUid] = fallbackProfile;
          localStorage.setItem('sipkl_local_users', JSON.stringify(localMap));
          
          localStorage.setItem('sipkl_mock_profile', JSON.stringify(fallbackProfile));
        } catch (e) {
          console.warn('Failed to save fallback user:', e);
        }

        onShowMessage('Akun dan Biodata berhasil disimpan secara lokal! Selamat datang.', 'success');
        onLoginSuccess(fallbackProfile);
        setLoading(false);
        return;
      }

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
          photoURL: '',
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

      <div className={`sm:mx-auto w-full transition-all duration-300 relative z-10 animate-fade-in font-sans ${isRegistering && !isAdminRegisterMode ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
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

      <div className={`mt-8 sm:mx-auto w-full transition-all duration-300 relative z-10 font-sans ${isRegistering && !isAdminRegisterMode ? 'sm:max-w-3xl' : 'sm:max-w-md'}`}>
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
                      Username / Email
                    </label>
                    <input
                      id="login-email"
                      type="text"
                      required
                      placeholder="Masukkan username atau email Anda"
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
            <form onSubmit={handleManualRegister} className="space-y-6 text-left">
              <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 text-xs text-emerald-950 font-medium flex gap-2">
                <span className="text-sm select-none">🎓</span>
                <span>Pendaftaran Akun Baru S.IPKL Peserta PKL & Magang Kejaksaan Tinggi Lampung. Isi seluruh biodata dengan benar untuk langsung masuk.</span>
              </div>

              {/* SECTION 1: INFORMASI AKUN */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold border-b border-neutral-100 pb-1.5 flex items-center gap-1.5 uppercase tracking-wider text-emerald-800">
                  <Shield className="h-4 w-4 text-emerald-700" />
                  Bagian 1: Kredensial Akun
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-username">
                      Username / Nama Pengguna <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="register-username"
                      type="text"
                      required
                      placeholder="e.g. budisantoso (tanpa spasi)"
                      value={registerUsername}
                      onChange={(e) => setRegisterUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">Hanya huruf kecil dan angka, tanpa spasi.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-password">
                      Kata Sandi (Password) <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      required
                      placeholder="Minimal 5 karakter"
                      value={manualPassword}
                      onChange={(e) => setManualPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5" htmlFor="register-name">
                    Nama Lengkap Sesuai KTP <span className="text-red-600">*</span>
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
              </div>

              {/* SECTION 2: BIODATA DIRI */}
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold border-b border-neutral-100 pb-1.5 flex items-center gap-1.5 uppercase tracking-wider text-[#D4AF37]">
                  <User className="h-4 w-4 text-emerald-700" />
                  Bagian 2: Biodata & Identitas Diri
                </h3>

                {/* Photo Upload Row */}
                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                  <label className="block text-[11px] font-bold text-neutral-800 uppercase mb-2">Unggah Pas Foto Formal (Maksimal 2MB)</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative shrink-0">
                      {photoURL ? (
                        <img
                          src={photoURL}
                          alt="Preview Pas Foto"
                          className="h-16 w-16 rounded-xl object-cover border border-[#D4AF37] shadow-sm bg-slate-200"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl border border-slate-300 border-dashed bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                          <User className="h-6 w-6 text-slate-400 mb-0.5" />
                          <span className="text-[9px] text-slate-400 font-semibold uppercase scale-90">KOSONG</span>
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 bg-emerald-700 text-white p-1 rounded-full border border-white shadow-sm">
                        <Camera className="h-3 w-3" />
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-[11px] text-neutral-600 mb-2">Unggah pas foto formal Anda untuk keperluan administrasi & penempatan.</p>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg shadow-sm text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-[#D4AF37] cursor-pointer transition-all">
                        <UploadCloud className="h-3.5 w-3.5 text-emerald-700" />
                        Pilih File Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                onShowMessage('Ukuran file foto maksimal adalah 5MB.', 'warning');
                                return;
                              }
                              compressImage(file)
                                .then((compressed) => {
                                  setPhotoURL(compressed);
                                  onShowMessage('Pas foto berhasil diunggah!', 'success');
                                })
                                .catch((err) => {
                                  console.error(err);
                                  onShowMessage('Gagal mengompresi foto.', 'error');
                                });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      NIM / Nomor Induk Mahasiswa <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2117051042"
                      value={nim}
                      onChange={(e) => setNim(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Universitas / Sekolah <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Universitas Lampung"
                      value={universitas}
                      onChange={(e) => setUniversitas(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Fakultas <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ilmu Komputer"
                      value={fakultas}
                      onChange={(e) => setFakultas(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Program Studi <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. S1 Teknik Informatika"
                      value={prodi}
                      onChange={(e) => setProdi(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Jenis Kelamin <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={jenisKelamin}
                      onChange={(e) => setJenisKelamin(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    >
                      <option value="Laki-Laki">Laki-Laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Nomor HP / WhatsApp <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 081234567890"
                      value={noHp}
                      onChange={(e) => setNoHp(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Tempat Lahir <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bandar Lampung"
                      value={tempatLahir}
                      onChange={(e) => setTempatLahir(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Tanggal Lahir <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={tanggalLahir}
                      onChange={(e) => setTanggalLahir(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Kabupaten / Kota Domisili <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={kota}
                      onChange={(e) => setKota(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white font-semibold"
                    >
                      {PILIHAN_KOTA_KABUPATEN.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Alamat Lengkap Domisili <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Kecamatan, RT/RW, dsb."
                      value={alamat}
                      onChange={(e) => setAlamat(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: PERIODE MAGANG */}
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <h3 className="text-xs font-bold border-b border-neutral-100 pb-1.5 flex items-center gap-1.5 uppercase tracking-wider text-blue-800">
                  <BookOpen className="h-4 w-4 text-emerald-700" />
                  Bagian 3: Periode PKL / Magang
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Tanggal Mulai Magang <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={tanggalMulai}
                      onChange={(e) => setTanggalMulai(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 uppercase mb-1.5">
                      Tanggal Selesai Magang <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={tanggalSelesai}
                      onChange={(e) => setTanggalSelesai(e.target.value)}
                      className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-200/60 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer text-center font-semibold"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] bg-emerald-700 hover:bg-emerald-800 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Mendaftarkan Akun...' : 'Daftar & Masuk Otomatis ✓'}
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
