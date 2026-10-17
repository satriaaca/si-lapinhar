import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  Copy, 
  Check, 
  Download, 
  Loader2, 
  AlertCircle,
  Cpu,
  Search,
  Eye,
  X,
  RotateCcw,
  CheckCheck
} from 'lucide-react';
import { LapinharRecord } from './types';
import { USER_PRODUCTION_LAPINHAR_LIST } from './data/samples';
import { parseCSV } from './utils/csvParser';

const AI_ENGINES = [
  { id: 'gemini-3.8-flash', provider: 'gemini', label: 'Gemini 3.8 Flash (Google AI)' },
  { id: 'gemini-3.1-flash-lite', provider: 'gemini', label: 'Gemini 3.1 Flash Lite (Google AI)' },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', label: 'Groq - Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', provider: 'groq', label: 'Groq - Llama 3.1 8B' },
  { id: 'deepseek-r1-distill-llama-70b', provider: 'groq', label: 'Groq - DeepSeek R1 70B' },
  { id: 'mixtral-8x7b-32768', provider: 'groq', label: 'Groq - Mixtral 8x7B' },
];

export const cleanNomorSurat = (nomor: string): string => {
  if (!nomor) return '';
  return nomor
    .replace(/^(?:R[-/])?(?:LIH|LIK|IN)[-/\.\s]*/gi, '')
    .replace(/^(?:R[-/])?(?:LIH|LIK|IN)[-/\.\s]*/gi, '')
    .trim();
};

