import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { safeSetDoc as setDoc, safeGetDocs as getDocs } from '../utils/firestoreHelper';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, AbsensiRecord, LogbookRecord, LaporanAkhir } from '../types';
import { compressImage } from '../utils/imageCompressor';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, FileText, UploadCloud,
  FileCheck, User, BarChart4, MapPin, Eye, Play, MapIcon, Compass, Landmark, RefreshCw
} from 'lucide-react';

interface PesertaDashboardProps {
  user: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onShowMessage: (text: string, type: 'success' | 'error' | 'warning') => void;
  onLogout: () => void;
}

// Kejaksaan Tinggi Lampung Coordinate Center
const KEJATI_LAT = -5.44198758263608;
const KEJATI_LNG = 105.25935793871486;
const MAX_RADIUS = 90; // meters

export default function PesertaDashboard({ user, onUpdateProfile, onShowMessage, onLogout }: PesertaDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'absensi' | 'logbook' | 'laporan'>('dashboard');
  
  // App states
  const [absensiHistory, setAbsensiHistory] = useState<AbsensiRecord[]>([]);
  const [logbookList, setLogbookList] = useState<LogbookRecord[]>([]);
  const [laporan, setLaporan] = useState<LaporanAkhir | null>(null);
  
  // Form states for logbook
  const [logTanggal, setLogTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [logKegiatan, setLogKegiatan] = useState('');
  const [logUraian, setLogUraian] = useState('');
  const [logHasil, setLogHasil] = useState('');
  const [logKendala, setLogKendala] = useState('');
  const [logSolusi, setLogSolusi] = useState('');
  
  // GPS States
  const [realLat, setRealLat] = useState<number | null>(null);
  const [realLng, setRealLng] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  
  // File upload state for PDF report
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Time tracker
  const [currentTime, setCurrentTime] = useState(new Date());

  const refreshGps = (silent = false) => {
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung Geolocation.');
      return;
    }
    setLoadingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealLat(pos.coords.latitude);
        setRealLng(pos.coords.longitude);
        setLoadingGps(false);
        if (!silent) {
          onShowMessage('Sinyal GPS berhasil sinkron presesi!', 'success');
        }
      },
      (err) => {
        console.warn('Geolocation access blocked or unavailable:', err.message);
        setGpsError(err.message);
        setLoadingGps(false);
        if (!silent) {
          onShowMessage('Lokasi tidak terdeteksi. Silakan aktifkan izin lokasi.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Set up timer and browser GPS on mount
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    refreshGps(true);
    return () => clearInterval(timer);
  }, []);

  // Fetch histories
  const fetchHistories = async () => {
    try {
      // 1. Fetch Absensi
      const absQuery = query(
        collection(db, 'absensi'),
        where('uid', '==', user.uid),
        orderBy('tanggal', 'desc')
      );
      const absSnap = await getDocs(absQuery);
      const absArr: AbsensiRecord[] = [];
      absSnap.forEach((doc) => {
        absArr.push(doc.data() as AbsensiRecord);
      });
      setAbsensiHistory(absArr);

      // 2. Fetch Logbooks
      const logQuery = query(
        collection(db, 'logbook'),
        where('uid', '==', user.uid),
        orderBy('tanggal', 'desc')
      );
      const logSnap = await getDocs(logQuery);
      const logArr: LogbookRecord[] = [];
      logSnap.forEach((doc) => {
        logArr.push(doc.data() as LogbookRecord);
      });
      setLogbookList(logArr);

      // 3. Fetch Laporan
      const lapSnap = await getDocs(
        query(collection(db, 'laporan'), where('uid', '==', user.uid))
      );
      if (!lapSnap.empty) {
        setLaporan(lapSnap.docs[0].data() as LaporanAkhir);
      } else {
        setLaporan(null);
      }
    } catch (err) {
      console.error('Error fetching participant data:', err);
    }
  };

  useEffect(() => {
    fetchHistories();
  }, [user.uid]);

  // Haversine formula implementation
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Determine current active GPS reading (Pure Real-Time GPS)
  const activeLat = realLat;
  const activeLng = realLng;
  const currentDistance = (realLat !== null && realLng !== null)
    ? getDistanceInMeters(realLat, realLng, KEJATI_LAT, KEJATI_LNG)
    : 999999;
  const isInsideRadius = currentDistance <= MAX_RADIUS;

  // Day check
  const daysString = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = currentTime.getDay();
  const currentDayName = daysString[dayIndex];
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isFriday = dayIndex === 5;

  const todayStr = currentTime.toISOString().split('T')[0];

  // LOGIKA MASA MAGANG
  const pklStart = user.dataMagang?.tanggalMulai || '';
  const pklEnd = user.dataMagang?.tanggalSelesai || '';
  const isBeforePeriod = todayStr < pklStart;
  const isAfterPeriod = todayStr > pklEnd;
  const isDuringPeriod = todayStr >= pklStart && todayStr <= pklEnd;

  // Auto transition to "Selesai" if date passed
  useEffect(() => {
    if (isAfterPeriod && user.status === 'Aktif') {
      const updateStatus = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { status: 'Selesai' }, { merge: true });
          onUpdateProfile({ ...user, status: 'Selesai' });
          onShowMessage('Periode magang Anda telah berakhir secara otomatis.', 'warning');
        } catch (e) {
          console.error(e);
        }
      };
      updateStatus();
    }
  }, [isAfterPeriod, user.status]);

  // Statistics calculation
  const totalHadir = absensiHistory.filter(a => a.datang?.status === 'Hadir').length;
  const totalTerlambat = absensiHistory.filter(a => a.datang?.status === 'Terlambat').length;
  const totalLogbook = logbookList.length;

  const getDaysDiff = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(1, Math.floor((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
  };

  const totalHariMagang = getDaysDiff(pklStart, pklEnd);
  
  // Calculating current progress days
  const calculateElapsedDays = () => {
    if (!pklStart || isBeforePeriod) return 0;
    if (isAfterPeriod) return totalHariMagang;
    return getDaysDiff(pklStart, todayStr);
  };
  const currentElapsedDays = calculateElapsedDays();
  const progressPercent = totalHariMagang > 0 ? Math.min(100, Math.round((currentElapsedDays / totalHariMagang) * 100)) : 0;

  // Single-submission checks for the day
  const todayAbsenRecord = absensiHistory.find(a => a.tanggal === todayStr);
  const alreadyCheckedIn = !!todayAbsenRecord?.datang;
  const alreadyCheckedOut = !!todayAbsenRecord?.pulang;

  // ABSENSI SUBMISSION HANDLER
  const handleAbsensi = async (tipe: 'datang' | 'pulang') => {
    if (isBeforePeriod) {
      onShowMessage('Periode magang Anda belum dimulai.', 'warning');
      return;
    }
    if (isAfterPeriod) {
      onShowMessage('Periode magang Anda telah selesai. Anda tidak dapat melakukan absensi.', 'warning');
      return;
    }
    if (isWeekend) {
      onShowMessage('Hari libur, absensi ditutup.', 'warning');
      return;
    }

    // 1. LOGBOOK CHECK: "Jika logbook hari sebelumnya belum diisi: Peserta tidak dapat melakukan absensi hari berikutnya."
    // Find previous workdays attended
    if (tipe === 'datang') {
      const datesAttended = absensiHistory
        .map(a => a.tanggal)
        .filter(d => d < todayStr)
        .sort(); // ascending dates

      if (datesAttended.length > 0) {
        const lastAttendedDate = datesAttended[datesAttended.length - 1];
        // Check if there is a logbook for this lastAttendedDate
        const hasLogbookForLastDate = logbookList.some(l => l.tanggal === lastAttendedDate);
        if (!hasLogbookForLastDate) {
          onShowMessage(`Kewajiban Pengisian: Silakan lengkapi logbook tanggal ${lastAttendedDate} terlebih dahulu sebelum absen hari ini.`, 'error');
          setActiveTab('logbook'); // Redirect to logbook tab
          return;
        }
      }
    }

    // 2. Jumat WFH or radius validation
    if (!isFriday) {
      if (realLat === null || realLng === null) {
        onShowMessage('Gagal mendeteksi lokasi presisi GPS Anda. Silakan izinkan akses lokasi (Geolocation) di browser Anda dan klik tombol perbarui sinyal GPS.', 'error');
        return;
      }
      if (!isInsideRadius) {
        onShowMessage(`Absensi ditolak. Anda berada di luar area Kejaksaan Tinggi Lampung (Radius 90 meter). Jarak Anda saat ini: ${currentDistance.toFixed(1)} meter dari kantor Kejati.`, 'error');
        return;
      }
    }

    // Determine late check-in (threshold standard office check-in 08:00:00)
    const hh = currentTime.getHours();
    const mm = currentTime.getMinutes();
    const isLate = tipe === 'datang' && (hh > 8 || (hh === 8 && mm > 0));

    try {
      const docId = `${user.uid}_${todayStr}`;
      const docRef = doc(db, 'absensi', docId);

      const log: any = {
        waktu: currentTime.toTimeString().split(' ')[0],
        latitude: activeLat,
        longitude: activeLng,
        isWFH: isFriday,
        status: isLate ? 'Terlambat' : 'Hadir'
      };

      let updatePayload: Partial<AbsensiRecord> = {};

      if (tipe === 'datang') {
        if (alreadyCheckedIn) {
          onShowMessage('Anda sudah mengirim absensi Datang hari ini.', 'warning');
          return;
        }
        updatePayload = {
          id: docId,
          uid: user.uid,
          email: user.email,
          namaLengkap: user.displayName,
          bidang: user.dataMagang?.bidang || 'Lainnya',
          tanggal: todayStr,
          hari: currentDayName,
          datang: log,
          statusAbsen: log.status
        };
      } else {
        if (!alreadyCheckedIn) {
          onShowMessage('Silakan melakukan absensi Datang terlebih dahulu.', 'warning');
          return;
        }
        if (alreadyCheckedOut) {
          onShowMessage('Anda sudah mengirim absensi Pulang hari ini.', 'warning');
          return;
        }
        updatePayload = {
          pulang: log
        };
      }

      await setDoc(docRef, updatePayload, { merge: true });

      // Create Audit trail
      const auditRef = doc(db, 'audit', `absen_${tipe}_${user.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: user.uid,
        email: user.email,
        namaLengkap: user.displayName,
        role: user.role,
        aktivitas: `Absen ${tipe === 'datang' ? 'Datang' : 'Pulang'}`,
        detail: `Melakukan absen ${tipe} pada ${log.waktu} (${isFriday ? 'WFH Jumat' : 'WFO'}). Status: ${log.status}`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Absensi ${tipe === 'datang' ? 'Datang' : 'Pulang'} berhasil dicatat!`, 'success');
      fetchHistories();
    } catch (err: any) {
      console.error(err);
      onShowMessage(`Gagal mengirim absensi: ${err.message}`, 'error');
    }
  };

  // LOGBOOK HARIAN SUBMISSION
  const handleLogbookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logKegiatan || !logUraian || !logHasil) {
      onShowMessage('Uraikan kegiatan, rincian pekerjaan dan hasil pekerjaan Anda.', 'warning');
      return;
    }

    try {
      const logId = `log_${user.uid}_${logTanggal.replace(/-/g, '')}`;
      const logRef = doc(db, 'logbook', logId);

      const record: LogbookRecord = {
        id: logId,
        uid: user.uid,
        namaLengkap: user.displayName,
        bidang: user.dataMagang?.bidang || 'Lainnya',
        tanggal: logTanggal,
        kegiatan: logKegiatan,
        uraianPekerjaan: logUraian,
        hasilPekerjaan: logHasil,
        kendala: logKendala || 'Tidak ada kendala',
        solusi: logSolusi || 'Tidak ada tindakan khusus',
        createdAt: new Date().toISOString()
      };

      await setDoc(logRef, record);

      // Audit trail
      const auditRef = doc(db, 'audit', `logbook_${user.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: user.uid,
        email: user.email,
        namaLengkap: user.displayName,
        role: user.role,
        aktivitas: 'Isi Logbook',
        detail: `Mengisi logbook kegiatan harian PKL untuk tanggal ${logTanggal}`,
        timestamp: new Date().toISOString()
      });

      onShowMessage('Logbook harian berhasil tersimpan!', 'success');
      fetchHistories();

      // Clear input fields (except date)
      setLogKegiatan('');
      setLogUraian('');
      setLogHasil('');
      setLogKendala('');
      setLogSolusi('');
    } catch (err: any) {
      console.error(err);
      onShowMessage(`Gagal menyimpan logbook: ${err.message}`, 'error');
    }
  };

  // PDF LAPORAN AKHIR HANDLER
  const handleReportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      onShowMessage('Pilih file laporan format PDF terlebih dahulu.', 'warning');
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      onShowMessage('Ukuran file PDF melebihi batas maksimal 20 MB.', 'error');
      return;
    }

    setUploadingReport(true);
    try {
      // 1. Attempt Real upload to Firebase Storage
      const storagePath = `reports/${user.uid}/${Date.now()}_${selectedFile.name}`;
      const fileRef = ref(storage, storagePath);
      
      let uploadUrl = '';
      try {
        const uploadResult = await uploadBytes(fileRef, selectedFile);
        uploadUrl = await getDownloadURL(uploadResult.ref);
      } catch (storageErr) {
        // Safe Graceful Fallback if Storage Bucket is not activated/unreachable in sandbox
        console.warn('Firebase Storage blocked or unconfigured, fallback to Base64 to save on Free Tier Firestore:', storageErr);
        
        // Convert to Base64 so we can save the actual PDF content securely in Firestore
        if (selectedFile.size > 1024 * 1024 * 0.95) {
          // Firestore document limit is 1MB. 950KB allows overhead marge.
          throw new Error('Sistem mendeteksi Firebase Storage belum aktif di Firebase Console Anda. Untuk menyimpan file langsung ke database (Base64), ukuran PDF tidak boleh lebih dari 950 KB.');
        }

        const base64Promise = new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsDataURL(selectedFile);
        });

        uploadUrl = await base64Promise;
        onShowMessage('Storage tidak aktif, sistem otomatis menyimpan PDF asli langsung ke Database!', 'warning');
      }

      const reportPayload: LaporanAkhir = {
        uid: user.uid,
        namaLengkap: user.displayName,
        bidang: user.dataMagang?.bidang || 'Lainnya',
        fileName: selectedFile.name,
        fileURL: uploadUrl,
        tanggalUpload: new Date().toISOString(),
        statusUpload: 'Success'
      };

      // Write to Laporan database
      await setDoc(doc(db, 'laporan', user.uid), reportPayload);

      // Audit trail
      const auditRef = doc(db, 'audit', `upload_${user.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: user.uid,
        email: user.email,
        namaLengkap: user.displayName,
        role: user.role,
        aktivitas: 'Upload Laporan Akhir',
        detail: `Berhasil mengunggah dokumen PDF laporan akhir: ${selectedFile.name}`,
        timestamp: new Date().toISOString()
      });

      onShowMessage('Laporan akhir format PDF berhasil diunggah!', 'success');
      fetchHistories();
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      onShowMessage(`Gagal mengunggah laporan: ${err.message}`, 'error');
    } finally {
      setUploadingReport(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="peserta-dashboard">
      
      {/* Alert Header if before or after period */}
      {isBeforePeriod && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-700 p-4 rounded-r-lg shadow-sm">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-700 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-extrabold text-red-950 uppercase">PEMBERITAHUAN SISTEM</h3>
              <p className="text-xs text-red-900 font-semibold mt-1">
                "Periode magang Anda belum dimulai." Kegiatan absensi harian dan pencatatan logbook masih dikunci (Mulai tanggal {pklStart}).
              </p>
            </div>
          </div>
        </div>
      )}

      {isAfterPeriod && (
        <div className="mb-6 bg-amber-50 border-l-4 border-[#D4AF37] p-4 rounded-r-lg shadow-sm">
          <div className="flex">
            <CheckCircle2 className="h-5 w-5 text-amber-700 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-extrabold text-amber-950 uppercase">MAGANG / PKL SELESAI</h3>
              <p className="text-xs text-amber-900 font-semibold mt-1">
                Periode magang Anda telah berakhir per tanggal {pklEnd}. Absensi dan Logbook dikunci. Silakan melengkapi menu <strong>Upload Laporan Akhir</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Timer Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        
        {/* Profile Card */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group cursor-pointer" title="Klik untuk ubah pas foto">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 rounded-full border-2 border-yellow-400 object-cover shadow-sm bg-slate-100"
                />
              ) : (
                <div className="h-16 w-16 rounded-full border-2 border-slate-300 border-dashed bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full border border-white shadow-md cursor-pointer transition-all">
                <UploadCloud className="h-3 w-3" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        onShowMessage('Ukuran file foto maksimal adalah 5MB.', 'warning');
                        return;
                      }
                      try {
                        const compressed = await compressImage(file);
                        const userRef = doc(db, 'users', user.uid);
                        await setDoc(userRef, { photoURL: compressed }, { merge: true });
                        onUpdateProfile({ ...user, photoURL: compressed });
                        
                        // Track in audit log
                        const auditRef = doc(db, 'audit', `photo_${user.uid}_${Date.now()}`);
                        await setDoc(auditRef, {
                          id: auditRef.id,
                          uid: user.uid,
                          email: user.email,
                          namaLengkap: user.displayName,
                          role: user.role,
                          aktivitas: 'Ubah Pas Foto',
                          detail: 'Pas foto resmi berhasil diperbarui dari Dashboard.',
                          timestamp: new Date().toISOString()
                        });
                        
                        onShowMessage('Pas foto Anda berhasil diperbarui!', 'success');
                      } catch (err) {
                        console.error(err);
                        onShowMessage('Gagal memperbarui pas foto.', 'error');
                      }
                    }
                  }}
                />
              </label>
            </div>
            <div className="text-center sm:text-left flex-1 min-w-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 mb-1">
                STATUS: {user.status.toUpperCase()}
              </span>
              <h1 className="text-xl font-extrabold text-emerald-800 font-display tracking-tight truncate">{user.displayName}</h1>
              <p className="text-xs text-slate-500 font-medium">
                NIM: {user.biodata?.nim} • {user.biodata?.universitas}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                  PENEMPATAN BIDANG: <strong className="text-blue-800 font-extrabold">{user.dataMagang?.bidang}</strong>
                </span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md border border-blue-200">
                  PERIODE PKL: <strong className="text-slate-800">{pklStart}</strong> s.d. <strong className="text-slate-800">{pklEnd}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Realtime Clock Card */}
        <div className="bg-gradient-to-br from-emerald-800 to-blue-900 p-5 rounded-2xl shadow-md text-white border-b-2 border-yellow-400 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest font-mono">SENSU PATROL CLOCK</span>
            <Clock className="h-4 w-4 text-yellow-300 animate-pulse" />
          </div>
          <div className="my-2 text-center sm:text-left">
            <span className="text-2xl font-extrabold block tracking-wider font-mono text-yellow-300">
              {currentTime.toTimeString().split(' ')[0]}
            </span>
            <span className="text-[11px] text-blue-100 block mt-0.5">
              {currentDayName}, {currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <div className="text-[9px] text-emerald-200 uppercase font-mono tracking-wider text-center bg-black/20 py-0.5 rounded">
            KEJAKSAAN TINGGI LAMPUNG
          </div>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6" id="pkl-progress">
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center space-x-2">
            <BarChart4 className="h-4 w-4 text-emerald-800" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Progress Kegiatan Magang</span>
          </div>
          <span className="text-xs font-bold text-emerald-800">{currentElapsedDays} / {totalHariMagang} Hari PKL ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
          <div
            className="bg-gradient-to-r from-blue-600 to-emerald-600 h-full rounded-full transition-all duration-500 border-r border-yellow-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* DASHBOARD TABS */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto gap-2" id="dashboard-tab-headers">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm uppercase whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeTab === 'dashboard'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Ringkasan & Stats
        </button>
        <button
          onClick={() => setActiveTab('absensi')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm uppercase whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeTab === 'absensi'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Absensi Berbasis GPS
        </button>
        <button
          onClick={() => setActiveTab('logbook')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm uppercase whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeTab === 'logbook'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Logbook Harian
        </button>
        <button
          onClick={() => {
            if (isAfterPeriod) {
              setActiveTab('laporan');
            } else {
              onShowMessage('Menu Upload Laporan Akhir akan dibuka secara otomatis jika periode magang Anda telah melampaui tanggal selesai.', 'warning');
            }
          }}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm uppercase whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            isAfterPeriod ? '' : 'opacity-50 cursor-not-allowed'
          } ${
            activeTab === 'laporan'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Laporan Akhir {!isAfterPeriod && '🔒'}
        </button>
      </div>

      {/* ==================== TAB 1: RINGKASAN & STATS ==================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6" id="overview-pane">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Hadir</p>
              <h3 className="text-2xl font-extrabold text-emerald-700 font-display">{totalHadir} Hari</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Terlambat</p>
              <h3 className="text-2xl font-extrabold text-orange-500 font-display">{totalTerlambat} Hari</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Logbook</p>
              <h3 className="text-2xl font-extrabold text-blue-600 font-display">{totalLogbook} Laporan</h3>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Intern</p>
              <h3 className="text-2xl font-extrabold text-slate-700 font-display">{user.status}</h3>
            </div>
          </div>

          {/* Quick Access or Guide Column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guide Info */}
            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-yellow-400/30">
              <h3 className="text-sm font-extrabold text-emerald-800 font-display uppercase tracking-wide flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4 text-[#D4AF37]" />
                Aturan & Jam Operasional Khusus
              </h3>
              <ul className="text-xs text-slate-700 space-y-2.5 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">▪</span>
                  <span><strong>Waktu Absensi:</strong> Hari Kerja Senin s.d. Jumat. Batas toleransi terlambat adalah jam <strong>08.00 WIB</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">▪</span>
                  <span><strong>Hari Jumat (WFH):</strong> Diperbolehkan absen dari luar kantor Kejaksaan Tinggi Lampung. Tetapi GPS Anda tetap direkam di dalam sistem database.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">▪</span>
                  <span><strong>Logbook Wajib:</strong> Anda <strong>tidak dapat absen hari berikutnya</strong> jika logbook hari keaktifan sebelumnya belum Anda lengkapi.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold">▪</span>
                  <span><strong>Unggah Laporan Akhir:</strong> Terbuka otomatis setelah melewati tanggal selesai magang ({pklEnd}). format dokumen wajib PDF (Maks. 20 MB).</span>
                </li>
              </ul>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase mb-2 text-left">Akses Cepat</h3>
                <p className="text-xs text-slate-500 leading-snug">Silakan pilih menu tab di atas untuk mengentri Absensi Harian atau mengisi logbook rincian pekerjaan Anda.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => setActiveTab('absensi')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 text-xs rounded-lg transition-all cursor-pointer border border-yellow-400 text-center"
                >
                  Buka Absensi GPS
                </button>
                <button
                  onClick={() => setActiveTab('logbook')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 text-xs rounded-lg transition-all cursor-pointer border border-slate-200 text-center"
                >
                  Buka Logbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: ABSENSI BERBASIS GPS ==================== */}
      {activeTab === 'absensi' && (
        <div className="space-y-6" id="absensi-pane">
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Check-In Check-Out Panel */}
            <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-700 font-display uppercase tracking-wide flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-emerald-700" />
                Registrasi Absensi Harian
              </h3>

              {/* Status Absensi Hari Ini */}
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 flex justify-between items-center mb-4 text-xs font-medium">
                <span className="text-slate-500">Status Hari Ini ( {todayStr} ):</span>
                <span className="font-extrabold tracking-wider text-slate-800 uppercase">
                  {!todayAbsenRecord ? 'BELUM ABSEN' : 
                   (todayAbsenRecord.datang && todayAbsenRecord.pulang) ? 'SELESAI ABSEN' : 
                   'SUDAH ABSEN DATANG'}
                </span>
              </div>

              {/* Action Buttons Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                
                {/* Datang Button */}
                <button
                  onClick={() => handleAbsensi('datang')}
                  disabled={alreadyCheckedIn || isBeforePeriod || isAfterPeriod || isWeekend}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all cursor-pointer ${
                    alreadyCheckedIn
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 cursor-not-allowed'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-600'
                  }`}
                  id="absen-datang-btn"
                >
                  <Calendar className={`h-8 w-8 mb-2 ${alreadyCheckedIn ? 'text-emerald-600' : 'text-emerald-700'}`} />
                  <span className="text-[14px] font-bold uppercase tracking-wider">Absen Masuk (Datang)</span>
                  {alreadyCheckedIn ? (
                    <span className="text-[11px] font-medium text-emerald-600 mt-1">
                      Jam Masuk: {todayAbsenRecord.datang?.waktu} ({todayAbsenRecord.datang?.status})
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-neutral-400 mt-1">Batas : 08.00 WIB</span>
                  )}
                </button>

                {/* Pulang Button */}
                <button
                  onClick={() => handleAbsensi('pulang')}
                  disabled={!alreadyCheckedIn || alreadyCheckedOut || isBeforePeriod || isAfterPeriod || isWeekend}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all cursor-pointer ${
                    alreadyCheckedOut
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-500 cursor-not-allowed'
                      : !alreadyCheckedIn
                      ? 'opacity-50 border-neutral-200 bg-[#f4f4f7] cursor-not-allowed'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50 hover:border-emerald-600'
                  }`}
                  id="absen-pulang-btn"
                >
                  <Clock className={`h-8 w-8 mb-2 ${alreadyCheckedOut ? 'text-neutral-500' : 'text-blue-600'}`} />
                  <span className="text-[14px] font-bold uppercase tracking-wider">Absen keluar (Pulang)</span>
                  {alreadyCheckedOut ? (
                    <span className="text-[11px] font-medium text-neutral-600 mt-1">
                      Jam Keluar: {todayAbsenRecord.pulang?.waktu}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-neutral-400 mt-1">Wajib Absen Datang Dahulu</span>
                  )}
                </button>
              </div>

              {/* Radius Feedback Warning */}
              {isFriday ? (
                <div className="bg-emerald-50 border border-emerald-300 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold uppercase text-emerald-800 block mb-0.5">Hari Jumat - Boleh WFH</span>
                    Peserta diperbolehkan melakukan absensi dari mana saja pada hari Jumat, namun data GPS real-time tetap tercantum di dalam sistem audit Kejaksaan.
                  </div>
                </div>
              ) : isInsideRadius ? (
                <div className="bg-emerald-50 border border-emerald-300 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold uppercase text-emerald-800 block mb-0.5">Lokasi Terverifikasi</span>
                    Anda berada di dalam jangkauan radius ({currentDistance.toFixed(1)} meter). Absensi WFO diperbolehkan.
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-300 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs text-red-950 font-medium">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-extrabold uppercase text-red-800 block mb-0.5">Diluar Radius Kantor</span>
                    Perangkat Anda terdeteksi berada di luar area Kejaksaan Tinggi Lampung atau sinyal GPS sedang kurang akurat. Silakan periksa koneksi GPS Anda.
                  </div>
                </div>
              )}
            </div>

            {/* Real GPS Geofence & Tracker Card */}
            <div className="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-xs font-extrabold text-[#D4AF37] font-display uppercase tracking-wider flex items-center gap-2 mb-3 border-b border-neutral-200 pb-2">
                  <Compass className="h-4 w-4 text-emerald-700 animate-spin" style={{ animationDuration: '8s' }} />
                  Verifikasi Geofence GPS Presisi
                </h3>
                <p className="text-xs text-neutral-600 leading-snug mb-4">
                  Sistem mendeteksi koordinat nyata secara langsung menggunakan sensor lokasi (Geolocation API) di HP/Laptop Anda.
                </p>

                <div className="space-y-4 text-xs font-medium">
                  {/* Real-time coordinates panel */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">GPS Tracker Status</span>
                      {loadingGps ? (
                        <span className="inline-flex items-center text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded animate-pulse">
                          Mencari Sinyal...
                        </span>
                      ) : realLat !== null ? (
                        <span className="inline-flex items-center text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                          Sinyal GPS Terkunci
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">
                          GPS Terblokir / Loading
                        </span>
                      )}
                    </div>

                    {realLat !== null && realLng !== null ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono">Latitude</span>
                            <span className="font-mono font-bold text-slate-800">{realLat.toFixed(6)}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-mono">Longitude</span>
                            <span className="font-mono font-bold text-slate-800">{realLng.toFixed(6)}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500">Jarak Anda ke Kantor Kejati:</span>
                          <span className={`font-extrabold ${isInsideRadius ? 'text-emerald-700' : 'text-red-700'}`}>
                            {currentDistance < 1000 ? `${currentDistance.toFixed(1)} Meter` : `${(currentDistance/1000).toFixed(2)} Km`} 
                            <span> ({isInsideRadius ? 'MEMENUHI SYARAT' : 'DI LUAR BATAS'})</span>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <p className="text-xs text-neutral-400 font-medium">Sinyal lokasi belum terdeteksi</p>
                        <p className="text-[10px] mt-2 text-amber-800 font-bold bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 block leading-normal">
                          Mohon periksa dan aktifkan izin lokasi (GPS) pada peramban/smartphone Anda lalu tekan tombol perbarui di bawah.
                        </p>
                      </div>
                    )}

                    {/* Refresh GPS button */}
                    <button
                      type="button"
                      onClick={() => refreshGps()}
                      disabled={loadingGps}
                      className="w-full flex justify-center items-center gap-2 mt-2 px-3 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingGps ? 'animate-spin' : ''}`} />
                      {loadingGps ? 'Memperbarui Koordinat...' : 'PERBARUI SINYAL GPS'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Coordinate Info Box */}
              <div className="bg-slate-200/55 p-3 rounded-xl border border-slate-300 mt-4 text-[11px] text-slate-700 space-y-1">
                <span className="font-extrabold uppercase tracking-widest text-emerald-800 block">TITIK ACUAN KORIDOR:</span>
                <p><strong>Kejaksaan Tinggi Lampung (Pusat Gedung)</strong></p>
                <p className="font-mono">Lat: {KEJATI_LAT}, Lng: {KEJATI_LNG}</p>
                <p className="text-[10px] text-slate-500 italic mt-1">*Keberadaan dalam radius maksimal 90 meter wajib dipenuhi pada hari Senin s.d. Kamis untuk mencegah absensi fiktif luar area kerja.</p>
              </div>
            </div>
          </div>

          {/* Absensi History List / Table */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-emerald-700" />
              Riwayat Absensi Kehadiran Anda
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200" id="absensi-history-table">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Hari</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Absen Masuk (Datang)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Absen Keluar (Pulang)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status Absen</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Lokasi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200 text-xs">
                  {absensiHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-medium italic">
                        Belum ada riwayat perekaman absensi yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    absensiHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-neutral-900">{item.tanggal}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-neutral-500">{item.hari}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-neutral-800">
                          {item.datang ? (
                            <span>{item.datang.waktu} <span className="text-[10px] text-neutral-500">WIB</span></span>
                          ) : (
                            <span className="text-red-400 italic font-sans font-medium">Bypass/Alpa</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-neutral-800">
                          {item.pulang ? (
                            <span>{item.pulang.waktu} <span className="text-[10px] text-neutral-500">WIB</span></span>
                          ) : (
                            <span className="text-yellow-600 italic font-sans font-medium">Belum Pulang</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.statusAbsen === 'Hadir' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : item.statusAbsen === 'Terlambat' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.statusAbsen}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-[10px] text-neutral-500">
                          {item.datang?.isWFH ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-sans font-bold px-1.5 py-0.5 rounded uppercase">WFH JUMAT</span>
                          ) : (
                            <span>{item.datang?.latitude.toFixed(4)}, {item.datang?.longitude.toFixed(4)}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: LOGBOOK HARIAN ==================== */}
      {activeTab === 'logbook' && (
        <div className="space-y-8" id="logbook-pane">
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Input Logbook Form */}
            <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-700 font-display uppercase tracking-wide flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-blue-700" />
                Input Rincian Logbook Harian
              </h3>

              <form onSubmit={handleLogbookSubmit} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tanggal Kegiatan</label>
                    <input
                      type="date"
                      required
                      value={logTanggal}
                      onChange={(e) => setLogTanggal(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Bidang / Dep</label>
                    <input
                      type="text"
                      disabled
                      value={user.dataMagang?.bidang || ''}
                      className="w-full rounded-lg border border-slate-250 px-3 py-2 text-xs bg-slate-50 text-slate-650 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Kegiatan Utama (Judul Pokok)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Membantu administrasi pemberkasan kasus Pihak X"
                    value={logKegiatan}
                    onChange={(e) => setLogKegiatan(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Uraian Rinci Pekerjaan</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Tulis kronologi sistem atau pekerjaan yang diselesaikan secara mendalam..."
                    value={logUraian}
                    onChange={(e) => setLogUraian(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Hasil Pekerjaan (Output)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5 berkas dakwaan selesai direkapitulasi"
                    value={logHasil}
                    onChange={(e) => setLogHasil(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Kendala / Masalah (Opsional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Listrik padam di ruang administrasi"
                      value={logKendala}
                      onChange={(e) => setLogKendala(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tindakan Solusi (Opsional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Menggunakan daya cadangan UPS darurat"
                      value={logSolusi}
                      onChange={(e) => setLogSolusi(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isBeforePeriod || isAfterPeriod}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 border border-yellow-400 transition-all cursor-pointer"
                    id="logbook-submit-btn"
                  >
                    <FileCheck className="h-4 w-4 text-yellow-300" />
                    SIMPAN LOGBOOK KEHADIRAN
                  </button>
                </div>
              </form>
            </div>

            {/* Rules and Explanation card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-blue-800 to-indigo-950 p-5 rounded-2xl shadow-md text-white border-b-2 border-yellow-400 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-yellow-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5" />
                  Kewajiban Pengisian
                </h3>
                <div className="space-y-4 text-xs font-medium text-blue-100 leading-relaxed">
                  <p>
                    Setiap peserta magang / PKL di Kejaksaan Tinggi Lampung diwajibkan untuk menguraikan kegiatan magang mereka setiap hari kerja secara berkala.
                  </p>
                  <p className="bg-black/35 p-3 rounded-lg border border-blue-800 text-[11px]">
                    <strong>SANKSI ABSENSI GANDA/REDAKSIONAL:</strong><br/>
                    "Jika logbook hari sebelumnya belum diisi, peserta tidak dapat melakukan absensi hari berikutnya."
                  </p>
                  <p>
                    Sistem akan memverifikasi riwayat kehadiran terdahulu. Pastikan menyisipkan uraian pekerjaan yang jelas, hasil output kerja, kendala yang dihadapi, serta solusi yang berhasil diterapkan.
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-blue-300 uppercase font-mono tracking-tight text-center bg-black/25 py-1.5 rounded mt-4">
                Sistem Perekaman Kejati Lampung
              </div>
            </div>
          </div>

          {/* Logbook History Table */}
          <div className="bg-white p-6 rounded-2xl shadow-md border border-neutral-200">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4">
              <FileCheck className="h-5 w-5 text-emerald-700" />
              Riwayat Logbook Harian Anda
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-200" id="logbook-history-table">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Kegiatan Utama</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Uraian Rinci</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Hasil (Output)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Kendala & Solusi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200 text-xs">
                  {logbookList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 font-medium italic">
                        Belum ada entri logbook harian yang diisi.
                      </td>
                    </tr>
                  ) : (
                    logbookList.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-neutral-900">{item.tanggal}</td>
                        <td className="px-6 py-4 font-bold text-emerald-800 max-w-[150px] truncate">{item.kegiatan}</td>
                        <td className="px-6 py-4 text-neutral-600 max-w-[250px] whitespace-normal break-words">{item.uraianPekerjaan}</td>
                        <td className="px-6 py-4 font-semibold text-neutral-800">{item.hasilPekerjaan}</td>
                        <td className="px-6 py-4 text-neutral-500">
                          <p className="font-semibold text-red-800">Kasus: {item.kendala}</p>
                          <p className="font-semibold text-emerald-800 mt-0.5">Solusi: {item.solusi}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 4: LAPORAN AKHIR (ONLY POST PKL-END) ==================== */}
      {activeTab === 'laporan' && isAfterPeriod && (
        <div className="space-y-6" id="laporan-pane">
          
          <div className="bg-white p-5 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-extrabold text-emerald-800 font-display uppercase tracking-wider flex items-center gap-2 mb-4">
              <UploadCloud className="h-4 w-4 text-yellow-300" />
              UNGGAH LAPORAN AKHIR MAGANG
            </h3>

            {/* Current report upload status feedback */}
            {laporan ? (
              <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-emerald-100 rounded-2xl">
                    <FileCheck className="h-8 w-8 text-emerald-700" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-bold text-emerald-950 text-sm">{laporan.fileName}</h4>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">Diupload pada: {new Date(laporan.tanggalUpload).toLocaleString('id-ID')}</p>
                    <p className="text-[10px] bg-emerald-200/50 text-emerald-900 px-2 py-0.5 rounded font-bold font-sans max-w-max mt-1">Status: {laporan.statusUpload}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={laporan.fileURL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-yellow-400 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    LIHAT DOKUMEN PDF
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-200 p-6 rounded-2xl text-center text-neutral-500 mb-6 font-medium italic">
                Anda belum mengunggah Laporan Akhir. Silakan pilih dokumen PDF resmi laporan magang Anda di bawah ini.
              </div>
            )}

            {/* PDF Form Upload Input */}
            <form onSubmit={handleReportUpload} className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs font-extrabold text-neutral-700 uppercase mb-2">Formulir Dokumen Laporan (Maks. 20 MB, format .pdf)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-200 hover:border-emerald-600 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <UploadCloud className="h-10 w-10 text-neutral-400 mb-2" />
                      <p className="text-xs text-neutral-700 font-bold mb-1">
                        {selectedFile ? selectedFile.name : 'Seret file atau klik untuk memilih dokumen'}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-mono">PDF formats up to 20 Megabytes size</p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="px-4 py-2 border border-neutral-300 rounded-xl text-neutral-700 hover:bg-neutral-50 text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  disabled={uploadingReport || !selectedFile}
                  className="flex items-center gap-1.5 px-4 py-2 border border-yellow-400 text-xs font-bold rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="h-4 w-4 text-yellow-300" />
                  {uploadingReport ? 'Mengunggah Dokumen...' : 'UNGGAH PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
