import React from 'react';
import { LapinharRecord } from '../types';
import { Shield, Lock, FileCheck } from 'lucide-react';

interface Props {
  data: LapinharRecord;
}

export const OfficialLapinharDoc: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white text-slate-900 shadow-xl border border-slate-300 rounded-lg max-w-4xl mx-auto p-8 md:p-12 font-serif text-[13px] leading-relaxed relative print:shadow-none print:border-none print:p-4">
      {/* Classification watermark / header */}
      <div className="flex justify-between items-center border-b-2 border-red-700 pb-3 mb-6">
        <div className="flex items-center gap-2 text-red-700 font-bold tracking-widest text-xs uppercase font-sans">
          <Lock className="w-4 h-4" />
          <span>RAHASIA (KLASIFIKASI TERBATAS)</span>
        </div>
        <div className="text-right text-xs font-sans text-slate-500">
          FORMULIR LAPINHAR / INTEL-1
        </div>
      </div>

      {/* Official Kejaksaan Header */}
      <div className="text-center mb-8 border-b border-slate-300 pb-5">
        <div className="flex justify-center items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-lg shadow-sm border border-amber-400">
            <Shield className="w-7 h-7" />
          </div>
        </div>
        <h2 className="font-sans font-extrabold text-base md:text-lg tracking-wider uppercase text-emerald-950">
          KEJAKSAAN REPUBLIK INDONESIA
        </h2>
        <h3 className="font-sans font-bold text-sm tracking-wide text-slate-700 uppercase">
          KORPS INTELIJEN PENEGAKAN HUKUM
        </h3>
        <p className="font-sans text-[11px] text-slate-500">
          Jl. Sultan Hasanuddin No. 1, Kebayoran Baru, Jakarta Selatan / Wilayah Hukum Terkait
        </p>
      </div>

      {/* Document Title */}
      <div className="text-center mb-6">
        <h1 className="font-sans font-black text-base md:text-lg tracking-widest underline uppercase text-slate-900">
          LAPORAN INFORMASI HARIAN (LAPINHAR)
        </h1>
        <p className="font-sans font-semibold text-xs text-slate-700 mt-1">
          NOMOR : <span className="text-emerald-900 font-mono font-bold">{data.nomor_surat}</span>
        </p>
      </div>

      {/* Metadata Table */}
      <div className="mb-6 border border-slate-300 bg-slate-50 p-4 rounded text-xs font-sans grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <span className="font-bold text-slate-600 block">KATEGORI :</span>
          <span className="font-medium text-slate-900">INTELIJEN EKONOMI & PENGAMANAN PEMBANGUNAN STRATEGIS (PPS)</span>
        </div>
        <div>
          <span className="font-bold text-slate-600 block">STATUS KELAYAKAN TELAAH :</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-emerald-800 bg-emerald-100 border border-emerald-300">
            <FileCheck className="w-3.5 h-3.5" />
            TERVERIFIKASI PASSED (SKOR 98/100)
          </span>
        </div>
      </div>

      {/* Section I: Peristiwa / Informasi Yang Diperoleh */}
      <div className="mb-6">
        <div className="font-sans font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2 border-b border-slate-200 pb-1 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-emerald-800 text-white inline-flex items-center justify-center text-[10px]">I</span>
          <span>INFORMASI YANG DIPEROLEH (REKONSTRUKSI 5W1H):</span>
        </div>
        <div className="text-slate-800 whitespace-pre-line pl-4 text-justify leading-relaxed">
          {data.info_yg_diperoleh}
        </div>
      </div>

      {/* Section II: Sumber Informasi */}
      <div className="mb-6">
        <div className="font-sans font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2 border-b border-slate-200 pb-1 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-emerald-800 text-white inline-flex items-center justify-center text-[10px]">II</span>
          <span>SUMBER INFORMASI (VERIFIKASI LAPANGAN & KOORDINASI TERTUTUP):</span>
        </div>
        <div className="text-slate-800 pl-4 text-justify bg-amber-50/40 p-3 rounded border-l-4 border-amber-500">
          {data.sumber_info}
        </div>
      </div>

      {/* Section III: Trend Perkembangan (Analisis AGHT) */}
      <div className="mb-6">
        <div className="font-sans font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2 border-b border-slate-200 pb-1 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-emerald-800 text-white inline-flex items-center justify-center text-[10px]">III</span>
          <span>TREND PERKEMBANGAN & ANALISIS PISAU BEDAH AGHT (PROYEKSI 1-3 BULAN):</span>
        </div>
        <div className="text-slate-800 whitespace-pre-line pl-4 text-justify leading-relaxed">
          {data.trend_perkembangan}
        </div>
      </div>

      {/* Section IV: Pendapat dan Saran Operasional */}
      <div className="mb-8">
        <div className="font-sans font-bold text-xs uppercase tracking-wider text-emerald-900 mb-2 border-b border-slate-200 pb-1 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-emerald-800 text-white inline-flex items-center justify-center text-[10px]">IV</span>
          <span>PENDAPAT DAN SARAN OPERASIONAL (REKOMENDASI PIMPINAN):</span>
        </div>
        <div className="text-slate-800 whitespace-pre-line pl-4 text-justify leading-relaxed bg-emerald-50/40 p-3.5 rounded border-l-4 border-emerald-600">
          {data.pendapat_saran}
        </div>
      </div>

      {/* Signature Section */}
      <div className="pt-6 border-t border-slate-300 font-sans grid grid-cols-2 text-xs">
        <div>
          <p className="text-slate-500">Catatan Pimpinan / Disposisi:</p>
          <div className="h-16 border border-dashed border-slate-300 mt-1 rounded p-2 text-[10px] text-slate-400 italic">
            [Ruang Disposisi Kajari / Kajati / Asintel]
          </div>
        </div>
        <div className="text-center ml-auto">
          <p>Dibuat di : Tabanan / Jakarta</p>
          <p>Pada Tanggal : {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="font-bold text-slate-900 mt-2">ANALIS SENIOR INTELIJEN KEJAKSAAN</p>
          <div className="h-16 flex items-center justify-center text-slate-300 italic text-[11px]">
            [Tanda Tangan Digital / Satgas Intel]
          </div>
          <p className="font-bold underline text-slate-900">TIM INTELIJEN YUSTISIAL</p>
          <p className="text-[10px] text-slate-500">KORPS ADHYAKSA RI</p>
        </div>
      </div>

      {/* Classification Footer */}
      <div className="mt-8 pt-3 border-t-2 border-red-700 text-center text-red-700 font-bold tracking-widest text-[11px] uppercase font-sans">
        RAHASIA
      </div>
    </div>
  );
};
