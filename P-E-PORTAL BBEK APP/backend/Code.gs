const PE_SHEET = 'PAYMENT ENTRY';
const PE_SHEET_UG = 'PAYMENT ENTRY-UG';
const PE_SHEETS = [PE_SHEET, PE_SHEET_UG];
const HISTORY_SHEET = 'HISTORY';

const DATA_START_ROW = 5;    
const MAX_SCAN_ROW = 1000;   
const ID_COL = 3;    
const NAME_COL = 4;  
const BILL_COL = 11; 
const AMT_COL = 12;  

const LIST_START_ROW = 9;   
const LIST_ROW_OFFSET = LIST_START_ROW - DATA_START_ROW; 
const SEARCH_ROW_OFFSET = 5 - DATA_START_ROW;             

const HISTORY_LOG_START_ROW = 5;
const HISTORY_LOG_COL = 11;       
const HISTORY_LOG_WIDTH = 10;     
const HISTORY_DISPLAY_WIDTH = 9;  
const HISTORY_ARCHIVED_COL_INDEX = 9; 
const HISTORY_MAX_ROW = 5000;

const STATUS_RECENTLY_DELETED = 'Recently Deleted/Reversed';

function sameText(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function runFullSetup() {
  PE_SHEETS.forEach(setupSearchValidation);
  setupHistoryColumns();
  SpreadsheetApp.getActive().toast('Setup complete.');
}


function setupSearchValidation(sheetName) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return;

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(sheet.getRange('P5:P' + MAX_SCAN_ROW), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('C4').setDataValidation(rule);

  sheet.getRange('N6').setValue('RefSheet');
  sheet.getRange('O6').setValue('RefRow');
  sheet.getRange('P6').setValue('SchoolSearchList');
  sheet.hideColumns(14); 
  sheet.hideColumns(15); 
  sheet.hideColumns(16); 
}

function setupHistoryColumns() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
  sheet.getRange('I4').setValue('Amount');
  sheet.getRange('I4').setFontWeight('bold');
 sheet.getRange('J4').setValue('Date');
  sheet.getRange('J4').setFontWeight('bold');
  sheet.getRange('J5:J' + HISTORY_MAX_ROW).setNumberFormat('@'); 
  sheet.hideColumns(HISTORY_LOG_COL, HISTORY_LOG_WIDTH); 

  const c2 = sheet.getRange('C2');
  if (!c2.getDataValidation()) {
    const settingSheet = SpreadsheetApp.getActive().getSheetByName('SETTING');
    c2.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInRange(settingSheet.getRange('A:A'), true)
        .setAllowInvalid(true)
        .build()
    );
  }
  if (!c2.getValue()) {
    c2.setValue('ALL');
  }

  const f2 = sheet.getRange('F2');
  if (!f2.getDataValidation()) {
    f2.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(
          ['ALL', 'Discount', 'Bad debt', 'Clearance', 'Rejected', 'Correction', STATUS_RECENTLY_DELETED],
          true
        )
        .setAllowInvalid(false)
        .build()
    );
  }
  if (!f2.getValue()) {
    f2.setValue('ALL');
  }
}

function onEdit(e) {
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  if (PE_SHEETS.indexOf(sheetName) !== -1) {
    const peSheet = sheet;
    const cell = e.range.getA1Notation();
    if (cell === 'C2') {
      handleFilterChanged(peSheet);
    } else if (cell === 'C4') {
      handleSchoolSelected(peSheet, e.value);
    } else if (cell === 'H3' || cell === 'H4') {
      handleAddPayment(peSheet);
    } else if (cell === 'J3' || cell === 'J4') {
      handleStatusAction(peSheet);
    }
    return;
  }

  if (sheetName === PH_SHEET) {
    const cell = e.range.getA1Notation();
    if (cell === 'C2' || cell === 'F2' || cell === 'I2') {
      refreshPaymentHistoryDisplay(sheet);
    }
    return;
  }

  if (sheetName === HISTORY_SHEET) {
    const cell = e.range.getA1Notation();
    if (cell === 'C2' || cell === 'F2') {
      refreshHistoryDisplay(sheet);
    }
    return;
  }

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < DATA_START_ROW) return;
  if (col !== ID_COL && col !== NAME_COL && col !== BILL_COL && col !== AMT_COL) return;

  PE_SHEETS.forEach(function (peSheetName) {
    const peSheet = SpreadsheetApp.getActive().getSheetByName(peSheetName);
    if (!peSheet) return;
    const activeMarketer = peSheet.getRange('C2').getValue();
    if (sheetName !== activeMarketer) return;

    syncSourceRow(peSheet, sheet, row);

    if (peSheet.getRange('N7').getValue() === sheetName &&
        Number(peSheet.getRange('O7').getValue()) === row) {
      writeRow7(peSheet, sheet, row);
    }
  });
}

function handleFilterChanged(peSheet) {
  peSheet.getRange('B7:F7').clearContent();
  peSheet.getRange('N7:O7').clearContent();
  peSheet.getRange('C4').clearContent();

  peSheet.getRange(LIST_START_ROW, 2, MAX_SCAN_ROW, 5).clearContent();
  peSheet.getRange(5, 16, MAX_SCAN_ROW, 1).clearContent(); // column P

  const marketerName = peSheet.getRange('C2').getValue();
  if (!marketerName) return;

  const marketerSheet = SpreadsheetApp.getActive().getSheetByName(marketerName);
  if (!marketerSheet) {
    SpreadsheetApp.getActive().toast('No sheet named "' + marketerName + '" found.');
    return;
  }

  
  const width = AMT_COL - ID_COL + 1;
  const block = marketerSheet.getRange(DATA_START_ROW, ID_COL, MAX_SCAN_ROW - DATA_START_ROW + 1, width).getValues();

  const listOut = [];
  const searchOut = [];
  for (let i = 0; i < block.length; i++) {
    const id = block[i][0];
    const name = block[i][NAME_COL - ID_COL];
    const bill = Number(block[i][BILL_COL - ID_COL]) || 0;
    const amt = Number(block[i][AMT_COL - ID_COL]) || 0;

    if (name === '' || name === null) {
      listOut.push(['', '', '', '', '']);
      searchOut.push(['']);
    } else {
      listOut.push([id, name, bill, amt, bill - amt]);
      searchOut.push([name]);
    }
  }

  if (listOut.length > 0) {
    peSheet.getRange(LIST_START_ROW, 2, listOut.length, 5).setValues(listOut);
    peSheet.getRange(5, 16, searchOut.length, 1).setValues(searchOut);
  }
}



function handleSchoolSelected(peSheet, selectedName) {
  if (!selectedName) return;

  const marketerName = peSheet.getRange('C2').getValue();
  const marketerSheet = SpreadsheetApp.getActive().getSheetByName(marketerName);
  if (!marketerSheet) return;

  const names = marketerSheet.getRange(DATA_START_ROW, NAME_COL, MAX_SCAN_ROW - DATA_START_ROW + 1, 1).getValues();

  let foundRow = -1;
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === String(selectedName).trim()) {
      foundRow = DATA_START_ROW + i;
      break;
    }
  }
  if (foundRow === -1) {
    SpreadsheetApp.getActive().toast('School not found on ' + marketerName + '.');
    return;
  }

  peSheet.getRange('N7').setValue(marketerName);
  peSheet.getRange('O7').setValue(foundRow);
  writeRow7(peSheet, marketerSheet, foundRow);

  peSheet.getRange('C4').clearContent();
}




function writeRow7(peSheet, marketerSheet, row) {
  const width = AMT_COL - ID_COL + 1;
  const data = marketerSheet.getRange(row, ID_COL, 1, width).getValues()[0];

  const id = data[0];
  const name = data[NAME_COL - ID_COL];
  const bill = Number(data[BILL_COL - ID_COL]) || 0;
  const amt = Number(data[AMT_COL - ID_COL]) || 0;

  peSheet.getRange('B7:F7').setValues([[id, name, bill, amt, bill - amt]]);
}


function handleAddPayment(peSheet) {
  const amount = Number(peSheet.getRange('H3').getValue());
  if (!amount) return; // allow negative for corrections

  const target = getRow7Target(peSheet);
  if (!target) return;

 
  const width = AMT_COL - ID_COL + 1;
  const rowData = target.marketerSheet.getRange(target.refRow, ID_COL, 1, width).getValues()[0];
  const id = rowData[0];
  const name = rowData[NAME_COL - ID_COL];
  const bill = Number(rowData[BILL_COL - ID_COL]) || 0;

  const amtCell = target.marketerSheet.getRange(target.refRow, AMT_COL);
  const current = Number(amtCell.getValue()) || 0;
  const newAmount = current + amount;

  if (Math.abs(newAmount) < 0.005) {
    amtCell.clearContent();

    const historySheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
    const historyNet = getHistoryNetForSchool(historySheet, id, target.marketerName);
    if (Math.abs(historyNet) >= 0.005) {
      appendHistoryLog(id, name, bill, 0, bill, target.marketerName, 'Correction', -historyNet);
    }
    archiveHistoryForSchool(historySheet, id, target.marketerName);
  } else {
    amtCell.setValue(newAmount);
  }

appendPaymentHistoryLog(id, name, target.marketerName, bill, amount, newAmount, bill - newAmount);

  const outstanding = bill - newAmount;
  peSheet.getRange('B7:F7').setValues([[id, name, bill, newAmount, outstanding]]);
  const targetListRow = target.refRow + LIST_ROW_OFFSET;
  const targetSearchRow = target.refRow + SEARCH_ROW_OFFSET;
  peSheet.getRange(targetListRow, 2, 1, 5).setValues([[id, name, bill, newAmount, outstanding]]);
  peSheet.getRange(targetSearchRow, 16).setValue(name);

  peSheet.getRange('H3').clearContent();
  const msg = amount > 0
    ? 'Payment of ' + amount + ' added to '
    : 'Correction of ' + amount + ' applied to ';
  SpreadsheetApp.getActive().toast(msg + name);
}



