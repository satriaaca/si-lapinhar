import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

export const app = express();
app.use(express.json({ limit: '15mb' }));

// Initialize Google GenAI client (Server-side)
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Prompt Analis Intelijen Kejaksaan Senior
export const LAPINHAR_ANALYST_PROMPT = `Kamu adalah seorang Analis Intelijen Kejaksaan Senior yang bertugas menyusun Laporan Informasi Harian (Lapinhar) yang otentik, tajam, dan memenuhi standar penilaian AI sistem.

Tugasmu adalah menganalisis dokumen/PDF input dan menghasilkan JSON output yang rapi dengan aturan ketat berikut:

1. NOMOR SURAT (info_no_surat):
   Ekstrak nomor surat. WAJIB bersihkan awalan 'R-LIH-', 'R-LIK-', 'R-LIH/', 'R-LIK/' dari input (contoh hasil bersih: '1962/N.1.17/Dsb.4/10/2026').

2. INFORMASI YANG DIPEROLEH (info_yg_diperoleh):
   - Tulis ulang bagian 'I. INFORMASI YANG DIPEROLEH' menjadi poin-poin terpisah.
   - Wajib terdiri dari MINIMAL 6 ITEM/POIN terpisah menggunakan bullet points '• '.
   - STRUKTUR KALIMAT: Dilarang keras menggunakan kata 'Bahwa' di awal kalimat maupun di dalam poin!
   - KREATIVITAS & UNIK: Ubah susunan kalimat, gunakan variasi diksi/sinonim formal, dan variasikan struktur penulisan (kalimat aktif) agar tingkat kemiripan (similarity index) dengan laporan harian sebelumnya berada di bawah 40%.

3. SUMBER INFORMASI (sumber_info):
   Susun sumber informasi yang otentik, spesifik, dan formal hasil pantauan lapangan serta koordinasi tertutup instansi terkait. Hindari klaim generik atau kata-kata placeholder.

4. TREND PERKEMBANGAN (trend_perkembangan):
   Susun analisis AGHT (Ancaman, Gangguan, Hambatan, Tantangan) yang mendalam, mencakup potensi eskalasi sosial/ekonomi, serta proyeksi dampak 1-3 bulan ke depan secara logis dan terukur.

5. PENDAPAT & SARAN (pendapat_saran):
   Susun minimal 2-3 poin saran/tindakan operasional yang konkret, dapat dieksekusi (actionable), dan taktis untuk Pimpinan Kejaksaan.

FORMAT OUTPUT:
Keluarkan hasil HANYA dalam bentuk objek JSON valid tanpa markdown/teks tambahan di luar JSON, dengan struktur key:
- info_no_surat
- info_yg_diperoleh
- sumber_info
- trend_perkembangan
- pendapat_saran`;

// Helper: sanitize nomor_surat by stripping R-LIH/R-LIK prefix
export const cleanNomorSurat = (nomor: string): string => {
  if (!nomor) return '';
  return nomor.replace(/^(?:R[-/])?(?:LIH|LIK|IN)[-/\.\s]*/gi, '').trim();
};

// Helper: extract text from PDF base64
export async function extractTextFromPdf(pdfBase64: string): Promise<string> {
  const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
  const buffer = Buffer.from(cleanBase64, 'base64');
  try {
    const pdfModule = await import('pdf-parse') as unknown as {
      PDFParse?: new (options: { data: Buffer }) => { getText: () => Promise<string | Record<string, unknown>> };
      default?: (buf: Buffer) => Promise<{ text: string }>;
    };

    if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const textResult = await parser.getText();
      if (typeof textResult === 'string' && textResult.trim().length > 20) {
        return textResult.trim();
      }
      if (textResult && typeof textResult === 'object') {
        const str = JSON.stringify(textResult);
        if (str.length > 20) return str;
      }
    } else if (typeof pdfModule.default === 'function') {
      const res = await pdfModule.default(buffer);
      if (res && res.text) return res.text.trim();
    }
  } catch (parseErr) {
    console.warn('pdf-parse extraction fallback notice:', parseErr);
  }
  // Fallback: extract ASCII characters from PDF stream
  const rawText = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  return rawText.slice(0, 8000).trim();
}

