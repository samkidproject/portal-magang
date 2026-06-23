import React, { useState } from 'react';
import { db } from '../firebase';
import { doc } from 'firebase/firestore';
import { safeSetDoc as setDoc } from '../utils/firestoreHelper';
import { UserProfile, Biodata, DataMagang } from '../types';
import { BookOpen, User, Mail, Phone, MapPin, Landmark, Calendar, Camera, UploadCloud } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';

interface SetupBiodataProps {
  user: UserProfile;
  onSetupComplete: (updatedProfile: UserProfile) => void;
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

export const PILIHAN_KOTA_KABUPATEN = [
  'Kota Bandar Lampung',
  'Kota Metro',
  'Kabupaten Lampung Barat',
  'Kabupaten Lampung Selatan',
  'Kabupaten Lampung Tengah',
  'Kabupaten Lampung Timur',
  'Kabupaten Lampung Utara',
  'Kabupaten Mesuji',
  'Kabupaten Pesawaran',
  'Kabupaten Pesisir Barat',
  'Kabupaten Pringsewu',
  'Kabupaten Tanggamus',
  'Kabupaten Tulang Bawang',
  'Kabupaten Tulang Bawang Barat',
  'Kabupaten Way Kanan',
  'Luar Provinsi Lampung'
];

export default function SetupBiodata({ user, onSetupComplete, onShowMessage }: SetupBiodataProps) {
  const [loading, setLoading] = useState(false);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  
  // States matching BIODATA
  const [namaLengkap, setNamaLengkap] = useState(user.displayName || '');
  const [nim, setNim] = useState('');
  const [universitas, setUniversitas] = useState('');
  const [fakultas, setFakultas] = useState('');
  const [prodi, setProdi] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('Laki-Laki');
  const [tempatLahir, setTempatLahir] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [noHp, setNoHp] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('Kota Bandar Lampung');
  
  // States matching DATA MAGANG
  const [bidang] = useState(user.dataMagang?.bidang || 'Belum Ditentukan');
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict validations
    if (!namaLengkap || !nim || !universitas || !fakultas || !prodi || !tempatLahir || !tanggalLahir || !noHp || !email || !alamat || !kota) {
      onShowMessage('Silakan lengkapi seluruh field Biodata.', 'warning');
      return;
    }

    if (!tanggalMulai || !tanggalSelesai) {
      onShowMessage('Silakan tentukan periode tanggal PKL Anda.', 'warning');
      return;
    }

    if (tanggalMulai > tanggalSelesai) {
      onShowMessage('Tanggal mulai tidak boleh melebihi tanggal selesai.', 'error');
      return;
    }

    setLoading(true);

    const biodata: Biodata = {
      namaLengkap,
      nim,
      universitas,
      fakultas,
      prodi,
      jenisKelamin,
      tempatLahir,
      tanggalLahir,
      noHp,
      email,
      alamat,
      kota
    };

    const dataMagang: DataMagang = {
      bidang,
      tanggalMulai,
      tanggalSelesai
    };

    // Determine current default status based on dates
    const todayStr = new Date().toISOString().split('T')[0];
    let initialStatus = user.status || 'Aktif';
    if (todayStr > tanggalSelesai) {
      initialStatus = 'Selesai';
    }

    const updatedProfile: UserProfile = {
      ...user,
      displayName: namaLengkap,
      photoURL: photoURL || user.photoURL || '',
      isSetup: true,
      biodata,
      dataMagang,
      status: initialStatus
    };

    try {
      // Save profile to firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, updatedProfile);

      // Create Audit Trail
      const auditRef = doc(db, 'audit', `setup_${user.uid}_${Date.now()}`);
      await setDoc(auditRef, {
        id: auditRef.id,
        uid: user.uid,
        email: user.email,
        namaLengkap: updatedProfile.displayName,
        role: updatedProfile.role,
        aktivitas: 'Isi Biodata Pertama',
        detail: `Registrasi biodata & bidang [${bidang}] berjalan sukses.`,
        timestamp: new Date().toISOString()
      });

      onShowMessage('Pendaftaran biodata Anda berhasil disimpan!', 'success');
      onSetupComplete(updatedProfile);
    } catch (err: any) {
      console.error('Setup Profile Error', err);
      onShowMessage(`Gagal mendaftarkan profil: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8" id="setup-biodata-screen">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-200">
        
        {/* Banner with Kejati Lampung Identity */}
        <div className="bg-gradient-to-r from-emerald-800 to-blue-900 p-6 text-white border-b-2 border-[#D4AF37]">
          <h2 className="text-xl font-extrabold flex items-center gap-3 font-display">
            <img 
              src="https://lh3.googleusercontent.com/d/1RFeS62mbLO2U3fdRp0gQBSQpgW9vXe4F" 
              alt="Logo Kejati" 
              referrerPolicy="no-referrer" 
              className="h-8 w-auto object-contain bg-white p-0.5 rounded border border-[#D4AF37]" 
            />
            LENGKAPI DATA PENDAFTARAN
          </h2>
          <p className="text-xs text-yellow-200 uppercase tracking-wider font-mono mt-1">
            S.IPKL Kejaksaan Tinggi Lampung • Pendaftaran Pertama Peserta Magang/PKL
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8 divide-y divide-neutral-200">
          
          {/* SECTION 1: BIODATA DIRIPESERTA */}
          <div>
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4 font-display">
              <User className="h-5 w-5 text-emerald-700" />
              Identitas & Biodata Diri
            </h3>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              
              {/* Photo Upload Row */}
              <div className="sm:col-span-6 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                <label className="block text-xs font-bold text-neutral-800 uppercase mb-2">Unggah Pas Foto (Format PNG/JPG, Maksimal 1MB)</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt="Preview Pas Foto"
                        className="h-20 w-20 rounded-xl object-cover border-2 border-[#D4AF37] shadow-sm bg-slate-200"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl border-2 border-slate-300 border-dashed bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                        <User className="h-8 w-8 text-slate-400 mb-0.5" />
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider scale-90">KOSONG</span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 bg-emerald-700 text-white p-1 rounded-full border border-white shadow-sm">
                      <Camera className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-xs text-neutral-600 mb-2">Unggah pas foto formal Anda untuk keperluan administrasi dan kartu identitas magang Kejaksaan Tinggi Lampung.</p>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-300 rounded-lg shadow-sm text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:border-[#D4AF37] cursor-pointer transition-all">
                      <UploadCloud className="h-4 w-4 text-emerald-700" />
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
                                onShowMessage('Pas foto berhasil diunggah dan dioptimalkan!', 'success');
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

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">NIM / Nomor Induk Mahasiswa</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2117051042"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Universitas / Sekolah</label>
                <input
                  type="text"
                  required
                  value={universitas}
                  onChange={(e) => setUniversitas(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Fakultas</label>
                <input
                  type="text"
                  required
                  value={fakultas}
                  onChange={(e) => setFakultas(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Program Studi</label>
                <input
                  type="text"
                  required
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Jenis Kelamin</label>
                <select
                  value={jenisKelamin}
                  onChange={(e) => setJenisKelamin(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="Laki-Laki">Laki-Laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  required
                  value={tempatLahir}
                  onChange={(e) => setTempatLahir(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  required
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Nomor HP / WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 081234567890"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Alamat Email</label>
                <input
                  type="email"
                  required
                  disabled
                  value={email}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm bg-neutral-100 text-neutral-600 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Kota / Kabupaten Domisili</label>
                <select
                  value={kota}
                  onChange={(e) => setKota(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 bg-white font-semibold"
                >
                  {PILIHAN_KOTA_KABUPATEN.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Alamat Domisili Lengkap (Kecamatan, RT/RW)</label>
                <textarea
                  required
                  rows={1}
                  value={alamat}
                  placeholder="e.g. Kedaton, RT 02/RW 03"
                  onChange={(e) => setAlamat(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DATA MAGANG */}
          <div className="pt-6">
            <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2 mb-4 font-display">
              <BookOpen className="h-5 w-5 text-blue-700" />
              Rincian Penempatan & Periode PKL
            </h3>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Bidang Divisi Penempatan
                </label>
                <div className="w-full rounded-lg border border-[#D4AF37] px-3 py-2 text-sm bg-neutral-50 text-neutral-800 font-bold flex items-center justify-between">
                  <span>{bidang}</span>
                  <span className="text-[10px] bg-[#6B0D18]/10 text-[#6B0D18] px-2.5 py-0.5 rounded-full font-extrabold uppercase select-none">
                    Ditetapkan Admin
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 mt-1 italic">
                  *Bidang divisi penempatan ditentukan sepenuhnya oleh Admin Kejaksaan Tinggi Lampung dan tidak dapat diisi/diubah sendiri oleh peserta.
                </p>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Tanggal Mulai Magang</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">Tanggal Selesai Magang</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1 italic">
                  *Setelah melewati tanggal ini, status Anda otomatis berubah menjadi Selesai.
                </p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="lg:w-auto w-full flex items-center justify-center gap-2 px-6 py-2.5 border border-transparent text-sm font-bold rounded-lg shadow-md text-white bg-emerald-700 hover:bg-emerald-800 border-[#D4AF37] border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-750 transition-all cursor-pointer"
            >
              <Landmark className="h-4 w-4 text-[#D4AF37]" />
              {loading ? 'Menyimpan...' : 'SELESAIKAN PENDAFTARAN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
