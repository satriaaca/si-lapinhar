import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  AlertTriangle,
  Zap,
  Sparkles,
  Settings,
  ChevronRight,
  Files,
  Plus,
  Trash2
} from 'lucide-react';
import { LapinharRecord } from './types';
import { parseCSV } from './utils/csvParser';

interface AIEngine {
  id: string;
  provider: 'gemini' | 'groq';
  name: string;
  label: string;
  description: string;
  tag: string;
}

const AI_ENGINES: AIEngine[] = [
  { 
    id: 'gemini-3.8-flash', 
    provider: 'gemini', 
    name: 'Gemini 3.8 Flash',
    label: 'Gemini 3.8 Flash (Google AI)', 
    description: 'Model multimodal canggih & cerdas, optimal untuk analisis visual PDF dan pemenuhan standar 5W1H.',
    tag: 'Rekomendasi Utama'
  },
  { 
    id: 'gemini-3.1-flash-lite', 
    provider: 'gemini', 
    name: 'Gemini 3.1 Flash Lite',
    label: 'Gemini 3.1 Flash Lite (Google AI)', 
    description: 'Sangat ringan & hemat kuota untuk pemrosesan cepat dokumen standar.',
    tag: 'Hemat Kuota'
  },
  { 
    id: 'openai/gpt-oss-120b', 
    provider: 'groq', 
    name: 'Groq - GPT OSS 120B',
    label: 'Groq - GPT OSS 120B (Bebas Kuota)', 
    description: 'Alternatif bebas kendala kuota Gemini. Kecepatan ultra tinggi, penalaran kuat setara GPT-4 / Llama 3.3 70B.',
    tag: 'Solusi Bebas Kuota'
  },
  { 
    id: 'openai/gpt-oss-20b', 
    provider: 'groq', 
    name: 'Groq - GPT OSS 20B',
    label: 'Groq - GPT OSS 20B (Super Kilat)', 
    description: 'Super kilat untuk perbaikan redaksional kilat tanpa antre kuota.',
    tag: 'Super Kilat'
  },
  { 
    id: 'qwen/qwen3.8-27b', 
    provider: 'groq', 
    name: 'Groq - Qwen 3.8 27B',
    label: 'Groq - Qwen 3.8 27B (Reasoning)', 
    description: 'Model penalaran terpandu mendalam untuk analisis AGHT komprehensif.',
    tag: 'Analisis Mendalam'
  },
];

export const cleanNomorSurat = (nomor: string): string => {
  if (!nomor) return '';
  return nomor.replace(/^(?:R[-/])?(?:LIH|LIK|IN)[-/\.\s]*/gi, '').trim();
};

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Gagal membaca berkas ${file.name}`));
    reader.readAsDataURL(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Gagal membaca berkas ${file.name}`));
    reader.readAsText(file);
  });
};