function handleStatusAction(peSheet) {
  const amount = Number(peSheet.getRange('J3').getValue());
  if (!amount) return; 

  const status = peSheet.getRange('J2').getValue();
  if (!status) {
    SpreadsheetApp.getActive().toast('Pick a status in J2 first (Discount / Bad debt / Clearance / Rejected).');
    peSheet.getRange('J3').clearContent();
    return;
  }

  const target = getRow7Target(peSheet);
  if (!target) return;


  const width = AMT_COL - ID_COL + 1;
  const rowData = target.marketerSheet.getRange(target.refRow, ID_COL, 1, width).getValues()[0];
  const id = rowData[0];
  const name = rowData[NAME_COL - ID_COL];
  const bill = Number(rowData[BILL_COL - ID_COL]) || 0;

  const amtCell = target.marketerSheet.getRange(target.refRow, AMT_COL);
  const current = Number(amtCell.getValue()) || 0;
  const newAmt = current + amount;
  if (Math.abs(newAmt) < 0.005) {
    amtCell.clearContent();
  } else {
    amtCell.setValue(newAmt);
  }

  
  const outstanding = bill - newAmt;
  peSheet.getRange('B7:F7').setValues([[id, name, bill, newAmt, outstanding]]);
  const targetListRow = target.refRow + LIST_ROW_OFFSET;
  const targetSearchRow = target.refRow + SEARCH_ROW_OFFSET;
  peSheet.getRange(targetListRow, 2, 1, 5).setValues([[id, name, bill, newAmt, outstanding]]);
  peSheet.getRange(targetSearchRow, 16).setValue(name);

appendHistoryLog(id, name, bill, newAmt, outstanding, target.marketerName, status, amount);

  if (Math.abs(newAmt) < 0.005) {
    const historySheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
    archiveHistoryForSchool(historySheet, id, target.marketerName);
  }

  peSheet.getRange('J3').clearContent();
  SpreadsheetApp.getActive().toast(status + ' of ' + amount + ' recorded for ' + name);
}



function getRow7Target(peSheet) {
  const refSheetName = peSheet.getRange('N7').getValue();
  const refRow = peSheet.getRange('O7').getValue();

  if (!refSheetName || !refRow) {
    SpreadsheetApp.getActive().toast('Select a school first (SEARCH box) before entering an amount.');
    return null;
  }

  const marketerSheet = SpreadsheetApp.getActive().getSheetByName(refSheetName);
  if (!marketerSheet) return null;

  return { marketerSheet: marketerSheet, marketerName: refSheetName, refRow: refRow };
}


function appendHistoryLog(id, name, bill, amtCollected, outstanding, marketer, status, actionAmount) {
  const historySheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
  const nextRow = getNextLogRow(historySheet);
 
  const timestamp = Utilities.formatDate(new Date(), 'Africa/Accra', 'MM/dd/yyyy HH:mm:ss');

  historySheet.getRange(nextRow, HISTORY_LOG_COL, 1, HISTORY_LOG_WIDTH).setValues(
    [[id, name, bill, amtCollected, outstanding, marketer, status, actionAmount, timestamp, false]]
  );

  PropertiesService.getDocumentProperties().setProperty('historyNextLogRow', String(nextRow + 1));

  refreshHistoryDisplay(historySheet);
}

function getNextLogRow(historySheet) {
  const cache = PropertiesService.getDocumentProperties();
  const cached = Number(cache.getProperty('historyNextLogRow'));
  if (cached) return cached;

  const ids = historySheet.getRange(
    HISTORY_LOG_START_ROW, HISTORY_LOG_COL, HISTORY_MAX_ROW - HISTORY_LOG_START_ROW + 1, 1
  ).getValues();

  let lastUsed = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] !== '' && ids[i][0] !== null) lastUsed = i;
  }
  const row = HISTORY_LOG_START_ROW + lastUsed + 1;
  cache.setProperty('historyNextLogRow', String(row));
  return row;
}


function getHistoryNetForSchool(historySheet, schoolId, marketerName) {
  const lastLogRow = getNextLogRow(historySheet) - 1;
  if (lastLogRow < HISTORY_LOG_START_ROW) return 0;

  const numRows = lastLogRow - HISTORY_LOG_START_ROW + 1;
  const log = historySheet.getRange(HISTORY_LOG_START_ROW, HISTORY_LOG_COL, numRows, HISTORY_LOG_WIDTH).getValues();

  let net = 0;
  log.forEach(function (r) {
    const rowId = r[0];
    const rowMarketer = r[5];
    const actionAmount = Number(r[7]) || 0;
    const archived = r[HISTORY_ARCHIVED_COL_INDEX];
    if (String(rowId) === String(schoolId) && rowMarketer === marketerName && archived !== true) {
      net += actionAmount;
    }
  });
  return net;
}



function archiveHistoryForSchool(historySheet, schoolId, marketerName) {
  const lastLogRow = getNextLogRow(historySheet) - 1;
  if (lastLogRow < HISTORY_LOG_START_ROW) return;

  const numRows = lastLogRow - HISTORY_LOG_START_ROW + 1;
  const range = historySheet.getRange(HISTORY_LOG_START_ROW, HISTORY_LOG_COL, numRows, HISTORY_LOG_WIDTH);
  const log = range.getValues();

  let changed = false;
  for (let i = 0; i < log.length; i++) {
    const rowId = log[i][0];
    const rowMarketer = log[i][5];
    if (String(rowId) === String(schoolId) && rowMarketer === marketerName) {
      log[i][HISTORY_ARCHIVED_COL_INDEX] = true;
      changed = true;
    }
  }

  if (changed) {
    range.setValues(log);
    refreshHistoryDisplay(historySheet);
  }
}


function refreshHistoryDisplay(historySheet) {
  const marketerFilter = historySheet.getRange('C2').getValue();
  const statusFilter = historySheet.getRange('F2').getValue();

  const lastLogRow = getNextLogRow(historySheet) - 1;
  historySheet.getRange(HISTORY_LOG_START_ROW, 2, HISTORY_MAX_ROW - HISTORY_LOG_START_ROW + 1, HISTORY_DISPLAY_WIDTH).clearContent();

  if (lastLogRow < HISTORY_LOG_START_ROW) return;

  const numRows = lastLogRow - HISTORY_LOG_START_ROW + 1;
  const log = historySheet.getRange(HISTORY_LOG_START_ROW, HISTORY_LOG_COL, numRows, HISTORY_LOG_WIDTH).getValues();

  const matches = log.filter(function (r) {
    if (r[0] === '' || r[0] === null) return false;
    const marketer = r[5];
    const status = r[6];
    const archived = r[HISTORY_ARCHIVED_COL_INDEX];
    const marketerOk = !marketerFilter || marketerFilter === 'ALL' || sameText(marketer, marketerFilter);

    if (statusFilter === STATUS_RECENTLY_DELETED) {
      
      return marketerOk && archived === true;
    }

    const statusOk = !statusFilter || statusFilter === 'ALL' || sameText(status, statusFilter);
    return marketerOk && statusOk && archived !== true;
  });
  if (matches.length > 0) {
    
    const displayRows = matches.map(function (r) { return r.slice(0, HISTORY_DISPLAY_WIDTH); });
    historySheet.getRange(HISTORY_LOG_START_ROW, 2, displayRows.length, HISTORY_DISPLAY_WIDTH).setValues(displayRows);
  }
}


function syncSourceRow(peSheet, marketerSheet, sourceRow) {
  const targetListRow = sourceRow + LIST_ROW_OFFSET;
  const targetSearchRow = sourceRow + SEARCH_ROW_OFFSET;

  const width = AMT_COL - ID_COL + 1;
  const data = marketerSheet.getRange(sourceRow, ID_COL, 1, width).getValues()[0];

  const id = data[0];
  const name = data[NAME_COL - ID_COL];
  const bill = Number(data[BILL_COL - ID_COL]) || 0;
  const amt = Number(data[AMT_COL - ID_COL]) || 0;

  if (name === '' || name === null) {
    peSheet.getRange(targetListRow, 2, 1, 5).setValues([['', '', '', '', '']]);
    peSheet.getRange(targetSearchRow, 16).setValue('');
  } else {
    peSheet.getRange(targetListRow, 2, 1, 5).setValues([[id, name, bill, amt, bill - amt]]);
    peSheet.getRange(targetSearchRow, 16).setValue(name);
  }
}

function findLastDataRow(marketerSheet) {
  const names = marketerSheet.getRange(DATA_START_ROW, NAME_COL, MAX_SCAN_ROW - DATA_START_ROW + 1, 1).getValues();
  let last = DATA_START_ROW - 1;
  for (let i = 0; i < names.length; i++) {
    if (names[i][0] !== '' && names[i][0] !== null) last = DATA_START_ROW + i;
  }
  return last;
}


function deleteSchoolAndArchiveHistory() {
  const ui = SpreadsheetApp.getUi();
  const activeSheet = SpreadsheetApp.getActive().getActiveSheet();
  const peSheet = PE_SHEETS.indexOf(activeSheet.getName()) !== -1
    ? activeSheet
    : SpreadsheetApp.getActive().getSheetByName(PE_SHEET);
  const target = getRow7Target(peSheet);
  if (!target) return;

  const id = target.marketerSheet.getRange(target.refRow, ID_COL).getValue();
  const name = target.marketerSheet.getRange(target.refRow, NAME_COL).getValue();

  const response = ui.alert(
    'Delete school?',
    'This will remove "' + name + '" from ' + target.marketerName +
    '\'s sheet. Its History will be archived (kept, but hidden from the live view — ' +
    'viewable under "' + STATUS_RECENTLY_DELETED + '"). Continue?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  target.marketerSheet.getRange(target.refRow, ID_COL, 1, AMT_COL - ID_COL + 1).clearContent();

  const historySheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
  archiveHistoryForSchool(historySheet, id, target.marketerName);

  peSheet.getRange('B7:F7').clearContent();
  peSheet.getRange('N7:O7').clearContent();
  syncSourceRow(peSheet, target.marketerSheet, target.refRow);

  SpreadsheetApp.getActive().toast('Deleted "' + name + '". Its History is archived, not erased.');
}


function manualRefreshHistory() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
  refreshHistoryDisplay(sheet);
  SpreadsheetApp.getActive().toast('History display refreshed.');
}


function clearAllHistory() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear all History?',
    'This will permanently delete every logged entry in HISTORY (live and archived). This cannot be undone. Continue?',
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName(HISTORY_SHEET);
  sheet.getRange(HISTORY_LOG_START_ROW, HISTORY_LOG_COL, HISTORY_MAX_ROW - HISTORY_LOG_START_ROW + 1, HISTORY_LOG_WIDTH).clearContent();
  sheet.getRange(HISTORY_LOG_START_ROW, 2, HISTORY_MAX_ROW - HISTORY_LOG_START_ROW + 1, HISTORY_DISPLAY_WIDTH).clearContent();

  PropertiesService.getDocumentProperties().deleteProperty('historyNextLogRow');

  SpreadsheetApp.getActive().toast('History cleared.');
}


