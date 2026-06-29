/**
 * Google Apps Script for syncing Firestore data to Google Sheets
 * 
 * Instructions:
 * 1. Open a Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code into the editor
 * 4. Click "Deploy" > "New Deployment"
 * 5. Select "Web App"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Copy the Web App URL and set it as VITE_GOOGLE_SHEET_URL in your app settings
 */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const sheetName = data.sheet;
    const payload = data.payload;

    if (!sheetName) return response({ status: 'error', message: 'Sheet name is required' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (action === 'sync') {
      return syncRecord(sheet, payload);
    } else if (action === 'batchSync') {
      return batchSync(sheet, payload);
    } else if (action === 'delete') {
      return deleteRecord(sheet, payload.id);
    } else if (action === 'uploadFile') {
      return uploadFileToDrive(payload);
    } else {
      return response({ status: 'error', message: 'Invalid action' });
    }
  } catch (error) {
    return response({ status: 'error', message: error.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet;

    if (action === 'read') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return response([]);
      
      const data = getSheetData(sheet);
      return response(data);
    }
    
    return response({ status: 'ok', message: 'Service is running' });
  } catch (error) {
    return response({ status: 'error', message: error.toString() });
  }
}

function syncRecord(sheet, payload) {
  const headers = getOrUpdateHeaders(sheet, payload);
  const data = getSheetData(sheet);
  const idIndex = headers.indexOf('id');
  
  if (idIndex === -1) {
    return response({ status: 'error', message: 'No "id" column found' });
  }

  const rowIndex = data.findIndex(row => row.id == payload.id);
  const rowValues = headers.map(header => {
    let val = findValueInPayload(header, payload);
    if (val === undefined) return '';
    if (val === 'TRUE' || val === 'true') return true;
    if (val === 'FALSE' || val === 'false') return false;
    return val;
  });

  if (rowIndex > -1) {
    // Update existing row (rowIndex + 2 because 1-indexed and header row)
    sheet.getRange(rowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    // Append new row
    sheet.appendRow(rowValues);
  }

  return response({ status: 'success' });
}

function deleteRecord(sheet, id) {
  const data = getSheetData(sheet);
  const rowIndex = data.findIndex(row => row.id == id);
  
  if (rowIndex > -1) {
    sheet.deleteRow(rowIndex + 2);
    return response({ status: 'success' });
  }
  
  return response({ status: 'not_found' });
}

function getOrUpdateHeaders(sheet, payload) {
  let headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h ? h.toString() : '');
  }

  const payloadKeys = Object.keys(payload);
  let headersChanged = false;

  payloadKeys.forEach(key => {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
      headersChanged = true;
    }
  });

  if (headersChanged) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Format header
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
  }

  return headers;
}

function getSheetData(sheet) {
  if (sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h ? h.toString() : '');
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  
  return values.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function batchSync(sheet, payloads) {
  if (!Array.isArray(payloads)) {
    return response({ status: 'error', message: 'Payload must be an array' });
  }

  // 1. Get or update headers
  let headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h ? h.toString() : '');
  } else {
    headers = ['id'];
  }
  
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) {
    headers.push('id');
  }

  let headersChanged = false;
  payloads.forEach(p => {
    Object.keys(p).forEach(key => {
      if (headers.indexOf(key) === -1) {
        headers.push(key);
        headersChanged = true;
      }
    });
  });

  if (headersChanged) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
  }

  // 2. Fetch existing rows (including the newly added columns/headers space)
  const lastRow = sheet.getLastRow();
  let existingRows = [];
  if (lastRow >= 2) {
    existingRows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  }

  // Map row list to an index map by 'id'
  const idToRowIndex = {};
  existingRows.forEach((row, idx) => {
    const rowId = row[idIndex];
    if (rowId) {
      idToRowIndex[rowId] = idx;
    }
  });

  // 3. Process each payload
  payloads.forEach(p => {
    const rowValues = headers.map(header => {
      let val = findValueInPayload(header, p);
      if (val === undefined) return '';
      if (val === 'TRUE' || val === 'true') return true;
      if (val === 'FALSE' || val === 'false') return false;
      return val;
    });

    const existingIdx = idToRowIndex[p.id];
    if (existingIdx !== undefined) {
      existingRows[existingIdx] = rowValues;
    } else {
      existingRows.push(rowValues);
      idToRowIndex[p.id] = existingRows.length - 1;
    }
  });

  // 4. Write everything back in ONE single operation
  if (existingRows.length > 0) {
    sheet.getRange(2, 1, existingRows.length, headers.length).setValues(existingRows);
  }

  return response({ status: 'success', count: payloads.length });
}

function findValueInPayload(header, payload) {
  if (header === undefined || header === null) return undefined;
  var headerStr = header.toString();
  if (payload[headerStr] !== undefined) return payload[headerStr];
  
  // Clean header lookup (lowercase and trimmed)
  var cleanHeader = headerStr.trim().toLowerCase();
  var keys = Object.keys(payload);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.trim().toLowerCase() === cleanHeader) {
      return payload[key];
    }
  }
  return undefined;
}