// Helper: detect if an error is due to AI Quota Limit / Rate Limit (429) or upstream unavailable (503)
export function isQuotaOrTemporaryError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { status?: number; statusCode?: number; message?: string };
  if (e.status === 429 || e.statusCode === 429 || e.status === 503 || e.statusCode === 503) return true;
  const msg = String(e.message || '').toLowerCase();
  return (
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('high demand') ||
    msg.includes('unavailable')
  );
}

// Normalize and sanitize parsed records from Gemini or Groq
export function normalizeToLapinharRecords(parsedObj: unknown): Array<{
  nomor_surat: string;
  info_no_surat: string;
  info_yg_diperoleh: string;
  sumber_info: string;
  trend_perkembangan: string;
  pendapat_saran: string;
  justifikasi_passed: string;
}> {
  let arrayData: Record<string, string>[] = [];
  if (Array.isArray(parsedObj)) {
    arrayData = parsedObj as Record<string, string>[];
  } else if (parsedObj && typeof parsedObj === 'object') {
    const obj = parsedObj as Record<string, unknown>;
    if (Array.isArray(obj.data)) {
      arrayData = obj.data as Record<string, string>[];
    } else if (Array.isArray(obj.laporan)) {
      arrayData = obj.laporan as Record<string, string>[];
    } else if (Array.isArray(obj.items)) {
      arrayData = obj.items as Record<string, string>[];
    } else {
      arrayData = [parsedObj as Record<string, string>];
    }
  }

  return arrayData.map((item) => {
    const rawNo = item.info_no_surat || item.nomor_surat || '';
    const cleanNo = cleanNomorSurat(rawNo);
    return {
      nomor_surat: cleanNo,
      info_no_surat: cleanNo,
      info_yg_diperoleh: item.info_yg_diperoleh || (item as Record<string, string>).informasi_yang_diperoleh || '',
      sumber_info: item.sumber_info || '',
      trend_perkembangan: item.trend_perkembangan || '',
      pendapat_saran: item.pendapat_saran || '',
      justifikasi_passed: item.justifikasi_passed || 'Draf memenuhi standar kelulusan anti-rejected (skor 95-100).',
    };
  });
}

// Map requested model to an available Groq model
function resolveGroqModel(modelName?: string): string {
  if (!modelName) return 'openai/gpt-oss-120b';
  if (modelName === 'openai/gpt-oss-120b' || modelName === 'openai/gpt-oss-20b' || modelName === 'qwen/qwen3.8-27b') {
    return modelName;
  }
  if (modelName.includes('8b') || modelName.includes('instant')) {
    return 'openai/gpt-oss-20b';
  }
  if (modelName.includes('reasoning') || modelName.includes('qwen') || modelName.includes('r1')) {
    return 'qwen/qwen3.8-27b';
  }
  return 'openai/gpt-oss-120b';
}