export default function App() {
  const [records, setRecords] = useState<LapinharRecord[]>(USER_PRODUCTION_LAPINHAR_LIST);
  const [fileName, setFileName] = useState<string>('');
  const [selectedEngine, setSelectedEngine] = useState<string>('gemini-3.8-flash');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // UX: Copy feedback state
  const [activeCopiedKey, setActiveCopiedKey] = useState<string | null>(null);
  const [copiedHistory, setCopiedHistory] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // UX: Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // UX: Detail preview modal
  const [previewItem, setPreviewItem] = useState<{ title: string; content: string } | null>(null);
  
  // UX: Drag & drop
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(r => 
      r.nomor_surat.toLowerCase().includes(q) ||
      r.info_yg_diperoleh.toLowerCase().includes(q) ||
      r.sumber_info.toLowerCase().includes(q) ||
      r.trend_perkembangan.toLowerCase().includes(q) ||
      r.pendapat_saran.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  // Enhanced copy helper with tracking
  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setActiveCopiedKey(key);
    setCopiedHistory(prev => new Set(prev).add(key));
    setToastMessage(`Tersalin: ${label}`);

    setTimeout(() => {
      setActiveCopiedKey(null);
    }, 1500);

    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  const handleCopyRow = (item: LapinharRecord, index: number) => {
    const formatted = `${item.nomor_surat}\n\n${item.info_yg_diperoleh}\n\n${item.sumber_info}\n\n${item.trend_perkembangan}\n\n${item.pendapat_saran}`;
    handleCopy(formatted, `row-${index}`, `Seluruh Baris (${item.nomor_surat})`);
    
    // Mark all columns in this row as copied
    setCopiedHistory(prev => {
      const next = new Set(prev);
      next.add(`${index}-nomor`);
      next.add(`${index}-info`);
      next.add(`${index}-sumber`);
      next.add(`${index}-trend`);
      next.add(`${index}-saran`);
      return next;
    });
  };

  const handleCopyAllAsTsv = () => {
    const headers = ['Nomor Surat', 'Informasi Yang Diperoleh', 'Sumber Informasi', 'Trend Perkembangan', 'Pendapat & Saran'];
    const rows = filteredRecords.map(r => [
      r.nomor_surat.replace(/\t/g, ' '),
      r.info_yg_diperoleh.replace(/[\t\r\n]+/g, ' '),
      r.sumber_info.replace(/[\t\r\n]+/g, ' '),
      r.trend_perkembangan.replace(/[\t\r\n]+/g, ' '),
      r.pendapat_saran.replace(/[\t\r\n]+/g, ' ')
    ]);
    const tsvContent = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);
    setActiveCopiedKey('all-tsv');
    setToastMessage('Tersalin: Seluruh Tabel (Format Excel/TSV)');
    setTimeout(() => setActiveCopiedKey(null), 1500);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const handleFileUpload = (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);

    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      processPdfFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        processCsvContent(content);
      }
    };
    reader.readAsText(file);
  };

  const processPdfFile = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setCopiedHistory(new Set());

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const activeEngineObj = AI_ENGINES.find(e => e.id === selectedEngine) || AI_ENGINES[0];

        const res = await fetch('/api/process-lapinhar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pdfBase64: base64Data,
            filename: file.name,
            provider: activeEngineObj.provider,
            model: activeEngineObj.id
          })
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Gagal mengekstrak dokumen PDF.');
        }

        if (json.data && Array.isArray(json.data)) {
          const formatted: LapinharRecord[] = json.data.map((item: LapinharRecord, idx: number) => ({
            ...item,
            nomor_surat: cleanNomorSurat(item.nomor_surat),
            id: `row-pdf-${Date.now()}-${idx}`,
          }));
          setRecords(formatted);
          setToastMessage(`Berhasil mengekstrak ${formatted.length} laporan dari PDF!`);
          setTimeout(() => setToastMessage(null), 3000);
        }
        setIsProcessing(false);
      };

      reader.onerror = () => {
        setIsProcessing(false);
        setErrorMsg('Gagal membaca berkas PDF.');
      };

      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const error = err as Error;
      setIsProcessing(false);
      setErrorMsg(error.message || 'Terjadi kesalahan pemrosesan PDF.');
    }
  };

  const processCsvContent = async (textToProcess: string) => {
    if (!textToProcess.trim()) {
      setErrorMsg('Data CSV kosong.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setCopiedHistory(new Set()); // Reset progress history on new file

    try {
      const parsedRows = parseCSV(textToProcess);
      let itemsToProcess: { nomor_surat: string; informasi_mentah: string }[] = [];

      if (parsedRows.length > 0) {
        itemsToProcess = parsedRows.map((row) => {
          const noSurat = row['nomor_surat'] || row['no_surat'] || row['nomor'] || 'R-LIH/01/2026';
          const info = row['informasi_yang_diperoleh'] || row['info'] || row['informasi'] || Object.values(row)[4] || '';
          return {
            nomor_surat: noSurat,
            informasi_mentah: info
          };
        }).filter(item => item.informasi_mentah.trim().length > 0);
      }

      if (itemsToProcess.length === 0) {
        const lines = textToProcess.split(/\r?\n/).filter(l => l.trim().length > 0);
        let curNo = '';
        let curInfo = '';
        for (const line of lines) {
          const match = line.match(/^([A-Z0-9\-\.\/]+),\s*(.*)$/i);
          if (match) {
            if (curNo && curInfo) itemsToProcess.push({ nomor_surat: curNo.trim(), informasi_mentah: curInfo.trim() });
            curNo = match[1];
            curInfo = match[2];
          } else if (curNo) {
            curInfo += '\n' + line;
          }
        }
        if (curNo && curInfo) itemsToProcess.push({ nomor_surat: curNo.trim(), informasi_mentah: curInfo.trim() });
      }

      if (itemsToProcess.length === 0) {
        itemsToProcess.push({
          nomor_surat: "1659/N.1.17/Dsb.4/09/2026",
          informasi_mentah: textToProcess
        });
      }

      const activeEngineObj = AI_ENGINES.find(e => e.id === selectedEngine) || AI_ENGINES[0];

      const res = await fetch('/api/process-lapinhar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: itemsToProcess,
          provider: activeEngineObj.provider,
          model: activeEngineObj.id
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memproses data.');
      }

      if (json.data && Array.isArray(json.data)) {
        const formatted: LapinharRecord[] = json.data.map((item: LapinharRecord, idx: number) => ({
          ...item,
          nomor_surat: cleanNomorSurat(item.nomor_surat),
          id: `row-${Date.now()}-${idx}`,
        }));
        setRecords(formatted);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Terjadi kesalahan pemrosesan CSV.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCsv = () => {
    const csvRows = [
      ['"nomor_surat"', '"info_yg_diperoleh"', '"sumber_info"', '"trend_perkembangan"', '"pendapat_saran"'].join(',')
    ];
    for (const r of filteredRecords) {
      const sanitize = (txt: string) => `"${(txt || '').replace(/"/g, '""')}"`;
      csvRows.push([
        sanitize(r.nomor_surat),
        sanitize(r.info_yg_diperoleh),
        sanitize(r.sumber_info),
        sanitize(r.trend_perkembangan),
        sanitize(r.pendapat_saran),
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lapinhar_output_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper: longer, more informative snippet (~120 chars) that shows key context
  const getExtendedSnippet = (text: string, maxLen = 130) => {
    if (!text) return '-';
    const clean = text.replace(/[\r\n•\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).trim() + '...';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-screen bg-slate-50 text-slate-800 font-sans p-4 sm:p-6 transition-colors ${
        isDragging ? 'bg-emerald-50/70 ring-4 ring-emerald-500 ring-inset' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-3">
        
        {/* Header Bersih & Kompak */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Format Lapinhar Intelijen
            </h1>
            <span className="text-[11px] text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded font-mono font-medium">
              {filteredRecords.length} / {records.length} Baris
            </span>
            {copiedHistory.size > 0 && (
              <button
                type="button"
                onClick={() => setCopiedHistory(new Set())}
                className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset tanda kolom yang sudah disalin"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Tanda</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllAsTsv}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {activeCopiedKey === 'all-tsv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{activeCopiedKey === 'all-tsv' ? 'Tersalin' : 'Salin Semua (Excel)'}</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* Toolbar Input & Filter: File, Model, Search */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Sisi Kiri: File Upload & Paste Link */}
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => handleFileUpload(e.target.files?.[0])} 
                accept=".pdf, .csv, .txt, application/pdf, text/csv, text/plain" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{fileName ? (fileName.toLowerCase().endsWith('.pdf') ? `📄 ${fileName}` : fileName) : 'Unggah Berkas (PDF / CSV)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer font-medium ml-1"
              >
                {showPasteBox ? 'Tutup Teks' : 'Atau Tempel Teks'}
              </button>
            </div>

            {/* Sisi Kanan: Pencarian Cepat & Model AI */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quick Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari no surat / kata kunci..."
                  className="pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-emerald-600 w-44 sm:w-56"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Model AI Dropdown */}
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedEngine}
                  onChange={(e) => setSelectedEngine(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-emerald-600 cursor-pointer"
                >
                  {AI_ENGINES.map((engine) => (
                    <option key={engine.id} value={engine.id}>
                      {engine.label}
                    </option>
                  ))}
                </select>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses...</span>
                </div>
              )}
            </div>
          </div>

          {/* Optional Paste Area */}
          {showPasteBox && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <textarea
                rows={3}
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder="Tempel teks laporan atau baris data (nomor surat dan informasi)..."
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-emerald-600"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => processCsvContent(rawPasteText)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-medium rounded cursor-pointer"
                >
                  Proses
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-red-600 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Tabel Snippet Informatif Khusus Copy-Paste */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px] sticky top-0 z-10 backdrop-blur-xs">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-44">No Surat</th>
                  <th className="py-2.5 px-3 min-w-[280px]">Informasi Diperoleh</th>
                  <th className="py-2.5 px-3 min-w-[220px]">Sumber Informasi</th>
                  <th className="py-2.5 px-3 min-w-[260px]">Trend Perkembangan (AGHT)</th>
                  <th className="py-2.5 px-3 min-w-[260px]">Pendapat &amp; Saran</th>
                  <th className="py-2.5 px-3 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada data yang cocok dengan pencarian "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item, index) => (
                    <tr 
                      key={item.id || index} 
                      className="hover:bg-slate-50/80 transition-colors group align-top"
                    >
                      {/* No */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* No Surat */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.nomor_surat, `${index}-nomor`, 'No Surat')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                              activeCopiedKey === `${index}-nomor`
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : copiedHistory.has(`${index}-nomor`)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Salin Nomor Surat"
                          >
                            {activeCopiedKey === `${index}-nomor` ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : copiedHistory.has(`${index}-nomor`) ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{activeCopiedKey === `${index}-nomor` ? 'Tersalin' : 'Salin'}</span>
                          </button>
                          <span 
                            className="font-mono text-slate-800 text-xs font-semibold break-all leading-tight mt-0.5 select-all" 
                            title={item.nomor_surat}
                          >
                            {item.nomor_surat}
                          </span>
                        </div>
                      </td>

                      {/* Informasi yang Diperoleh - Snippet Sedikit Lebih Panjang */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.info_yg_diperoleh, `${index}-info`, 'Informasi Diperoleh')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                              activeCopiedKey === `${index}-info`
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : copiedHistory.has(`${index}-info`)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Salin Informasi yang Diperoleh"
                          >
                            {activeCopiedKey === `${index}-info` ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : copiedHistory.has(`${index}-info`) ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{activeCopiedKey === `${index}-info` ? 'Tersalin' : 'Salin'}</span>
                          </button>
                          <div className="flex-1">
                            <p 
                              onClick={() => setPreviewItem({ title: `Informasi Diperoleh (${item.nomor_surat})`, content: item.info_yg_diperoleh })}
                              className="text-slate-700 text-xs leading-relaxed line-clamp-2 hover:text-slate-900 cursor-pointer" 
                              title="Klik untuk intip isi lengkap"
                            >
                              {getExtendedSnippet(item.info_yg_diperoleh, 140)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Sumber Informasi - Snippet Sedikit Lebih Panjang */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.sumber_info, `${index}-sumber`, 'Sumber Informasi')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                              activeCopiedKey === `${index}-sumber`
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : copiedHistory.has(`${index}-sumber`)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Salin Sumber Informasi"
                          >
                            {activeCopiedKey === `${index}-sumber` ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : copiedHistory.has(`${index}-sumber`) ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{activeCopiedKey === `${index}-sumber` ? 'Tersalin' : 'Salin'}</span>
                          </button>
                          <div className="flex-1">
                            <p 
                              onClick={() => setPreviewItem({ title: `Sumber Informasi (${item.nomor_surat})`, content: item.sumber_info })}
                              className="text-slate-700 text-xs leading-relaxed line-clamp-2 hover:text-slate-900 cursor-pointer" 
                              title="Klik untuk intip isi lengkap"
                            >
                              {getExtendedSnippet(item.sumber_info, 110)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Trend Perkembangan - Snippet Sedikit Lebih Panjang */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.trend_perkembangan, `${index}-trend`, 'Trend Perkembangan')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                              activeCopiedKey === `${index}-trend`
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : copiedHistory.has(`${index}-trend`)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Salin Trend Perkembangan"
                          >
                            {activeCopiedKey === `${index}-trend` ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : copiedHistory.has(`${index}-trend`) ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{activeCopiedKey === `${index}-trend` ? 'Tersalin' : 'Salin'}</span>
                          </button>
                          <div className="flex-1">
                            <p 
                              onClick={() => setPreviewItem({ title: `Trend Perkembangan (${item.nomor_surat})`, content: item.trend_perkembangan })}
                              className="text-slate-700 text-xs leading-relaxed line-clamp-2 hover:text-slate-900 cursor-pointer" 
                              title="Klik untuk intip isi lengkap"
                            >
                              {getExtendedSnippet(item.trend_perkembangan, 130)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Pendapat & Saran - Snippet Sedikit Lebih Panjang */}
                      <td className="py-3 px-3">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(item.pendapat_saran, `${index}-saran`, 'Pendapat & Saran')}
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                              activeCopiedKey === `${index}-saran`
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : copiedHistory.has(`${index}-saran`)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Salin Pendapat & Saran"
                          >
                            {activeCopiedKey === `${index}-saran` ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : copiedHistory.has(`${index}-saran`) ? (
                              <CheckCheck className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            <span>{activeCopiedKey === `${index}-saran` ? 'Tersalin' : 'Salin'}</span>
                          </button>
                          <div className="flex-1">
                            <p 
                              onClick={() => setPreviewItem({ title: `Pendapat & Saran (${item.nomor_surat})`, content: item.pendapat_saran })}
                              className="text-slate-700 text-xs leading-relaxed line-clamp-2 hover:text-slate-900 cursor-pointer" 
                              title="Klik untuk intip isi lengkap"
                            >
                              {getExtendedSnippet(item.pendapat_saran, 130)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Aksi Baris */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopyRow(item, index)}
                          className={`w-full py-1 px-2 rounded text-[11px] font-medium border flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs ${
                            activeCopiedKey === `row-${index}`
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {activeCopiedKey === `row-${index}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{activeCopiedKey === `row-${index}` ? 'Tersalin' : 'Salin 1 Baris'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Floating UX Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Quick Modal Preview (Intip Teks Lengkap) */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-300 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-xs text-slate-800">
                {previewItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-xs text-slate-800 whitespace-pre-line leading-relaxed select-text">
              {previewItem.content}
            </div>
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {previewItem.content.length} karakter
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewItem.content);
                  setToastMessage('Tersalin dari Pratinjau');
                  setTimeout(() => setToastMessage(null), 2000);
                  setPreviewItem(null);
                }}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Teks Ini</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
