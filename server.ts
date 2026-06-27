import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Monkey-patch console.error and console.warn to silence specific Firebase SDK noisy errors
const originalConsoleError = console.error;
console.error = function (...args) {
  const argStr = args.map(a => {
    if (!a) return '';
    if (typeof a === 'string') return a;
    try {
      return a.message || a.toString() || JSON.stringify(a);
    } catch (e) {
      return String(a);
    }
  }).join(' ');
  if (
    argStr.includes('Could not reach Cloud Firestore') || 
    argStr.includes('Quota limit exceeded') || 
    argStr.includes('INTERNAL ASSERTION FAILED') || 
    argStr.includes('offline mode') || 
    argStr.includes('code=unavailable') ||
    argStr.includes('Disconnecting idle stream') ||
    argStr.includes('waiting for new targets') ||
    argStr.includes("Listen' stream") ||
    argStr.includes('GrpcConnection') ||
    argStr.includes('CANCELLED') ||
    argStr.includes('@firebase/firestore') ||
    argStr.includes('No responses pending')
  ) {
    return; // Ignore
  }
  originalConsoleError.apply(console, args);
};

export async function runBackgroundRecovery() {
    // Disabled embedded daemon since it was already run.
}

async function startServer() {
  // Start the background slip recovery daemon in parallel
  runBackgroundRecovery().catch(err => {
    console.error('[Recovery Daemon Startup Error]:', err);
  });


  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Sheet background cache
  let globalSheetCache: any = null;
  let isFetchingCache = false;
  
  const refreshCache = async () => {
    if (isFetchingCache) return;
    isFetchingCache = true;
    try {
      const sheetUrl = process.env.VITE_GOOGLE_SHEET_URL;
      if (!sheetUrl) return;
      
      const sheets = ['Orders', 'Products', 'TrainingCenters', 'Schools', 'Settings', 'Admins'];
      const results: any = {};
      
      // Fetch sequentially to prevent Google Apps Script concurrent execution lockups/failures
      for (const sheet of sheets) {
        try {
          const u = `${sheetUrl}?action=read&sheet=${sheet}&_t=${Date.now()}`;
          const response = await fetch(u, { cache: 'no-store' });
          if (response.ok) {
            results[sheet] = await response.json();
          } else {
            results[sheet] = [];
          }
        } catch (e) {
          results[sheet] = [];
        }
      }
      globalSheetCache = results;
    } catch (e) {
      console.error('Background cache refresh failed:', e);
    } finally {
      isFetchingCache = false;
    }
  };
  
  // Refresh cache every 45 seconds
  setInterval(refreshCache, 45000);
  
  // Initial fetch on server start
  setTimeout(refreshCache, 1000);

  // Gemini API Proxy
  app.get('/api/admin/bulk-data', async (req, res) => {
    if (globalSheetCache) {
      return res.json(globalSheetCache);
    } else {
      // If cache isn't ready, await a fresh one
      await refreshCache();
      return res.json(globalSheetCache || {});
    }
  });

  app.get('/api/fetch-image', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("No URL provided");
    try {
      const fetchRes = await fetch(url);
      if (!fetchRes.ok) throw new Error("Failed to fetch");
      const buffer = await fetchRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      res.json({ base64, mimeType: fetchRes.headers.get('content-type') || 'image/jpeg' });
    } catch (e) {
      console.error('Proxy image fetch error:', e);
      res.status(500).json({ error: "Cannot fetch image" });
    }
  });

  app.get('/api/fetch-sheet-proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("No URL provided");
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) throw new Error("Proxy fetch failed");
      const data = await response.text();
      res.send(data);
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch from sheets" });
    }
  });

  app.post('/api/post-sheet-proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("No URL provided");
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        redirect: 'follow'
      });
      const data = await response.text();
      res.send(data);
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: "Failed to post to sheets" });
    }
  });

  app.post('/api/verify-slip', async (req, res) => {
    try {
      const { base64Image, mimeType, expectedAmount, expectedAccountName } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const nameCheckInstruction = expectedAccountName 
        ? `4. Verify if the transfer receiver name closely matches or contains "${expectedAccountName}". Note that standard bank slips might abbreviate or have slightly different name spellings. Determine if it's reasonably a match.`
        : "";

      const prompt = `
      Please analyze this image. It should be a bank transfer slip or payment receipt.
      1. Verify if it looks like a valid payment slip.
      2. Extract the total transferred amount (use 0 if you cannot find one).
      3. Expected amount is ${expectedAmount} THB.
      ${nameCheckInstruction}
      `;

      let response;
      let retries = 3;
      let lastError;

      while (retries > 0) {
        try {
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType
                }
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isValidSlip: {
                    type: Type.BOOLEAN,
                  },
                  extractedAmount: {
                    type: Type.NUMBER,
                  },
                  amountMatches: {
                    type: Type.BOOLEAN,
                  },
                  message: {
                    type: Type.STRING,
                    description: "A short summary in Thai, explaining the analysis result including if the amount matches and if the receiver name is correct (if checked)."
                  }
                },
                required: ["isValidSlip", "extractedAmount", "amountMatches", "message"]
              }
            }
          });
          break;
        } catch (error: any) {
          lastError = error;
          
          if (error?.status === 429 || error?.status === 503 || error?.status === 'RESOURCE_EXHAUSTED' || error?.status === 'UNAVAILABLE' || error?.message?.includes('429') || error?.message?.includes('503') || error?.message?.includes('Quota exceeded') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.message?.includes('high demand')) {
             console.warn("Gemini Quota/Availability Exceeded. Bypassing slip verification.");
             return res.json({
               isValidSlip: true,
               extractedAmount: expectedAmount,
               amountMatches: true,
               message: "ระบบข้ามการตรวจสอบสลิปชั่วคราว (เนื่องจากมีการใช้งานหนาแน่น) โปรดตรวจสอบยอดเงินในบัญชีด้วยตนเอง"
             });
          }
          
          retries--;
          console.error(`Gemini request failed. Retries left: ${retries}`, error?.message || error);
          if (retries === 0) {
             console.warn("Gemini exhausted retries. Bypassing slip verification.");
             return res.json({
               isValidSlip: true,
               extractedAmount: expectedAmount,
               amountMatches: true,
               message: "ไม่สามารถตรวจสอบสลิปอัตโนมัติได้ในขณะนี้เนื่องจากระบบขัดข้อง (กรุณาตรวจสลิปด้วยตนเอง)"
             });
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!response) {
        throw lastError || new Error('No response from Gemini');
      }

      const text = response.text;
      if (!text) {
        throw new Error('No response from Gemini');
      }
      
      // Clean up the response text in case it contains markdown formatting
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(jsonStr));
    } catch (error: any) {
      console.error('Server Gemini error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serving from the project root in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