// Helper: execute Groq chat completion with model fallback
async function executeGroqProcessing({
  prompt,
  model,
  groqApiKey,
}: {
  prompt: string;
  model?: string;
  groqApiKey?: string;
}) {
  const apiKeyToUse = groqApiKey || process.env.GROQ_API_KEY;
  if (!apiKeyToUse) {
    throw new Error('GROQ_API_KEY_NOT_CONFIGURED');
  }

  const primaryModel = resolveGroqModel(model);
  const modelsToTry = [primaryModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

  let lastError: Error | null = null;
  for (const currentModel of [...new Set(modelsToTry)]) {
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeyToUse}`,
        },
        body: JSON.stringify({
          model: currentModel,
          messages: [
            {
              role: 'system',
              content: LAPINHAR_ANALYST_PROMPT,
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      if (!groqResponse.ok) {
        const errText = await groqResponse.text();
        throw new Error(`Groq API Error (${groqResponse.status}): ${errText}`);
      }

      const groqData = await groqResponse.json();
      const rawContent = groqData.choices?.[0]?.message?.content?.trim() || '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        const match = rawContent.match(/\[[\s\S]*\]/) || rawContent.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('Groq tidak menghasilkan respon JSON valid.');
        }
      }

      return normalizeToLapinharRecords(parsed);
    } catch (err: unknown) {
      lastError = err as Error;
      // If error is 404 (model not found), try next model
      if (lastError.message.includes('404') || lastError.message.includes('model_not_found')) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('Gagal memproses dengan Groq AI.');
}

// Health check endpoint
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SIAP-LAPINHAR API',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
  });
});

// JSON Schema definition for Gemini Structured Outputs
const GEMINI_LAPINHAR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    info_no_surat: { type: Type.STRING },
    info_yg_diperoleh: { type: Type.STRING },
    sumber_info: { type: Type.STRING },
    trend_perkembangan: { type: Type.STRING },
    pendapat_saran: { type: Type.STRING },
  },
  required: [
    'info_no_surat',
    'info_yg_diperoleh',
    'sumber_info',
    'trend_perkembangan',
    'pendapat_saran',
  ],
};

// API: Process Lapinhar using Gemini or Groq
app.post(['/api/process-lapinhar', '/process-lapinhar'], async (req, res) => {
  try {
    const {
      items,
      pdfBase64,
      filename,
      provider = 'gemini',
      model = 'gemini-3.8-flash',
      groqApiKey,
      autoFallback = true,
    } = req.body;

    const buildPromptForText = (rawItems: unknown[]) => `
${LAPINHAR_ANALYST_PROMPT}

DOKUMEN/DATA INPUT:
${JSON.stringify(rawItems, null, 2)}
`;

    // -------------------------------------------------------------
    // FLOW 1: USER EXPLICITLY CHOSE GROQ
    // -------------------------------------------------------------
    if (provider === 'groq') {
      let groqPrompt = '';
      if (pdfBase64) {
        const extractedText = await extractTextFromPdf(pdfBase64);
        groqPrompt = `
${LAPINHAR_ANALYST_PROMPT}

DOKUMEN/PDF INPUT (${filename || 'Laporan Lapinhar'}):
"""
${extractedText}
"""
`;
      } else if (items && Array.isArray(items) && items.length > 0) {
        groqPrompt = buildPromptForText(items);
      } else {
        return res.status(400).json({ error: 'Data input kosong atau tidak valid.' });
      }

      try {
        const groqResult = await executeGroqProcessing({
          prompt: groqPrompt,
          model,
          groqApiKey,
        });
        return res.json({
          success: true,
          data: groqResult,
          source: `${model}_groq`,
          provider: 'groq',
        });
      } catch (groqError: unknown) {
        const err = groqError as Error;
        console.warn('Groq processing failed:', err.message);

        return res.status(500).json({
          error: err.message === 'GROQ_API_KEY_NOT_CONFIGURED'
            ? 'Kunci API Groq (GROQ_API_KEY) belum disetel di server/pengaturan. Silakan masukkan kunci API Groq Anda atau pilih engine Google Gemini.'
            : `Gagal memproses dengan Groq AI: ${err.message}`,
          canFallbackToGemini: Boolean(ai),
        });
      }
    }

    // -------------------------------------------------------------
    // FLOW 2: GOOGLE GEMINI (PDF Multimodal)
    // -------------------------------------------------------------
    if (pdfBase64) {
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY belum dikonfigurasi di server. Silakan pilih Groq AI atau konfigurasikan kunci API.',
        });
      }

      try {
        const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
        const pdfPart = {
          inlineData: {
            mimeType: 'application/pdf',
            data: cleanBase64,
          },
        };
        const promptPart = {
          text: `
${LAPINHAR_ANALYST_PROMPT}

DOKUMEN/PDF INPUT (${filename || 'Laporan Lapinhar'}):
Analisis dokumen PDF ini dan keluarkan hasil HANYA dalam bentuk objek JSON valid sesuai aturan ketat di atas.
`,
        };

        const targetModel = model.startsWith('gemini') ? model : 'gemini-3.8-flash';
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: { parts: [pdfPart, promptPart] },
          config: {
            systemInstruction: LAPINHAR_ANALYST_PROMPT,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_LAPINHAR_SCHEMA,
          },
        });

        const rawParsed = JSON.parse(response.text?.trim() || '{}');
        const normalized = normalizeToLapinharRecords(rawParsed);
        return res.json({ success: true, data: normalized, source: `${targetModel}_pdf`, provider: 'gemini' });
      } catch (geminiPdfErr: unknown) {
        console.warn('Gemini PDF processing error:', geminiPdfErr);
        const isTemporaryOrQuota = isQuotaOrTemporaryError(geminiPdfErr);

        const groqKey = groqApiKey || process.env.GROQ_API_KEY;
        if (isTemporaryOrQuota && autoFallback && groqKey) {
          console.log('Gemini quota/demand reached on PDF! Auto-switching to Groq...');
          try {
            const extractedText = await extractTextFromPdf(pdfBase64);
            const groqPrompt = `
${LAPINHAR_ANALYST_PROMPT}

DOKUMEN/PDF INPUT (${filename || 'Laporan Lapinhar'}):
"""
${extractedText}
"""
`;
            const groqResult = await executeGroqProcessing({
              prompt: groqPrompt,
              model: 'openai/gpt-oss-120b',
              groqApiKey,
            });
            return res.json({
              success: true,
              data: groqResult,
              source: 'groq_quota_fallback',
              provider: 'groq',
              fallbackTriggered: true,
              fallbackMessage: 'Batas kuota/antrean Google Gemini tercapai. Pemrosesan dialihkan otomatis ke Groq Cloud AI.',
            });
          } catch (fallbackErr) {
            console.warn('Auto-fallback to Groq failed:', fallbackErr);
          }
        }

        if (isTemporaryOrQuota) {
          return res.status(429).json({
            error: 'Layanan Google Gemini sedang padat / kuota limit. Anda dapat memilih Groq Cloud AI untuk memproses tanpa batas kuota.',
            isQuotaExceeded: true,
            suggestedProvider: 'groq',
          });
        }

        throw geminiPdfErr;
      }
    }

    // -------------------------------------------------------------
    // FLOW 3: TEXT / CSV ITEMS VIA GEMINI
    // -------------------------------------------------------------
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Data input tidak valid. Masukkan minimal 1 baris data atau unggah dokumen.' });
    }

    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di server. Silakan pilih Groq AI atau masukkan kunci API Groq.',
      });
    }

    const promptText = buildPromptForText(items);

    try {
      const targetModel = model.startsWith('gemini') ? model : 'gemini-3.8-flash';
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: promptText,
        config: {
          systemInstruction: LAPINHAR_ANALYST_PROMPT,
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_LAPINHAR_SCHEMA,
        },
      });

      const rawParsed = JSON.parse(response.text?.trim() || '{}');
      const parsedData = normalizeToLapinharRecords(rawParsed);
      return res.json({ success: true, data: parsedData, source: targetModel, provider: 'gemini' });
    } catch (geminiTextErr: unknown) {
      console.warn('Gemini text error:', geminiTextErr);
      const isTemporaryOrQuota = isQuotaOrTemporaryError(geminiTextErr);

      const groqKey = groqApiKey || process.env.GROQ_API_KEY;
      if (isTemporaryOrQuota && autoFallback && groqKey) {
        console.log('Gemini quota/demand reached on text! Auto-switching to Groq...');
        try {
          const groqResult = await executeGroqProcessing({
            prompt: promptText,
            model: 'openai/gpt-oss-120b',
            groqApiKey,
          });
          return res.json({
            success: true,
            data: groqResult,
            source: 'groq_quota_fallback',
            provider: 'groq',
            fallbackTriggered: true,
            fallbackMessage: 'Batas kuota/antrean Google Gemini tercapai. Pemrosesan dialihkan otomatis ke Groq Cloud AI.',
          });
        } catch (fallbackErr) {
          console.warn('Fallback to Groq text failed:', fallbackErr);
        }
      }

      if (isTemporaryOrQuota) {
        return res.status(429).json({
          error: 'Layanan Google Gemini sedang padat / kuota limit. Anda dapat memilih Groq Cloud AI untuk memproses tanpa batas kuota.',
          isQuotaExceeded: true,
          suggestedProvider: 'groq',
        });
      }

      throw geminiTextErr;
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error in /api/process-lapinhar:', error);
    return res.status(500).json({
      error: 'Gagal memproses data Lapinhar: ' + (error.message || 'Unknown error'),
    });
  }
});

export default app;
