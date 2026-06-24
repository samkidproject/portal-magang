import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { 
  safeSetDoc as setDoc, 
  safeGetDocs as getDocs, 
  safeDeleteDoc as deleteDoc 
} from '../utils/firestoreHelper';
import { UserProfile, AbsensiRecord, LogbookRecord, LaporanAkhir, UserRole, AuditTrailRecord } from '../types';
import { PILIHAN_KOTA_KABUPATEN } from './SetupBiodata';
import {
  Users, Calendar, Clock, BookOpen, FileText, Plus, Edit2, Trash2,
  Search, ShieldAlert, FileDown, Eye, Check, X, ShieldCheck, RefreshCw, Briefcase, Mail
} from 'lucide-react';

interface AdminDashboardProps {
  adminUser: UserProfile;
  onShowMessage: (text: string, type: 'success' | 'error' | 'warning') => void;
}

const PILIHAN_BIDANG = [
  'Pembinaan',
  'Intelijen',
  'Tindak Pidana Umum',
  'Tindak Pidana Khusus',
  'Perdata dan Tata Usaha Negara',
  'Pengawasan',
  'Barang Bukti dan Barang Rampasan',
  'Pemulihan Aset'
];

export default function AdminDashboard({ adminUser, onShowMessage }: AdminDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'ringkasan' | 'peserta' | 'absensi' | 'logbook' | 'laporan' | 'audit'>('ringkasan');
  
  // Master lists
  const [allPeserta, setAllPeserta] = useState<UserProfile[]>([]);
  const [allAbsensi, setAllAbsensi] = useState<AbsensiRecord[]>([]);
  const [allLogbook, setAllLogbook] = useState<LogbookRecord[]>([]);
  const [allLaporan, setAllLaporan] = useState<LaporanAkhir[]>([]);
  const [allAudit, setAllAudit] = useState<AuditTrailRecord[]>([]);

  // Search & Filter state
  const [searchTermPeserta, setSearchTermPeserta] = useState('');
  const [filterKotaPeserta, setFilterKotaPeserta] = useState('Semua');
  const [filterBidangAbsen, setFilterBidangAbsen] = useState('Semua');
  const [filterStatusAbsen, setFilterStatusAbsen] = useState('Semua');
  const [filterTanggalAbsen, setFilterTanggalAbsen] = useState('');
  const [searchTermAbsen, setSearchTermAbsen] = useState('');
  
  // Search state for general boards
  const [searchLogbook, setSearchLogbook] = useState('');

  // Modals state
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [showAddPesertaModal, setShowAddPesertaModal] = useState(false);
  const [confirmDeletePeserta, setConfirmDeletePeserta] = useState<{ uid: string; displayName: string } | null>(null);
  const [confirmDeleteAbsen, setConfirmDeleteAbsen] = useState<{ id: string; namaLengkap: string; tanggal: string } | null>(null);

  // New Participant Form
  const [newEmail, setNewEmail] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newNim, setNewNim] = useState('');
  const [newUniv, setNewUniv] = useState('');
  const [newFakultas, setNewFakultas] = useState('');
  const [newProdi, setNewProdi] = useState('');
  const [newGender, setNewGender] = useState('Laki-Laki');
  const [newHp, setNewHp] = useState('');
  const [newBidang, setNewBidang] = useState(PILIHAN_BIDANG[0]);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newKota, setNewKota] = useState('Kota Bandar Lampung');

  // Edit Candidate forms
  const [editNama, setEditNama] = useState('');
  const [editNim, setEditNim] = useState('');
  const [editUniv, setEditUniv] = useState('');
  const [editBidang, setEditBidang] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editStatus, setEditStatus] = useState<'Aktif' | 'Selesai' | 'Diberhentikan'>('Aktif');
  const [editKota, setEditKota] = useState('Kota Bandar Lampung');

  // Load backend database models
  const loadAdminDatabase = async () => {
    try {
      // 1. All Users (exclude current admin or gather candidates)
      const uSnap = await getDocs(collection(db, 'users'));
      const uArr: UserProfile[] = [];
      uSnap.forEach((doc) => {
        const u = doc.data() as UserProfile;
        if (u.role !== 'admin') {
          uArr.push(u);
        }
      });
      setAllPeserta(uArr);

      // 2. All Absensi
      const aSnap = await getDocs(collection(db, 'absensi'));
      const aArr: AbsensiRecord[] = [];
      aSnap.forEach((doc) => {
        aArr.push({ ...(doc.data() as AbsensiRecord), id: doc.id });
      });
      // Sort absensi descending
      aArr.sort((x, y) => y.tanggal.localeCompare(x.tanggal));
      setAllAbsensi(aArr);

      // 3. All Logbook
      const lSnap = await getDocs(collection(db, 'logbook'));
      const lArr: LogbookRecord[] = [];
      lSnap.forEach((doc) => {
        lArr.push(doc.data() as LogbookRecord);
      });
      lArr.sort((x, y) => y.tanggal.localeCompare(x.tanggal));
      setAllLogbook(lArr);

      // 4. All Laporan
      const rSnap = await getDocs(collection(db, 'laporan'));
      const rArr: LaporanAkhir[] = [];
      rSnap.forEach((doc) => {
        rArr.push(doc.data() as LaporanAkhir);
      });
      setAllLaporan(rArr);

      // 5. All Audit Logs
      const auSnap = await getDocs(collection(db, 'audit'));
      const auArr: AuditTrailRecord[] = [];
      auSnap.forEach((doc) => {
        auArr.push(doc.data() as AuditTrailRecord);
      });
      auArr.sort((x, y) => y.timestamp.localeCompare(x.timestamp));
      setAllAudit(auArr);

    } catch (err) {
      console.error('Admin DB read error', err);
      onShowMessage('Gagal memuat beberapa pangkalan data admin.', 'error');
    }
  };

  useEffect(() => {
    loadAdminDatabase();
  }, []);

  // ADD PESERTA HANDLER
  const handleAddPeserta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newNama || !newNim || !newUniv || !newStart || !newEnd) {
      onShowMessage('Mohon isi field bertanda bintang (*)', 'warning');
      return;
    }

    const mockUid = `peserta_${Math.floor(1000 + Math.random() * 9000)}`;
    const newProfile: UserProfile = {
      uid: mockUid,
      email: newEmail.toLowerCase().trim(),
      displayName: newNama,
      photoURL: '',
      role: 'peserta',
      isSetup: true,
      status: 'Aktif',
      createdAt: new Date().toISOString(),
      biodata: {
        namaLengkap: newNama,
        nim: newNim,
        universitas: newUniv,
        fakultas: newFakultas || 'Hukum',
        prodi: newProdi || 'Hukum',
        jenisKelamin: newGender,
        tempatLahir: 'Bandar Lampung',
        tanggalLahir: '2004-01-01',
        noHp: newHp || '0812345678',
        email: newEmail.toLowerCase().trim(),
        alamat: 'Bandar Lampung, Lampung',
        kota: newKota
      },
      dataMagang: {
        bidang: newBidang,
        tanggalMulai: newStart,
        tanggalSelesai: newEnd
      }
    };

    try {
      await setDoc(doc(db, 'users', mockUid), newProfile);
      
      // Audit entry
      const auditRef = doc(db, 'audit', `admin_add_${mockUid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: adminUser.uid,
        email: adminUser.email,
        namaLengkap: adminUser.displayName,
        role: adminUser.role,
        aktivitas: 'Tambah Peserta Magang',
        detail: `Menambahkan peserta baru bernama ${newNama} (${newEmail}) di bidang [${newBidang}]`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Peserta ${newNama} berhasil ditambahkan!`, 'success');
      setShowAddPesertaModal(false);
      
      // Reset form
      setNewEmail('');
      setNewNama('');
      setNewNim('');
      setNewUniv('');
      setNewFakultas('');
      setNewProdi('');
      setNewHp('');
      setNewStart('');
      setNewEnd('');
      setNewKota('Kota Bandar Lampung');

      loadAdminDatabase();
    } catch (err: any) {
      onShowMessage(`Gagal menambahkan peserta: ${err.message}`, 'error');
    }
  };

  // EDIT PESERTA TRIGGER
  const startEditProfile = (profile: UserProfile) => {
    setEditingProfile(profile);
    setEditNama(profile.displayName || '');
    setEditNim(profile.biodata?.nim || '');
    setEditUniv(profile.biodata?.universitas || '');
    setEditBidang(profile.dataMagang?.bidang || PILIHAN_BIDANG[0]);
    setEditStart(profile.dataMagang?.tanggalMulai || '');
    setEditEnd(profile.dataMagang?.tanggalSelesai || '');
    setEditStatus(profile.status);
    setEditKota(profile.biodata?.kota || 'Kota Bandar Lampung');
  };

  // EDIT PESERTA HANDLER
  const handleSaveEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const updatedProfile: UserProfile = {
      ...editingProfile,
      displayName: editNama,
      status: editStatus,
      biodata: editingProfile.biodata ? {
        ...editingProfile.biodata,
        namaLengkap: editNama,
        nim: editNim,
        universitas: editUniv,
        kota: editKota
      } : {
        namaLengkap: editNama,
        nim: editNim,
        universitas: editUniv,
        fakultas: 'Lainnya',
        prodi: 'Lainnya',
        jenisKelamin: 'Laki-Laki',
        tempatLahir: 'Bandar Lampung',
        tanggalLahir: '2004-01-01',
        noHp: '0812345678',
        email: editingProfile.email,
        alamat: 'Bandar Lampung',
        kota: editKota
      },
      dataMagang: {
        bidang: editBidang,
        tanggalMulai: editStart,
        tanggalSelesai: editEnd
      }
    };

    try {
      await setDoc(doc(db, 'users', editingProfile.uid), updatedProfile);
      
      // Audit trail
      const auditRef = doc(db, 'audit', `admin_edit_${editingProfile.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: adminUser.uid,
        email: adminUser.email,
        namaLengkap: adminUser.displayName,
        role: adminUser.role,
        aktivitas: 'Edit Data Peserta',
        detail: `Mengubah data & masa PKL untuk peserta: ${editNama} (${editingProfile.email}). Status: [${editStatus}]`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Profil ${editNama} berhasil diperbarui!`, 'success');
      setEditingProfile(null);
      loadAdminDatabase();
    } catch (err: any) {
      onShowMessage(`Gagal merestrukturisasi profil: ${err.message}`, 'error');
    }
  };

  // DELETE PESERTA
  const handleDeletePeserta = async (uid: string, nama: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      
      // Audit trail
      const auditRef = doc(db, 'audit', `admin_delete_${uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: adminUser.uid,
        email: adminUser.email,
        namaLengkap: adminUser.displayName,
        role: adminUser.role,
        aktivitas: 'Hapus Peserta Magang',
        detail: `Hapus profil peserta ${nama} (${uid})`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Peserta ${nama} telah dikeluarkan dari sistem.`, 'success');
      setConfirmDeletePeserta(null);
      loadAdminDatabase();
    } catch (err: any) {
      onShowMessage(`Gagal menghapus: ${err.message}`, 'error');
    }
  };

  // DELETE SINGLE ABSENSI RECORD
  const handleDeleteAbsensi = async (id: string, namaLengkap: string, tanggal: string) => {
    try {
      await deleteDoc(doc(db, 'absensi', id));

      // Audit trail
      const auditRef = doc(db, 'audit', `admin_delete_absen_${id}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: adminUser.uid,
        email: adminUser.email,
        namaLengkap: adminUser.displayName,
        role: adminUser.role,
        aktivitas: 'Hapus Absensi',
        detail: `Hapus riwayat absensi milik ${namaLengkap} pada tanggal ${tanggal}`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Data absensi ${namaLengkap} pada tanggal ${tanggal} berhasil dihapus.`, 'success');
      setConfirmDeleteAbsen(null);
      loadAdminDatabase();
    } catch (err: any) {
      onShowMessage(`Gagal menghapus absensi: ${err.message}`, 'error');
    }
  };

  // ACTIVATE or DEACTIVATE Acc
  const toggleAccountStatus = async (userProf: UserProfile, targetStatus: 'Aktif' | 'Diberhentikan') => {
    try {
      const userRef = doc(db, 'users', userProf.uid);
      await setDoc(userRef, { status: targetStatus }, { merge: true });
      
      const auditRef = doc(db, 'audit', `admin_toggle_${userProf.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: adminUser.uid,
        email: adminUser.email,
        namaLengkap: adminUser.displayName,
        role: adminUser.role,
        aktivitas: 'Ubah Status Akun',
        detail: `Ubah status akun ${userProf.displayName} menjadi ${targetStatus}`,
        timestamp: new Date().toISOString()
      });

      onShowMessage(`Status akun ${userProf.displayName} diubah menjadi ${targetStatus}.`, 'success');
      loadAdminDatabase();
    } catch (e: any) {
      onShowMessage(`Error: ${e.message}`, 'error');
    }
  };

  // EXPORT CSV - EXCEL REAL DOWNLOAD
  const handleExportCSV = () => {
    const headers = ['Hari', 'Tanggal', 'Nama Peserta', 'Bidang Penempatan', 'Waktu Masuk', 'Waktu Pulang', 'Status Absensi', 'Sifat Lokasi'];
    const rows = filteredAbsensi.map(item => [
      item.hari,
      item.tanggal,
      item.namaLengkap,
      item.bidang,
      item.datang?.waktu || 'Alpa',
      item.pulang?.waktu || 'Belum Pulang',
      item.statusAbsen,
      item.datang?.isWFH ? 'WFH (Jumat)' : 'WFO Kantor'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `REKAPITULASI_ABSENSI_PESTAMAGANG_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onShowMessage('Laporan absensi berhasil dieksport ke format Microsoft Excel (.csv)', 'success');
  };

  // FILTERED CONTEXTS FOR SEARCHING
  const filteredPeserta = allPeserta.filter(p => {
    const matchSearch = (p.displayName || '').toLowerCase().includes(searchTermPeserta.toLowerCase()) ||
                        (p.biodata?.nim || '').includes(searchTermPeserta) ||
                        (p.biodata?.universitas || '').toLowerCase().includes(searchTermPeserta.toLowerCase());
    const matchKota = filterKotaPeserta === 'Semua' || (p.biodata?.kota || 'Belum Diisi') === filterKotaPeserta;
    return matchSearch && matchKota;
  });

  const filteredAbsensi = allAbsensi.filter(a => {
    const matchSearch = (a.namaLengkap || '').toLowerCase().includes(searchTermAbsen.toLowerCase()) ||
                        (a.email || '').toLowerCase().includes(searchTermAbsen.toLowerCase());
    const matchBidang = filterBidangAbsen === 'Semua' || a.bidang === filterBidangAbsen;
    const matchStatus = filterStatusAbsen === 'Semua' || a.statusAbsen === filterStatusAbsen;
    const matchTanggal = !filterTanggalAbsen || a.tanggal === filterTanggalAbsen;
    return matchSearch && matchBidang && matchStatus && matchTanggal;
  });

  const filteredLogbook = allLogbook.filter(l => {
    return (l.namaLengkap || '').toLowerCase().includes(searchLogbook.toLowerCase()) ||
           (l.kegiatan || '').toLowerCase().includes(searchLogbook.toLowerCase()) ||
           (l.uraianPekerjaan || '').toLowerCase().includes(searchLogbook.toLowerCase());
  });

  // METRICS SUMMARY FOR HEADER
  const totalPesertaNum = allPeserta.length;
  const activePesertaNum = allPeserta.filter(p => p.status === 'Aktif').length;
  const finishedPesertaNum = allPeserta.filter(p => p.status === 'Selesai').length;
  const totalAbsenNum = allAbsensi.length;
  const totalLogNum = allLogbook.length;
  const totalRepNum = allLaporan.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="admin-dashboard">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-blue-900 p-5 text-white rounded-2xl shadow-md border-b-2 border-yellow-400 mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-wider font-display uppercase">PORTAL ADMINISTRASI</h1>
            <p className="text-[10px] text-yellow-300 mt-0.5 uppercase font-mono tracking-widest">Kejaksaan Tinggi Lampung • Monitoring PKL & Internships</p>
          </div>
          <button
            onClick={loadAdminDatabase}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-3 py-1 text-xs rounded-lg font-bold border border-white/20 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-yellow-300" />
            Segarkan Database
          </button>
        </div>
      </div>

      {/* DASHBOARD TABS */}
      <div className="flex border-b border-slate-205 mb-6 overflow-x-auto gap-2" id="admin-tab-headers">
        <button
          onClick={() => setActiveSubTab('ringkasan')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'ringkasan'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Ringkasan Stats
        </button>
        <button
          onClick={() => setActiveSubTab('peserta')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'peserta'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Data Peserta ({totalPesertaNum})
        </button>
        <button
          onClick={() => setActiveSubTab('absensi')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'absensi'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Data Absensi ({totalAbsenNum})
        </button>
        <button
          onClick={() => setActiveSubTab('logbook')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'logbook'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Data Logbook ({totalLogNum})
        </button>
        <button
          onClick={() => setActiveSubTab('laporan')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'laporan'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Laporan Akhir ({totalRepNum})
        </button>
        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-3 py-2 font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
            activeSubTab === 'audit'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Audit Trail ({allAudit.length})
        </button>
      </div>

      {/* ==================== SUB-TAB 1: RINGKASAN STATS ==================== */}
      {activeSubTab === 'ringkasan' && (
        <div className="space-y-8" id="admin-summary-view">
          
          {/* Main 6 cards metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Total Peserta</span>
              <span className="text-3xl font-extrabold text-neutral-900 block mt-1">{totalPesertaNum}</span>
              <span className="text-[9px] text-[#6B0D18] font-mono block mt-1.5 font-bold">Terdaftar sistem</span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Peserta Aktif</span>
              <span className="text-3xl font-extrabold text-emerald-600 block mt-1">{activePesertaNum}</span>
              <span className="text-[9px] text-emerald-800 bg-emerald-50 px-1 rounded block mt-1.5 font-bold max-w-max">Sedang Magang</span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Peserta Selesai</span>
              <span className="text-3xl font-extrabold text-blue-600 block mt-1">{finishedPesertaNum}</span>
              <span className="text-[9px] text-blue-800 bg-blue-50 px-1 rounded block mt-1.5 font-bold max-w-max">Telah Lulus PKL</span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Total Absensi</span>
              <span className="text-3xl font-extrabold text-[#6B0D18] block mt-1">{totalAbsenNum}</span>
              <span className="text-[9px] text-red-800 bg-red-50 px-1 rounded block mt-1.5 font-bold max-w-max">Presensi harian</span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Total Logbook</span>
              <span className="text-3xl font-extrabold text-[#6B0D18] block mt-1">{totalLogNum}</span>
              <span className="text-[9px] text-red-800 bg-red-50 px-1 rounded block mt-1.5 font-bold max-w-max">Laporan Harian</span>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200">
              <span className="text-[10px] text-neutral-400 font-bold uppercase block tracking-wider">Laporan PDF</span>
              <span className="text-3xl font-extrabold text-amber-600 block mt-1">{totalRepNum}</span>
              <span className="text-[9px] text-amber-800 bg-amber-50 px-1 rounded block mt-1.5 font-bold max-w-max">Berkas Akhir</span>
            </div>
          </div>

          {/* Quick Informative Panel */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
            <h3 className="text-sm font-extrabold uppercase text-[#6B0D18] tracking-wider mb-2">Sistem Monitoring Terpusat Kejaksaan Tinggi Lampung</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Pusat monitoring S.IPKL dipergunakan oleh tim admin sub bagian Kepegawaian dan Pembinaan Kejaksaan Tinggi Lampung untuk memanipulasi, menyetujui, dan mengeksport rekam jejak, absensi koordinat, logbook harian, dan naskah PDF ujian magang milik seluruh civitas mahasiswa magang. Admin bertanggung jawab penuh terhadap integritas perizinan di masa PKL.
            </p>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: DATA PESERTA ==================== */}
      {activeSubTab === 'peserta' && (
        <div className="space-y-6" id="participants-pane">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-xl">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, universitas..."
                  value={searchTermPeserta}
                  onChange={(e) => setSearchTermPeserta(e.target.value)}
                  className="w-full bg-white rounded-xl pl-10 pr-4 py-2 text-xs border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18] focus:border-[#6B0D18] font-medium"
                />
              </div>

              {/* Filter Kota */}
              <div className="w-full sm:w-56">
                <select
                  value={filterKotaPeserta}
                  onChange={(e) => setFilterKotaPeserta(e.target.value)}
                  className="w-full bg-white rounded-xl px-3 py-2 text-xs border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18] focus:border-[#6B0D18] font-semibold text-neutral-700"
                >
                  <option value="Semua">Semua Asal Daerah (Kota/Kab)</option>
                  {PILIHAN_KOTA_KABUPATEN.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                  <option value="Belum Diisi">Belum Ditentukan / Diisi</option>
                </select>
              </div>
            </div>

            {/* Tambah Peserta Button */}
            <button
              onClick={() => setShowAddPesertaModal(true)}
              className="flex items-center gap-1.5 bg-[#6B0D18] text-[#D4AF37] px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-[#D4AF37] shadow-md hover:bg-[#520A12] cursor-pointer w-full sm:w-auto justify-center"
              id="tambah-peserta-trigger"
            >
              <Plus className="h-4 w-4" />
              TAMBAH PESERTA MANUAL
            </button>
          </div>

          {/* Peserta Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-[#6B0D18]/5 font-serif text-neutral-800 uppercase tracking-tight">
                <tr>
                  <th className="px-6 py-3.5 text-left font-bold">Mahasiswa/NIM/Arah Email</th>
                  <th className="px-6 py-3.5 text-left font-bold">Universitas</th>
                  <th className="px-6 py-3.5 text-left font-bold">Bidang Penempatan</th>
                  <th className="px-6 py-3.5 text-left font-bold">Masa PKL / Magang</th>
                  <th className="px-6 py-3.5 text-left font-bold">Status</th>
                  <th className="px-6 py-3.5 text-center font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200 font-medium">
                {filteredPeserta.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-neutral-400 font-semibold italic">
                      Tidak ada peserta yang cocok dengan parameter penelusuran.
                    </td>
                  </tr>
                ) : (
                  filteredPeserta.map((p) => (
                    <tr key={p.uid} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {p.photoURL ? (
                            <img
                              src={p.photoURL}
                              alt={p.displayName}
                              referrerPolicy="no-referrer"
                              className="h-10 w-10 rounded-full border border-neutral-300 object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full border border-slate-300 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                              {p.displayName ? p.displayName.slice(0, 1).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="text-left">
                            <p className="font-extrabold text-neutral-900 leading-snug">{p.displayName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <p className="text-[10px] text-[#6B0D18] font-mono leading-none">{p.biodata?.nim || 'Belum diisi'}</p>
                              {p.biodata?.kota && (
                                <span className="text-[8.5px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.2 rounded-sm leading-none whitespace-nowrap">
                                  📍 {p.biodata.kota.replace("Kabupaten ", "Kab. ")}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-neutral-400 font-mono mt-0.5">
                              {p.email.endsWith('@sipkl.local') ? `Username: ${p.email.replace('@sipkl.local', '')}` : p.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-neutral-800">{p.biodata?.universitas || 'N/A'}</p>
                        <p className="text-[10px] text-neutral-400">{p.biodata?.prodi || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-amber-900 bg-amber-500/5 uppercase text-[10px] tracking-wider rounded border-l-4 border-[#D4AF37]">
                        {p.dataMagang?.bidang || 'PENDING BIODATA'}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-neutral-600">
                        {p.dataMagang ? (
                          <div>
                            <span>{p.dataMagang.tanggalMulai}</span>
                            <span className="block text-[10px] text-neutral-400">s.d {p.dataMagang.tanggalSelesai}</span>
                          </div>
                        ) : (
                          <span className="italic text-red-400">Belum diaktifkan</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          p.status === 'Aktif' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : p.status === 'Selesai' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => startEditProfile(p)}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 p-1.5 rounded transition-colors cursor-pointer"
                            title="Edit Profil"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          
                          {p.status === 'Aktif' ? (
                            <button
                              onClick={() => toggleAccountStatus(p, 'Diberhentikan')}
                              className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded transition-colors cursor-pointer"
                              title="Tangguhkan/Berhentikan Magang"
                            >
                              <ShieldAlert className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleAccountStatus(p, 'Aktif')}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-1.5 rounded transition-colors cursor-pointer"
                              title="Aktifkan Kembali"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setConfirmDeletePeserta({ uid: p.uid, displayName: p.displayName })}
                            className="bg-red-950/10 hover:bg-red-900 hover:text-white text-red-950 p-1.5 rounded transition-colors cursor-pointer"
                            title="Hapus Permanent"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: DATA ABSENSI ==================== */}
      {activeSubTab === 'absensi' && (
        <div className="space-y-6" id="attendance-pane">
          
          {/* Filters Zone */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 card">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end text-xs font-semibold">
              
              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1 font-extrabold font-mono">Penelusuran Nama</label>
                <input
                  type="text"
                  placeholder="Cari nama peserta..."
                  value={searchTermAbsen}
                  onChange={(e) => setSearchTermAbsen(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18] focus:border-[#6B0D18]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1 font-extrabold font-mono">Filter Bidang</label>
                <select
                  value={filterBidangAbsen}
                  onChange={(e) => setFilterBidangAbsen(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18]"
                >
                  <option value="Semua">Semua Bidang</option>
                  {PILIHAN_BIDANG.map(bid => (
                    <option key={bid} value={bid}>{bid}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1 font-extrabold font-mono">Filter Status</label>
                <select
                  value={filterStatusAbsen}
                  onChange={(e) => setFilterStatusAbsen(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18]"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Terlambat">Terlambat</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 uppercase mb-1 font-extrabold font-mono font-sans">Filter Tanggal Absensi</label>
                <input
                  type="date"
                  value={filterTanggalAbsen}
                  onChange={(e) => setFilterTanggalAbsen(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18]"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-neutral-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSearchTermAbsen('');
                  setFilterBidangAbsen('Semua');
                  setFilterStatusAbsen('Semua');
                  setFilterTanggalAbsen('');
                }}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
              <button
                onClick={handleExportCSV}
                className="bg-[#6B0D18] hover:bg-[#520A12] text-[#D4AF37] font-bold px-4 py-2 rounded-lg text-xs transition-colors border border-[#D4AF37] flex items-center gap-1.5 cursor-pointer"
                id="export-csv-btn"
              >
                <FileDown className="h-4 w-4" />
                EXPORT EXCEL (CSV)
              </button>
            </div>
          </div>

          {/* Absensi list table */}
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden text-clip">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-[#6B0D18]/5 text-neutral-800 uppercase tracking-tight">
                <tr>
                  <th className="px-6 py-3.5 text-left font-bold">Tanggal & Hari</th>
                  <th className="px-6 py-3.5 text-left font-bold">Mahasiswa / Bidang</th>
                  <th className="px-6 py-3.5 text-left font-bold">Absen Datang</th>
                  <th className="px-6 py-3.5 text-left font-bold">Absen Pulang</th>
                  <th className="px-6 py-3.5 text-left font-bold">Status Absen</th>
                  <th className="px-6 py-3.5 text-left font-bold">Informasi Satelit / GPS</th>
                  <th className="px-6 py-3.5 text-center font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200 font-medium">
                {filteredAbsensi.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-400 font-semibold italic">
                      Tidak ada riwayat absensi yang terdeteksi dengan format filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredAbsensi.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-extrabold text-neutral-900">{a.tanggal}</p>
                        <p className="text-[10px] text-neutral-400 uppercase font-mono">{a.hari}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-neutral-900">{a.namaLengkap}</p>
                        <span className="text-[9px] bg-[#6B0D18]/5 text-[#6B0D18] px-1.5 py-0.5 rounded font-bold">{a.bidang}</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-neutral-800 whitespace-nowrap">
                        {a.datang ? (
                          <div className="text-left">
                            <span className="block text-emerald-800">{a.datang.waktu} <span className="text-[9px] text-neutral-400">WIB</span></span>
                            <span className="block text-[8px] text-neutral-400 font-sans">({a.datang.status})</span>
                          </div>
                        ) : (
                          <span className="text-red-400 text-xs italic">Alpa</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-neutral-800 whitespace-nowrap">
                        {a.pulang ? (
                          <div className="text-left">
                            <span className="block text-neutral-800">{a.pulang.waktu} <span className="text-[9px] text-neutral-400">WIB</span></span>
                          </div>
                        ) : (
                          <span className="text-yellow-600 text-[10px] italic">Belum Pulang</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.statusAbsen === 'Hadir' 
                             ? 'bg-emerald-100 text-emerald-800' 
                             : a.statusAbsen === 'Terlambat' 
                             ? 'bg-amber-100 text-amber-800' 
                             : 'bg-red-100 text-red-800'
                        }`}>
                          {a.statusAbsen}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-neutral-500">
                        {a.datang?.isWFH ? (
                          <span className="bg-emerald-100 text-emerald-900 text-[9px] px-1.5 rounded font-extrabold tracking-widest font-sans uppercase">WFH JUMAT</span>
                        ) : (
                          <div>
                            <span className="block text-[9.5px]">Lat: {a.datang?.latitude || 'N/A'}</span>
                            <span className="block text-[9.5px]">Lng: {a.datang?.longitude || 'N/A'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setConfirmDeleteAbsen({ id: a.id, namaLengkap: a.namaLengkap, tanggal: a.tanggal })}
                          className="bg-red-950/10 hover:bg-red-900 hover:text-white text-red-950 p-1.5 rounded transition-colors cursor-pointer"
                          title="Hapus Record Absensi"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: DATA LOGBOOK ==================== */}
      {activeSubTab === 'logbook' && (
        <div className="space-y-6" id="logbooks-pane">
          
          <div className="flex justify-between items-center">
            {/* Search Bar */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari nama, kegiatan, rincian harian..."
                value={searchLogbook}
                onChange={(e) => setSearchLogbook(e.target.value)}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-2 text-xs border border-neutral-300 focus:outline-none focus:ring-1 focus:ring-[#6B0D18]"
              />
            </div>
          </div>

          {/* Logbook Grid */}
          <div className="grid grid-cols-1 gap-4" id="logbook-cards-grid">
            {filteredLogbook.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-neutral-200 text-center font-medium italic text-neutral-400">
                Tidak ada entri logbook yang ditemukan.
              </div>
            ) : (
              filteredLogbook.map((l) => (
                <div key={l.id} className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200 text-left space-y-3.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-100 pb-3">
                    <div>
                      <h4 className="font-extrabold text-[#6B0D18] text-sm uppercase">{l.namaLengkap}</h4>
                      <p className="text-[10px] text-neutral-400 font-mono mt-0.5">Bidang Penempatan: {l.bidang}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-neutral-100 px-3 py-1 rounded-full border border-neutral-200 font-mono text-[11px] font-bold text-neutral-700">
                      <Calendar className="h-3.5 w-3.5 text-[#D4AF37]" />
                      {l.tanggal}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase font-mono tracking-wider">Judul Pokok Kegiatan:</p>
                    <p className="text-xs font-bold text-black">{l.kegiatan}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase font-mono tracking-wider">Laporan Kronologi Pekerjaan:</p>
                    <p className="text-xs text-neutral-700 font-medium whitespace-normal leading-relaxed">{l.uraianPekerjaan}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-50 text-[11px] font-medium">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase block font-mono">Hasil Output Kerja:</span>
                      <span className="font-bold text-emerald-800">{l.hasilPekerjaan}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-400 uppercase block font-mono">Kendala & Tindakan Solusi:</span>
                      <div className="leading-snug">
                        <p className="text-red-700 font-bold">Masalah: {l.kendala}</p>
                        <p className="text-emerald-700 font-bold">Tindakan: {l.solusi}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 5: DATA LAPORAN AKHIR ==================== */}
      {activeSubTab === 'laporan' && (
        <div className="space-y-6" id="reports-admin-pane">
          
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-[#6B0D18]/5 text-neutral-800 uppercase tracking-tight">
                <tr>
                  <th className="px-6 py-3.5 text-left font-bold">Nama Peserta / Bidang</th>
                  <th className="px-6 py-3.5 text-left font-bold">Nama Berkas Laporan</th>
                  <th className="px-6 py-3.5 text-left font-bold">Tanggal Diupload</th>
                  <th className="px-6 py-3.5 text-left font-bold">Status Verifikasi</th>
                  <th className="px-6 py-3.5 text-center font-bold">Aksi PDF</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200 font-medium">
                {allLaporan.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 font-semibold italic">
                      Belum ada berkas PDF laporan akhir magang yang diunggah oleh peserta lulus magang.
                    </td>
                  </tr>
                ) : (
                  allLaporan.map((l) => (
                    <tr key={l.uid} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-neutral-900">{l.namaLengkap}</p>
                        <span className="text-[10px] bg-[#6B0D18]/5 text-[#6B0D18] px-1 px-1.5 rounded font-bold font-mono">{l.bidang}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-[#6B0D18]">
                        {l.fileName}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-neutral-500">
                        {new Date(l.tanggalUpload).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {l.statusUpload}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <a
                          href={l.fileURL}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-1.5 rounded-xl border border-neutral-300 font-bold tracking-tight cursor-pointer mr-2"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          KLIK EXAMINER PDF
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 6: DATA AUDIT TRAIL ==================== */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6" id="audit-trail-pane">
          
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
            <table className="min-w-full divide-y divide-neutral-200 text-xs">
              <thead className="bg-[#6B0D18]/5 text-neutral-800 uppercase tracking-tight">
                <tr>
                  <th className="px-6 py-3.5 text-left font-bold">Waktu Cap</th>
                  <th className="px-6 py-3.5 text-left font-bold">Operator Terkait</th>
                  <th className="px-6 py-3.5 text-left font-bold">Role Hak Akses</th>
                  <th className="px-6 py-3.5 text-left font-bold">Aktivitas</th>
                  <th className="px-6 py-3.5 text-left font-bold">Kronologi Detail Peristiwa</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200 font-medium">
                {allAudit.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-400 font-semibold italic">
                      Belum ada transkrip log audit trail yang disimpan di dalam database.
                    </td>
                  </tr>
                ) : (
                  allAudit.map((a) => (
                    <tr key={a.id} className="hover:bg-neutral-50/50">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-[11px] text-[#6B0D18] font-bold">
                        {new Date(a.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-neutral-900">{a.namaLengkap}</p>
                        <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                          {a.email && a.email.endsWith('@sipkl.local') ? a.email.replace('@sipkl.local', '') : a.email}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.role === 'admin' 
                            ? 'bg-red-100 text-red-800 border border-red-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {a.role === 'admin' ? 'ADMINISTRATOR' : 'PESERTA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-neutral-900 text-left">
                        {a.aktivitas}
                      </td>
                      <td className="px-6 py-4 text-left text-neutral-600 font-medium max-w-[350px] whitespace-normal break-words leading-relaxed">
                        {a.detail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD PESERTA MANUAL ==================== */}
      {showAddPesertaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-neutral-200 overflow-hidden text-left animate-in fade-in zoom-in-95">
            <div className="bg-[#6B0D18] p-5 text-white flex justify-between items-center border-b-4 border-[#D4AF37]">
              <div>
                <h3 className="text-md font-extrabold uppercase">Tambah Peserta Baru</h3>
                <p className="text-[10px] text-red-100 mt-0.5">S.IPKL Kejaksaan Tinggi Lampung</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPesertaModal(false)}
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddPeserta} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs font-semibold">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Nama Lengkap *</label>
                  <input
                    type="text"
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">NIM / Nomor Induk *</label>
                  <input
                    type="text"
                    required
                    value={newNim}
                    onChange={(e) => setNewNim(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Email Peserta *</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@email.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Universitas *</label>
                  <input
                    type="text"
                    required
                    value={newUniv}
                    onChange={(e) => setNewUniv(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Fakultas</label>
                  <input
                    type="text"
                    value={newFakultas}
                    onChange={(e) => setNewFakultas(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Program Studi</label>
                  <input
                    type="text"
                    value={newProdi}
                    onChange={(e) => setNewProdi(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Jenis Kelamin</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  >
                    <option value="Laki-Laki">Laki-Laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Kabupaten / Kota Asal</label>
                  <select
                    value={newKota}
                    onChange={(e) => setNewKota(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-semibold text-neutral-700"
                  >
                    {PILIHAN_KOTA_KABUPATEN.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Nomor HP</label>
                  <input
                    type="tel"
                    value={newHp}
                    onChange={(e) => setNewHp(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Bidang Penempatan *</label>
                  <select
                    value={newBidang}
                    onChange={(e) => setNewBidang(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-bold"
                  >
                    {PILIHAN_BIDANG.map(bid => (
                      <option key={bid} value={bid}>{bid}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Tanggal Mulai Magang *</label>
                  <input
                    type="date"
                    required
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Tanggal Selesai *</label>
                  <input
                    type="date"
                    required
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddPesertaModal(false)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6B0D18] hover:bg-[#520A12] text-[#D4AF37] border border-[#D4AF37] rounded-lg font-bold text-xs cursor-pointer"
                >
                  Simpan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT DATA PESERTA ==================== */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-neutral-200 overflow-hidden text-left animate-in fade-in zoom-in-95">
            <div className="bg-[#6B0D18] p-5 text-white flex justify-between items-center border-b-4 border-[#D4AF37]">
              <div>
                <h3 className="text-md font-extrabold uppercase">Manipulasi data peserta</h3>
                <p className="text-[10px] text-red-100 mt-0.5">
                  {editingProfile.email.endsWith('@sipkl.local') ? `Username: ${editingProfile.email.replace('@sipkl.local', '')}` : editingProfile.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditProfile} className="p-6 space-y-4 text-xs font-semibold">
              
              <div>
                <label className="block text-[10px] text-neutral-700 uppercase mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">NIM / Nomor Induk</label>
                  <input
                    type="text"
                    required
                    value={editNim}
                    onChange={(e) => setEditNim(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Universitas</label>
                  <input
                    type="text"
                    required
                    value={editUniv}
                    onChange={(e) => setEditUniv(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-700 uppercase mb-1">Kabupaten / Kota Asal</label>
                <select
                  value={editKota}
                  onChange={(e) => setEditKota(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-semibold text-neutral-700"
                >
                  {PILIHAN_KOTA_KABUPATEN.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-700 uppercase mb-1">Bidang Penempatan</label>
                <select
                  value={editBidang}
                  onChange={(e) => setEditBidang(e.target.value)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-bold text-amber-950"
                >
                  {PILIHAN_BIDANG.map(bid => (
                    <option key={bid} value={bid}>{bid}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Mulai PKL</label>
                  <input
                    type="date"
                    required
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-700 uppercase mb-1">Selesai PKL</label>
                  <input
                    type="date"
                    required
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-700 uppercase mb-1">Status Keaktifan</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none font-bold text-neutral-800"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Diberhentikan">Diberhentikan</option>
                </select>
              </div>

              <div className="pt-4 border-t border-neutral-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#6B0D18] hover:bg-[#520A12] text-[#D4AF37] border border-[#D4AF37] rounded-lg font-bold text-xs cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIRM DELETION ==================== */}
      {confirmDeletePeserta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-neutral-200 overflow-hidden text-left animate-in zoom-in-95">
            <div className="bg-[#6B0D18] p-5 text-white flex justify-between items-center border-b-4 border-[#D4AF37]">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#D4AF37] animate-pulse" />
                  Konfirmasi Hapus
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeletePeserta(null)}
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold">
              <p className="text-neutral-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus peserta <span className="text-red-700 font-extrabold">{confirmDeletePeserta.displayName}</span> dari database secara permanen?
              </p>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200 text-red-950 leading-normal font-medium">
                Tindakan ini tidak dapat dibatalkan. Profil peserta akan dihapus sepenuhnya, namun riwayat log audit absensi tetap tersimpan demi akuntabilitas data Kejaksaan.
              </div>

              <div className="pt-2 flex justify-end gap-3 font-semibold">
                <button
                  type="button"
                  onClick={() => setConfirmDeletePeserta(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePeserta(confirmDeletePeserta.uid, confirmDeletePeserta.displayName)}
                  className="px-5 py-2 bg-red-800 hover:bg-red-900 border border-red-900 hover:border-red-950 text-white rounded-lg font-extrabold cursor-pointer transition-colors"
                >
                  YA, HAPUS PERMANEN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIRM DELETE ABSENSI ==================== */}
      {confirmDeleteAbsen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-neutral-200 overflow-hidden text-left animate-in zoom-in-95">
            <div className="bg-[#6B0D18] p-5 text-white flex justify-between items-center border-b-4 border-[#D4AF37]">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wide flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#D4AF37] animate-pulse" />
                  Hapus Record Absensi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteAbsen(null)}
                className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-semibold">
              <p className="text-neutral-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus catatan absensi milik <strong className="text-[#6B0D18] font-extrabold">{confirmDeleteAbsen.namaLengkap}</strong> untuk tanggal <strong className="text-neutral-900 font-extrabold">{confirmDeleteAbsen.tanggal}</strong>?
              </p>
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-950 leading-normal font-medium">
                Sistem internal audit Kejaksaan akan mencatat riwayat penghapusan ini demi terpenuhinya prinsip akuntabilitas data.
              </div>

              <div className="pt-2 flex justify-end gap-3 font-semibold">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAbsen(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-700 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAbsensi(confirmDeleteAbsen.id, confirmDeleteAbsen.namaLengkap, confirmDeleteAbsen.tanggal)}
                  className="px-5 py-2 bg-red-800 hover:bg-red-900 border border-red-900 hover:border-red-950 text-white rounded-lg font-extrabold cursor-pointer transition-colors"
                >
                  Ya, Hapus Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