function onOpen() {
  SpreadsheetApp.getUi()
    // .createMenu('Payment Tools')
    // .addItem('One-time setup (run first)', 'runFullSetup')
    // .addItem('Refresh History Display', 'manualRefreshHistory')
    // .addItem('Delete Selected School (archive its History)', 'deleteSchoolAndArchiveHistory')
    // .addItem('Clear ALL History (testing only)', 'clearAllHistory')
    .addToUi();
}






   //PAYMENT HISTORY  

const PH_SHEET = 'PAYMENT HISTORY';
const PH_LOG_COL = 11;        
const PH_LOG_WIDTH = 10;     
const PH_DISPLAY_WIDTH = 9;   
const PH_COMPLETED_INDEX = 9; 
const PH_LOG_START_ROW = 5;
const PH_MAX_ROW = 5000;



function createPaymentHistorySheet() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(PH_SHEET);

  if (!sheet) {
    const historySheet = ss.getSheetByName(HISTORY_SHEET);
    const insertIndex = historySheet ? historySheet.getIndex() : ss.getSheets().length;
    sheet = ss.insertSheet(PH_SHEET, insertIndex);
  }

  // ---- filter row (row 2) ----
  sheet.getRange('B2').setValue('Marketer');
  sheet.getRange('E2').setValue('Status');
  sheet.getRange('H2').setValue('Search (ID or Name)');

  const marketerCell = sheet.getRange('C2');
  const settingSheet = ss.getSheetByName('SETTING');
  marketerCell.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(settingSheet.getRange('A:A'), true)
      .setAllowInvalid(true)
      .build()
  );
  if (!marketerCell.getValue()) marketerCell.setValue('ALL');

  const statusCell = sheet.getRange('F2');
  statusCell.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['ALL', 'In Progress', 'Completed'], true)
      .setAllowInvalid(false)
      .build()
  );
  if (!statusCell.getValue()) statusCell.setValue('ALL');

  // ---- header row 
  const headers = ['School ID', 'Name of School', 'Marketer', 'Total Due',
                    'Payment #', 'Amount Added', 'Amount Collected',
                    'Outstanding Balance', 'Date'];
  const headerRange = sheet.getRange(4, 2, 1, headers.length); // B4:J4
  headerRange.setValues([headers]);
  headerRange.setBackground('#EA9999');
  headerRange.setHorizontalAlignment('center');
  headerRange.setFontFamily('Twentieth Century');
  headerRange.setFontSize(10);
  sheet.getRange('I4').setFontWeight('bold');
  sheet.getRange('J4').setFontWeight('bold');

  
  sheet.setColumnWidth(2, 118);  
  sheet.setColumnWidth(3, 245);  
  sheet.setColumnWidth(4, 110);  
  sheet.setColumnWidth(5, 100);  
  sheet.setColumnWidth(6, 80);   
  sheet.setColumnWidth(7, 110);  
  sheet.setColumnWidth(8, 120);  
  sheet.setColumnWidth(9, 130);  
  sheet.setColumnWidth(10, 150); 

  
  sheet.getRange(PH_LOG_START_ROW, 10, PH_MAX_ROW, 1).setNumberFormat('M/d/yyyy H:mm:ss');
  sheet.getRange(PH_LOG_START_ROW, PH_LOG_COL + 8, PH_MAX_ROW, 1).setNumberFormat('M/d/yyyy H:mm:ss');

  
  sheet.showColumns(PH_LOG_COL, PH_LOG_WIDTH);
  sheet.hideColumns(PH_LOG_COL, PH_LOG_WIDTH);

  
  const existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(4, 2, PH_MAX_ROW - 3, PH_DISPLAY_WIDTH).createFilter();

  SpreadsheetApp.getActive().toast('PAYMENT HISTORY sheet is ready.');
}


function getNextPaymentLogRow(sheet) {
  const cache = PropertiesService.getDocumentProperties();
  const cached = Number(cache.getProperty('paymentHistoryNextLogRow'));
  if (cached) return cached;

  const ids = sheet.getRange(PH_LOG_START_ROW, PH_LOG_COL, PH_MAX_ROW - PH_LOG_START_ROW + 1, 1).getValues();

  let lastUsed = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] !== '' && ids[i][0] !== null) lastUsed = i;
  }
  const row = PH_LOG_START_ROW + lastUsed + 1;
  cache.setProperty('paymentHistoryNextLogRow', String(row));
  return row;
}

function countPreviousPayments(sheet, schoolId, marketerName) {
  const lastLogRow = getNextPaymentLogRow(sheet) - 1;
  if (lastLogRow < PH_LOG_START_ROW) return 0;
  const numRows = lastLogRow - PH_LOG_START_ROW + 1;
  const log = sheet.getRange(PH_LOG_START_ROW, PH_LOG_COL, numRows, PH_LOG_WIDTH).getValues();
  let count = 0;
  log.forEach(function (r) {
    if (String(r[0]) === String(schoolId) && r[2] === marketerName) count++;
  });
  return count;
}



function appendPaymentHistoryLog(id, name, marketer, bill, amountAdded, cumulative, outstanding) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PH_SHEET);
  if (!sheet) return; 

  const paymentNumber = countPreviousPayments(sheet, id, marketer) + 1;
  const nextRow = getNextPaymentLogRow(sheet);
  const timestamp = Utilities.formatDate(new Date(), 'Africa/Accra', 'MM/dd/yyyy HH:mm:ss');
  const completed = Math.abs(outstanding) < 0.005;

  sheet.getRange(nextRow, PH_LOG_COL, 1, PH_LOG_WIDTH).setValues(
    [[id, name, marketer, bill, paymentNumber, amountAdded, cumulative, outstanding, timestamp, completed]]
  );

  PropertiesService.getDocumentProperties().setProperty('paymentHistoryNextLogRow', String(nextRow + 1));
  refreshPaymentHistoryDisplay(sheet);
}


function refreshPaymentHistoryDisplay(sheet) {
  const marketerFilter = sheet.getRange('C2').getValue();
  const statusFilter = sheet.getRange('F2').getValue();
  const searchFilter = String(sheet.getRange('I2').getValue() || '').trim().toLowerCase();

  sheet.getRange(PH_LOG_START_ROW, 2, PH_MAX_ROW - PH_LOG_START_ROW + 1, PH_DISPLAY_WIDTH).clearContent();

  const lastLogRow = getNextPaymentLogRow(sheet) - 1;
  if (lastLogRow < PH_LOG_START_ROW) return;

  const numRows = lastLogRow - PH_LOG_START_ROW + 1;
  const log = sheet.getRange(PH_LOG_START_ROW, PH_LOG_COL, numRows, PH_LOG_WIDTH).getValues();

   const matches = log.filter(function (r) {
    if (r[0] === '' || r[0] === null) return false;
    const id = String(r[0]).toLowerCase();
    const name = String(r[1]).toLowerCase();
    const marketer = r[2];
    const completed = r[PH_COMPLETED_INDEX];

    const marketerOk = !marketerFilter || marketerFilter === 'ALL' || sameText(marketer, marketerFilter);
    const statusOk = !statusFilter || statusFilter === 'ALL' ||
                      (statusFilter === 'Completed' && completed === true) ||
                      (statusFilter === 'In Progress' && completed !== true);
    const searchOk = !searchFilter || id.indexOf(searchFilter) !== -1 || name.indexOf(searchFilter) !== -1;

    return marketerOk && statusOk && searchOk;
  });

  if (matches.length > 0) {
    const displayRows = matches.map(function (r) { return r.slice(0, PH_DISPLAY_WIDTH); });
    sheet.getRange(PH_LOG_START_ROW, 2, displayRows.length, PH_DISPLAY_WIDTH).setValues(displayRows);
  }
}



function manualRefreshPaymentHistory() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(PH_SHEET);
  refreshPaymentHistoryDisplay(sheet);
  SpreadsheetApp.getActive().toast('Payment History display refreshed.');
}




//DASHBOARD  

const DASHBOARD_SHEET = 'DASHBOARD';
const DASH_HELPER_START_ROW = 4;
const DASH_HELPER_NAME_COL = 10; // column J
const DASH_HELPER_WIDTH = 12;    // J..U
const DASH_LIVE_META_EXCLUDE = ['STATISTIC', 'ALL', 'G. GHANA', 'U. GHANA', 'C. GHANA', 'N. GHANA'];


function setupDashboard() {
  const dash = SpreadsheetApp.getActive().getSheetByName(DASHBOARD_SHEET);

  dash.getRange(2, 1).setValue('TOTALS');
  dash.getRange(2, 1, 1, 7)
    .setFontFamily('Twentieth Century')
    .setFontSize(10)
    .setFontWeight('bold')
    .setBackground('#D9EAD3')
    .setHorizontalAlignment('center');
  dash.getRange(2, 1).setHorizontalAlignment('left');

  SpreadsheetApp.getActive().toast('Dashboard header ready — now run setupDashboardLive().');
}


function getAllRepNamesLive() {
  const settingSheet = SpreadsheetApp.getActive().getSheetByName('SETTING');
  const lastRow = settingSheet.getLastRow();
  const values = settingSheet.getRange(1, 1, lastRow, 1).getValues();
  const reps = [];
  values.forEach(function (r) {
    const v = String(r[0]).trim();
    if (v && DASH_LIVE_META_EXCLUDE.indexOf(v) === -1) reps.push(v);
  });
  return reps;
}


