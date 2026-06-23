export type UserRole = 'peserta' | 'admin';

export interface Biodata {
  namaLengkap: string;
  nim: string;
  universitas: string;
  fakultas: string;
  prodi: string;
  jenisKelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  noHp: string;
  email: string;
  alamat: string;
  kota?: string;
}

export interface DataMagang {
  bidang: string; // Pembinaan | Intelijen | Tindak Pidana Umum | Tindak Pidana Khusus | Perdata dan Tata Usaha Negara | Pengawasan | Barang Bukti dan Barang Rampasan | Pemulihan Aset
  tanggalMulai: string; // YYYY-MM-DD
  tanggalSelesai: string; // YYYY-MM-DD
}

export type MagangStatus = 'Aktif' | 'Selesai' | 'Diberhentikan';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  isSetup: boolean;
  biodata?: Biodata;
  dataMagang?: DataMagang;
  status: MagangStatus;
  createdAt: string;
}

export interface LogAbsen {
  waktu: string; // HH:mm:ss
  latitude: number;
  longitude: number;
  isWFH: boolean;
  status: 'Hadir' | 'Terlambat';
}

export interface AbsensiRecord {
  id: string; // format: uid_YYYY-MM-DD
  uid: string;
  email: string;
  namaLengkap: string;
  bidang: string;
  tanggal: string; // YYYY-MM-DD
  hari: string; // Senin - Jumat
  datang?: LogAbsen;
  pulang?: LogAbsen;
  statusAbsen: 'Hadir' | 'Terlambat' | 'Alpa';
}

export interface LogbookRecord {
  id: string; // auto-generated
  uid: string;
  namaLengkap: string;
  bidang: string;
  tanggal: string; // YYYY-MM-DD
  kegiatan: string;
  uraianPekerjaan: string;
  hasilPekerjaan: string;
  kendala: string;
  solusi: string;
  createdAt: string;
}

export interface LaporanAkhir {
  uid: string;
  namaLengkap: string;
  bidang: string;
  fileName: string;
  fileURL: string;
  tanggalUpload: string; // ISO string
  statusUpload: 'Success' | 'Pending' | 'Failed';
}

export interface AuditTrailRecord {
  id: string;
  uid: string;
  email: string;
  namaLengkap: string;
  role: UserRole;
  aktivitas: string; // e.g. Login, Logout, Absen Datang, Absen Pulang, Isi Logbook, Upload Laporan, Perubahan Data Peserta dll
  detail: string;
  timestamp: string; // ISO string
}