function uploadFileToDrive(payload) {
  try {
    var base64Data = payload.base64;
    var filename = payload.filename || 'slip_' + new Date().getTime() + '.jpg';
    var mimeType = payload.mimeType || 'image/jpeg';
    
    // Decode base64
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    
    // Create file
    var file = DriveApp.createFile(blob);
    
    // Set permission to anyone with link (so AdminDashboard can display it in img src)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // We want a URL that can be directly used in <img src="..."> if possible
    // file.getDownloadUrl() gives a download link with a token, which usually works for raw get.
    // Replace with standard drive export URL for raw images:
    var directUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
    
    return response({ status: 'success', url: directUrl });
  } catch (error) {
    return response({ status: 'error', message: 'Drive Upload Error: ' + error.toString() });
  }
}

// ==========================================
// ฟังก์ชันสำหรับขออนุญาตเข้าถึง Google Drive
// ให้กด Run ฟังก์ชันนี้ 1 ครั้ง เพื่อให้ Google ขอสิทธิ์เข้าถึง Drive
// ==========================================
function authorizeDrive() {
  try {
    var file = DriveApp.createFile("test.txt", "test file", "text/plain");
    file.setTrashed(true);
    Logger.log("ได้รับสิทธิ์เข้าถึง Google Drive แล้ว! คุณสามารถใช้งานอัพโหลดสลิปได้ทันที");
  } catch (e) {
    Logger.log("เกิดข้อผิดพลาด: " + e.toString());
  }
}

// ==========================================
// ฟังก์ชันกู้ชีพ: แก้ปัญหา Base64 ยาวเกินไปจน Google Sheets ล่ม
// ให้ผู้ใช้กดยืนยันให้ทำงานจากหน้า Apps Script ได้เลย
// ==========================================
function migrateBase64ToDrive() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
  if (!sheet) {
    Logger.log('ไม่พบแผ่นงาน Orders');
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    Logger.log('ไม่มีข้อมูลใน Orders');
    return;
  }

  var processedCount = 0;
  var errorCount = 0;
  var startTime = new Date().getTime();
  Logger.log('กำลังตรวจสอบข้อมูลทั้งหมด ' + (lastRow - 1) + ' แถว...');

  // ใช้ getValues เพื่อดึงข้อมูลทั้งหมดมาประมวลผลพร้อมกัน (เร็วกว่า getRange ทีละช่องเป็นร้อยเท่า)
  var range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  var values = range.getValues();
  var isUpdated = false;

  for (var r = 0; r < values.length; r++) {
    // Check timeout (Apps Script limits to 6 mins, we stop at 5 mins to be safe)
    if (new Date().getTime() - startTime > 5 * 60 * 1000) {
       Logger.log('ใกล้หมดเวลา 5 นาทีของระบบแล้ว หยุดชั่วคราว... (กำลังบันทึกข้อมูลที่ทำเสร็จ...)');
       break;
    }

    for (var c = 0; c < values[r].length; c++) {
      var val = values[r][c];
      
      if (typeof val === 'string' && val.indexOf('data:image/') === 0 && val.length > 500) {
        try {
          var mimeType = val.split(';')[0].split(':')[1];
          var base64Data = val.split(',')[1];
          
          if (!base64Data) continue;
          
          // Clean base64 string
          base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
          
          // Padding base64
          while (base64Data.length % 4 !== 0) {
            base64Data += '=';
          }

          var filename = 'slip_recovered_row_' + (r + 2) + '.jpg';
          if (mimeType.indexOf('png') !== -1) {
            filename = 'slip_recovered_row_' + (r + 2) + '.png';
          }
          
          try {
            var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
            var file = DriveApp.createFile(blob);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            
            var directUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
            values[r][c] = directUrl; // เปลี่ยนข้อมูลใน Array
            processedCount++;
            isUpdated = true;
            Logger.log('แถวที่ ' + (r + 2) + ': กู้คืนสำเร็จ -> ' + directUrl);
          } catch (decodeError) {
            // ถ้า Code มาตรงนี้แปลว่า Base64 ถูก Google Sheets ตัดทอนจนพัง (เกินลิมิต 50,000 ตัวอักษร)
            Logger.log('แถวที่ ' + (r + 2) + ' กู้ไม่ได้ (รูปขาดหาย): ' + decodeError.toString());
            values[r][c] = "UPLOAD_FAILED_ROW_" + (r + 2) + "_CORRUPTED";
            errorCount++;
            isUpdated = true;
          }
        } catch (e) {
          Logger.log('แถวที่ ' + (r + 2) + ' แปลงล้มเหลว: ' + e.toString());
          values[r][c] = "UPLOAD_FAILED_ROW_" + (r + 2) + "_ERROR";
          errorCount++;
          isUpdated = true;
        }
      }
    }
  }

  // เซฟข้อมูลทั้งหมดรวดเดียว
  if (isUpdated) {
    range.setValues(values);
  }

  Logger.log('เสร็จสิ้น! แปลงเป็นรูปลงไดรฟ์สำเร็จ ' + processedCount + ' รูป | รูปที่เสีย/กู้ไม่ได้ (ต้องให้เด็กส่งใหม่) ' + errorCount + ' รูป');
}