function setupDashboardLive() {
  const ss = SpreadsheetApp.getActive();
  const dash = ss.getSheetByName(DASHBOARD_SHEET);
  const repNames = getAllRepNamesLive();
  const n = repNames.length;
  const startRow = DASH_HELPER_START_ROW;

  dash.getRange(startRow, 1, 1000, 7).clearContent();
  dash.getRange(startRow, DASH_HELPER_NAME_COL, 1000, DASH_HELPER_WIDTH).clearContent();
  dash.getRange(2, 2, 1, 6).clearContent();
const nameColumn = [];
  const formulaRows = [];
  for (let i = 0; i < n; i++) {
    const row = startRow + i;
    const name = repNames[i];
    const escaped = name.replace(/'/g, "''");
    const ref = "\"'" + escaped + "'!\""; 

    nameColumn.push([name]);

 formulaRows.push([
      '=IFERROR(N(INDIRECT(' + ref + '&"E3")),0)',
      '=IFERROR(N(INDIRECT(' + ref + '&"F3")),0)',
      '=IFERROR(COUNTIF(INDIRECT(' + ref + '&"H5:H1000"),"A"),0)',
      '=IFERROR(N(INDIRECT(' + ref + '&"H3")),0)',
      '=IFERROR(N(INDIRECT(' + ref + '&"J3")),0)',
      '=IFERROR(N(INDIRECT(' + ref + '&"L3")),0)',
      '=IFERROR(COUNTIF(\'G. GHANA\'!$B$3:$B$1000,$J' + row + ')>0,FALSE)',
      '=IFERROR(COUNTIF(\'U. GHANA\'!$B$3:$B$1000,$J' + row + ')>0,FALSE)',
      '=IFERROR(COUNTIF(\'C. GHANA\'!$B$3:$B$1000,$J' + row + ')>0,FALSE)',
      '=IFERROR(COUNTIF(\'N. GHANA\'!$B$3:$B$1000,$J' + row + ')>0,FALSE)',
      '=OR($B$1="",$B$1="ALL",$B$1="STATISTIC",$B$1=$J' + row +
        ',AND($B$1="G. GHANA",$Q' + row + '),AND($B$1="U. GHANA",$R' + row +
        '),AND($B$1="C. GHANA",$S' + row + '),AND($B$1="N. GHANA",$T' + row + '))'
    ]);
  }

  dash.getRange(startRow, DASH_HELPER_NAME_COL, n, 1).setValues(nameColumn);
  dash.getRange(startRow, DASH_HELPER_NAME_COL + 1, n, DASH_HELPER_WIDTH - 1).setFormulas(formulaRows);

  const lastHelperRow = startRow + n - 1;

  dash.getRange(startRow, 1).setFormula(
    '=IFERROR(FILTER($J$' + startRow + ':$P$' + lastHelperRow +
    ',$U$' + startRow + ':$U$' + lastHelperRow + '),"NO REPS MATCH")'
  );

  const totalCols = ['B', 'C', 'D', 'E', 'F', 'G'];
  const statCols = ['K', 'L', 'M', 'N', 'O', 'P'];
  totalCols.forEach(function (col, idx) {
    dash.getRange(2, col.charCodeAt(0) - 64).setFormula(
      '=SUMPRODUCT($U$' + startRow + ':$U$' + lastHelperRow + '*$' +
      statCols[idx] + '$' + startRow + ':$' + statCols[idx] + '$' + lastHelperRow + ')'
    );
  });

  dash.hideColumns(DASH_HELPER_NAME_COL, DASH_HELPER_WIDTH);

  SpreadsheetApp.getActive().toast('Dashboard rebuilt (' + n + ' reps, self-healing for missing sheets).');
}

function cleanupDashboardCacheSystem() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rebuildDashboardCache') {
      ScriptApp.deleteTrigger(t);
    }
  });
  const cache = SpreadsheetApp.getActive().getSheetByName('DASH_CACHE');
  if (cache) cache.hideSheet();
  SpreadsheetApp.getActive().toast('Old trigger removed, DASH_CACHE hidden (safe to delete later).');
}




function diagnoseDashboardFormulas() {
  const ss = SpreadsheetApp.getActive();
  const dash = ss.getSheetByName(DASHBOARD_SHEET);
  const repNames = getAllRepNamesLive();

  // scratch area far away from anything else, so we don't disturb real data
  const testCell = dash.getRange('AZ1');
  const report = [];

  repNames.forEach(function (name) {
    const sheetExists = !!ss.getSheetByName(name);

    // check every character in the name itself for hidden/odd characters
    const charCodes = [];
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i);
      if (code > 126) charCodes.push('pos' + i + '="' + name[i] + '"(code ' + code + ')');
    }

    const qname = "'" + name.replace(/'/g, "''") + "'";

    // check the apostrophe characters we just built are plain straight quotes (code 39)
    const badQuotes = [];
    for (let i = 0; i < qname.length; i++) {
      if (qname[i] === "'" && qname.charCodeAt(i) !== 39) {
        badQuotes.push('pos' + i + ' code=' + qname.charCodeAt(i));
      } else if (/[\u2018\u2019\u201C\u201D]/.test(qname[i])) {
        badQuotes.push('pos' + i + ' curly-quote code=' + qname.charCodeAt(i));
      }
    }

    
    let formulaResult = '';
    try {
      testCell.setFormula('=' + qname + '!E3');
      SpreadsheetApp.flush();
      const val = testCell.getValue();
      formulaResult = (typeof val === 'string' && val.indexOf('#') === 0) ? 'ERROR: ' + val : 'OK: ' + val;
      if (String(testCell.getFormula()) === '') formulaResult = 'FORMULA REJECTED BY SHEETS';
    } catch (err) {
      formulaResult = 'THREW: ' + err.message;
    }

    report.push([
      name,
      sheetExists ? 'YES' : 'NO — SHEET MISSING',
      charCodes.length ? charCodes.join(', ') : 'clean',
      badQuotes.length ? badQuotes.join(', ') : 'clean',
      formulaResult
    ]);
  });

  testCell.clearContent();

  const out = ss.getSheetByName('DASH_DIAGNOSTIC') || ss.insertSheet('DASH_DIAGNOSTIC');
  out.clear();
  out.getRange(1, 1, 1, 5).setValues([['Rep Name', 'Sheet Exists?', 'Odd Chars In Name', 'Odd Chars In Quoted Ref', 'Formula Test Result']]);
  out.getRange(2, 1, report.length, 5).setValues(report);
  out.autoResizeColumns(1, 5);

  SpreadsheetApp.getActive().toast('Diagnostic done — check the DASH_DIAGNOSTIC tab.');
}



function diagnoseRepSheetLayout() {
  const ss = SpreadsheetApp.getActive();
  const samples = ['TURKSON', 'NICHOLAS', 'RITA'];
  const out = ss.getSheetByName('DASH_DIAGNOSTIC2') || ss.insertSheet('DASH_DIAGNOSTIC2');
  out.clear();

  let writeRow = 1;
  samples.forEach(function (name) {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;

    out.getRange(writeRow, 1).setValue('=== ' + name + ' (rows 1-6, cols A-M) ===');
    writeRow++;

    const data = sheet.getRange(1, 1, 6, 13).getValues();
    const formulas = sheet.getRange(1, 1, 6, 13).getFormulas();

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 13; c++) {
        const val = data[r][c];
        const f = formulas[r][c];
        if (val !== '' && val !== null) {
          const colLetter = String.fromCharCode(65 + c);
          out.getRange(writeRow, 1).setValue(colLetter + (r + 1));
          out.getRange(writeRow, 2).setValue(f ? f : String(val));
          out.getRange(writeRow, 3).setValue(f ? 'formula, value=' + val : 'value');
          writeRow++;
        }
      }
    }
    writeRow += 2;
  });

  out.autoResizeColumns(1, 3);
  SpreadsheetApp.getActive().toast('Layout dumped to DASH_DIAGNOSTIC2 tab.');
}

function resetLogRowCaches() {
  const props = PropertiesService.getDocumentProperties();
  props.deleteProperty('historyNextLogRow');
  props.deleteProperty('paymentHistoryNextLogRow');
  SpreadsheetApp.getActive().toast('Log row caches cleared — will recompute correctly on next refresh.');
}


function diagnoseLogState() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getDocumentProperties();

  const hSheet = ss.getSheetByName(HISTORY_SHEET);
  const phSheet = ss.getSheetByName(PH_SHEET);

  const hCached = props.getProperty('historyNextLogRow');
  const phCached = props.getProperty('paymentHistoryNextLogRow');

  const hIds = hSheet.getRange(HISTORY_LOG_START_ROW, HISTORY_LOG_COL, HISTORY_MAX_ROW - HISTORY_LOG_START_ROW + 1, 1).getValues();
  let hLastUsed = -1;
  for (let i = 0; i < hIds.length; i++) if (hIds[i][0] !== '' && hIds[i][0] !== null) hLastUsed = i;

  const phIds = phSheet.getRange(PH_LOG_START_ROW, PH_LOG_COL, PH_MAX_ROW - PH_LOG_START_ROW + 1, 1).getValues();
  let phLastUsed = -1;
  for (let i = 0; i < phIds.length; i++) if (phIds[i][0] !== '' && phIds[i][0] !== null) phLastUsed = i;

  Logger.log('HISTORY cached property: ' + hCached);
  Logger.log('HISTORY true last used row (fresh scan): ' + (HISTORY_LOG_START_ROW + hLastUsed));
  Logger.log('HISTORY C2 filter value: "' + hSheet.getRange('C2').getValue() + '"');
  Logger.log('HISTORY F2 filter value: "' + hSheet.getRange('F2').getValue() + '"');

  Logger.log('PAYMENT HISTORY cached property: ' + phCached);
  Logger.log('PAYMENT HISTORY true last used row (fresh scan): ' + (PH_LOG_START_ROW + phLastUsed));
  Logger.log('PAYMENT HISTORY C2 filter value: "' + phSheet.getRange('C2').getValue() + '"');
  Logger.log('PAYMENT HISTORY F2 filter value: "' + phSheet.getRange('F2').getValue() + '"');

  SpreadsheetApp.getActive().toast('Diagnostic logged — check View > Logs (or Executions) for details.');
}



 //PAYMENT ENTRY PORTAL — BACKEND
 


 // 1. CONFIG


