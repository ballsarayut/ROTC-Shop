/// <reference types="vite/client" />

/**
 * Service to handle synchronization with Google Sheets via Google Apps Script
 */

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEET_URL || "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFl1ILZ18Nt-dvJLk1dd6VtgEI/exec";

export type SheetName = 'Orders' | 'Products' | 'Settings' | 'Admins' | 'Schools' | 'TrainingCenters';

export const googleSheetService = {
  /**
   * Sync a single record to Google Sheets (Create or Update)
   */
  async syncRecord(sheet: SheetName, payload: any) {
    if (!SCRIPT_URL) {
      console.warn('VITE_GOOGLE_SHEET_URL is not defined. Skipping sync. Please redeploy if you just added it.');
      return;
    }

    try {
      let intendedIsEmbroidered: any = undefined;
      let intendedIsOrdered: any = undefined;

      // Scan all potential variation of keys to guarantee we extract the latest intended toggled status
      Object.keys(payload).forEach(k => {
        const cleanK = k.toLowerCase().trim();
        if (cleanK === 'isembroidered') {
          if (k === 'isEmbroidered' || intendedIsEmbroidered === undefined) {
            intendedIsEmbroidered = payload[k];
          }
        }
        if (cleanK === 'isordered') {
          if (k === 'isOrdered' || intendedIsOrdered === undefined) {
            intendedIsOrdered = payload[k];
          }
        }
      });

      // Convert Firestore timestamps to ISO strings for Sheets
      const sanitizedPayload = { ...payload };
      Object.keys(sanitizedPayload).forEach(key => {
        const val = sanitizedPayload[key];
        if (key === 'phone') {
          let phoneStr = String(val || '');
          if (phoneStr.startsWith("'")) phoneStr = phoneStr.substring(1);
          if (phoneStr && !phoneStr.startsWith('0')) {
            phoneStr = '0' + phoneStr;
          }
          sanitizedPayload[key] = `'${phoneStr}`;
        } else if (typeof val === 'boolean') {
          sanitizedPayload[key] = val ? "TRUE" : "FALSE";
        } else if (val && typeof val === 'object' && val.toDate) {
          sanitizedPayload[key] = val.toDate().toISOString();
        } else if (val instanceof Date) {
          sanitizedPayload[key] = val.toISOString();
        } else if (val && typeof val === 'object') {
          sanitizedPayload[key] = JSON.stringify(val);
        }
      });
      
      // Update ALL variation keys to standard representation so it updates the correct column in Apps Script
      if (intendedIsEmbroidered !== undefined) {
        const valStr = (intendedIsEmbroidered === true || intendedIsEmbroidered === 'true' || intendedIsEmbroidered === 'TRUE') ? "TRUE" : "FALSE";
        let foundVariation = false;
        Object.keys(sanitizedPayload).forEach(k => {
          if (k.toLowerCase().trim() === 'isembroidered') {
            sanitizedPayload[k] = valStr;
            foundVariation = true;
          }
        });
        if (!foundVariation) {
          sanitizedPayload['isEmbroidered'] = valStr;
        }
      }
      if (intendedIsOrdered !== undefined) {
        const valStr = (intendedIsOrdered === true || intendedIsOrdered === 'true' || intendedIsOrdered === 'TRUE') ? "TRUE" : "FALSE";
        let foundVariation = false;
        Object.keys(sanitizedPayload).forEach(k => {
          if (k.toLowerCase().trim() === 'isordered') {
            sanitizedPayload[k] = valStr;
            foundVariation = true;
          }
        });
        if (!foundVariation) {
          sanitizedPayload['isOrdered'] = valStr;
        }
      }

      // Force write to both the X column and "หมายเหตุ" to guarantee it hits
      if (sanitizedPayload.remarks !== undefined) {
        sanitizedPayload['หมายเหตุ'] = sanitizedPayload.remarks;
        sanitizedPayload['X'] = sanitizedPayload.remarks;
        sanitizedPayload['x'] = sanitizedPayload.remarks;
        sanitizedPayload[''] = sanitizedPayload.remarks; // Support empty column header in column X
        delete sanitizedPayload['remarks'];
      }

      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        // using text/plain prevents CORS preflight issues without losing the body
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'sync',
          sheet,
          payload: sanitizedPayload,
        }),
      });
      
      return true;
    } catch (error) {
      console.warn(`Error syncing ${sheet} to Google Sheets: Is VITE_GOOGLE_SHEET_URL configured correctly?`);
      return false;
    }
  },

  /**
   * Sync multiple records to Google Sheets in a single batch operation
   */
  async syncRecords(sheet: SheetName, payloads: any[]) {
    if (!SCRIPT_URL) {
      console.warn('VITE_GOOGLE_SHEET_URL is not defined. Skipping batch sync.');
      return false;
    }
    if (!payloads || payloads.length === 0) return true;

    try {
      const sanitizedPayloads = payloads.map(payload => {
        const sanitizedPayload = { ...payload };
        let intendedIsEmbroidered: any = undefined;
        let intendedIsOrdered: any = undefined;

        // Scan all potential variation of keys to extract intended status
        Object.keys(payload).forEach(k => {
          const cleanK = k.toLowerCase().trim();
          if (cleanK === 'isembroidered') {
            if (k === 'isEmbroidered' || intendedIsEmbroidered === undefined) {
              intendedIsEmbroidered = payload[k];
            }
          }
          if (cleanK === 'isordered') {
            if (k === 'isOrdered' || intendedIsOrdered === undefined) {
              intendedIsOrdered = payload[k];
            }
          }
        });

        Object.keys(sanitizedPayload).forEach(key => {
          const val = sanitizedPayload[key];
          if (key === 'phone') {
            let phoneStr = String(val || '');
            if (phoneStr.startsWith("'")) phoneStr = phoneStr.substring(1);
            if (phoneStr && !phoneStr.startsWith('0')) {
              phoneStr = '0' + phoneStr;
            }
            sanitizedPayload[key] = `'${phoneStr}`;
          } else if (typeof val === 'boolean') {
            sanitizedPayload[key] = val ? "TRUE" : "FALSE";
          } else if (val && typeof val === 'object' && val.toDate) {
            sanitizedPayload[key] = val.toDate().toISOString();
          } else if (val instanceof Date) {
            sanitizedPayload[key] = val.toISOString();
          } else if (val && typeof val === 'object') {
            sanitizedPayload[key] = JSON.stringify(val);
          }
        });

        // Ensure all variations of isEmbroidered are updated
        if (intendedIsEmbroidered !== undefined) {
          const valStr = (intendedIsEmbroidered === true || intendedIsEmbroidered === 'true' || intendedIsEmbroidered === 'TRUE') ? "TRUE" : "FALSE";
          let foundVariation = false;
          Object.keys(sanitizedPayload).forEach(k => {
            if (k.toLowerCase().trim() === 'isembroidered') {
              sanitizedPayload[k] = valStr;
              foundVariation = true;
            }
          });
          if (!foundVariation) {
            sanitizedPayload['isEmbroidered'] = valStr;
          }
        }

        // Ensure all variations of isOrdered are updated
        if (intendedIsOrdered !== undefined) {
          const valStr = (intendedIsOrdered === true || intendedIsOrdered === 'true' || intendedIsOrdered === 'TRUE') ? "TRUE" : "FALSE";
          let foundVariation = false;
          Object.keys(sanitizedPayload).forEach(k => {
            if (k.toLowerCase().trim() === 'isordered') {
              sanitizedPayload[k] = valStr;
              foundVariation = true;
            }
          });
          if (!foundVariation) {
            sanitizedPayload['isOrdered'] = valStr;
          }
        }

        // Force write to both the X column and "หมายเหตุ" to guarantee it hits
        if (sanitizedPayload.remarks !== undefined) {
          sanitizedPayload['หมายเหตุ'] = sanitizedPayload.remarks;
          sanitizedPayload['X'] = sanitizedPayload.remarks;
          sanitizedPayload['x'] = sanitizedPayload.remarks;
          sanitizedPayload[''] = sanitizedPayload.remarks;
          delete sanitizedPayload['remarks'];
        }

        return sanitizedPayload;
      });

      console.log(`[Batch Sync] Trying batchSync for ${sanitizedPayloads.length} records...`);
      let batchSucceeded = false;
      try {
        const response = await fetch(SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'batchSync',
            sheet,
            payload: sanitizedPayloads,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.status === 'success') {
            console.log(`[Batch Sync] Successfully batch-synced all ${sanitizedPayloads.length} records!`);
            batchSucceeded = true;
          } else {
            console.warn('[Batch Sync] batchSync returned non-success response:', data);
          }
        } else {
          console.warn('[Batch Sync] batchSync HTTP response fell back:', response.status);
        }
      } catch (err) {
        console.warn(`[Batch Sync] batchSync failed or not supported. Falling back to sequential sync...`, err);
      }

      if (batchSucceeded) {
        return true;
      }

      // --- FALLBACK MODE: Sync sequentially ---
      console.log(`[Batch Sync] Fallback: Syncing ${sanitizedPayloads.length} records sequentially to ensure robust writes...`);
      let count = 0;
      for (const record of sanitizedPayloads) {
        try {
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
              action: 'sync',
              sheet,
              payload: record,
            }),
          });
          if (response.ok) {
            const resJson = await response.json();
            if (resJson && resJson.status === 'success') {
              count++;
            }
          }
        } catch (err) {
          console.warn(`[Batch Sync Fallback] Error syncing record ${record.id}:`, err);
        }
        // Brief delay to prevent lock conflicts on the sheet cells
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      console.log(`[Batch Sync Fallback] Finished sequential fallback. Synced ${count}/${sanitizedPayloads.length} records successfully.`);
      return count > 0;
    } catch (error) {
      console.warn(`Error batch syncing ${sheet} to Google Sheets: Is VITE_GOOGLE_SHEET_URL configured correctly?`);
      return false;
    }
  },

  /**
   * Delete a record from Google Sheets
   */
  async deleteRecord(sheet: SheetName, id: string) {
    if (!SCRIPT_URL) return;

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'delete',
          sheet,
          payload: { id },
        }),
      });
      return true;
    } catch (error) {
      console.warn(`Error deleting ${sheet} from Google Sheets: Is VITE_GOOGLE_SHEET_URL configured correctly?`);
      return false;
    }
  },

  /**
   * Fetch all records from a sheet via high-speed server side caching daemon
   */
  async fetchRecords(sheet: SheetName) {
    if (!SCRIPT_URL) {
      throw new Error('VITE_GOOGLE_SHEET_URL is not defined');
    }

    try {
      const url = `${SCRIPT_URL}?action=read&sheet=${sheet}&_t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
      let data;
      try {
        data = await response.json();
      } catch (err: any) {
        throw new Error('URL ไม่ถูกต้อง หรือยังไม่ได้ตั้งค่าสิทธิ์ Apps Script เป็น "Anyone" (ทุกคน). กรุณาตรวจสอบการตั้งค่า Deploy ใน Apps Script.');
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
      return data;
    } catch (error) {
      console.warn(`Error fetching ${sheet} from Google Sheets: Is VITE_GOOGLE_SHEET_URL configured correctly?`);
      throw error;
    }
  }
};
