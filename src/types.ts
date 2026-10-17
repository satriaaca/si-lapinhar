export interface LapinharRecord {
  id?: string;
  nomor_surat: string;
  info_yg_diperoleh: string;
  sumber_info: string;
  trend_perkembangan: string;
  pendapat_saran: string;
  justifikasi_passed: string;
  audit_score?: number;
  audit_status?: 'PASSED' | 'REVISION' | 'REJECTED';
}

export interface AuditResult {
  score: number;
  status: string;
  breakdown: {
    eliminasi_bahwa: { score: number; max: number; feedback: string };
    otentisitas_sumber: { score: number; max: number; feedback: string };
    analisis_aght_trend: { score: number; max: number; feedback: string };
    pendapat_saran_operasional: { score: number; max: number; feedback: string };
    struktur_5w1h_format: { score: number; max: number; feedback: string };
  };
}