const CONFIG = {
  SHEETS: {
    SETTING: 'SETTING',              
    PAYMENT_HISTORY: 'PAYMENT HISTORY', 
    STATUS_HISTORY: 'HISTORY',       
  
    USERS: 'PORTAL_USERS',
    AUDIT: 'PORTAL_AUDIT_LOG'
  },

  DATA_START_ROW: {
    SETTING: 1,
    PAYMENT_HISTORY: 5,
    STATUS_HISTORY: 5
  },

  
  MARKETER_COL: { SCHOOL_ID: 3, NAME: 4, LOCATION: 5, CONTACT: 6, ENROLMENT: 7, BILL: 11, AMOUNT: 12, BALANCE: 13 },
  MARKETER_DATA_START_ROW: 5,

  
  FALLBACK_MARKETER_TABS: [
    'TURKSON', 'NICHOLAS', 'MAVIS', 'FORTUNE', 'MARY', 'ELIZABETH', 'GEOFFERY', 'HASSAN',
    'MATILDA', 'DANIEL', 'EMERALD', 'VANESSA', 'RITA', 'GOTTFRIED', 'NATHANIEL', 'GRACE',
    'NII', 'CYRIL', 'JEMIMA', 'EMMANUEL', 'AIKINS', 'NADIA', 'MAXWELL', 'PRISCILLA', 'JOAN',
    'COSMOS', 'OWUSU', 'CYNTHIA', 'COLLINS', 'JAKON', 'ALBERT', 'GABRIEL', 'ABDUL',
    'JACKLINE', 'DRAMANI', 'IBRAHIM', 'SANDRA', 'MR ATSU', 'MIKE', 'MR. NARTEY'
  ],


  PH_COL: { SCHOOL_ID: 2, NAME: 3, MARKETER: 4, BILL: 5, PAYMENT_NO: 6, AMOUNT_ADDED: 7, COLLECTED: 8, BALANCE: 9, DATE: 10 },
 
  PH_EXT_COL: { TXN_ID: 21, AGENT: 22, REVERSED: 23, REVERSED_BY: 24, REVERSED_AT: 25, REVERSAL_REASON: 26, LEDGER_REF: 27 },

  ST_COL: { SCHOOL_ID: 2, NAME: 3, BILL: 4, COLLECTED: 5, BALANCE: 6, MARKETER: 7, STATUS: 8, AMOUNT: 9, DATE: 10 },
  ST_EXT_COL: { TXN_ID: 21, AGENT: 23, REASON: 24, REVIEW_STATUS: 25, REVERSED: 26, REVERSED_BY: 27, REVERSED_AT: 28, REVERSAL_REASON: 29 },

  STATUS_TYPES: ['Clearance', 'Discount', 'Bad debt', 'Rejected'],
  SESSION_TTL_SECONDS: 6 * 60 * 60, // CacheService max is 6 hours
  MAX_PAGE_SIZE: 200,


  
  LEDGER: {
    // TEST copy for now — swap to the real Ledger spreadsheet ID once verified.
    SS_ID: '1k2NlVpTr72ijqdV3-PHtdwzKzz8UpLBNKOPb8IvgDjo',
    COL_DATE: 2, COL_SCHOOL: 3, COL_SENDER: 4, COL_AMOUNT: 5, COL_STATUS: 6,
    COL_PORTAL_TXN: 29,        // hidden col — set once this ledger row has been captured by a portal payment
    DATA_START_ROW: 4,
    MAX_ROW: 1800,
    WRONG_ENTRY_STATUS: 'Wrong Entry',
    ENTERED_COLOR: '#93C47D',  // green highlight applied to a matched/entered ledger row
    SETTING_SHEET: 'SETTING',
    SETTING_REP_COL: 2,
    SETTING_META_VALUES: ['STATISTIC', 'ALL', 'G. GHANA', 'U. GHANA', 'C. GHANA', 'N. GHANA']
  }
};


 // ENTRY POINTS
 

function doGet(e) {
  return handle(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var params = {};
  try {
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'Malformed request body.' });
  }
  return handle(params);
}

function handle(params) {
  var action = params.action;
  var lock = LockService.getScriptLock();
  try {
   
    if (action === 'ping') return jsonOut({ ok: true, ts: Date.now() });
    if (action === 'login') return jsonOut(login(params.username, params.pin));

 
    var session = requireSession(params.token);
    if (!session.ok) return jsonOut(session);
    var user = session.user;

    switch (action) {
      case 'me':
        return jsonOut({ ok: true, user: user });
      case 'logout':
        CacheService.getScriptCache().remove('session_' + params.token);
        audit(user, 'LOGOUT', '-', {});
        return jsonOut({ ok: true });
      case 'getMarketers':
        return jsonOut({ ok: true, marketers: getMarketers() });
      case 'getSchools':
        return jsonOut({ ok: true, schools: getSchoolsForMarketer(params.marketer) });
      case 'getLedgerForMarketer':
        return jsonOut({ ok: true, entries: getLedgerEntriesForMarketer(params.marketer) });
      case 'getDashboardSummary':
        return jsonOut({ ok: true, summary: getDashboardSummary() });

      case 'addPayment':
        lock.waitLock(20000);
        return jsonOut(withRole(user, ['agent', 'supervisor', 'admin'], function () {
          return addPayment(params, user);
        }));

      case 'addDeclaration':
        lock.waitLock(20000);
        return jsonOut(withRole(user, ['agent', 'supervisor', 'admin'], function () {
          return addDeclaration(params, user);
        }));

      case 'getPaymentHistory':
        return jsonOut({ ok: true, result: getPaymentHistory(params) });
      case 'getDeclarations':
        return jsonOut({ ok: true, result: getDeclarations(params) });

          case 'reverseTransaction':
        lock.waitLock(20000);
        return jsonOut(withRole(user, ['agent', 'supervisor', 'admin'], function () {
          return reverseTransaction(params, user);
        }));

      case 'reviewDeclaration':
        lock.waitLock(20000);
        return jsonOut(withRole(user, ['agent', 'supervisor', 'admin'], function () {
          return reviewDeclaration(params, user);
        }));

      case 'getAuditLog':
        return jsonOut(withRole(user, ['agent', 'supervisor', 'admin'], function () {
          return { ok: true, log: getAuditLog(params) };
        }));

      case 'listUsers':
        return jsonOut(withRole(user, ['admin'], function () { return { ok: true, users: listUsers() }; }));
      case 'createUser':
        return jsonOut(withRole(user, ['admin'], function () { return createUser(params, user); }));
      case 'setUserStatus':
        return jsonOut(withRole(user, ['admin'], function () { return setUserStatus(params, user); }));

      default:
        return jsonOut({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return jsonOut({ ok: false, error: 'Server error: ' + err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* not held, fine */ }
  }
}

function withRole(user, allowedRoles, fn) {
  if (allowedRoles.indexOf(user.role) === -1) {
    return { ok: false, error: 'You do not have permission to perform this action.' };
  }
  return fn();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


 // 3. AUTH 

function usersSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CONFIG.SHEETS.USERS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEETS.USERS);
    sh.appendRow(['Username', 'FullName', 'PinHash', 'Role', 'Status', 'CreatedAt', 'LastLoginAt']);
    sh.appendRow(['admin', 'System Administrator', sha256_('2468'), 'admin', 'active', new Date(), '']);
    sh.appendRow(['agent1', 'Payment Entry Agent', sha256_('1111'), 'agent', 'active', new Date(), '']);
    sh.appendRow(['supervisor1', 'Supervisor', sha256_('2222'), 'supervisor', 'active', new Date(), '']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function sha256_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text));
  return raw.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function login(username, pin) {
  if (!username || !pin) return { ok: false, error: 'Username and PIN are required.' };
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[0]).toLowerCase() === String(username).toLowerCase()) {
      if (String(row[4]).toLowerCase() !== 'active') {
        return { ok: false, error: 'This account is disabled. Contact an administrator.' };
      }
      if (row[2] !== sha256_(pin)) {
        return { ok: false, error: 'Invalid username or PIN.' };
      }
      var user = { username: row[0], name: row[1], role: row[3] };
      var token = Utilities.getUuid();
      CacheService.getScriptCache().put('session_' + token, JSON.stringify(user), CONFIG.SESSION_TTL_SECONDS);
      sh.getRange(i + 1, 7).setValue(new Date());
      audit(user, 'LOGIN', '-', {});
      return { ok: true, token: token, user: user, expiresInSeconds: CONFIG.SESSION_TTL_SECONDS };
    }
  }
  return { ok: false, error: 'Invalid username or PIN.' };
}

function requireSession(token) {
  if (!token) return { ok: false, error: 'Not authenticated. Please log in.' };
  var raw = CacheService.getScriptCache().get('session_' + token);
  if (!raw) return { ok: false, error: 'Session expired. Please log in again.' };
  CacheService.getScriptCache().put('session_' + token, raw, CONFIG.SESSION_TTL_SECONDS);
  return { ok: true, user: JSON.parse(raw) };
}

function listUsers() {
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    out.push({ username: data[i][0], name: data[i][1], role: data[i][3], status: data[i][4], lastLoginAt: data[i][6] });
  }
  return out;
}

function createUser(params, actingUser) {
  if (!params.username || !params.pin || !params.role) return { ok: false, error: 'Missing fields.' };
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(params.username).toLowerCase()) {
      return { ok: false, error: 'That username already exists.' };
    }
  }
  sh.appendRow([params.username, params.name || params.username, sha256_(params.pin), params.role, 'active', new Date(), '']);
  audit(actingUser, 'USER_CREATED', params.username, { role: params.role });
  return { ok: true };
}

function setUserStatus(params, actingUser) {
  var sh = usersSheet_();
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(params.username).toLowerCase()) {
      sh.getRange(i + 1, 5).setValue(params.status === 'active' ? 'active' : 'disabled');
      audit(actingUser, 'USER_STATUS_CHANGED', params.username, { status: params.status });
      return { ok: true };
    }
  }
  return { ok: false, error: 'User not found.' };
}


 
 // AUDIT LOG 

function auditSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(CONFIG.SHEETS.AUDIT);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEETS.AUDIT);
    sh.appendRow(['Timestamp', 'Actor', 'Role', 'Action', 'Target', 'Details']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function audit(user, action, target, details) {
  try {
    auditSheet_().appendRow([new Date(), user ? user.username : 'system', user ? user.role : '-', action, target, JSON.stringify(details || {})]);
  } catch (e) { /* never let logging break the main flow */ }
}

function getAuditLog(params) {
  var sh = auditSheet_();
  var data = sh.getDataRange().getValues();
  var rows = data.slice(1).reverse();
  var limit = Math.min(params.limit || 100, 500);
  return rows.slice(0, limit).map(function (r) {
    return { timestamp: r[0], actor: r[1], role: r[2], action: r[3], target: r[4], details: r[5] };
  });
}




//5. MARKETERS + SCHOOLS

var READ_CACHE_TTL_SECONDS = 5;

function invalidateReadCache_(marketer) {
  var c = CacheService.getScriptCache();
  c.remove('cache_marketers');
  c.remove('cache_dashboard_summary');
  if (marketer) c.remove('cache_schools_' + marketer);
}


function getMarketerTabNames_() {
  var ss = SpreadsheetApp.getActive();
  var names = [];

  try {
    var setting = ss.getSheetByName(CONFIG.SHEETS.SETTING);
    if (setting) {
      var lastRow = setting.getLastRow();
      if (lastRow >= CONFIG.DATA_START_ROW.SETTING) {
        var vals = setting.getRange(CONFIG.DATA_START_ROW.SETTING, 1, lastRow - CONFIG.DATA_START_ROW.SETTING + 1, 1).getValues();
        vals.forEach(function (r) {
          var name = String(r[0] == null ? '' : r[0]).trim();
          if (name) names.push(name);
        });
      }
    }
  } catch (e) { /* fall through to fallback list below */ }

  if (names.length === 0) names = CONFIG.FALLBACK_MARKETER_TABS.slice();

  var deduped = [];
  var seen = {};
  names.forEach(function (name) {
    var key = name.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    if (ss.getSheetByName(name)) deduped.push(name);
  });

  return deduped;
}

function getMarketers() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('cache_marketers');
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.getActive();
  var tabNames = getMarketerTabNames_();
  var out = [];

  tabNames.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var lastRow = sh.getLastRow();
    var start = CONFIG.MARKETER_DATA_START_ROW;
    if (lastRow < start) {
      out.push({ name: name, schools: 0, enrolment: 0, bill: 0, collected: 0, balance: 0 });
      return;
    }

    var values = sh.getRange(start, 1, lastRow - start + 1, 13).getValues();
    var schools = 0, enrolment = 0, bill = 0, collected = 0, balance = 0;

    values.forEach(function (r) {
      var id = r[CONFIG.MARKETER_COL.SCHOOL_ID - 1];
      if (!id) return; // blank row
      schools += 1;
      enrolment += Number(r[CONFIG.MARKETER_COL.ENROLMENT - 1]) || 0;
      var b = Number(r[CONFIG.MARKETER_COL.BILL - 1]) || 0;
      var c = Number(r[CONFIG.MARKETER_COL.AMOUNT - 1]) || 0;
      bill += b;
      collected += c;
      balance += (b - c);
    });

    out.push({ name: name, schools: schools, enrolment: enrolment, bill: bill, collected: collected, balance: balance });
  });

  try { cache.put('cache_marketers', JSON.stringify(out), READ_CACHE_TTL_SECONDS); } catch (e) { /* payload too big for cache — fine, just skip caching */ }
  return out;
}

function getSchoolsForMarketer(marketer) {
  if (!marketer) return [];
  var cache = CacheService.getScriptCache();
  var cacheKey = 'cache_schools_' + marketer;
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(marketer);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  var start = CONFIG.MARKETER_DATA_START_ROW;
  if (lastRow < start) return [];

  var values = sh.getRange(start, 1, lastRow - start + 1, 13).getValues();
  var out = [];
  values.forEach(function (r) {
    var id = r[CONFIG.MARKETER_COL.SCHOOL_ID - 1];
    if (!id) return;
    var bill = Number(r[CONFIG.MARKETER_COL.BILL - 1]) || 0;
    var collected = Number(r[CONFIG.MARKETER_COL.AMOUNT - 1]) || 0;
    out.push({
      schoolId: String(id).trim(),
      name: String(r[CONFIG.MARKETER_COL.NAME - 1] || '').trim(),
      location: String(r[CONFIG.MARKETER_COL.LOCATION - 1] || '').trim(),
      contact: r[CONFIG.MARKETER_COL.CONTACT - 1] || '',
      enrolment: Number(r[CONFIG.MARKETER_COL.ENROLMENT - 1]) || 0,
      bill: bill,
      collected: collected,
      balance: bill - collected
    });
  });
  try { cache.put(cacheKey, JSON.stringify(out), READ_CACHE_TTL_SECONDS); } catch (e) { /* payload too big for cache — fine, just skip caching */ }
  return out;
}


function findSchoolRow_(marketer, schoolId) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(marketer);
  if (!sh) return null; // tab must exist and match SETTING list exactly
  var lastRow = sh.getLastRow();
  var start = CONFIG.MARKETER_DATA_START_ROW;
  if (lastRow < start) return null;
  var values = sh.getRange(start, 1, lastRow - start + 1, 13).getValues();
  for (var i = 0; i < values.length; i++) {
    var id = values[i][CONFIG.MARKETER_COL.SCHOOL_ID - 1];
    if (id && String(id).trim() === String(schoolId).trim()) {
      return { sheet: sh, row: start + i, data: values[i] };
    }
  }
  return null;
}



function ledgerSS_() {
  return SpreadsheetApp.openById(CONFIG.LEDGER.SS_ID);
}


function extractLedgerSchoolId_(schoolStr) {
  var m = String(schoolStr || '').match(/\(([^()]+)\)\s*$/);
  return m ? m[1].trim() : '';
}

function stripLedgerSchoolId_(schoolStr) {
  return String(schoolStr || '').replace(/\s*\([^()]*\)\s*$/, '').trim();
}

function normName_(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}


function getLedgerEntriesForMarketer(marketer) {
  if (!marketer) return [];
  var sh = ledgerSS_().getSheetByName(marketer);
  if (!sh) return [];
  var L = CONFIG.LEDGER;
  var lastRow = Math.min(sh.getLastRow(), L.MAX_ROW);
  if (lastRow < L.DATA_START_ROW) return [];

  var numRows = lastRow - L.DATA_START_ROW + 1;
  var width = L.COL_PORTAL_TXN - L.COL_DATE + 1;
  var values = sh.getRange(L.DATA_START_ROW, L.COL_DATE, numRows, width).getValues();

  var out = [];
  values.forEach(function (r, i) {
    var school = r[L.COL_SCHOOL - L.COL_DATE];
    if (!school) return;
    var status = r[L.COL_STATUS - L.COL_DATE];
    if (status === L.WRONG_ENTRY_STATUS) return;
    var portalTxn = r[L.COL_PORTAL_TXN - L.COL_DATE];
    if (portalTxn) return; // already captured by a portal payment — hide it

    out.push({
      rowRef: L.DATA_START_ROW + i,
      date: r[L.COL_DATE - L.COL_DATE],
      school: String(school).trim(),
      schoolId: extractLedgerSchoolId_(school),
      schoolNameOnly: stripLedgerSchoolId_(school),
      sender: r[L.COL_SENDER - L.COL_DATE] || '',
      amount: Number(r[L.COL_AMOUNT - L.COL_DATE]) || 0,
      status: status || ''
    });
  });

  out.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  return out;
}


function findLedgerMatch_(marketer, schoolId, schoolName) {
  var entries = getLedgerEntriesForMarketer(marketer);
  var wantId = String(schoolId || '').trim();
  if (wantId) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].schoolId && entries[i].schoolId === wantId) return entries[i];
    }
  }
  var wantName = normName_(schoolName);
  if (wantName) {
    for (var j = 0; j < entries.length; j++) {
      if (normName_(entries[j].schoolNameOnly) === wantName) return entries[j];
    }
  }
  return null;
}


function markLedgerEntryEntered_(marketer, rowRef, txnId) {
  try {
    var sh = ledgerSS_().getSheetByName(marketer);
    if (!sh) return;
    var L = CONFIG.LEDGER;
    
    if (sh.getRange(rowRef, L.COL_PORTAL_TXN).getValue()) return;
    sh.getRange(rowRef, L.COL_DATE, 1, L.COL_STATUS - L.COL_DATE + 1).setBackground(L.ENTERED_COLOR);
    sh.getRange(rowRef, L.COL_PORTAL_TXN).setValue(txnId);
  } catch (e) { /* never let the ledger side-effect break the actual payment */ }
}

function unmarkLedgerEntryEntered_(marketer, rowRef) {
  try {
    var sh = ledgerSS_().getSheetByName(marketer);
    if (!sh) return;
    var L = CONFIG.LEDGER;
    sh.getRange(rowRef, L.COL_DATE, 1, L.COL_STATUS - L.COL_DATE + 1).setBackground(null);
    sh.getRange(rowRef, L.COL_PORTAL_TXN).clearContent();
  } catch (e) { /* best-effort — reversal of the payment itself must still succeed */ }
}

function ledgerRepNames_() {
  var ss = ledgerSS_();
  var L = CONFIG.LEDGER;
  var setting = ss.getSheetByName(L.SETTING_SHEET);
  if (!setting) return [];
  var lastRow = setting.getLastRow();
  var values = setting.getRange(1, L.SETTING_REP_COL, lastRow, 1).getValues();
  var reps = [];
  values.forEach(function (r) {
    var v = String(r[0] || '').trim();
    if (v && L.SETTING_META_VALUES.indexOf(v) === -1) reps.push(v);
  });
  return reps;
}

// One-time setup: run this once from the Apps Script editor (Run >
// setupLedgerIntegration) after pointing CONFIG.LEDGER.SS_ID at the right
// spreadsheet. Adds/hides the hidden "captured by portal" column on every
// rep sheet in the Ledger. Safe to re-run any time.
function setupLedgerIntegration() {
  var ss = ledgerSS_();
  var L = CONFIG.LEDGER;
  var reps = ledgerRepNames_();
  reps.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.getRange(3, L.COL_PORTAL_TXN).setValue('Portal Txn Ref');
    sh.hideColumns(L.COL_PORTAL_TXN);
  });
  SpreadsheetApp.getActive().toast('Ledger integration set up for ' + reps.length + ' rep sheet(s).');
}

function getDashboardSummary() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('cache_dashboard_summary');
  if (cached) return JSON.parse(cached);

  var summary = computeDashboardSummary_();
  try { cache.put('cache_dashboard_summary', JSON.stringify(summary), READ_CACHE_TTL_SECONDS); } catch (e) { /* skip caching if too large */ }
  return summary;
}

function computeDashboardSummary_() {
  var marketers = getMarketers();
  var totalBill = 0, totalCollected = 0, totalBalance = 0, totalSchools = 0;
  marketers.forEach(function (m) { totalBill += m.bill; totalCollected += m.collected; totalBalance += m.balance; totalSchools += m.schools; });

  var payToday = getPaymentHistory({ dateRange: 'today', pageSize: 5000 });
  var declToday = getDeclarations({ dateRange: 'today', pageSize: 5000 });

  var paidToday = 0, schoolsPaidToday = {}, reversedCount = 0;
  payToday.rows.forEach(function (r) {
    if (!r.reversed) { paidToday += r.amountAdded; schoolsPaidToday[r.schoolId] = true; }
    else reversedCount++;
  });
  var statusToday = 0;
  declToday.rows.forEach(function (r) { if (!r.reversed) statusToday++; });

  return {
    todayTotalPayments: paidToday,
    todayEntries: payToday.rows.length,
    schoolsPaidToday: Object.keys(schoolsPaidToday).length,
    outstandingBalance: totalBalance,
    todayDeclarations: statusToday,
    reversedToday: reversedCount,
    totalSchools: totalSchools,
    totalBill: totalBill,
    totalCollected: totalCollected,
    marketers: marketers
  };
}


 // 6. PAYMENTS