export default function App() {
  const [records, setRecords] = useState<LapinharRecord[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [selectedEngine, setSelectedEngine] = useState<string>('gemini-3.8-flash');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Multi-File Upload & AI Engine Modal State
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showEngineModal, setShowEngineModal] = useState<boolean>(false);
  const [appendMode, setAppendMode] = useState<'append' | 'replace'>('append');
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentFileName: string;
  } | null>(null);

  const [autoFallback, setAutoFallback] = useState<boolean>(true);
  const [customGroqKey, setCustomGroqKey] = useState<string>(() => {
    return localStorage.getItem('user_groq_api_key') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Quota & Fallback Notifications
  const [quotaExceededNotice, setQuotaExceededNotice] = useState<string | null>(null);
  const [lastProcessedData, setLastProcessedData] = useState<{
    type: 'pdf' | 'csv' | 'text';
    files?: File[];
    file?: File;
    text?: string;
  } | null>(null);

  // UX: Copy feedback state
  const [activeCopiedKey, setActiveCopiedKey] = useState<string | null>(null);
  const [copiedHistory, setCopiedHistory] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // UX: Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // UX: Detail preview modal
  const [previewItem, setPreviewItem] = useState<{ title: string; content: string } | null>(null);

  // UX: Drag & drop & Paste
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [rawPasteText, setRawPasteText] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  // Save custom Groq key when edited
  useEffect(() => {
    if (customGroqKey) {
      localStorage.setItem('user_groq_api_key', customGroqKey);
    }
  }, [customGroqKey]);

  // Active engine object
  const currentEngineObj = useMemo(() => {
    return AI_ENGINES.find(e => e.id === selectedEngine) || AI_ENGINES[0];
  }, [selectedEngine]);

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

  // Called when user selects or drops one or multiple files
  const handleFilesPicked = (incomingFiles: File[]) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    
    // Filter supported files
    const validFiles = incomingFiles.filter(f => 
      f.name.toLowerCase().endsWith('.pdf') || 
      f.name.toLowerCase().endsWith('.csv') || 
      f.name.toLowerCase().endsWith('.txt') ||
      f.type.includes('pdf') ||
      f.type.includes('csv') ||
      f.type.includes('text')
    );

    if (validFiles.length === 0) {
      setErrorMsg('Format berkas tidak didukung. Harap pilih berkas PDF atau CSV/Teks.');
      return;
    }

    setPendingFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}`));
      const nonDuplicates = validFiles.filter(f => !existingKeys.has(`${f.name}-${f.size}`));
      return [...prev, ...nonDuplicates];
    });

    setShowEngineModal(true);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // CSV parsing helper
  const extractFromCsvText = async (textToProcess: string, activeEngine: AIEngine): Promise<LapinharRecord[]> => {
    const parsedRows = parseCSV(textToProcess);
    let itemsToProcess: { nomor_surat: string; informasi_mentah: string }[] = [];

    if (parsedRows.length > 0) {
      itemsToProcess = parsedRows.map((row) => {
        const noSurat = row['nomor_surat'] || row['no_surat'] || row['nomor'] || '0001/N.1/Dsb.4/10/2026';
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

    const res = await fetch('/api/process-lapinhar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        items: itemsToProcess,
        provider: activeEngine.provider,
        model: activeEngine.id,
        autoFallback: autoFallback,
        groqApiKey: customGroqKey.trim() || undefined,
      })
    });

    const json = await res.json();
    if (res.status === 429 || json.isQuotaExceeded) {
      setQuotaExceededNotice(json.error || 'Batas kuota Gemini tercapai (Error 429). Anda dapat langsung beralih ke Groq Cloud AI.');
      return [];
    }

    if (!res.ok) {
      throw new Error(json.error || 'Gagal memproses data CSV.');
    }

    if (json.data && Array.isArray(json.data)) {
      return json.data.map((item: LapinharRecord, idx: number) => {
        const cleanNo = cleanNomorSurat(item.info_no_surat || item.nomor_surat || '');
        return {
          ...item,
          nomor_surat: cleanNo,
          info_no_surat: cleanNo,
          id: `row-${Date.now()}-${idx}`,
        };
      });
    }
    return [];
  };

  // Batch process all selected files (Multi-file PDF & CSV)
  const executeBatchProcess = async (
    filesToProcess: File[], 
    engineId = selectedEngine, 
    mode = appendMode
  ) => {
    if (filesToProcess.length === 0) return;
    
    setShowEngineModal(false);
    setIsProcessing(true);
    setErrorMsg(null);
    setQuotaExceededNotice(null);
    setCopiedHistory(new Set());

    const activeEngine = AI_ENGINES.find(e => e.id === engineId) || AI_ENGINES[0];
    setLastProcessedData({ type: 'pdf', files: filesToProcess });

    const allNewRecords: LapinharRecord[] = [];
    let fallbacksCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setBatchProgress({
        current: i + 1,
        total: filesToProcess.length,
        currentFileName: file.name
      });

      try {
        if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
          const base64Data = await readFileAsDataURL(file);
          const res = await fetch('/api/process-lapinhar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64Data,
              filename: file.name,
              provider: activeEngine.provider,
              model: activeEngine.id,
              autoFallback: autoFallback,
              groqApiKey: customGroqKey.trim() || undefined,
            })
          });

          const json = await res.json();

          if (res.status === 429 || json.isQuotaExceeded) {
            setQuotaExceededNotice(
              json.error || `Batas kuota Gemini tercapai saat memproses "${file.name}". Beralih ke Groq AI untuk melanjutkan tanpa kendala kuota.`
            );
            break;
          }

          if (!res.ok) {
            errors.push(`${file.name}: ${json.error || 'Gagal diproses'}`);
            continue;
          }

          if (json.data && Array.isArray(json.data)) {
            const formatted: LapinharRecord[] = json.data.map((item: LapinharRecord, idx: number) => {
              const cleanNo = cleanNomorSurat(item.info_no_surat || item.nomor_surat || '');
              return {
                ...item,
                nomor_surat: cleanNo,
                info_no_surat: cleanNo,
                id: `row-pdf-${Date.now()}-${i}-${idx}`,
              };
            });
            allNewRecords.push(...formatted);
          }

          if (json.fallbackTriggered) {
            fallbacksCount++;
          }
        } else {
          // CSV / Text file
          const content = await readFileAsText(file);
          const formatted = await extractFromCsvText(content, activeEngine);
          if (formatted && formatted.length > 0) {
            allNewRecords.push(...formatted);
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        errors.push(`${file.name}: ${error.message || 'Gagal membaca berkas'}`);
      }
    }

    if (allNewRecords.length > 0) {
      if (mode === 'replace') {
        setRecords(allNewRecords);
      } else {
        setRecords(prev => [...prev, ...allNewRecords]);
      }

      if (filesToProcess.length === 1) {
        setFileName(filesToProcess[0].name);
      } else {
        setFileName(`${filesToProcess.length} Berkas PDF (${allNewRecords.length} Baris Laporan)`);
      }

      if (fallbacksCount > 0) {
        setToastMessage(`Selesai! Beralih otomatis ke Groq AI untuk ${fallbacksCount} berkas karena batas kuota Gemini.`);
      } else {
        setToastMessage(`Berhasil mengekstrak ${allNewRecords.length} butir laporan dari ${filesToProcess.length} berkas via ${activeEngine.name}!`);
      }
      setTimeout(() => setToastMessage(null), 4500);
    }

    if (errors.length > 0 && allNewRecords.length === 0) {
      setErrorMsg(`Gagal memproses berkas: ${errors.join('; ')}`);
    } else if (errors.length > 0) {
      setErrorMsg(`Perhatian: Beberapa berkas terkendala (${errors.join('; ')}), namun ${allNewRecords.length} laporan berhasil diekstrak.`);
    }

    setIsProcessing(false);
    setBatchProgress(null);
    setPendingFiles([]);
  };

  // Single CSV text manual processing
  const executeProcessCsv = async (text: string, engine: AIEngine) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setQuotaExceededNotice(null);
    try {
      const formatted = await extractFromCsvText(text, engine);
      if (formatted.length > 0) {
        if (appendMode === 'replace') {
          setRecords(formatted);
        } else {
          setRecords(prev => [...prev, ...formatted]);
        }
        setFileName(`Teks Manual (${formatted.length} Baris)`);
        setToastMessage(`Berhasil memproses ${formatted.length} butir laporan via ${engine.name}!`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Terjadi kesalahan pemrosesan teks.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Instant recovery action when quota is exceeded: Switch to Groq and re-run
  const handleSwitchToGroqAndRetry = () => {
    const groqEngineId = 'openai/gpt-oss-120b';
    const groqEngine = AI_ENGINES.find(e => e.id === groqEngineId) || AI_ENGINES[2];
    setSelectedEngine(groqEngineId);
    setQuotaExceededNotice(null);

    if (lastProcessedData) {
      if (lastProcessedData.files && lastProcessedData.files.length > 0) {
        executeBatchProcess(lastProcessedData.files, groqEngineId, appendMode);
      } else if (lastProcessedData.file) {
        executeBatchProcess([lastProcessedData.file], groqEngineId, appendMode);
      } else if (lastProcessedData.text) {
        executeProcessCsv(lastProcessedData.text, groqEngine);
      }
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

  const getExtendedSnippet = (text: string, maxLen = 130) => {
    if (!text) return '-';
    const clean = text.replace(/[\r\n•\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen).trim() + '...';
  };

  // Drag and drop handlers supporting multiple files
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
    const dropped = Array.from(e.dataTransfer.files || []);
    if (dropped.length > 0) {
      handleFilesPicked(dropped);
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
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRecords([]);
                  setFileName('');
                  setToastMessage('Tabel berhasil dibersihkan.');
                  setTimeout(() => setToastMessage(null), 2000);
                }}
                className="text-[11px] text-slate-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors"
                title="Bersihkan seluruh data tabel"
              >
                <Trash2 className="w-3 h-3" />
                <span>Bersihkan Tabel</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllAsTsv}
              disabled={records.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 text-xs font-medium rounded border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {activeCopiedKey === 'all-tsv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{activeCopiedKey === 'all-tsv' ? 'Tersalin' : 'Salin Semua (Excel)'}</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={records.length === 0}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-medium rounded flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
          </div>
        </div>

        {/* Toolbar Input & Filter: File, Model, Search */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Sisi Kiri: Multi-File Upload & Paste Link */}
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                multiple
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) handleFilesPicked(files);
                  e.target.value = '';
                }} 
                accept=".pdf, .csv, .txt, application/pdf, text/csv, text/plain" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Mendukung multi-file: pilih beberapa PDF sekaligus atau seret langsung ke sini"
              >
                <Files className="w-3.5 h-3.5" />
                <span>
                  {fileName ? (
                    fileName.includes('Berkas') ? `📁 ${fileName}` : `📄 ${fileName}`
                  ) : (
                    'Unggah Dokumen (Bisa Multi PDF)'
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer font-medium ml-1"
              >
                {showPasteBox ? 'Tutup Teks' : 'Atau Tempel Teks'}
              </button>
            </div>

            {/* Sisi Kanan: Pencarian Cepat & Model AI Switcher */}
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

              {/* Model AI Dropdown with Provider Grouping */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded px-2 py-1">
                <span className={`w-2 h-2 rounded-full ${currentEngineObj.provider === 'gemini' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                <select
                  value={selectedEngine}
                  onChange={(e) => setSelectedEngine(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 font-medium focus:outline-none cursor-pointer pr-1"
                >
                  <optgroup label="── Google Gemini (Default) ──">
                    <option value="gemini-3.8-flash">Gemini 3.8 Flash (Multimodal)</option>
                    <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Hemat Kuota)</option>
                  </optgroup>
                  <optgroup label="── Groq Cloud AI (Anti-Quota Exceeded) ──">
                    <option value="openai/gpt-oss-120b">Groq - GPT OSS 120B (Rekomendasi)</option>
                    <option value="openai/gpt-oss-20b">Groq - GPT OSS 20B (Kilat)</option>
                    <option value="qwen/qwen3.8-27b">Groq - Qwen 3.8 27B (Reasoning)</option>
                  </optgroup>
                </select>

                <button
                  type="button"
                  onClick={() => setShowEngineModal(true)}
                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Buka Pengaturan Mesin AI & Berkas"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Kotak Tempel Teks (Bila Diaktifkan) */}
          {showPasteBox && (
            <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in duration-100">
              <label className="text-xs font-semibold text-slate-700 block">
                Tempelkan Teks Dokumen atau CSV Mentah:
              </label>
              <textarea
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                placeholder="Tempel nomor surat dan narasi laporan mentah di sini..."
                rows={4}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:outline-emerald-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Mesin aktif: <strong className="text-slate-700">{currentEngineObj.name}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRawPasteText('');
                      setShowPasteBox(false);
                    }}
                    className="px-3 py-1 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!rawPasteText.trim() || isProcessing}
                    onClick={() => {
                      if (!rawPasteText.trim()) return;
                      setLastProcessedData({ type: 'text', text: rawPasteText });
                      setShowPasteBox(false);
                      executeProcessCsv(rawPasteText, currentEngineObj);
                    }}
                    className="px-3.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Mulai Standarisasi</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Batch Progress Bar untuk Multi-File PDF */}
        {batchProgress && (
          <div className="bg-emerald-900 text-white rounded-lg p-3 shadow-md border border-emerald-700 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-300 shrink-0" />
                <span>Memproses Berkas {batchProgress.current} dari {batchProgress.total}</span>
                <span className="text-emerald-300 font-mono font-normal truncate max-w-xs sm:max-w-md">
                  • {batchProgress.currentFileName}
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-200 shrink-0">
                {Math.round(((batchProgress.current - 0.2) / batchProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-emerald-950/70 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(10, ((batchProgress.current - 0.2) / batchProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Banner Alert: Limit Kuota Gemini (Error 429) & Solusi Groq */}
        {quotaExceededNotice && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3 shadow-xs animate-in fade-in slide-in-from-top-1">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-900">
                  Batas Kuota Google Gemini Tercapai (Error 429)
                </h4>
                <button
                  type="button"
                  onClick={() => setQuotaExceededNotice(null)}
                  className="text-amber-500 hover:text-amber-800 text-xs cursor-pointer"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {quotaExceededNotice} Kuota Gemini Anda sedang limit atau habis. Anda dapat langsung melanjutkan pemrosesan dokumen menggunakan <strong>Groq Cloud AI (Llama 3.3 70B)</strong> yang bebas kuota Google.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSwitchToGroqAndRetry}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>⚡ Proses Ulang dengan Groq AI (Llama 3.3 70B)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEngineModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-800 text-xs font-medium rounded border border-amber-300 cursor-pointer"
                >
                  Pilih Mesin AI Lain...
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Banner Error Umum */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-2 text-rose-700 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button 
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-700 font-bold cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabel Data Kompak & Profesional */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200/60">No</th>
                  <th className="py-2.5 px-3 w-44 border-r border-slate-200/60">Nomor Surat</th>
                  <th className="py-2.5 px-3 min-w-[260px] border-r border-slate-200/60">Informasi Yang Diperoleh</th>
                  <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200/60">Sumber Informasi</th>
                  <th className="py-2.5 px-3 min-w-[240px] border-r border-slate-200/60">Trend Perkembangan</th>
                  <th className="py-2.5 px-3 min-w-[240px] border-r border-slate-200/60">Pendapat &amp; Saran</th>
                  <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal text-slate-700">
                {isProcessing && records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-xs font-medium">Sedang mengekstrak dan menstandarisasi dokumen...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Files className="w-8 h-8 text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">
                          {searchQuery ? 'Tidak ada data yang sesuai dengan pencarian.' : 'Belum ada data laporan.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Unggah satu atau banyak berkas PDF / CSV atau gunakan tombol "Atau Tempel Teks" di toolbar atas.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((item, idx) => {
                    const rowKey = `row-${idx}`;
                    const isAllRowCopied = copiedHistory.has(rowKey);

                    return (
                      <tr 
                        key={item.id || idx} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isAllRowCopied ? 'bg-emerald-50/30' : idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        }`}
                      >
                        {/* 1. No Urut */}
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                          {idx + 1}
                        </td>

                        {/* 2. Nomor Surat */}
                        <td className="py-2 px-3 border-r border-slate-100 group align-top">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-semibold text-slate-900 font-mono text-xs select-all">
                              {item.nomor_surat || '-'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.nomor_surat, `${idx}-nomor`, 'Nomor Surat')}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-opacity cursor-pointer shrink-0"
                              title="Salin Nomor Surat"
                            >
                              {activeCopiedKey === `${idx}-nomor` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 3. Informasi Yang Diperoleh */}
                        <td className="py-2 px-3 border-r border-slate-100 group align-top">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-slate-700 leading-snug line-clamp-3">
                              {getExtendedSnippet(item.info_yg_diperoleh)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewItem({ title: `Informasi Yang Diperoleh (${item.nomor_surat})`, content: item.info_yg_diperoleh })}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Lihat Teks Lengkap"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.info_yg_diperoleh, `${idx}-info`, 'Informasi Yang Diperoleh')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Salin Informasi"
                              >
                                {activeCopiedKey === `${idx}-info` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 4. Sumber Informasi */}
                        <td className="py-2 px-3 border-r border-slate-100 group align-top">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-slate-700 leading-snug line-clamp-3">
                              {getExtendedSnippet(item.sumber_info)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewItem({ title: `Sumber Informasi (${item.nomor_surat})`, content: item.sumber_info })}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Lihat Teks Lengkap"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.sumber_info, `${idx}-sumber`, 'Sumber Informasi')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Salin Sumber Informasi"
                              >
                                {activeCopiedKey === `${idx}-sumber` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 5. Trend Perkembangan */}
                        <td className="py-2 px-3 border-r border-slate-100 group align-top">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-slate-700 leading-snug line-clamp-3">
                              {getExtendedSnippet(item.trend_perkembangan)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewItem({ title: `Trend Perkembangan (${item.nomor_surat})`, content: item.trend_perkembangan })}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Lihat Teks Lengkap"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.trend_perkembangan, `${idx}-trend`, 'Trend Perkembangan')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Salin Trend Perkembangan"
                              >
                                {activeCopiedKey === `${idx}-trend` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 6. Pendapat & Saran */}
                        <td className="py-2 px-3 border-r border-slate-100 group align-top">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-slate-700 leading-snug line-clamp-3">
                              {getExtendedSnippet(item.pendapat_saran)}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewItem({ title: `Pendapat & Saran (${item.nomor_surat})`, content: item.pendapat_saran })}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Lihat Teks Lengkap"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.pendapat_saran, `${idx}-saran`, 'Pendapat & Saran')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                                title="Salin Pendapat & Saran"
                              >
                                {activeCopiedKey === `${idx}-saran` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 7. Aksi Baris (Salin Seluruh Baris) */}
                        <td className="py-2 px-2 text-center align-top">
                          <button
                            type="button"
                            onClick={() => handleCopyRow(item, idx)}
                            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center justify-center gap-1 w-full transition-colors cursor-pointer ${
                              isAllRowCopied 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                            title="Salin seluruh kolom di baris ini untuk dipaste ke Excel/Word"
                          >
                            {activeCopiedKey === `row-${idx}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Disalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Hidden file input for adding more files inside the modal */}
      <input 
        type="file" 
        ref={additionalFileInputRef} 
        multiple
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) handleFilesPicked(files);
          e.target.value = '';
        }} 
        accept=".pdf, .csv, .txt, application/pdf, text/csv, text/plain" 
        className="hidden" 
      />

      {/* MODAL: Konfigurasi Multi-Berkas & Pilihan Engine AI (Gemini vs Groq) */}
      {showEngineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-700" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Pilih Mesin AI &amp; Ekstraksi Dokumen
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Mendukung multi-file PDF. Tentukan engine AI sebelum berkas diproses untuk mengantisipasi batas kuota.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEngineModal(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Berkas Terpilih Info & Multi-File List */}
              {pendingFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Files className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Berkas Terpilih ({pendingFiles.length} berkas • {(pendingFiles.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)} MB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => additionalFileInputRef.current?.click()}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Berkas</span>
                    </button>
                  </div>

                  {/* Scrollable List of Pending Files */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {pendingFiles.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 pt-1.5 first:pt-0 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-white text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-slate-800 truncate" title={f.name}>
                            {f.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(f.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          className="w-5 h-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0 cursor-pointer"
                          title="Hapus berkas dari antrean"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Option: Mode Penggabungan Data jika sudah ada data di tabel */}
                  {records.length > 0 && (
                    <div className="p-2.5 bg-emerald-50/50 border border-emerald-200/80 rounded-lg text-xs space-y-1.5">
                      <span className="font-semibold text-slate-700 block text-[11px]">
                        Tindakan Terhadap Data Tabel ({records.length} baris yang sudah ada):
                      </span>
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                          <input
                            type="radio"
                            name="appendMode"
                            checked={appendMode === 'append'}
                            onChange={() => setAppendMode('append')}
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Tambahkan (Append)</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-medium">
                          <input
                            type="radio"
                            name="appendMode"
                            checked={appendMode === 'replace'}
                            onChange={() => setAppendMode('replace')}
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span>Ganti Semua (Replace)</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-1">
                  <Files className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs text-slate-600 font-medium">Belum ada berkas PDF yang dipilih</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer underline inline-block pt-1"
                  >
                    + Pilih Satu atau Beberapa Berkas PDF / CSV
                  </button>
                </div>
              )}

              {/* Provider Choices */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Pilih Engine AI:</span>
                  <span className="text-[11px] font-normal text-slate-500">Pilih Gemini atau Groq</span>
                </label>

                {/* Option 1: Google Gemini */}
                <div 
                  onClick={() => setSelectedEngine('gemini-3.8-flash')}
                  className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                    currentEngineObj.provider === 'gemini'
                      ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={currentEngineObj.provider === 'gemini'}
                        onChange={() => setSelectedEngine('gemini-3.8-flash')}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-slate-900">Google Gemini AI</span>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                      Multimodal PDF
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 pl-6 leading-relaxed">
                    Menganalisis dokumen PDF langsung via Vision AI. Akurasi tinggi terhadap tabel, stempel, dan naskah dinas.
                  </p>
                  
                  {currentEngineObj.provider === 'gemini' && (
                    <div className="mt-2.5 pl-6 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Model:</span>
                      <select
                        value={selectedEngine}
                        onChange={(e) => setSelectedEngine(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="gemini-3.8-flash">Gemini 3.8 Flash (Direkomendasikan)</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Hemat Kuota)</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Option 2: Groq Cloud AI (Anti-Quota Exceeded) */}
                <div 
                  onClick={() => setSelectedEngine('openai/gpt-oss-120b')}
                  className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                    currentEngineObj.provider === 'groq'
                      ? 'border-amber-600 bg-amber-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={currentEngineObj.provider === 'groq'}
                        onChange={() => setSelectedEngine('openai/gpt-oss-120b')}
                        className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="font-bold text-xs text-slate-900">Groq Cloud AI (Bebas Kuota)</span>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> Bebas Kuota Gemini
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 pl-6 leading-relaxed">
                    Solusi utama saat kuota Google Gemini habis (Error 429) atau padat antrean. Pemrosesan ekstra cepat &amp; bebas hambatan.
                  </p>

                  {currentEngineObj.provider === 'groq' && (
                    <div className="mt-2.5 pl-6 flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Model:</span>
                      <select
                        value={selectedEngine}
                        onChange={(e) => setSelectedEngine(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium cursor-pointer"
                      >
                        <option value="openai/gpt-oss-120b">Groq - GPT OSS 120B (Rekomendasi Bebas Kuota)</option>
                        <option value="openai/gpt-oss-20b">Groq - GPT OSS 20B (Super Kilat)</option>
                        <option value="qwen/qwen3.8-27b">Groq - Qwen 3.8 27B (Reasoning)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-Fallback Checkbox */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={autoFallback}
                    onChange={(e) => setAutoFallback(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Otomatis beralih ke Groq jika kuota Gemini habis (Error 429)</span>
                </label>
                <p className="text-[11px] text-slate-500 pl-5">
                  Jika Gemini mengembalikan kuota exceeded, sistem mengekstrak teks dokumen dan langsung memproses melalui Groq tanpa gagal.
                </p>
              </div>

              {/* Optional Custom Groq Key Input for Vercel users without env */}
              <div className="text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  {showKeyInput ? 'Sembunyikan Pengaturan Kunci API' : '+ Atur Kunci API Groq Kustom (Opsional)'}
                </button>
                {showKeyInput && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-700 block">
                      Kunci API Groq Pribadi (gsk_...):
                    </label>
                    <input
                      type="password"
                      value={customGroqKey}
                      onChange={(e) => setCustomGroqKey(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 font-mono"
                    />
                    <p className="text-[10px] text-slate-400">
                      Disimpan aman di browser Anda. Berguna jika Anda belum memasukkan GROQ_API_KEY di Vercel Environment Variables.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowEngineModal(false);
                  setPendingFiles([]);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded border border-slate-300 cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={pendingFiles.length === 0 || isProcessing}
                onClick={() => {
                  if (pendingFiles.length > 0) {
                    executeBatchProcess(pendingFiles, selectedEngine, appendMode);
                  } else {
                    setShowEngineModal(false);
                  }
                }}
                className={`px-4 py-1.5 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                  currentEngineObj.provider === 'gemini'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <span>
                      Mulai Ekstrak ({pendingFiles.length > 0 ? `${pendingFiles.length} Berkas • ` : ''}{currentEngineObj.provider === 'gemini' ? 'Gemini' : 'Groq'})
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating UX Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 pointer-events-none max-w-lg text-center">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
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
