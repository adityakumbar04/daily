/**
 * Google Apps Script Web App
 *
 * Instructions:
 * - Create a new Apps Script project (https://script.google.com)
 * - Replace SPREADSHEET_ID with your Google Sheet ID
 * - Deploy as Web App: Execute as "Me", Who has access: "Anyone, even anonymous"
 * - Use the provided web app URL in your site (replace YOUR_SCRIPT_ID)
 */

const SPREADSHEET_ID = '11VSJe3cVjYWxnZsDGZIQ2eRAPGG_osSIi1Cku5mYDOM'; // replace
const SHEET_NAME = 'Responses';

function _getSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  // Ensure header row exists
  const headers = ['Name','Score','Percentage','Answers','TotalQuestions','Timestamp'];
  const first = sh.getRange(1,1,1,headers.length).getValues()[0];
  if (first.join('') === '') sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function doPost(e) {
  try {
    // Log what we receive
    Logger.log('Received POST: ' + e.postData.contents);
    
    const sh = _getSheet();
    Logger.log('Sheet retrieved: ' + sh.getName());
    
    let data = {};
    if (e && e.parameter && e.parameter.payload) {
      data = JSON.parse(e.parameter.payload);
    } else if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    Logger.log('Parsed data: ' + JSON.stringify(data));

    const row = [
      data.name || '',
      data.score != null ? data.score : '',
      data.percentage != null ? data.percentage : '',
      data.answers ? JSON.stringify(data.answers) : '',
      data.totalQuestions != null ? data.totalQuestions : '',
      data.timestamp || new Date().toISOString()
    ];

    Logger.log('Appending row: ' + JSON.stringify(row));
    sh.appendRow(row);
    Logger.log('Row appended successfully');

    const output = JSON.stringify({ status: 'success', message: 'Data saved' });
    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('ERROR: ' + err.toString());
    const output = JSON.stringify({ status: 'error', message: err.toString() });
    return ContentService
      .createTextOutput(output)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sh = _getSheet();
    const data = sh.getDataRange().getValues();
    const headers = data.shift();

    const rows = data.map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h.toString().trim().replace(/\s+/g,'').toLowerCase()] = r[i];
      });
      // Normalize field names for admin (name, score, percentage, answers, totalQuestions, timestamp)
      return {
        name: obj['name'] || '',
        score: obj['score'] || '',
        percentage: obj['percentage'] || '',
        answers: tryParseJSON(obj['answers']) || [],
        totalQuestions: obj['totalquestions'] || '',
        timestamp: obj['timestamp'] || ''
      };
    });

    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function tryParseJSON(s){
  try { return JSON.parse(s); } catch(e){ return null; }
}