function makeTxnId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'GMT', 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}

function addPayment(params, user) {
  var marketer = String(params.marketer || '').trim();
  var schoolId = String(params.schoolId || '').trim();
  var amount = Number(params.amount);
  var idempotencyKey = params.idempotencyKey || '';

  if (!marketer || !schoolId) return { ok: false, error: 'Marketer and school are required.' };
  if (!amount || isNaN(amount) || amount <= 0) return { ok: false, error: 'Amount must be a positive number.' };
  if (amount > 1000000) return { ok: false, error: 'Amount exceeds the maximum allowed transaction size.' };

  if (idempotencyKey && wasAlreadyProcessed_(idempotencyKey)) {
    return { ok: false, error: 'This payment was already submitted (duplicate detected).', duplicate: true };
  }

  var school = findSchoolRow_(marketer, schoolId);
  if (!school) return { ok: false, error: 'This school does not belong to the selected marketer, or was not found.' };

  var bill = Number(school.data[CONFIG.MARKETER_COL.BILL - 1]) || 0;
  var previousCollected = Number(school.data[CONFIG.MARKETER_COL.AMOUNT - 1]) || 0;
  var newCollected = previousCollected + amount;
  var newBalance = bill - newCollected; 

 
  school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).setValue(newCollected);

  var schoolName = school.data[CONFIG.MARKETER_COL.NAME - 1];
  var paymentNo = countPriorPayments_(schoolId) + 1;
  var txnId = makeTxnId_('PMT');
  var now = new Date();
  var agentLabel = user.name + ' (' + user.username + ')';

  var ph = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.PAYMENT_HISTORY);
  ensureExtHeaders_(ph, CONFIG.PH_EXT_COL, { TXN_ID: 'Transaction ID', AGENT: 'Agent', REVERSED: 'Reversed', REVERSED_BY: 'Reversed By', REVERSED_AT: 'Reversed At', REVERSAL_REASON: 'Reversal Reason', LEDGER_REF: 'Ledger Ref' });
  var row = ph.getLastRow() + 1;
  ph.getRange(row, CONFIG.PH_COL.SCHOOL_ID, 1, 9).setValues([[
    schoolId, schoolName, marketer, bill, paymentNo, amount, newCollected, newBalance, now
  ]]);
  ph.getRange(row, CONFIG.PH_EXT_COL.TXN_ID, 1, 3).setValues([[txnId, agentLabel, false]]);

  
  var ledgerRowRef = Number(params.ledgerRowRef) || 0;
  if (ledgerRowRef) {
    markLedgerEntryEntered_(marketer, ledgerRowRef, txnId);
    ph.getRange(row, CONFIG.PH_EXT_COL.LEDGER_REF).setValue(marketer + '|' + ledgerRowRef);
  }

  invalidateReadCache_(marketer);
  if (idempotencyKey) rememberIdempotency_(idempotencyKey);
  audit(user, 'PAYMENT_CREATED', txnId, { schoolId: schoolId, marketer: marketer, amount: amount, ledgerRowRef: ledgerRowRef || undefined });

  return {
    ok: true,
    transaction: {
      transactionId: txnId, schoolId: schoolId, schoolName: schoolName, marketer: marketer,
      amount: amount, previousCollected: previousCollected, newCollected: newCollected,
      bill: bill, newBalance: newBalance, agent: user.name, timestamp: now,
      ledgerRowRef: ledgerRowRef || null
    }
  };
}

function countPriorPayments_(schoolId) {
  var ph = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.PAYMENT_HISTORY);
  var lastRow = ph.getLastRow();
  var start = CONFIG.DATA_START_ROW.PAYMENT_HISTORY;
  if (lastRow < start) return 0;
  var ids = ph.getRange(start, CONFIG.PH_COL.SCHOOL_ID, lastRow - start + 1, 1).getValues();
  var count = 0;
  ids.forEach(function (r) { if (r[0] && String(r[0]).trim() === String(schoolId).trim()) count++; });
  return count;
}

function ensureExtHeaders_(sheet, colMap, labels) {
  Object.keys(colMap).forEach(function (key) {
    var col = colMap[key];
    var headerRow = 4; // same header row as the rest of the ledger
    var cell = sheet.getRange(headerRow, col);
    if (!cell.getValue()) cell.setValue(labels[key] || key);
  });
}

function wasAlreadyProcessed_(key) {
  return !!CacheService.getScriptCache().get('idem_' + key);
}
function rememberIdempotency_(key) {
  CacheService.getScriptCache().put('idem_' + key, '1', 600); // 10 minutes
}

// 7. DECLARATIONS (Clearance / Discount / Bad debt / Rejected)

function addDeclaration(params, user) {
  var marketer = String(params.marketer || '').trim();
  var schoolId = String(params.schoolId || '').trim();
  var status = String(params.status || '').trim();
  var amount = Number(params.amount || 0);
  var reason = String(params.reason || '').trim();

  if (!marketer || !schoolId) return { ok: false, error: 'Marketer and school are required.' };
  if (CONFIG.STATUS_TYPES.map(function (s) { return s.toLowerCase(); }).indexOf(status.toLowerCase()) === -1) {
    return { ok: false, error: 'Invalid status type.' };
  }
  if (amount < 0) return { ok: false, error: 'Amount cannot be negative.' };

  var school = findSchoolRow_(marketer, schoolId);
  if (!school) return { ok: false, error: 'This school does not belong to the selected marketer, or was not found.' };

  var bill = Number(school.data[CONFIG.MARKETER_COL.BILL - 1]) || 0;
  var previousCollected = Number(school.data[CONFIG.MARKETER_COL.AMOUNT - 1]) || 0;
  var newCollected = previousCollected + amount;
  var newBalance = bill - newCollected; 

  
  school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).setValue(newCollected);

  var schoolName = school.data[CONFIG.MARKETER_COL.NAME - 1];
  var txnId = makeTxnId_('DEC');
  var now = new Date();
  var needsReview = status.toLowerCase() !== 'discount'; // configurable review rule
  var agentLabel = user.name + ' (' + user.username + ')';
  var reviewStatus = needsReview ? 'Pending Review' : 'Auto-approved';

  var st = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.STATUS_HISTORY);
  ensureExtHeaders_(st, CONFIG.ST_EXT_COL, {
    TXN_ID: 'Declaration ID', AGENT: 'Agent', REASON: 'Reason', REVIEW_STATUS: 'Review Status',
    REVERSED: 'Reversed', REVERSED_BY: 'Reversed By', REVERSED_AT: 'Reversed At', REVERSAL_REASON: 'Reversal Reason'
  });
  var row = st.getLastRow() + 1;
 
  st.getRange(row, CONFIG.ST_COL.SCHOOL_ID, 1, 9).setValues([[
    schoolId, schoolName, bill, newCollected, newBalance, marketer, status, amount, now
  ]]);
  st.getRange(row, CONFIG.ST_EXT_COL.TXN_ID).setValue(txnId);
  st.getRange(row, CONFIG.ST_EXT_COL.AGENT, 1, 4).setValues([[agentLabel, reason, reviewStatus, false]]);

  invalidateReadCache_(marketer);
  audit(user, 'DECLARATION_CREATED', txnId, { schoolId: schoolId, marketer: marketer, status: status, amount: amount });

  return {
    ok: true,
    declaration: {
      declarationId: txnId, schoolId: schoolId, schoolName: schoolName, marketer: marketer,
      status: status, amount: amount, reason: reason, reviewStatus: reviewStatus,
    
      newBill: bill, newCollected: newCollected, newBalance: newBalance,
      agent: user.name, timestamp: now
    }
  };
}

function reviewDeclaration(params, user) {
  var txnId = params.transactionId;
  var decision = params.decision === 'approve' ? 'Approved' : 'Rejected by reviewer';
  var st = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.STATUS_HISTORY);
  var lastRow = st.getLastRow();
  var ids = st.getRange(5, CONFIG.ST_EXT_COL.TXN_ID, lastRow - 4, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === txnId) {
      var row = 5 + i;
      st.getRange(row, CONFIG.ST_EXT_COL.REVIEW_STATUS).setValue(decision);
      audit(user, 'DECLARATION_REVIEWED', txnId, { decision: decision });
      invalidateReadCache_(st.getRange(row, CONFIG.ST_COL.MARKETER).getValue());
      return { ok: true };
    }
  }
  return { ok: false, error: 'Declaration not found.' };
}


 // 8. HISTORY READERS 

function parseDateFilter_(dateRange, dateFrom, dateTo) {
  var now = new Date();
  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateRange === 'today') return { from: startOfToday, to: new Date(startOfToday.getTime() + 86400000) };
  if (dateRange === 'yesterday') {
    var y = new Date(startOfToday.getTime() - 86400000);
    return { from: y, to: startOfToday };
  }
  if (dateRange === 'last7') return { from: new Date(startOfToday.getTime() - 7 * 86400000), to: new Date(startOfToday.getTime() + 86400000) };
  if (dateRange === 'last30') return { from: new Date(startOfToday.getTime() - 30 * 86400000), to: new Date(startOfToday.getTime() + 86400000) };
  if (dateFrom || dateTo) {
    return {
      from: dateFrom ? new Date(dateFrom) : new Date(0),
      to: dateTo ? new Date(new Date(dateTo).getTime() + 86400000) : new Date(8640000000000000)
    };
  }
  return null; // 'all'
}

function getPaymentHistory(params) {
  var ph = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.PAYMENT_HISTORY);
  var lastRow = ph.getLastRow();
  var start = CONFIG.DATA_START_ROW.PAYMENT_HISTORY;
  if (lastRow < start) return { rows: [], total: 0 };
  var numCols = Math.max(CONFIG.PH_EXT_COL.REVERSAL_REASON, 10);
  var values = ph.getRange(start, 1, lastRow - start + 1, numCols).getValues();

  var range = parseDateFilter_(params.dateRange, params.dateFrom, params.dateTo);
  var rows = [];
  values.forEach(function (r, idx) {
    var schoolId = r[CONFIG.PH_COL.SCHOOL_ID - 1];
    if (!schoolId) return;
    var date = r[CONFIG.PH_COL.DATE - 1];
    if (range && date instanceof Date && (date < range.from || date >= range.to)) return;
    if (params.marketer && String(r[CONFIG.PH_COL.MARKETER - 1]).toLowerCase() !== String(params.marketer).toLowerCase()) return;
    if (params.search) {
      var s = String(params.search).toLowerCase();
      var hay = (String(schoolId) + ' ' + String(r[CONFIG.PH_COL.NAME - 1])).toLowerCase();
      if (hay.indexOf(s) === -1) return;
    }
    if (params.minAmount && Number(r[CONFIG.PH_COL.AMOUNT_ADDED - 1]) < Number(params.minAmount)) return;
    if (params.maxAmount && Number(r[CONFIG.PH_COL.AMOUNT_ADDED - 1]) > Number(params.maxAmount)) return;
    if (params.reversed === 'yes' && r[CONFIG.PH_EXT_COL.REVERSED - 1] !== true) return;
    if (params.reversed === 'no' && r[CONFIG.PH_EXT_COL.REVERSED - 1] === true) return;

    rows.push({
      rowIndex: start + idx,
      schoolId: schoolId,
      schoolName: r[CONFIG.PH_COL.NAME - 1],
      marketer: r[CONFIG.PH_COL.MARKETER - 1],
      bill: Number(r[CONFIG.PH_COL.BILL - 1]) || 0,
      paymentNo: r[CONFIG.PH_COL.PAYMENT_NO - 1],
      amountAdded: Number(r[CONFIG.PH_COL.AMOUNT_ADDED - 1]) || 0,
      collected: Number(r[CONFIG.PH_COL.COLLECTED - 1]) || 0,
      balance: Number(r[CONFIG.PH_COL.BALANCE - 1]) || 0,
      date: date,
      transactionId: r[CONFIG.PH_EXT_COL.TXN_ID - 1] || ('LEGACY-' + (start + idx)),
      agent: r[CONFIG.PH_EXT_COL.AGENT - 1] || '',
      reversed: r[CONFIG.PH_EXT_COL.REVERSED - 1] === true,
      reversedBy: r[CONFIG.PH_EXT_COL.REVERSED_BY - 1] || '',
      reversedAt: r[CONFIG.PH_EXT_COL.REVERSED_AT - 1] || '',
      reversalReason: r[CONFIG.PH_EXT_COL.REVERSAL_REASON - 1] || ''
    });
  });

  rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  var total = rows.length;
  var pageSize = Math.min(params.pageSize || 25, CONFIG.MAX_PAGE_SIZE);
  var page = Math.max(params.page || 1, 1);
  var paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { rows: paged, total: total, page: page, pageSize: pageSize };
}

function getDeclarations(params) {
  var st = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.STATUS_HISTORY);
  var lastRow = st.getLastRow();
  var start = CONFIG.DATA_START_ROW.STATUS_HISTORY;
  if (lastRow < start) return { rows: [], total: 0 };
  var numCols = Math.max(CONFIG.ST_EXT_COL.REVERSAL_REASON, 10);
  var values = st.getRange(start, 1, lastRow - start + 1, numCols).getValues();

  var range = parseDateFilter_(params.dateRange, params.dateFrom, params.dateTo);
  var rows = [];
  values.forEach(function (r, idx) {
    var schoolId = r[CONFIG.ST_COL.SCHOOL_ID - 1];
    if (!schoolId) return;
    var date = r[CONFIG.ST_COL.DATE - 1];
    if (range && date instanceof Date && (date < range.from || date >= range.to)) return;
    if (params.marketer && String(r[CONFIG.ST_COL.MARKETER - 1]).toLowerCase() !== String(params.marketer).toLowerCase()) return;
    if (params.status && String(r[CONFIG.ST_COL.STATUS - 1]).toLowerCase() !== String(params.status).toLowerCase()) return;
    if (params.search) {
      var s = String(params.search).toLowerCase();
      var hay = (String(schoolId) + ' ' + String(r[CONFIG.ST_COL.NAME - 1])).toLowerCase();
      if (hay.indexOf(s) === -1) return;
    }
    if (params.reversed === 'yes' && r[CONFIG.ST_EXT_COL.REVERSED - 1] !== true) return;
    if (params.reversed === 'no' && r[CONFIG.ST_EXT_COL.REVERSED - 1] === true) return;

    rows.push({
      rowIndex: start + idx,
      schoolId: schoolId,
      schoolName: r[CONFIG.ST_COL.NAME - 1],
      marketer: r[CONFIG.ST_COL.MARKETER - 1],
      bill: Number(r[CONFIG.ST_COL.BILL - 1]) || 0,
      collected: Number(r[CONFIG.ST_COL.COLLECTED - 1]) || 0,
      balance: Number(r[CONFIG.ST_COL.BALANCE - 1]) || 0,
      status: r[CONFIG.ST_COL.STATUS - 1],
      amount: Number(r[CONFIG.ST_COL.AMOUNT - 1]) || 0,
      date: date,
      transactionId: r[CONFIG.ST_EXT_COL.TXN_ID - 1] || ('LEGACY-' + (start + idx)),
      agent: r[CONFIG.ST_EXT_COL.AGENT - 1] || '',
      reason: r[CONFIG.ST_EXT_COL.REASON - 1] || '',
      reviewStatus: r[CONFIG.ST_EXT_COL.REVIEW_STATUS - 1] || '',
      reversed: r[CONFIG.ST_EXT_COL.REVERSED - 1] === true,
      reversedBy: r[CONFIG.ST_EXT_COL.REVERSED_BY - 1] || '',
      reversedAt: r[CONFIG.ST_EXT_COL.REVERSED_AT - 1] || '',
      reversalReason: r[CONFIG.ST_EXT_COL.REVERSAL_REASON - 1] || ''
    });
  });

  rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  var total = rows.length;
  var pageSize = Math.min(params.pageSize || 25, CONFIG.MAX_PAGE_SIZE);
  var page = Math.max(params.page || 1, 1);
  var paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { rows: paged, total: total, page: page, pageSize: pageSize };
}


 // 9. REVERSALS — never delete, always correct + audit.
 

function reverseTransaction(params, user) {
  var source = params.source; 
  var transactionId = params.transactionId;
  var reason = String(params.reason || '').trim();
  if (!reason) return { ok: false, error: 'A reason is required to reverse a transaction.' };
  if (!transactionId) return { ok: false, error: 'Missing transaction id.' };

  if (source === 'payment') return reversePayment_(transactionId, reason, user);
  if (source === 'declaration') return reverseDeclaration_(transactionId, reason, user);
  return { ok: false, error: 'Unknown source type.' };
}

function reversePayment_(transactionId, reason, user) {
  var ph = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.PAYMENT_HISTORY);
  var lastRow = ph.getLastRow();
  var start = CONFIG.DATA_START_ROW.PAYMENT_HISTORY;
  var ids = ph.getRange(start, CONFIG.PH_EXT_COL.TXN_ID, lastRow - start + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === transactionId) {
      var row = start + i;
      var mainVals = ph.getRange(row, CONFIG.PH_COL.SCHOOL_ID, 1, 9).getValues()[0];
      var schoolId = mainVals[0];
      var marketer = mainVals[CONFIG.PH_COL.MARKETER - CONFIG.PH_COL.SCHOOL_ID];
      var amount = Number(mainVals[CONFIG.PH_COL.AMOUNT_ADDED - CONFIG.PH_COL.SCHOOL_ID]) || 0;

      if (ph.getRange(row, CONFIG.PH_EXT_COL.REVERSED).getValue() === true) {
        return { ok: false, error: 'This transaction was already reversed.' };
      }

      var school = findSchoolRow_(marketer, schoolId);
      if (school) {
        var curAmt = Number(school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).getValue()) || 0;
        school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).setValue(curAmt - amount);
      }

      ph.getRange(row, CONFIG.PH_EXT_COL.REVERSED, 1, 4).setValues([[
        true, user.name + ' (' + user.username + ')', new Date(), reason
      ]]);

      
      var ledgerRef = String(ph.getRange(row, CONFIG.PH_EXT_COL.LEDGER_REF).getValue() || '');
      if (ledgerRef.indexOf('|') !== -1) {
        var parts = ledgerRef.split('|');
        unmarkLedgerEntryEntered_(parts[0], Number(parts[1]));
      }

      invalidateReadCache_(marketer);
      audit(user, 'PAYMENT_REVERSED', transactionId, { reason: reason });
      return { ok: true };
    }
  }
  return { ok: false, error: 'Transaction not found.' };
}

function reverseDeclaration_(transactionId, reason, user) {
  var st = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.STATUS_HISTORY);
  var lastRow = st.getLastRow();
  var start = CONFIG.DATA_START_ROW.STATUS_HISTORY;
  var ids = st.getRange(start, CONFIG.ST_EXT_COL.TXN_ID, lastRow - start + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === transactionId) {
      var row = start + i;
      var mainVals = st.getRange(row, CONFIG.ST_COL.SCHOOL_ID, 1, 9).getValues()[0];
      var schoolId = mainVals[0];
      var marketer = mainVals[CONFIG.ST_COL.MARKETER - CONFIG.ST_COL.SCHOOL_ID];
      var amount = Number(mainVals[CONFIG.ST_COL.AMOUNT - CONFIG.ST_COL.SCHOOL_ID]) || 0;

      if (st.getRange(row, CONFIG.ST_EXT_COL.REVERSED).getValue() === true) {
        return { ok: false, error: 'This declaration was already reversed.' };
      }

      var school = findSchoolRow_(marketer, schoolId);
      if (school) {
        var curAmt = Number(school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).getValue()) || 0;
        school.sheet.getRange(school.row, CONFIG.MARKETER_COL.AMOUNT).setValue(curAmt - amount);
      }

      st.getRange(row, CONFIG.ST_EXT_COL.REVERSED, 1, 4).setValues([[
        true, user.name + ' (' + user.username + ')', new Date(), reason
      ]]);

      invalidateReadCache_(marketer);
      audit(user, 'DECLARATION_REVERSED', transactionId, { reason: reason });
      return { ok: true };
    }
  }
  return { ok: false, error: 'Declaration not found.' };
}
