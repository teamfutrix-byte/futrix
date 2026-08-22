/**
 * Futrix Pilot Exam Portal - Google Apps Script Backend
 * 
 * ── GOOGLE SHEET COLUMN MAP (First Sheet - Registration / Responses) ──
 * The Google Sheet columns map as:
 * - Column A: Timestamp
 * - Column B: Full Name
 * - Column C: Email Address
 * - Column D: Phone Number
 * - Column E: Date of Birth
 * - Column F: Father's / Guardian's Name
 * - Column G: Father's / Guardian's Contact Number
 * - Column H: City
 * - Column I: Institute Name
 * - Column J: Pin Code
 * - Column K: Preparation For
 * - Column L: If Any Referral
 * - Column M: XP Point
 * - Column N: Referral XP
 * 
 * Note: The existing verifyLogin and checkRegistration checks find column indexes dynamically,
 * which ensures no Apps Script logic shifts are required.
 */

// ── EMAIL DELIVERY CONFIGURATION (Select your preferred mailing service)
// Options:
// - "GMAIL"  : Uses GmailApp.sendEmail. Free, but personal @gmail.com accounts may go to Spam.
// - "BREVO"  : Uses Brevo (Sendinblue) API. Free 300 emails/day. Highly recommended to land in Inbox.
// - "RESEND" : Uses Resend.com API. Free 3,000 emails/month. Highly recommended to land in Inbox.
var EMAIL_SERVICE  = "GMAIL"; 
var BREVO_API_KEY  = "YOUR_BREVO_API_KEY_HERE";
var RESEND_API_KEY = "YOUR_RESEND_API_KEY_HERE";
var SENDER_EMAIL   = "your_verified_sender_email@gmail.com"; // Required for Brevo / Resend

function doGet(e) {
  var callback = e.parameter.callback || '';
  var action   = e.parameter.action   || '';
  var result;
  try {
    if      (action === 'questions') result = getQuestions(e);
    else if (action === 'submit')    result = saveResponse(e);
    else if (action === 'getConfig') result = getExamConfig();
    else if (action === 'checkAttempt') result = checkAttempt(e);
    else if (action === 'checkRegistration') result = checkRegistration(e);
    else if (action === 'register') result = saveRegistration(e);
    else if (action === 'sendOTP')   result = sendOTP(e);
    else if (action === 'verifyOTP') result = verifyOTP(e);
    else if (action === 'getSeriesList') result = getSeriesList(e);
    else if (action === 'unlockSeries') result = unlockSeries(e);
    else if (action === 'getLeaderboard') result = getLeaderboard(e);
    else if (action === 'getPerformance') result = getPerformance(e);
    else if (action === 'createBattle') result = createBattle(e);
    else if (action === 'acceptBattle') result = acceptBattle(e);
    else if (action === 'getBattles') result = getBattles(e);
    else if (action === 'cancelBattle') result = cancelBattle(e);
    else if (action === 'seedData')   result = seedData(e);
    else if (action === 'inspectSheets') result = inspectSheets(e);
    else if (action === 'sendForgotOTP') result = sendForgotOTP(e);
    else if (action === 'verifyForgotOTP') result = verifyForgotOTP(e);
    else if (action === 'resetPassword') result = resetPassword(e);
    else                             result = verifyLogin(e);
  } catch (err) {
    result = { success: false, message: 'Error: ' + err.message };
  }
  var json = JSON.stringify(result);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getXPColumn(sheet) {
  var lastCol = sheet.getLastColumn(); if (lastCol === 0) return 6;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) { 
    var h = String(headers[i]).trim();
    if (h === 'XP Points' || h === 'XP Point') return i + 1; 
  }
  var newCol = lastCol + 1; sheet.getRange(1, newCol).setValue('XP Point'); sheet.getRange(1, newCol).setFontWeight('bold'); return newCol;
}

function getReferralXPColumn(sheet) {
  var lastCol = sheet.getLastColumn(); if (lastCol === 0) return 12;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) { 
    var h = String(headers[i]).trim();
    if (h === 'Referral XP' || h === 'Referral XP Point') return i + 1; 
  }
  var newCol = lastCol + 1; sheet.getRange(1, newCol).setValue('Referral XP'); sheet.getRange(1, newCol).setFontWeight('bold'); return newCol;
}

function getColumnIndexByName(sheet, name, defaultCol) {
  var lastCol = sheet.getLastColumn(); if (lastCol === 0) return defaultCol;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase().trim();
    if (h.indexOf(name.toLowerCase()) !== -1) return i + 1;
  }
  return defaultCol;
}

function verifyLogin(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var phone = (e.parameter.phone || '').trim();
  if (!email || !phone) return { success: false, message: 'Please enter both email and mobile number.' };
  var ss    = getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data  = sheet.getDataRange().getValues();
  
  var nameCol  = getColumnIndexByName(sheet, 'name', 2);
  var emailCol = getColumnIndexByName(sheet, 'email', 3);
  var phoneCol = getColumnIndexByName(sheet, 'phone', 4);
  var xpCol    = getXPColumn(sheet);
  var refXpCol = getReferralXPColumn(sheet);
  var prepCol  = getColumnIndexByName(sheet, 'prep', 12);
  var instCol  = getColumnIndexByName(sheet, 'institute', 10);
  var unlockedCol = getUnlockedLevelColumn(sheet);

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailCol - 1]).toLowerCase().trim();
    var rowPhone = String(data[i][phoneCol - 1]).trim();
    if (rowEmail === email && rowPhone === phone) {
      var xp = parseFloat(data[i][xpCol - 1]) || 0;
      if (xp === 0) { xp = 100; sheet.getRange(i + 1, xpCol).setValue(100); }
      var referralXp = parseFloat(data[i][refXpCol - 1]) || 0;
      var prep = String(data[i][prepCol - 1] || 'Other').trim();
      var inst = String(data[i][instCol - 1] || '').trim();
      var unlockedLevel = parseInt(data[i][unlockedCol - 1] || 1);
      if (unlockedLevel < 1) unlockedLevel = 1;
      
      var streak = getUserStreak(ss, email);
      var activeUsers = getActiveUsersCount(ss);
      
      return { 
        success: true, 
        name: String(data[i][nameCol - 1]).trim(), 
        email: email, 
        phone: phone, 
        xp: xp, 
        referralXp: referralXp, 
        preparation: prep, 
        institute: inst,
        streak: streak,
        activeUsers: activeUsers,
        unlockedLevel: unlockedLevel
      };
    }
  }
  return { success: false, message: 'Invalid email or mobile number. Please try again.' };
}

function getLeaderboard(e) {
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheets()[0]; // 'Registred Pilot'
  var data = sheet.getDataRange().getValues();
  
  var nameCol  = getColumnIndexByName(sheet, 'name', 2);
  var emailCol = getColumnIndexByName(sheet, 'email', 3);
  var xpCol    = getXPColumn(sheet);
  var prepCol  = getColumnIndexByName(sheet, 'prep', 12);
  
  var leaderboard = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][nameCol - 1] || '').trim();
    var email = String(data[i][emailCol - 1] || '').toLowerCase().trim();
    var xp = parseFloat(data[i][xpCol - 1]) || 100;
    var prep = String(data[i][prepCol - 1] || 'Other').trim();
    if (name && email) {
      leaderboard.push({
        name: name,
        email: email,
        xp: xp,
        preparation: prep
      });
    }
  }
  
  // Sort by XP in descending order
  leaderboard.sort(function(a, b) {
    return b.xp - a.xp;
  });
  
  return { success: true, leaderboard: leaderboard };
}

function getPerformance(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  if (!email) return { success: false, message: 'Email is required.' };
  
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Exam Responses');
  if (!sheet) return { success: true, performance: [] };
  
  var data = sheet.getDataRange().getValues();
  var performance = [];
  
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][2] || '').toLowerCase().trim();
    if (rowEmail === email) {
      performance.push({
        timestamp: data[i][0],
        candidateName: data[i][1],
        email: rowEmail,
        phone: data[i][3],
        seriesId: data[i][4],
        score: parseFloat(data[i][5]) || 0,
        correct: parseInt(data[i][6]) || 0,
        wrong: parseInt(data[i][7]) || 0,
        skipped: parseInt(data[i][8]) || 0,
        totalQuestions: parseInt(data[i][9]) || 0,
        timeTaken: data[i][10] || '',
        answers: data[i][11] || '{}'
      });
    }
  }
  
  // Sort by timestamp descending
  performance.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  return { success: true, performance: performance };
}

function createBattle(e) {
  var creatorEmail = (e.parameter.creatorEmail || '').toLowerCase().trim();
  var creatorName = (e.parameter.creatorName || '').trim();
  var difficulty = (e.parameter.difficulty || 'medium').toLowerCase().trim(); // 'easy', 'medium', 'hard'
  var opponentEmail = (e.parameter.opponentEmail || '').toLowerCase().trim(); // Optional: can be empty for Open challenge
  
  if (!creatorEmail || !creatorName) {
    return { success: false, message: 'Missing required parameters.' };
  }
  
  var ss = getActiveSpreadsheet();
  
  // 1. Get creator stream (preparation)
  var regSheet = ss.getSheets()[0];
  var regData = regSheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(regSheet, 'email', 3);
  var prepCol = getColumnIndexByName(regSheet, 'prep', 12);
  
  var creatorStream = 'NEET'; // Default fallback
  for (var i = 1; i < regData.length; i++) {
    if (String(regData[i][emailCol - 1]).toLowerCase().trim() === creatorEmail) {
      creatorStream = String(regData[i][prepCol - 1] || 'NEET').trim().toUpperCase();
      break;
    }
  }
  
  // 2. Select random questions matching creator's stream and difficulty
  var questions = selectRandomQuestionsForStream(ss, creatorStream, difficulty);
  if (questions.length === 0) {
    return { success: false, message: 'No questions found for stream ' + creatorStream };
  }
  
  var sheet = getOrCreateBattlesSheet(ss);
  var battleId = 'BTL-' + Math.floor(100000 + Math.random() * 900000);
  
  // Columns: Battle ID, Creator Email, Creator Name, Challenger Email, Challenger Name, Series ID, Creator Score, Challenger Score, Status, Timestamp, Difficulty, Questions JSON, Stream
  sheet.appendRow([
    battleId,
    creatorEmail,
    creatorName,
    opponentEmail, // Challenger Email (could be empty)
    '',            // Challenger Name
    'PvP Battle - ' + battleId, // Series ID
    '',            // Creator Score
    '',            // Challenger Score
    'pending',     // Status
    new Date(),
    difficulty,
    JSON.stringify(questions),
    creatorStream
  ]);
  
  return { success: true, battleId: battleId };
}

function acceptBattle(e) {
  var battleId = (e.parameter.battleId || '').trim();
  var challengerEmail = (e.parameter.challengerEmail || '').toLowerCase().trim();
  var challengerName = (e.parameter.challengerName || '').trim();
  
  if (!battleId || !challengerEmail || !challengerName) {
    return { success: false, message: 'Missing parameters.' };
  }
  
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Battles');
  if (!sheet) return { success: false, message: 'Battles sheet not found.' };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === battleId) {
      if (String(data[i][8]).trim() !== 'pending') {
        return { success: false, message: 'Battle is already accepted or completed.' };
      }
      
      // Update Challenger Email (col 4), Challenger Name (col 5), and Status (col 9) to 'active'
      sheet.getRange(i + 1, 4).setValue(challengerEmail);
      sheet.getRange(i + 1, 5).setValue(challengerName);
      sheet.getRange(i + 1, 9).setValue('active');
      return { success: true };
    }
  }
  return { success: false, message: 'Battle ID not found.' };
}

function getBattles(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  if (!email) return { success: false, message: 'Email required.' };
  
  var ss = getActiveSpreadsheet();
  var sheet = getOrCreateBattlesSheet(ss);
  var data = sheet.getDataRange().getValues();
  
  var battles = [];
  for (var i = 1; i < data.length; i++) {
    var bId = String(data[i][0]).trim();
    var cEmail = String(data[i][1]).toLowerCase().trim();
    var cName = String(data[i][2]).trim();
    var chEmail = String(data[i][3]).toLowerCase().trim();
    var chName = String(data[i][4]).trim();
    var sId = String(data[i][5]).trim();
    var cScore = data[i][6] === '' ? null : parseFloat(data[i][6]);
    var chScore = data[i][7] === '' ? null : parseFloat(data[i][7]);
    var status = String(data[i][8]).trim();
    var timestamp = data[i][9];
    var difficulty = String(data[i][10] || 'medium').trim();
    var stream = String(data[i][12] || 'NEET').trim();
    
    if ((chEmail === '' && status === 'pending') || cEmail === email || chEmail === email) {
      battles.push({
        battleId: bId,
        creatorEmail: cEmail,
        creatorName: cName,
        challengerEmail: chEmail,
        challengerName: chName,
        seriesId: sId,
        creatorScore: cScore,
        challengerScore: chScore,
        status: status,
        timestamp: timestamp,
        difficulty: difficulty,
        stream: stream
      });
    }
  }
  
  battles.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  return { success: true, battles: battles };
}

function getOrCreateBattlesSheet(ss) {
  var sheet = ss.getSheetByName('Battles');
  var headers = ['Battle ID', 'Creator Email', 'Creator Name', 'Challenger Email', 'Challenger Name', 'Series ID', 'Creator Score', 'Challenger Score', 'Status', 'Timestamp', 'Difficulty', 'Questions JSON', 'Stream'];
  if (!sheet) {
    sheet = ss.insertSheet('Battles');
    sheet.appendRow(headers);
    var hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setFontWeight('bold');
    hr.setBackground('#cc0000');
    hr.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else {
    var lastCol = sheet.getLastColumn();
    if (lastCol < headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setFontWeight('bold');
      hr.setBackground('#cc0000');
      hr.setFontColor('#ffffff');
    }
  }
  return sheet;
}

function selectRandomQuestionsForStream(ss, stream, difficulty) {
  var masterTabs = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var streamSeriesIds = {};
  
  // Build set of seriesIds for this stream
  masterTabs.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var sIdCol = 0; // Series ID is usually Column A (index 0)
      var examTypeCol = getColumnIndexByName(sheet, 'exam type', 2) - 1;
      
      for (var i = 1; i < data.length; i++) {
        var sId = String(data[i][sIdCol] || '').trim();
        var examType = String(data[i][examTypeCol] || '').trim().toUpperCase();
        if (examType === stream.toUpperCase()) {
          streamSeriesIds[sId] = true;
        }
      }
    }
  });
  
  // Also include prefix fallbacks in case catalog list is empty
  var isNEET = (stream.toUpperCase() === 'NEET');
  
  var qSheet = ss.getSheetByName('Questions');
  if (!qSheet) return [];
  
  var qData = qSheet.getDataRange().getValues();
  // Question columns: Q.No, Question, OptA, OptB, OptC, OptD, Correct, Marks, Negative, Topic, Series ID, Complexity Level (optional)
  var allQuestions = [];
  
  // Parse level number (e.g. "level_5" -> 5)
  var levelNum = 1;
  var levelStr = String(difficulty || 'level 5').toLowerCase().trim();
  var match = levelStr.match(/\d+/);
  if (match) {
    levelNum = parseInt(match[0]) || 1;
  }
  if (levelNum < 1) levelNum = 1;
  if (levelNum > 20) levelNum = 20;
  
  // Determine questions count
  var numQuestions = 10;
  if (levelNum >= 1 && levelNum <= 4) numQuestions = 10;
  else if (levelNum >= 5 && levelNum <= 8) numQuestions = 12;
  else if (levelNum >= 9 && levelNum <= 12) numQuestions = 14;
  else if (levelNum >= 13 && levelNum <= 16) numQuestions = 16;
  else if (levelNum >= 17 && levelNum <= 19) numQuestions = 18;
  else if (levelNum >= 20) numQuestions = 20;
  
  // Complexity Level pool limits (Highly progressive mapping)
  var minLevel = Math.max(1, levelNum - 1);
  var maxLevel = Math.min(20, levelNum + 1);
  
  for (var i = 1; i < qData.length; i++) {
    var qText = String(qData[i][1] || '').trim();
    var optA = String(qData[i][2] || '').trim();
    var optB = String(qData[i][3] || '').trim();
    var optC = String(qData[i][4] || '').trim();
    var optD = String(qData[i][5] || '').trim();
    var correct = String(qData[i][6] || '').trim().toUpperCase();
    var sId = String(qData[i][10] || '').trim();
    var qLevel = parseInt(qData[i][11] || 1); // 12th column is Complexity Level
    
    if (!qText || !optA || !optB || !correct) continue;
    
    var matched = false;
    if (streamSeriesIds[sId]) {
      matched = true;
    } else {
      var prefix = sId.toUpperCase();
      if (isNEET && (prefix.indexOf('N') === 0 || prefix.indexOf('NEET') !== -1)) {
        matched = true;
      } else if (!isNEET && (prefix.indexOf('J') === 0 || prefix.indexOf('JEE') !== -1)) {
        matched = true;
      }
    }
    
    if (matched && qLevel >= minLevel && qLevel <= maxLevel) {
      allQuestions.push({
        questionNumber: qData[i][0] || i,
        question: qText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correct: correct,
        marks: parseFloat(qData[i][7]) || 4,
        negative: parseFloat(qData[i][8]) || -1,
        topic: String(qData[i][9] || 'Arena').trim(),
        seriesId: sId,
        level: qLevel
      });
    }
  }
  
  // Fallback 1: Try wider Complexity Level brackets [levelNum - 3, levelNum + 3]
  if (allQuestions.length < numQuestions) {
    var minLevelWide = Math.max(1, levelNum - 3);
    var maxLevelWide = Math.min(20, levelNum + 3);
    allQuestions = [];
    
    for (var i = 1; i < qData.length; i++) {
      var qText = String(qData[i][1] || '').trim();
      var optA = String(qData[i][2] || '').trim();
      var optB = String(qData[i][3] || '').trim();
      var optC = String(qData[i][4] || '').trim();
      var optD = String(qData[i][5] || '').trim();
      var correct = String(qData[i][6] || '').trim().toUpperCase();
      var sId = String(qData[i][10] || '').trim();
      var qLevel = parseInt(qData[i][11] || 1);
      
      if (!qText || !optA || !optB || !correct) continue;
      
      var matched = false;
      if (streamSeriesIds[sId]) matched = true;
      else {
        var prefix = sId.toUpperCase();
        if (isNEET && (prefix.indexOf('N') === 0 || prefix.indexOf('NEET') !== -1)) matched = true;
        else if (!isNEET && (prefix.indexOf('J') === 0 || prefix.indexOf('JEE') !== -1)) matched = true;
      }
      
      if (matched && qLevel >= minLevelWide && qLevel <= maxLevelWide) {
        allQuestions.push({
          questionNumber: qData[i][0] || i,
          question: qText,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correct: correct,
          marks: parseFloat(qData[i][7]) || 4,
          negative: parseFloat(qData[i][8]) || -1,
          topic: String(qData[i][9] || 'Arena').trim(),
          seriesId: sId,
          level: qLevel
        });
      }
    }
  }
  
  // Fallback 2: Grab all questions for stream regardless of Complexity Level
  if (allQuestions.length < numQuestions) {
    allQuestions = [];
    for (var i = 1; i < qData.length; i++) {
      var qText = String(qData[i][1] || '').trim();
      var optA = String(qData[i][2] || '').trim();
      var optB = String(qData[i][3] || '').trim();
      var optC = String(qData[i][4] || '').trim();
      var optD = String(qData[i][5] || '').trim();
      var correct = String(qData[i][6] || '').trim().toUpperCase();
      var sId = String(qData[i][10] || '').trim();
      var qLevel = parseInt(qData[i][11] || 1);
      
      if (!qText || !optA || !optB || !correct) continue;
      
      var matched = false;
      if (streamSeriesIds[sId]) matched = true;
      else {
        var prefix = sId.toUpperCase();
        if (isNEET && (prefix.indexOf('N') === 0 || prefix.indexOf('NEET') !== -1)) matched = true;
        else if (!isNEET && (prefix.indexOf('J') === 0 || prefix.indexOf('JEE') !== -1)) matched = true;
      }
      
      if (matched) {
        allQuestions.push({
          questionNumber: qData[i][0] || i,
          question: qText,
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correct: correct,
          marks: parseFloat(qData[i][7]) || 4,
          negative: parseFloat(qData[i][8]) || -1,
          topic: String(qData[i][9] || 'Arena').trim(),
          seriesId: sId,
          level: qLevel
        });
      }
    }
  }
  
  if (allQuestions.length === 0) return [];
  
  // Fisher-Yates shuffle to ensure completely randomized, non-repeating question selection
  for (var k = allQuestions.length - 1; k > 0; k--) {
    var j = Math.floor(Math.random() * (k + 1));
    var temp = allQuestions[k];
    allQuestions[k] = allQuestions[j];
    allQuestions[j] = temp;
  }
  
  return allQuestions.slice(0, Math.min(numQuestions, allQuestions.length));
}

function getQuestions(e) {
  var battleId = (e && e.parameter && e.parameter.battleId || '').trim();
  if (battleId) {
    var ss = getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Battles');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === battleId) {
          var questionsJson = String(data[i][11] || '[]').trim();
          var qList = [];
          try {
            qList = JSON.parse(questionsJson);
          } catch (ex) {}
          return { success: true, questions: qList };
        }
      }
    }
    return { success: false, message: 'Battle not found.' };
  }

  var seriesId = (e && e.parameter && e.parameter.seriesId || '').trim();
  var email = (e && e.parameter && e.parameter.email || '').toLowerCase().trim();
  
  var ss = getActiveSpreadsheet();
  
  // Find series info in the Test Series list
  var seriesSheet = ss.getSheetByName('Test Series');
  var isExpired = false;
  var targetSheetName = 'Questions'; // Default sheet is the active "Questions"
  
  if (seriesSheet && seriesId) {
    var seriesData = seriesSheet.getDataRange().getValues();
    var nowTime = new Date().getTime();
    for (var k = 1; k < seriesData.length; k++) {
      var sId = String(seriesData[k][0]).trim();
      if (sId === seriesId) {
        var uploadTimeRaw = seriesData[k][3];
        var uploadTime = new Date(uploadTimeRaw).getTime();
        if (!isNaN(uploadTime)) {
          isExpired = (nowTime - uploadTime) > 24 * 60 * 60 * 1000;
        }
        break;
      }
    }
  }

  // Dynamic Route: if sheet tab with seriesId exists, load from it. Else default to "Questions"
  var isPartitioned = false;
  var baseSheetName = '';
  if (seriesId) {
    var customSheet = ss.getSheetByName(seriesId);
    if (customSheet) {
      targetSheetName = seriesId;
    } else {
      // Check if it's partitioned (e.g. N11-PHY-MEASURE-01 -> N11-PHY-MEASURE)
      var lastHyphenIdx = seriesId.lastIndexOf('-');
      if (lastHyphenIdx !== -1) {
        baseSheetName = seriesId.substring(0, lastHyphenIdx);
        customSheet = ss.getSheetByName(baseSheetName);
        if (customSheet) {
          targetSheetName = baseSheetName;
          isPartitioned = true;
        }
      }
    }
    
    if (!customSheet && isExpired) {
      targetSheetName = seriesId; // Fallback to auto-archive sheet if expired and not partitioned
    }
  }
  
  // If expired, check unlock permission
  if (isExpired) {
    if (!email) {
      return { success: false, locked: true, message: 'Candidate email is required to access expired tests.' };
    }
    // Check Pro Membership (Membership type column is dynamic, default Column O / Col 15)
    var sheet0 = ss.getSheets()[0];
    var data0 = sheet0.getDataRange().getValues();
    var emailCol0 = getColumnIndexByName(sheet0, 'email', 3);
    var membershipCol = getColumnIndexByName(sheet0, 'membership', 15);
    
    var isPro = false;
    for (var i = 1; i < data0.length; i++) {
      var rowEmail = String(data0[i][emailCol0 - 1]).toLowerCase().trim();
      if (rowEmail === email) {
        var membership = String(data0[i][membershipCol - 1] || '').trim().toLowerCase();
        if (membership === 'pro') isPro = true;
        break;
      }
    }
    
    // Check if the series is free in Test Series sheet
    var isFree = false;
    if (seriesSheet && seriesId) {
      var seriesData = seriesSheet.getDataRange().getValues();
      var priceColIdx = getColumnIndexByName(seriesSheet, 'price', 10);
      for (var k = 1; k < seriesData.length; k++) {
        if (String(seriesData[k][0]).trim() === seriesId) {
          var priceVal = String(seriesData[k][priceColIdx - 1] || '7.00').trim().toLowerCase();
          isFree = (priceVal === 'free' || parseFloat(priceVal) === 0);
          break;
        }
      }
    }
    
    var isUnlocked = isPro || isFree;
    if (!isUnlocked) {
      // Check Unlocked Tests
      var unlockSheet = ss.getSheetByName('Unlocked Tests');
      if (unlockSheet) {
        var unlockData = unlockSheet.getDataRange().getValues();
        var now = new Date().getTime();
        for (var j = 1; j < unlockData.length; j++) {
          var uEmail = String(unlockData[j][1]).toLowerCase().trim();
          var uSeriesId = String(unlockData[j][2]).trim();
          var uStatus = String(unlockData[j][3]).trim().toLowerCase();
          var uTime = new Date(unlockData[j][0]).getTime();
          
          if (uEmail === email && uSeriesId === seriesId && uStatus === 'unlocked') {
            if (now - uTime < 2592000000) { // 30 days unlock expiry
              isUnlocked = true;
              break;
            }
          }
        }
      }
    }
    
    if (!isUnlocked) {
      return { success: false, locked: true, message: 'This test series has expired. Please unlock it to proceed.' };
    }
  }
  
  // Fetch from the target sheet (either "Questions" or the archived seriesId sheet)
  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    // Fallback: if archived sheet doesn't exist yet but it's expired, try checking/archiving it first
    if (isExpired && seriesId) {
      autoArchiveExpiredSeries();
      sheet = ss.getSheetByName(seriesId);
    }
    if (!sheet) {
      sheet = ss.getSheetByName('Questions'); // last resort fallback
    }
  }
  
  if (!sheet) return { success: false, message: 'Questions sheet not found.' };
  
  var data = sheet.getDataRange().getValues(); 
  var questions = [];
  
  // Find Series ID column if partitioned
  var headers = data[0];
  var seriesIdColIdx = -1;
  for (var h = 0; h < headers.length; h++) {
    if (String(headers[h]).trim().toLowerCase() === 'series id') {
      seriesIdColIdx = h;
      break;
    }
  }
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][1]) continue;
    
    // Filter by Series ID if partitioned or using shared Questions sheet
    if ((isPartitioned || targetSheetName === 'Questions') && seriesIdColIdx !== -1) {
      var rowSeriesId = String(data[i][seriesIdColIdx]).trim();
      if (rowSeriesId !== seriesId) {
        continue;
      }
    }
    
    // Column J (index 9) is the Topic. We extract it to questions list!
    var topic = String(data[i][9] || 'General').trim();
    questions.push({ 
      no: data[i][0] || i, 
      question: String(data[i][1]).trim(),
      optionA: String(data[i][2] || '').trim(), 
      optionB: String(data[i][3] || '').trim(),
      optionC: String(data[i][4] || '').trim(), 
      optionD: String(data[i][5] || '').trim(),
      correct: String(data[i][6] || '').trim().toUpperCase(), 
      marks: Number(data[i][7]) || 1, 
      negative: Number(data[i][8]) || -0.25,
      topic: topic
    });
  }
  
  if (questions.length === 0) return { success: false, message: 'No questions found.' };
  
  // Update Has Questions status in Test Series sheet to TRUE
  try {
    if (seriesSheet && seriesId) {
      var seriesData = seriesSheet.getDataRange().getValues();
      var hasQuestionsColIdx = getColumnIndexByName(seriesSheet, 'has questions', 11);
      for (var k = 1; k < seriesData.length; k++) {
        if (String(seriesData[k][0]).trim() === seriesId) {
          if (String(seriesData[k][hasQuestionsColIdx - 1]).toUpperCase() !== 'TRUE') {
            seriesSheet.getRange(k + 1, hasQuestionsColIdx).setValue('TRUE');
            // Evict cache so the catalog list updates immediately
            CacheService.getScriptCache().remove("catalog_metadata_v3");
          }
          break;
        }
      }
    }
  } catch(err) {
    Logger.log("Error updating Has Questions status in getQuestions: " + err.message);
  }
  
  return { success: true, questions: questions };
}

// ── EXAM CONFIG: Fetch from "Exam Config" tab ──
function getExamConfig() {
  var ss    = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Exam Config');
  if (!sheet) return { success: false, message: 'Sheet "Exam Config" not found.' };
  var data = sheet.getDataRange().getValues();
  var cfg  = {};
  for (var i = 0; i < data.length; i++) {
    cfg[String(data[i][0]).trim()] = data[i][1];
  }
  return {
    success:   true,
    seriesId:  String(cfg['Series ID']       || '#FX-0001'),
    questions: Number(cfg['Questions']        || 20),
    duration:  Number(cfg['Duration (mins)'] || 30),
    maxMarks:  Number(cfg['Max Marks']        || 20)
  };
}

function saveResponse(e) {
  var ss = getActiveSpreadsheet(); var sheet = ss.getSheetByName('Exam Responses');
  var headers = ['Timestamp','Candidate Name','Email','Phone','Series ID','Score','Correct','Wrong','Skipped','Total Questions','Time Taken','Answers'];
  if (!sheet) {
    sheet = ss.insertSheet('Exam Responses'); sheet.appendRow(headers);
    var hr = sheet.getRange(1,1,1,headers.length); hr.setFontWeight('bold'); hr.setBackground('#1a73e8'); hr.setFontColor('#ffffff'); sheet.setFrozenRows(1);
  } else {
    if (String(sheet.getRange(1,1).getValue()) !== 'Timestamp') {
      sheet.insertRowBefore(1); sheet.getRange(1,1,1,headers.length).setValues([headers]);
      var hr2 = sheet.getRange(1,1,1,headers.length); hr2.setFontWeight('bold'); hr2.setBackground('#1a73e8'); hr2.setFontColor('#ffffff'); sheet.setFrozenRows(1);
    }
  }
  var candidateEmail = (e.parameter.candidateEmail || '').toLowerCase().trim();
  sheet.appendRow([new Date(), e.parameter.candidateName||'', candidateEmail, e.parameter.candidatePhone||'',
    e.parameter.seriesId||'', Number(e.parameter.score||0), Number(e.parameter.correct||0), Number(e.parameter.wrong||0),
    Number(e.parameter.skipped||0), Number(e.parameter.totalQuestions||0), e.parameter.timeTaken||'', e.parameter.answers||'{}']);
  
  // Log entry in "Exam Attempts" sheet
  try {
    var attemptSheet = ss.getSheetByName('Exam Attempts');
    var attemptHeaders = ['Timestamp', 'Series ID', 'Candidate Name', 'Email'];
    if (!attemptSheet) {
      attemptSheet = ss.insertSheet('Exam Attempts'); attemptSheet.appendRow(attemptHeaders);
      var ahr = attemptSheet.getRange(1,1,1,attemptHeaders.length); ahr.setFontWeight('bold'); ahr.setBackground('#34a853'); ahr.setFontColor('#ffffff'); attemptSheet.setFrozenRows(1);
    } else {
      if (String(attemptSheet.getRange(1,1).getValue()) !== 'Timestamp') {
        attemptSheet.insertRowBefore(1); attemptSheet.getRange(1,1,1,attemptHeaders.length).setValues([attemptHeaders]);
        var ahr2 = attemptSheet.getRange(1,1,1,attemptHeaders.length); ahr2.setFontWeight('bold'); ahr2.setBackground('#34a853'); ahr2.setFontColor('#ffffff'); attemptSheet.setFrozenRows(1);
      }
    }
    attemptSheet.appendRow([new Date(), e.parameter.seriesId||'', e.parameter.candidateName||'', candidateEmail]);
  } catch (err) {
    Logger.log('Error saving to Exam Attempts sheet: ' + err.message);
  }

  // Log detailed question responses
  try {
    var detailedSheet = ss.getSheetByName('Detailed Question Responses');
    var detailedHeaders = ['Timestamp', 'Candidate Name', 'Email', 'Phone', 'Series ID', 'Question No', 'Question Text', 'Topic', 'Candidate Response', 'Correct Answer', 'Status'];
    if (!detailedSheet) {
      detailedSheet = ss.insertSheet('Detailed Question Responses'); detailedSheet.appendRow(detailedHeaders);
      var dhr = detailedSheet.getRange(1,1,1,detailedHeaders.length); dhr.setFontWeight('bold'); dhr.setBackground('#673ab7'); dhr.setFontColor('#ffffff'); detailedSheet.setFrozenRows(1);
    } else {
      if (String(detailedSheet.getRange(1,1).getValue()) !== 'Timestamp') {
        detailedSheet.insertRowBefore(1); detailedSheet.getRange(1,1,1,detailedHeaders.length).setValues([detailedHeaders]);
        var dhr2 = detailedSheet.getRange(1,1,1,detailedHeaders.length); dhr2.setFontWeight('bold'); dhr2.setBackground('#673ab7'); dhr2.setFontColor('#ffffff'); detailedSheet.setFrozenRows(1);
      }
    }
    
    var qSheet = ss.getSheetByName('Questions');
    if (qSheet) {
      var qData = qSheet.getDataRange().getValues();
      var parsedAnswers = JSON.parse(e.parameter.answers || '{}');
      var qIndex = 0;
      for (var i = 1; i < qData.length; i++) {
        if (!qData[i][1]) continue;
        var qNo = qData[i][0] || (qIndex + 1);
        var qText = String(qData[i][1]).trim();
        var correctAns = String(qData[i][6] || '').trim().toUpperCase();
        var topic = String(qData[i][9] || 'General').trim();
        
        var candidateAns = parsedAnswers[qIndex];
        var status = '';
        if (candidateAns === undefined || candidateAns === null || candidateAns === '') {
          candidateAns = '';
          status = 'Skipped';
        } else {
          candidateAns = String(candidateAns).trim().toUpperCase();
          status = (candidateAns === correctAns) ? 'Correct' : 'Wrong';
        }
        
        detailedSheet.appendRow([
          new Date(),
          e.parameter.candidateName || '',
          candidateEmail,
          e.parameter.candidatePhone || '',
          e.parameter.seriesId || '',
          qNo,
          qText,
          topic,
          candidateAns,
          correctAns,
          status
        ]);
        qIndex++;
      }
    }
  } catch (err) {
    Logger.log('Error saving detailed question responses: ' + err.message);
  }

  // Save to Battle score if battleId is present
  var battleId = (e.parameter.battleId || '').trim();
  if (battleId) {
    try {
      var bSheet = ss.getSheetByName('Battles');
      if (bSheet) {
        var bData = bSheet.getDataRange().getValues();
        for (var i = 1; i < bData.length; i++) {
          if (String(bData[i][0]).trim() === battleId) {
            var cEmail = String(bData[i][1]).toLowerCase().trim();
            var chEmail = String(bData[i][3]).toLowerCase().trim();
            var scoreVal = parseFloat(e.parameter.score || 0);
            
            if (candidateEmail === cEmail) {
              bSheet.getRange(i + 1, 7).setValue(scoreVal); // Creator Score
            } else if (candidateEmail === chEmail) {
              bSheet.getRange(i + 1, 8).setValue(scoreVal); // Challenger Score
            }
            
            // Check if both scores are now submitted
            var creatorScoreStr = bSheet.getRange(i + 1, 7).getValue();
            var challengerScoreStr = bSheet.getRange(i + 1, 8).getValue();
            
            if (creatorScoreStr !== '' && challengerScoreStr !== '') {
              // Mark complete
              bSheet.getRange(i + 1, 9).setValue('completed');
              
              // Determine winner and award +50 XP bonus
              var cScore = parseFloat(creatorScoreStr) || 0;
              var chScore = parseFloat(challengerScoreStr) || 0;
              
              var winnerEmail = '';
              if (cScore > chScore) {
                winnerEmail = cEmail;
              } else if (chScore > cScore) {
                winnerEmail = chEmail;
              }
              
              if (winnerEmail) {
                var regSheet = ss.getSheets()[0];
                var regData = regSheet.getDataRange().getValues();
                var xpCol = getXPColumn(regSheet);
                var emailCol = getColumnIndexByName(regSheet, 'email', 3);
                for (var j = 1; j < regData.length; j++) {
                  if (String(regData[j][emailCol - 1]).toLowerCase().trim() === winnerEmail) {
                    var currentXp = parseFloat(regData[j][xpCol - 1]) || 100;
                    regSheet.getRange(j + 1, xpCol).setValue(currentXp + 50); // Winner gets +50 XP!
                    break;
                  }
                }
              }
            } else {
              bSheet.getRange(i + 1, 9).setValue('active');
            }
            break;
          }
        }
      }
    } catch (bErr) {
      Logger.log('Error updating battle: ' + bErr.message);
    }
  }

  var xpEarned = parseFloat(e.parameter.xpEarned || 0);
  if (xpEarned !== 0) {
    var regSheet = ss.getSheets()[0]; var regData = regSheet.getDataRange().getValues(); var xpCol = getXPColumn(regSheet);
    var emailCol = getColumnIndexByName(regSheet, 'email', 3);
    for (var i = 1; i < regData.length; i++) {
      if (String(regData[i][emailCol-1]).toLowerCase().trim() === candidateEmail) {
        var newXP = Math.max(0, parseFloat(((parseFloat(regData[i][xpCol-1])||100) + xpEarned).toFixed(2)));
        regSheet.getRange(i+1, xpCol).setValue(newXP); break;
      }
    }
  }
  // Update Unlocked Level if candidate passed PvP level challenge (>= 50% score)
  var levelNum = parseInt(e.parameter.level || 0);
  var scoreVal = parseFloat(e.parameter.score || 0);
  var totalQuestions = parseInt(e.parameter.totalQuestions || 10);
  var newUnlockedLevel = 1;
  
  if (levelNum > 0 && totalQuestions > 0) {
    var isPass = (scoreVal / totalQuestions) >= 0.5;
    if (isPass) {
      var regSheet = ss.getSheets()[0];
      var regData = regSheet.getDataRange().getValues();
      var unlockedCol = getUnlockedLevelColumn(regSheet);
      var emailCol = getColumnIndexByName(regSheet, 'email', 3);
      for (var j = 1; j < regData.length; j++) {
        if (String(regData[j][emailCol - 1]).toLowerCase().trim() === candidateEmail) {
          var currUnlocked = parseInt(regData[j][unlockedCol - 1] || 1);
          if (levelNum >= currUnlocked) {
            newUnlockedLevel = Math.min(20, levelNum + 1);
            regSheet.getRange(j + 1, unlockedCol).setValue(newUnlockedLevel);
          } else {
            newUnlockedLevel = currUnlocked;
          }
          break;
        }
      }
    }
  }
  
  if (newUnlockedLevel === 1) {
    // Look up current unlocked level to return it
    var regSheet = ss.getSheets()[0];
    var regData = regSheet.getDataRange().getValues();
    var unlockedCol = getUnlockedLevelColumn(regSheet);
    var emailCol = getColumnIndexByName(regSheet, 'email', 3);
    for (var j = 1; j < regData.length; j++) {
      if (String(regData[j][emailCol - 1]).toLowerCase().trim() === candidateEmail) {
        newUnlockedLevel = parseInt(regData[j][unlockedCol - 1] || 1);
        break;
      }
    }
  }

  return { success: true, unlockedLevel: newUnlockedLevel };
}

// ── CHECK ATTEMPT: Check if test is already taken once ──
function checkAttempt(e) {
  // Support multiple parameter aliases for email and series
  var email = (e.parameter.email || e.parameter.candidateEmail || e.parameter.emailAddress || '').toLowerCase().trim();
  var seriesId = (e.parameter.seriesId || e.parameter.series || '').trim();

  if (!email || !seriesId)
    return { attempted: false };

  var ss    = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Exam Attempts');

  if (!sheet) return { attempted: false };

  var data = sheet.getDataRange().getValues();

  var emailCol  = getColumnIndexByName(sheet, 'email', 4);
  var seriesCol = getColumnIndexByName(sheet, 'series', 2);

  for (var i = 1; i < data.length; i++) {
    var rowSeries = String(data[i][seriesCol - 1] || '').trim();
    var rowEmail  = String(data[i][emailCol - 1] || '').toLowerCase().trim();
    if (rowEmail === email && rowSeries === seriesId) {
      return { attempted: true, series: seriesId };
    }
  }

  return { attempted: false };
}

// ── PREVENT DUPLICATE REGISTRATION: Check if email or phone is already registered ──
function checkRegistration(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var phone = (e.parameter.phone || '').trim();

  if (!email && !phone) {
    return { success: false, message: 'Please provide email or mobile number to check.' };
  }

  var sheet = getActiveSpreadsheet().getSheets()[0];
  var data  = sheet.getDataRange().getValues();

  var emailCol = getColumnIndexByName(sheet, 'email', 3);
  var phoneCol = getColumnIndexByName(sheet, 'phone', 4);

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailCol - 1] || '').toLowerCase().trim();
    var rowPhone = String(data[i][phoneCol - 1] || '').trim();

    if (email && rowEmail === email) {
      return { success: false, message: 'You are already registered with the same email ID.' };
    }
    if (phone && rowPhone === phone) {
      return { success: false, message: 'You are already registered with the same mobile number.' };
    }
  }

  return { success: true };
}

// ── SAVE REGISTRATION: Register a new candidate directly to the sheet ──
function saveRegistration(e) {
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  
  var fullName = (e.parameter.fullName || '').trim();
  var email = (e.parameter.email || '').toLowerCase().trim();
  var phone = (e.parameter.phone || '').trim();
  var dob = (e.parameter.dob || '').trim();
  var guardianName = (e.parameter.guardianName || '').trim();
  var guardianContact = (e.parameter.guardianContact || '').trim();
  var city = (e.parameter.city || '').trim();
  var qualification = (e.parameter.qualification || '').trim();
  var instituteName = (e.parameter.instituteName || '').trim();
  var pinCode = (e.parameter.pinCode || '').trim();
  var preparation = (e.parameter.preparation || '').trim();
  var referral = (e.parameter.referral || '').trim();
  var xpPoint = 100; // Registration defaults to 100 XP point
  
  if (!fullName || !email || !phone) {
    return { success: false, message: 'Required fields (Full Name, Email Address, and Phone Number) are missing.' };
  }

  // Validate Date of Birth format & values
  if (!dob || !isValidDOBBackend(dob)) {
    return { success: false, message: 'Invalid Date of Birth. Please enter a valid date in DD/MM/YYYY format.' };
  }

  // Validate mobile numbers to prevent fake registrations
  if (isFakePhone(phone)) {
    return { success: false, message: 'Invalid phone number. Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' };
  }
  if (guardianContact && isFakePhone(guardianContact)) {
    return { success: false, message: 'Invalid Father\'s/Guardian\'s contact number. Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' };
  }

  // Verify that the email was successfully verified in the OTPs sheet within the last 15 minutes (900,000 ms)
  var otpSheet = ss.getSheetByName('OTPs');
  var emailVerified = false;
  if (otpSheet) {
    var otpData = otpSheet.getDataRange().getValues();
    var nowTime = new Date().getTime();
    for (var k = otpData.length - 1; k >= 1; k--) {
      var oEmail = String(otpData[k][1]).toLowerCase().trim();
      var oStatus = String(otpData[k][3]).trim();
      var oTime = new Date(otpData[k][0]).getTime();
      if (oEmail === email && oStatus === 'verified') {
        if (nowTime - oTime < 900000) { // 15 mins
          emailVerified = true;
          break;
        }
      }
    }
  }
  if (!emailVerified) {
    return { success: false, message: 'Your email address is not verified. Please verify it using OTP first.' };
  }
  
  // Prevent duplicate email/phone check (similar to checkRegistration)
  var data = sheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(sheet, 'email', 3);
  var phoneCol = getColumnIndexByName(sheet, 'phone', 4);
  var xpCol = getXPColumn(sheet);
  
  // Verify referral exists in the registered phone numbers
  var referrerRowIdx = -1;
  if (referral) {
    var cleanReferral = referral.replace(/[^0-9]/g, '');
    for (var i = 1; i < data.length; i++) {
      var rowPhone = String(data[i][phoneCol - 1] || '').replace(/[^0-9]/g, '');
      if (rowPhone && cleanReferral && rowPhone.indexOf(cleanReferral) !== -1 || cleanReferral.indexOf(rowPhone) !== -1) {
        if (rowPhone.length >= 10 && cleanReferral.length >= 10) {
          referrerRowIdx = i + 1; // 1-indexed row number
          break;
        }
      }
    }
    if (referrerRowIdx === -1) {
      return { success: false, message: 'Referrer mobile number is not registered. Please enter a valid registered mobile number or leave it blank.' };
    }
  }
  
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailCol - 1] || '').toLowerCase().trim();
    var rowPhone = String(data[i][phoneCol - 1] || '').trim();
    if (email && rowEmail === email) {
      return { success: false, message: 'You are already registered with the same email ID.' };
    }
    if (phone && rowPhone === phone) {
      return { success: false, message: 'You are already registered with the same mobile number.' };
    }
  }
  
  // Header order: Timestamp, Full Name, Email Address, Phone Number, Date of Birth, Father's / Guardian's Name, Father's / Guardian's Contact Number, City, Qualification, Institute Name, Pin Code, Preparation For, If Any Referral, XP Point, Referral XP
  var headers = [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Date of Birth',
    "Father's / Guardian's Name",
    "Father's / Guardian's Contact Number",
    'City',
    'Qualification',
    'Institute Name',
    'Pin Code',
    'Preparation For',
    'If Any Referral',
    'XP Point',
    'Referral XP'
  ];
  
  // If the sheet is completely empty, setup the headers
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var hr = sheet.getRange(1, 1, 1, headers.length);
    hr.setFontWeight('bold');
    hr.setBackground('#1a73e8');
    hr.setFontColor('#ffffff');
  } else {
    // If headers exist, let's verify if they match our desired order, if not, write/align them
    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var match = true;
    for (var j = 0; j < headers.length; j++) {
      if (j >= existingHeaders.length || String(existingHeaders[j]).trim().toLowerCase() !== headers[j].toLowerCase()) {
        match = false;
        break;
      }
    }
    // Only rewrite headers if there are no rows or they don't match, to preserve existing data structure
    if (!match && sheet.getLastRow() === 1) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var hr2 = sheet.getRange(1, 1, 1, headers.length);
      hr2.setFontWeight('bold');
      hr2.setBackground('#1a73e8');
      hr2.setFontColor('#ffffff');
    }
  }
  
  sheet.appendRow([
    new Date(),
    fullName,
    email,
    phone,
    dob,
    guardianName,
    guardianContact,
    city,
    qualification,
    instituteName,
    pinCode,
    preparation,
    referral,
    xpPoint,
    0 // Referral XP default is 0
  ]);
  
  // Award Referral bonus of +100 XP to referrer if referral is verified
  if (referrerRowIdx !== -1) {
    try {
      var refXpCol = getReferralXPColumn(sheet);
      var referrerXP = parseFloat(sheet.getRange(referrerRowIdx, xpCol).getValue()) || 100;
      sheet.getRange(referrerRowIdx, xpCol).setValue(referrerXP + 100);
      var referrerRefXP = parseFloat(sheet.getRange(referrerRowIdx, refXpCol).getValue()) || 0;
      sheet.getRange(referrerRowIdx, refXpCol).setValue(referrerRefXP + 100);
    } catch (err) {
      Logger.log('Error adding referral bonus: ' + err.message);
    }
  }
  
  return { success: true, message: 'Registration successful!' };
}

// ── SEND OTP: Generates and emails a 6-digit verification code
function sendOTP(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var phone = (e.parameter.phone || '').trim();
  if (!email) return { success: false, message: 'Email address is required.' };
  
  var ss = getActiveSpreadsheet();
  
  // Check if email or mobile number is already registered in the responses sheet
  var regSheet = ss.getSheets()[0];
  var regData = regSheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(regSheet, 'email', 3);
  var phoneCol = getColumnIndexByName(regSheet, 'phone', 4);
  for (var i = 1; i < regData.length; i++) {
    var rowEmail = String(regData[i][emailCol - 1] || '').toLowerCase().trim();
    var rowPhone = String(regData[i][phoneCol - 1] || '').trim();
    if (email && rowEmail === email) {
      return { success: false, message: 'This email address is already registered. Please login or use a different email.' };
    }
    if (phone && rowPhone === phone) {
      return { success: false, message: 'This mobile number is already registered. Please login or use a different mobile number.' };
    }
  }
  
  // Generate 6-digit OTP
  var otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  var sheet = ss.getSheetByName('OTPs');
  if (!sheet) {
    sheet = ss.insertSheet('OTPs');
    sheet.appendRow(['Timestamp', 'Email', 'OTP', 'Status']);
    var hr = sheet.getRange(1, 1, 1, 4);
    hr.setFontWeight('bold');
    hr.setBackground('#ea4335');
    hr.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  
  // Save OTP in the sheet
  sheet.appendRow([new Date(), email, otp, 'pending']);
  
  // Send email
  try {
    var subject = "Verify your email address - Futrix Exam Portal";
    
    var htmlBody = "<div style=\"background-color:#f8fafc;padding:30px 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">" +
                   "  <div style=\"max-width:480px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -1px rgba(0,0,0,0.03);\">" +
                   "    <div style=\"background-color:#1e3a8a;padding:24px;text-align:center;\">" +
                   "      <h1 style=\"color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;\">FUTRIX</h1>" +
                   "      <p style=\"color:#93c5fd;margin:4px 0 0 0;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;\">Pilot Exam Portal</p>" +
                   "    </div>" +
                   "    <div style=\"padding:30px 24px;\">" +
                   "      <p style=\"font-size:16px;color:#1e293b;margin:0 0 16px 0;line-height:1.5;\">Hello Pilot,</p>" +
                   "      <p style=\"font-size:14px;color:#475569;margin:0 0 24px 0;line-height:1.6;\">Thank you for initiating your registration at the Futrix Pilot Portal. To verify your email address, please enter the one-time verification code below:</p>" +
                   "      <div style=\"text-align:center;margin:24px 0;padding:16px;background-color:#f1f5f9;border-radius:12px;\">" +
                   "        <span style=\"font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;color:#1e3a8a;letter-spacing:6px;display:inline-block;padding-left:6px;\">" + otp + "</span>" +
                   "      </div>" +
                   "      <p style=\"font-size:12px;color:#64748b;margin:0 0 24px 0;line-height:1.5;text-align:center;\">This verification code is valid for 10 minutes. For security reasons, please do not share this code with anyone.</p>" +
                   "      <div style=\"border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;\">" +
                   "        <p style=\"font-size:11px;color:#94a3b8;margin:0;line-height:1.6;\">This is an automated security notification from Futrix.<br>If you did not request this code, you can safely ignore this email.</p>" +
                   "      </div>" +
                   "    </div>" +
                   "    <div style=\"background-color:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;\">" +
                   "      <p style=\"font-size:10px;color:#94a3b8;margin:0;\">&copy; 2026 Futrix Exam Portal. All rights reserved.</p>" +
                   "    </div>" +
                   "  </div>" +
                   "</div>";
                   
    var sent = sendEmailViaProvider(email, subject, otp, htmlBody);
    if (sent) {
      return { success: true, message: 'OTP sent successfully to your email.' };
    } else {
      return { success: false, message: 'Failed to dispatch email verification. Please check settings.' };
    }
  } catch (err) {
    return { success: false, message: 'Error sending email: ' + err.message };
  }
}

// ── EMAIL PROVIDER ROUTER: Dispatches the email based on the configured service
function sendEmailViaProvider(email, subject, otp, htmlBody) {
  var service = EMAIL_SERVICE.toUpperCase().trim();
  
  if (service === "BREVO" && BREVO_API_KEY && BREVO_API_KEY !== "YOUR_BREVO_API_KEY_HERE") {
    var url = "https://api.brevo.com/v3/smtp/email";
    var payload = {
      sender: { name: "FUTRIX Pilot Portal", email: SENDER_EMAIL },
      to: [{ email: email }],
      subject: subject,
      htmlContent: htmlBody
    };
    var options = {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
        "accept": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var resCode = response.getResponseCode();
    if (resCode === 200 || resCode === 201) return true;
    Logger.log("Brevo API Error: " + response.getContentText());
  } 
  
  if (service === "RESEND" && RESEND_API_KEY && RESEND_API_KEY !== "YOUR_RESEND_API_KEY_HERE") {
    var url = "https://api.resend.com/emails";
    var payload = {
      from: "FUTRIX <onboarding@resend.dev>",
      to: [email],
      subject: subject,
      html: htmlBody
    };
    var options = {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var resCode = response.getResponseCode();
    if (resCode === 200 || resCode === 201) return true;
    Logger.log("Resend API Error: " + response.getContentText());
  }

  // Fallback to standard GmailApp
  var plainText = "Hello Pilot,\n\nYour email verification code for FUTRIX is: " + otp + "\n\nThis code is valid for 10 minutes.";
  GmailApp.sendEmail(email, subject, plainText, {
    name: "FUTRIX Pilot Portal",
    htmlBody: htmlBody
  });
  return true;
}

// ── DATE OF BIRTH VALIDATION: Strict format & calendar checks
function isValidDOBBackend(dobStr) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)) return false;
  var parts = dobStr.split('/');
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  
  var currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return false;
  if (month < 1 || month > 12) return false;
  
  var isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  var monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  if (day < 1 || day > monthDays[month - 1]) return false;
  
  var today = new Date();
  var birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) {
    return false;
  }
  if (birthDate > today) return false;
  
  return true;
}

// ── PHONE VALIDATION: Validates Indian mobile number format & prevents dummy numbers
function isFakePhone(phone) {
  if (!phone) return true;
  var clean = phone.replace(/[^0-9]/g, '');
  if (clean.length !== 10) return true;
  if (!/^[6-9]/.test(clean)) return true;
  if (/(\d)\1{4,}/.test(clean)) return true;
  if (/^(\d{2})\1{4}$/.test(clean)) return true;
  if (/^(\d{3})\1{2}\d$/.test(clean)) return true;
  
  var sequentialUp = "0123456789";
  var sequentialDown = "9876543210";
  if (sequentialUp.indexOf(clean) !== -1 || sequentialDown.indexOf(clean) !== -1) return true;
  
  var testPatterns = [
    "1234512345", "9876598765", "6789067890", "1234567890", "0123456789", 
    "9876543210", "8765432109", "7654321098", "6543210987", "5432109876"
  ];
  if (testPatterns.indexOf(clean) !== -1) return true;
  
  return false;
}

// ── VERIFY OTP: Validates the entered OTP code
function verifyOTP(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var otp = (e.parameter.otp || '').trim();
  if (!email || !otp) return { success: false, message: 'Email and OTP are required.' };
  
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('OTPs');
  if (!sheet) return { success: false, message: 'No OTP records found.' };
  
  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();
  
  // Search from the end to get the latest OTP
  for (var i = data.length - 1; i >= 1; i--) {
    var rowEmail = String(data[i][1]).toLowerCase().trim();
    var rowOtp = String(data[i][2]).trim();
    var rowStatus = String(data[i][3]).trim();
    var rowTime = new Date(data[i][0]).getTime();
    
    if (rowEmail === email && rowOtp === otp) {
      if (rowStatus === 'verified') {
        return { success: true, message: 'Email already verified.' };
      }
      // Check if OTP is less than 10 minutes old (600,000 ms)
      if (now - rowTime < 600000) {
        sheet.getRange(i + 1, 4).setValue('verified');
        return { success: true, message: 'Email verified successfully!' };
      } else {
        return { success: false, message: 'OTP has expired. Please request a new one.' };
      }
    }
  }
  return { success: false, message: 'Invalid OTP code. Please try again.' };
}

// ── AUTHORIZE SCRIPT: Run this function once in the Apps Script Editor to trigger the OAuth Permission dialog
function authorizeScript() {
  Logger.log("Requesting authorization for email sending...");
  try {
    var email = Session.getActiveUser().getEmail();
    if (email) {
      GmailApp.sendEmail(email, "FUTRIX Pilot Portal - Authorization Success", "Your Google Apps Script has been successfully authorized to send email verification OTPs using GmailApp!");
      Logger.log("Test email sent to " + email);
    }
  } catch(e) {
    Logger.log("Authorization prompt triggered successfully.");
  }
}

function checkAndSetupSheets() {
  var ss = getActiveSpreadsheet();
  
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var headers = ['Series ID', 'Exam Type', 'Topic/Chapter', 'Upload Time', 'Duration (mins)', 'XP Reward', 'Max Marks', 'Status', 'Test Type', 'Price', 'Has Questions'];
  
  for (var tIdx = 0; tIdx < MASTER_TABS.length; tIdx++) {
    var sheet = ss.getSheetByName(MASTER_TABS[tIdx]);
    if (!sheet) {
      sheet = ss.insertSheet(MASTER_TABS[tIdx]);
      sheet.appendRow(headers);
      var hr = sheet.getRange(1, 1, 1, headers.length);
      hr.setFontWeight('bold').setBackground('#4d8eff').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
  
  // 2. Setup Unlocked Tests Sheet
  var unlockSheet = ss.getSheetByName('Unlocked Tests');
  if (!unlockSheet) {
    unlockSheet = ss.insertSheet('Unlocked Tests');
    var unlockHeaders = ['Timestamp', 'Email', 'Series ID', 'Status'];
    unlockSheet.appendRow(unlockHeaders);
    var hr = unlockSheet.getRange(1, 1, 1, unlockHeaders.length);
    hr.setFontWeight('bold').setBackground('#2e7d32').setFontColor('#ffffff');
    unlockSheet.setFrozenRows(1);
  }
  
  // 3. Setup Payments Sheet
  var paySheet = ss.getSheetByName('Payments');
  if (!paySheet) {
    paySheet = ss.insertSheet('Payments');
    var payHeaders = ['Timestamp', 'Candidate Name', 'Email', 'Phone', 'Series ID / Package', 'Amount Paid', 'Transaction ID / UTR', 'Sender UPI ID', 'Status'];
    paySheet.appendRow(payHeaders);
    var hr = paySheet.getRange(1, 1, 1, payHeaders.length);
    hr.setFontWeight('bold').setBackground('#ef6c00').setFontColor('#ffffff');
    paySheet.setFrozenRows(1);
  }
  
  // 4. Verify Membership column header on first sheet
  var sheet0 = ss.getSheets()[0];
  var membershipCol = getColumnIndexByName(sheet0, 'membership', 0);
  if (membershipCol === 0) {
    var lastCol = sheet0.getLastColumn();
    var newCol = Math.max(15, lastCol + 1);
    if (sheet0.getMaxColumns() < newCol) {
      sheet0.insertColumnsAfter(sheet0.getMaxColumns(), newCol - sheet0.getMaxColumns());
    }
    sheet0.getRange(1, newCol).setValue('Membership');
    sheet0.getRange(1, newCol).setFontWeight('bold');
  }

  // 5. Setup consolidated Questions Sheet
  var questionsSheet = ss.getSheetByName('Questions');
  if (!questionsSheet) {
    questionsSheet = ss.insertSheet('Questions');
    var qHeaders = ['Question No', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option', 'Marks', 'Negative Marks', 'Topic', 'Series ID'];
    questionsSheet.appendRow(qHeaders);
    var hr = questionsSheet.getRange(1, 1, 1, qHeaders.length);
    hr.setFontWeight('bold').setBackground('#1565c0').setFontColor('#ffffff');
    questionsSheet.setFrozenRows(1);
  }
 
  // 6. Ensure Series ID column exists on all syllabus sheets
  ensureSeriesIdColumnInAllSheets();
}

function ensureSeriesIdColumnInAllSheets() {
  var ss = getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var systemSheets = ['Test Series', 'Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series', 'Unlocked Tests', 'Payments', 'OTPs', 'Exam Config', 'Exam Responses', 'Exam Attempts', 'Detailed Question Responses'];
  
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    
    // Skip config / responses / logs sheets
    if (systemSheets.indexOf(sheetName) !== -1 || sheet === sheets[0]) {
      continue;
    }
    
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var hasSeriesId = false;
      for (var j = 0; j < headers.length; j++) {
        if (String(headers[j]).trim().toLowerCase() === 'series id') {
          hasSeriesId = true;
          break;
        }
      }
      if (!hasSeriesId) {
        var newCol = lastCol + 1;
        sheet.getRange(1, newCol).setValue('Series ID');
        sheet.getRange(1, newCol).setFontWeight('bold');
      }
    }
  }
}

// ── EXPIRY AND AUTOMATED ARCHIVING ENGINE
function autoArchiveExpiredSeries() {
  var ss = getActiveSpreadsheet();
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var now = new Date().getTime();
  
  var idCol = 1;      // Col A
  var timeCol = 4;    // Col D
  var statusCol = 8;  // Col H
  var questionsSheet = ss.getSheetByName('Questions');
  
  for (var tIdx = 0; tIdx < MASTER_TABS.length; tIdx++) {
    var seriesSheet = ss.getSheetByName(MASTER_TABS[tIdx]);
    if (!seriesSheet) continue;
    
    var data = seriesSheet.getDataRange().getValues();
    var hasQuestionsColIdx = getColumnIndexByName(seriesSheet, 'has questions', 11);
    var modified = false;
    
    for (var i = 1; i < data.length; i++) {
      var seriesId = String(data[i][idCol - 1]).trim();
      var uploadTimeRaw = data[i][timeCol - 1];
      var status = String(data[i][statusCol - 1]).trim().toLowerCase();
      
      if (!seriesId || !uploadTimeRaw) continue;
      
      var uploadTime = new Date(uploadTimeRaw).getTime();
      if (isNaN(uploadTime)) continue;
      
      var isExpired = (now - uploadTime) > 24 * 60 * 60 * 1000; // > 24 hours
      
      if (isExpired && status !== 'archived') {
        var hasQVal = String(data[i][hasQuestionsColIdx - 1] || 'FALSE').trim().toUpperCase();
        var hasQuestions = (hasQVal === 'TRUE' || hasQVal === 'Y' || hasQVal === 'YES');
        if (!hasQuestions) continue;
        
        data[i][statusCol - 1] = 'archived';
        modified = true;
      }
    }
    
    if (modified) {
      var statusRange = seriesSheet.getRange(2, statusCol, data.length - 1, 1);
      var statusValues = [];
      for (var j = 1; j < data.length; j++) {
        statusValues.push([data[j][statusCol - 1]]);
      }
      statusRange.setValues(statusValues);
    }
  }
}

// Helper to detect which series IDs actually have questions uploaded in the spreadsheet
function detectQuestionsExistence(ss, sheetsMap) {
  var existenceMap = {};
  
  // 1. Check all sheet objects in the spreadsheet
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    var lastRow = sheets[i].getLastRow();
    if (lastRow > 1) {
      existenceMap[name] = true;
    }
  }
  
  // 2. Scan "Questions" sheet if it exists
  var questionsSheet = sheetsMap['Questions'];
  if (questionsSheet && questionsSheet.getLastRow() > 1) {
    var lastRow = questionsSheet.getLastRow();
    var lastCol = questionsSheet.getLastColumn();
    var headers = questionsSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var seriesIdColIdx = -1;
    for (var h = 0; h < headers.length; h++) {
      if (String(headers[h]).trim().toLowerCase() === 'series id') {
        seriesIdColIdx = h + 1;
        break;
      }
    }
    if (seriesIdColIdx !== -1) {
      var vals = questionsSheet.getRange(2, seriesIdColIdx, lastRow - 1, 1).getValues();
      for (var r = 0; r < vals.length; r++) {
        var sId = String(vals[r][0]).trim();
        if (sId) {
          existenceMap[sId] = true;
        }
      }
    }
  }
  
  // 3. Scan non-system sheets that contain a 'Series ID' column (like partitioned base syllabus sheets)
  var systemSheets = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series', 'Unlocked Tests', 'Payments', 'OTPs', 'Exam Config', 'Exam Responses', 'Exam Attempts', 'Detailed Question Responses', 'Questions', 'Test Series'];
  for (var name in sheetsMap) {
    if (systemSheets.indexOf(name) !== -1) continue;
    var sheet = sheetsMap[name];
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var seriesIdColIdx = -1;
      for (var h = 0; h < headers.length; h++) {
        if (String(headers[h]).trim().toLowerCase() === 'series id') {
          seriesIdColIdx = h + 1;
          break;
        }
      }
      if (seriesIdColIdx !== -1) {
        var vals = sheet.getRange(2, seriesIdColIdx, lastRow - 1, 1).getValues();
        for (var r = 0; r < vals.length; r++) {
          var sId = String(vals[r][0]).trim();
          if (sId) {
            existenceMap[sId] = true;
          }
        }
      }
    }
  }
  
  return existenceMap;
}

// ── GET DYNAMIC SERIES CATALOG WITH EXPIRY STATUS
function getSeriesList(e) {
  var ss = getActiveSpreadsheet();
  var sheets = ss.getSheets();
  
  // Build a map of sheet names to sheet objects in one sweep
  var sheetsMap = {};
  for (var i = 0; i < sheets.length; i++) {
    sheetsMap[sheets[i].getName()] = sheets[i];
  }
  
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var unlockSheet = sheetsMap['Unlocked Tests'];
  var paySheet = sheetsMap['Payments'];
  
  // Verify main system sheets exist
  var systemCheckFailed = false;
  for (var mIdx = 0; mIdx < MASTER_TABS.length; mIdx++) {
    if (!sheetsMap[MASTER_TABS[mIdx]]) {
      systemCheckFailed = true;
      break;
    }
  }
  if (systemCheckFailed || !unlockSheet || !paySheet) {
    checkAndSetupSheets();
    // Refresh sheets and map after setup
    sheets = ss.getSheets();
    sheetsMap = {};
    for (var i = 0; i < sheets.length; i++) {
      sheetsMap[sheets[i].getName()] = sheets[i];
    }
    unlockSheet = sheetsMap['Unlocked Tests'];
  }
  
  // Throttle autoArchiveExpiredSeries to run at most once every 5 minutes (300 seconds)
  var cache = CacheService.getScriptCache();
  var lastArchive = cache.get("last_archive");
  if (!lastArchive) {
    autoArchiveExpiredSeries();
    cache.put("last_archive", "done", 300); // 5 minutes caching
  }
  
  var email = (e.parameter.email || '').toLowerCase().trim();
  
  // 1. Get Membership Status (Check Pro)
  var sheet0 = sheets[0];
  var data0 = sheet0.getDataRange().getValues();
  var emailCol0 = getColumnIndexByName(sheet0, 'email', 3);
  var membershipCol = getColumnIndexByName(sheet0, 'membership', 15);
  
  var isPro = false;
  for (var i = 1; i < data0.length; i++) {
    var rowEmail = String(data0[i][emailCol0 - 1]).toLowerCase().trim();
    if (rowEmail === email) {
      var membership = String(data0[i][membershipCol - 1] || '').trim().toLowerCase();
      if (membership === 'pro') {
        isPro = true;
      }
      break;
    }
  }
  
  // 2. Get Unlocked Series IDs (valid for 30 days)
  var unlockedIds = [];
  if (unlockSheet) {
    var unlockData = unlockSheet.getDataRange().getValues();
    var now = new Date().getTime();
    for (var j = 1; j < unlockData.length; j++) {
      var uEmail = String(unlockData[j][1]).toLowerCase().trim();
      var uSeriesId = String(unlockData[j][2]).trim();
      var uStatus = String(unlockData[j][3]).trim().toLowerCase();
      var uTime = new Date(unlockData[j][0]).getTime();
      
      if (uEmail === email && uStatus === 'unlocked') {
        if (now - uTime < 2592000000) { // 30 days limit
          unlockedIds.push(uSeriesId);
        }
      }
    }
  }
  
  // 3. Gather series metadata (Read directly from sheets for real-time freshness)
  var cachedSeries = [];
  
  var existenceMap = detectQuestionsExistence(ss, sheetsMap);
  
  for (var tIdx = 0; tIdx < MASTER_TABS.length; tIdx++) {
    var seriesSheet = sheetsMap[MASTER_TABS[tIdx]];
    if (!seriesSheet) continue;
    
    var seriesData = seriesSheet.getDataRange().getValues();
    var priceColIdx = getColumnIndexByName(seriesSheet, 'price', 10);
    var hasQuestionsColIdx = getColumnIndexByName(seriesSheet, 'has questions', 11);
    
    var hasQuestionsValues = [];
    var modified = false;
    
    for (var k = 1; k < seriesData.length; k++) {
      var seriesId = String(seriesData[k][0]).trim();
      var examType = String(seriesData[k][1]).trim();
      var topic = String(seriesData[k][2]).trim();
      var uploadTimeRaw = seriesData[k][3];
      var duration = Number(seriesData[k][4]) || 30;
      var xpReward = Number(seriesData[k][5]) || 100;
      var maxMarks = Number(seriesData[k][6]) || 100;
      var testType = String(seriesData[k][8] || 'topic').trim().toLowerCase();
      
      var priceVal = String(seriesData[k][priceColIdx - 1] || '7.00').trim().toLowerCase();
      var isFree = (priceVal === 'free' || parseFloat(priceVal) === 0);
      var basePriceNum = isFree ? 0 : (parseFloat(priceVal) || 7.00);
      
      if (!seriesId) {
        hasQuestionsValues.push(['FALSE']);
        continue;
      }
      
      // Compute hasQuestions dynamically in real-time
      var hasQuestions = !!existenceMap[seriesId];
      hasQuestionsValues.push([hasQuestions ? 'TRUE' : 'FALSE']);
      
      var originalHasQVal = String(seriesData[k][hasQuestionsColIdx - 1] || 'FALSE').trim().toUpperCase();
      var originalHasQ = (originalHasQVal === 'TRUE' || originalHasQVal === 'Y' || originalHasQVal === 'YES');
      
      if (hasQuestions !== originalHasQ) {
        modified = true;
      }
      
      cachedSeries.push({
        seriesId: seriesId,
        examType: examType,
        topic: topic,
        uploadTime: uploadTimeRaw,
        duration: duration,
        xpReward: xpReward,
        maxMarks: maxMarks,
        testType: testType,
        price: basePriceNum.toFixed(2),
        isFree: isFree,
        hasQuestions: hasQuestions
      });
    }
    
    // Batch update the spreadsheet column only if there was a status change
    if (hasQuestionsValues.length > 0 && modified) {
      seriesSheet.getRange(2, hasQuestionsColIdx, hasQuestionsValues.length, 1).setValues(hasQuestionsValues);
    }
  }
  
  // 4. Calculate dynamic expiry and user unlock states
  var finalSeriesList = [];
  var nowTime = new Date().getTime();
  
  for (var s = 0; s < cachedSeries.length; s++) {
    var item = cachedSeries[s];
    
    var uploadTime = new Date(item.uploadTime).getTime();
    var isExpired = false;
    if (!isNaN(uploadTime)) {
      isExpired = (nowTime - uploadTime) > 24 * 60 * 60 * 1000;
    }
    
    var isUnlocked = isPro || item.isFree || !isExpired || (unlockedIds.indexOf(item.seriesId) !== -1);
    
    finalSeriesList.push({
      seriesId: item.seriesId,
      examType: item.examType,
      topic: item.topic,
      uploadTime: item.uploadTime,
      duration: item.duration,
      xpReward: item.xpReward,
      maxMarks: item.maxMarks,
      testType: item.testType,
      isExpired: isExpired,
      isUnlocked: isUnlocked,
      hasQuestions: item.hasQuestions,
      price: item.price,
      isFree: item.isFree
    });
  }
  
  return { success: true, isPro: isPro, series: finalSeriesList };
}

// ── ONE-CLICK SYLLABUS SHEET INITIALIZER
function setupSyllabusSheets() {
  var ss = getActiveSpreadsheet();
  checkAndSetupSheets(); // Ensure main sheets exist
  
  var existingSeriesIds = {};
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  
  for (var mIdx = 0; mIdx < MASTER_TABS.length; mIdx++) {
    var mSheet = ss.getSheetByName(MASTER_TABS[mIdx]);
    if (mSheet) {
      var mData = mSheet.getDataRange().getValues();
      for (var i = 1; i < mData.length; i++) {
        existingSeriesIds[String(mData[i][0]).trim()] = true;
      }
    }
  }
  
  var syllabus = [
    { id: 'N11-PHY-MEASURE', type: 'NEET', topic: 'Cosmic Scale: Units & Measurements', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-LINE', type: 'NEET', topic: 'Linear Velocity: Motion in a Straight Line', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-PLANE', type: 'NEET', topic: 'Vector Flight: Motion in a Plane', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-LAWS', type: 'NEET', topic: 'Newtonian Mechanics: Laws of Motion', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-WORK', type: 'NEET', topic: 'Energy Flow: Work, Energy & Power', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-ROT', type: 'NEET', topic: 'Torque & Spin: Rotational Motion', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-GRAV', type: 'NEET', topic: 'Orbits & Gravity: Gravitation', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-BULK', type: 'NEET', topic: 'Matter Dynamics: Properties of Bulk Matter', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-THERMO', type: 'NEET', topic: 'Thermal Power: Thermodynamics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-PHY-WAVES', type: 'NEET', topic: 'Harmonic Symphony: Oscillations & Waves', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-BASIC', type: 'NEET', topic: 'Mole Concept Mastery: Basic Chemistry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-ATOM', type: 'NEET', topic: 'Quantum Shells: Structure of Atom', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-PERIODIC', type: 'NEET', topic: 'Periodic Rhythms: Classification of Elements', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-BOND', type: 'NEET', topic: 'Valence Bonds: Chemical Bonding', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-THERMO', type: 'NEET', topic: 'Enthalpy & Entropy: Chemical Thermodynamics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-EQUIL', type: 'NEET', topic: 'Le Chatelier\'s Balance: Equilibrium', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-REDOX', type: 'NEET', topic: 'Electron Transfer: Redox Reactions', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-ORG', type: 'NEET', topic: 'Carbon Chemistry: Basic Principles', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-CHE-HYDRO', type: 'NEET', topic: 'Alkanes & Alkynes: Hydrocarbons', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-BIO-DIVERSITY', type: 'NEET', topic: 'Kingdom of Life: Diversity in Living World', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-BIO-STRUCT', type: 'NEET', topic: 'Tissues & Organs: Biological Structure', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-BIO-CELL', type: 'NEET', topic: 'Cell Engine: Cell Structure & Function', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-BIO-PLANT', type: 'NEET', topic: 'Botanical Energy: Plant Physiology', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N11-BIO-HUMAN', type: 'NEET', topic: 'Vital Systems: Human Physiology', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-ELECTRO', type: 'NEET', topic: 'Electric Fields: Electrostatics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-CURRENT', type: 'NEET', topic: 'Charge Current: Current Electricity', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-MAGNET', type: 'NEET', topic: 'Lorentz Forces: Current Magnetism', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-EMI', type: 'NEET', topic: 'Induction Sparks: EMI & Alternating Current', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-EMW', type: 'NEET', topic: 'Spectrum Radiance: Electromagnetic Waves', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-OPTICS', type: 'NEET', topic: 'Ray & Wave Optics: Visual Spectrum', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-DUAL', type: 'NEET', topic: 'Wave-Particle Dualism: Matter & Light', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-ATOMS', type: 'NEET', topic: 'Nuclear Fusion: Atoms & Nuclei', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-PHY-DEVICES', type: 'NEET', topic: 'Semiconductors: Electronic Devices', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-SOL', type: 'NEET', topic: 'Solvent Mixtures: Chemical Solutions', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-ELECTRO', type: 'NEET', topic: 'Nernst Potential: Electrochemistry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-KINETICS', type: 'NEET', topic: 'Reaction Rates: Chemical Kinetics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-PBLOCK', type: 'NEET', topic: 'P-Block Chemistry: Main Group Elements', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-DFBLOCK', type: 'NEET', topic: 'Inner Transition: D- & F-Block Elements', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-COORD', type: 'NEET', topic: 'Ligand Complexes: Coordination Chemistry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-HALO', type: 'NEET', topic: 'Halogen Derivatives: Haloalkanes', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-ALCOHOL', type: 'NEET', topic: 'Oxygen Compounds: Alcohols & Ethers', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-CARBO', type: 'NEET', topic: 'Carbonyls: Aldehydes & Acids', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-AMINES', type: 'NEET', topic: 'Nitrogen Base: Amines', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-CHE-BIOMOL', type: 'NEET', topic: 'Life Molecules: Biomolecules', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-BIO-REPRO', type: 'NEET', topic: 'Generations of Life: Reproduction', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-BIO-GENETICS', type: 'NEET', topic: 'DNA Blueprint: Genetics & Evolution', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-BIO-WELFARE', type: 'NEET', topic: 'Microbe Wars: Biology & Human Welfare', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-BIO-BIOTECH', type: 'NEET', topic: 'Gene Splice: Biotechnology & Applications', duration: 15, marks: 15, testType: 'topic' },
    { id: 'N12-BIO-ECOLOGY', type: 'NEET', topic: 'Biosphere: Ecology & Environment', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-BASIC', type: 'JEE', topic: 'Mole Metrics: Physical Chemistry Basics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-ATOM', type: 'JEE', topic: 'Orbit Shells: JEE Atomic Structure', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-BOND', type: 'JEE', topic: 'Lattice Enthalpy: Chemical Bonding', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-THERMO', type: 'JEE', topic: 'Hess\'s Law: Chemical Thermodynamics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-SOL', type: 'JEE', topic: 'Raoult\'s Law: Solution Properties', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-EQUIL', type: 'JEE', topic: 'Buffer Systems: Dynamic Equilibrium', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-ELECTRO', type: 'JEE', topic: 'Nernst EMF: Redox & Electrochemistry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-KINETICS', type: 'JEE', topic: 'Arrhenius Order: Chemical Kinetics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-PERIOD', type: 'JEE', topic: 'Periodic Trends: Elements Periodicity', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-PBLOCK', type: 'JEE', topic: 'Group Trends: P-Block Inorganic', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-DFBLOCK', type: 'JEE', topic: 'Transition Catalysis: D- & F-Block', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-COORD', type: 'JEE', topic: 'Crystal Fields: Coordination Compounds', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-PURIFY', type: 'JEE', topic: 'Chromatography: Organic Purification', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-ORG', type: 'JEE', topic: 'Inductive Resonance: Basic Organic', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-HYDRO', type: 'JEE', topic: 'Friedel-Crafts: JEE Hydrocarbons', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-HALO', type: 'JEE', topic: 'Substitution Mechanisms: Organic Halogens', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-OXYGEN', type: 'JEE', topic: 'Aldol Grignard: Organic Oxygen', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-NITROGEN', type: 'JEE', topic: 'Diazonium Salts: Organic Nitrogen', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-BIOMOL', type: 'JEE', topic: 'Peptide Chains: JEE Biomolecules', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-CHE-PRACTICAL', type: 'JEE', topic: 'Salt Analysis: Practical Chemistry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-UNITS', type: 'JEE', topic: 'SI Dimension: Physics Metrics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-KINEMATICS', type: 'JEE', topic: 'Projectiles: Kinematics Motion', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-LAWS', type: 'JEE', topic: 'Centripetal Friction: Laws of Motion', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-WORK', type: 'JEE', topic: 'Collision Energy: Work, Energy & Power', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-ROT', type: 'JEE', topic: 'Angular Torque: Rotational Motion', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-GRAV', type: 'JEE', topic: 'Kepler\'s Orbits: Gravitation', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-SOLIDS', type: 'JEE', topic: 'Bernoulli Fluid: Solids & Liquids', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-THERMO', type: 'JEE', topic: 'Heat Engines: Thermal Physics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-GASES', type: 'JEE', topic: 'Ideal Gases: Kinetic Theory', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-WAVES', type: 'JEE', topic: 'Standing Waves: Waves & SHM', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-ELECTRO', type: 'JEE', topic: 'Gauss Flux: Electrostatics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-CURRENT', type: 'JEE', topic: 'Kirchhoff Circuits: Current Electricity', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-MAGNET', type: 'JEE', topic: 'Biot-Savart: Magnetic Effects', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-EMI', type: 'JEE', topic: 'LCR Resonance: EMI & Alternating Currents', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-EMW', type: 'JEE', topic: 'Displacement Spark: EM Waves', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-OPTICS', type: 'JEE', topic: 'Prism Diffraction: Optics & Instruments', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-DUAL', type: 'JEE', topic: 'Photoelectric Spark: Dual Nature', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-ATOMS', type: 'JEE', topic: 'Bohr Model: Atoms & Nuclei', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-DEVICES', type: 'JEE', topic: 'Logic Gates: Electronic Devices', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-PHY-EXPERIMENT', type: 'JEE', topic: 'Screw Gauge: Experimental Skills', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-SETS', type: 'JEE', topic: 'Equivalence Relations: Sets & Functions', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-COMPLEX', type: 'JEE', topic: 'Argand Roots: Complex & Quadratics', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-MATRICES', type: 'JEE', topic: 'Cramer\'s Algebra: Matrices & Determinants', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-PERM', type: 'JEE', topic: 'Combinatorics: Permutations & Combinations', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-BINOMIAL', type: 'JEE', topic: 'General Coefficients: Binomial Theorem', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-SEQUENCE', type: 'JEE', topic: 'Geometric Progression: Sequence & Series', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-LIMIT', type: 'JEE', topic: 'Maxima Minima: Limit & Differentiability', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-INTEGRAL', type: 'JEE', topic: 'FTC Area: Integral Calculus', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-DIFFEQ', type: 'JEE', topic: 'Separable Variables: Differential Equations', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-COORDINATE', type: 'JEE', topic: 'Conic Standard: Co-ordinate Geometry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-3D', type: 'JEE', topic: 'Skew Lines: 3D Geometry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-VECTOR', type: 'JEE', topic: 'Scalar Products: Vector Algebra', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-STATS', type: 'JEE', topic: 'Bayes Theorem: Stats & Probability', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-MAT-TRIG', type: 'JEE', topic: 'Trig Identities: Trigonometry', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-APTITUDE', type: 'JEE', topic: 'Design Geometry: Architecture Aptitude', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-3D', type: 'JEE', topic: '3D Form Rotations: Visual Perception', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-DRAWING', type: 'JEE', topic: 'Landscape Sketch: Memory Drawing', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-PLAN-GEN', type: 'JEE', topic: 'Urban Planning: General Awareness', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-PLAN-SOC', type: 'JEE', topic: 'Human Settlements: Social Sciences', duration: 15, marks: 15, testType: 'topic' },
    { id: 'JEE-P2-PLAN-THINK', type: 'JEE', topic: 'Comprehension: Thinking Skills', duration: 15, marks: 15, testType: 'topic' }
  ];
  
  var headers = ['Question No', 'Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option', 'Marks', 'Negative Marks', 'Topic', 'Series ID'];
  var count = 0;
  var nowTime = new Date().getTime();

  for (var k = 0; k < syllabus.length; k++) {
    var s = syllabus[k];
    
    // Choose correct master sheet
    var targetSheetName = 'Topic-Wise Series';
    if (s.testType === 'subject') targetSheetName = 'Subject-Wise Series';
    else if (s.testType === 'series' || s.testType === 'battle') targetSheetName = 'Series-Wise Series';
    else if (s.testType === 'full') targetSheetName = 'Full Mock Series';
    
    var mSheet = ss.getSheetByName(targetSheetName);
    if (!mSheet) continue;
    
    // 1. Add to master sheet if it doesn't exist
    if (!existingSeriesIds[s.id]) {
      var uploadTime = new Date(nowTime - 48 * 3600000); // 48 hours ago
      mSheet.appendRow([
        s.id,
        s.type,
        s.topic,
        uploadTime,
        s.duration,
        s.marks * 4,
        s.marks,
        'active',
        s.testType,
        'free',
        'TRUE'
      ]);
      count++;
    }
  }
  
  // Clear catalog cache on setup updates
  try {
    CacheService.getScriptCache().remove("catalog_metadata_v3");
  } catch(e){}
  
  return "Syllabus sheets setup complete! Added " + count + " new series entries.";
}

// ── CUSTOM SPREADSHEET MENU: Runs automatically when the Google Sheet is opened/refreshed.
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Futrix Portal')
    .addItem('Initialize Syllabus Sheets', 'setupSyllabusSheets')
    .addItem('Sync Question Counts', 'syncQuestionCountsMenu')
    .addItem('Merge & Clean Up Extra Sheets', 'mergeAndCleanupTopicSheetsMenu')
    .addItem('Run Categorized Migration & Cleanup', 'runMigrationMenu')
    .addToUi();
}

// ── SIMPLE TRIGGER FOR SHEET EDITS: Automatically clears cache on changes
function onEdit(e) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("catalog_metadata_v3");
    cache.remove("last_archive");
  } catch(err) {
    Logger.log("Error clearing cache in onEdit: " + err);
  }
}

function runMigrationMenu() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('Run Migration', 'Are you sure you want to run the categorized master tab migration and clean up obsolete sheets?', ui.ButtonSet.YES_NO);
  if (response === ui.Button.YES) {
    var result = migrateToCategorizedSyllabus();
    ui.alert(result);
  }
}

function syncQuestionCountsMenu() {
  var result = syncQuestionCounts();
  try {
    SpreadsheetApp.getUi().alert(result);
  } catch(e) {
    Logger.log(result);
  }
}

// Automatically scan sheets to verify which ones have questions uploaded
function syncQuestionCounts() {
  var ss = getActiveSpreadsheet();
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  
  var sheets = ss.getSheets();
  var sheetsMap = {};
  for (var i = 0; i < sheets.length; i++) {
    sheetsMap[sheets[i].getName()] = sheets[i];
  }
  
  for (var tIdx = 0; tIdx < MASTER_TABS.length; tIdx++) {
    var seriesSheet = sheetsMap[MASTER_TABS[tIdx]];
    if (!seriesSheet) continue;
    
    var seriesData = seriesSheet.getDataRange().getValues();
    var hasQuestionsColIdx = getColumnIndexByName(seriesSheet, 'has questions', 11);
    
    // Set header row
    seriesSheet.getRange(1, hasQuestionsColIdx).setValue('Has Questions').setFontWeight('bold');
    
    for (var k = 1; k < seriesData.length; k++) {
      var seriesId = String(seriesData[k][0]).trim();
      if (!seriesId) continue;
      
      var hasQuestions = false;
      var qSheet = sheetsMap[seriesId];
      if (qSheet) {
        hasQuestions = qSheet.getLastRow() > 1;
      } else {
        // Partitioned sheet check
        var lastHyphenIdx = seriesId.lastIndexOf('-');
        if (lastHyphenIdx !== -1) {
          var baseSheetName = seriesId.substring(0, lastHyphenIdx);
          var baseSheet = sheetsMap[baseSheetName];
          if (baseSheet) {
            var lastRow = baseSheet.getLastRow();
            if (lastRow > 1) {
              var maxCols = baseSheet.getLastColumn();
              var seriesIdColIdx = -1;
              var headers = baseSheet.getRange(1, 1, 1, maxCols).getValues()[0];
              for (var h = 0; h < headers.length; h++) {
                if (String(headers[h]).trim().toLowerCase() === 'series id') {
                  seriesIdColIdx = h + 1;
                  break;
                }
              }
              if (seriesIdColIdx !== -1) {
                var vals = baseSheet.getRange(2, seriesIdColIdx, lastRow - 1, 1).getValues();
                for (var r = 0; r < vals.length; r++) {
                  if (String(vals[r][0]).trim() === seriesId) {
                    hasQuestions = true;
                    break;
                  }
                }
              } else {
                hasQuestions = true;
              }
            }
          }
        }
      }
      
      if (!hasQuestions) {
        var defaultSheet = sheetsMap['Questions'];
        if (defaultSheet) {
          var lastRow = defaultSheet.getLastRow();
          if (lastRow > 1) {
            var maxCols = defaultSheet.getLastColumn();
            var seriesIdColIdx = -1;
            var headers = defaultSheet.getRange(1, 1, 1, maxCols).getValues()[0];
            for (var h = 0; h < headers.length; h++) {
              if (String(headers[h]).trim().toLowerCase() === 'series id') {
                seriesIdColIdx = h + 1;
                break;
              }
            }
            if (seriesIdColIdx !== -1) {
              var vals = defaultSheet.getRange(2, seriesIdColIdx, lastRow - 1, 1).getValues();
              for (var r = 0; r < vals.length; r++) {
                if (String(vals[r][0]).trim() === seriesId) {
                  hasQuestions = true;
                  break;
                }
              }
            } else {
              hasQuestions = true;
            }
          }
        }
      }
      
      seriesSheet.getRange(k + 1, hasQuestionsColIdx).setValue(hasQuestions ? 'TRUE' : 'FALSE');
    }
  }
  
  // Evict cache so the web app reloads fresh values
  try {
    CacheService.getScriptCache().remove("catalog_metadata_v3");
  } catch(e){}
  
  return "Synced question counts for all syllabus series!";
}

// ── ONE-CLICK MIGRATION & MAINTENANCE UTILITY
function migrateToCategorizedSyllabus() {
  var ss = getActiveSpreadsheet();
  checkAndSetupSheets(); // Ensure new master sheets exist
  
  var oldSheet = ss.getSheetByName('Test Series');
  if (!oldSheet) {
    return "Error: Old 'Test Series' sheet not found. Migration may have already run.";
  }
  
  var oldData = oldSheet.getDataRange().getValues();
  var priceColIdx = getColumnIndexByName(oldSheet, 'price', 10);
  var hasQuestionsColIdx = getColumnIndexByName(oldSheet, 'has questions', 11);
  
  var count = 0;
  
  // 1. Move rows to categorized tabs
  for (var i = 1; i < oldData.length; i++) {
    var seriesId = String(oldData[i][0]).trim();
    var examType = String(oldData[i][1]).trim();
    var topic = String(oldData[i][2]).trim();
    var uploadTime = oldData[i][3];
    var duration = oldData[i][4];
    var xpReward = oldData[i][5];
    var maxMarks = oldData[i][6];
    var status = oldData[i][7];
    var testType = String(oldData[i][8] || 'topic').trim().toLowerCase();
    var price = oldData[i][priceColIdx - 1] || 'free';
    var hasQuestions = oldData[i][hasQuestionsColIdx - 1] || 'FALSE';
    
    if (!seriesId) continue;
    
    // Choose correct master sheet
    var targetSheetName = 'Topic-Wise Series';
    if (testType === 'subject') targetSheetName = 'Subject-Wise Series';
    else if (testType === 'series' || testType === 'battle') targetSheetName = 'Series-Wise Series';
    else if (testType === 'full') targetSheetName = 'Full Mock Series';
    
    var mSheet = ss.getSheetByName(targetSheetName);
    if (mSheet) {
      // Check duplicate
      var exists = false;
      var mData = mSheet.getDataRange().getValues();
      for (var r = 1; r < mData.length; r++) {
        if (String(mData[r][0]).trim() === seriesId) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        mSheet.appendRow([seriesId, examType, topic, uploadTime, duration, xpReward, maxMarks, status, testType, price, hasQuestions]);
        count++;
      }
    }
  }
  
  // 2. Delete the old 'Test Series' sheet to avoid duplicates
  ss.deleteSheet(oldSheet);
  
  // 3. Clean up and delete obsolete extra sheets
  var deletedCount = cleanObsoleteExtraSheets(ss);
  
  // Clear cache
  try {
    CacheService.getScriptCache().remove("catalog_metadata_v3");
  } catch(e){}
  
  return "Migration complete! Migrated " + count + " test entries and deleted " + deletedCount + " obsolete extra sheets.";
}

function cleanObsoleteExtraSheets(ss) {
  if (!ss) ss = getActiveSpreadsheet();
  
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var systemSheets = ['Unlocked Tests', 'Payments', 'OTPs', 'Exam Config', 'Exam Responses', 'Exam Attempts', 'Detailed Question Responses'];
  
  // Build set of referenced Series IDs and partition prefixes from all master sheets
  var activeSeriesMap = {};
  for (var mIdx = 0; mIdx < MASTER_TABS.length; mIdx++) {
    var sheet = ss.getSheetByName(MASTER_TABS[mIdx]);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var sId = String(data[i][0]).trim();
        if (sId) {
          activeSeriesMap[sId] = true;
          // Also check for partition base prefix
          var lastHyphenIdx = sId.lastIndexOf('-');
          if (lastHyphenIdx !== -1) {
            var basePrefix = sId.substring(0, lastHyphenIdx);
            activeSeriesMap[basePrefix] = true;
          }
        }
      }
    }
  }
  
  // Always preserve sheets[0] (Registration/Users)
  var sheet0 = ss.getSheets()[0];
  var sheet0Name = sheet0.getName();
  
  var sheets = ss.getSheets();
  var deletedCount = 0;
  
  for (var i = sheets.length - 1; i >= 0; i--) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    
    // Check if it is a system sheet
    if (sheetName === sheet0Name || systemSheets.indexOf(sheetName) !== -1 || MASTER_TABS.indexOf(sheetName) !== -1 || sheetName === 'Questions') {
      continue;
    }
    
    // Check if it is an active test question sheet
    if (activeSeriesMap[sheetName]) {
      continue;
    }
    
    // If not matching any of the above, it is obsolete! Delete it.
    ss.deleteSheet(sheet);
    deletedCount++;
  }
  
  return deletedCount;
}

function mergeAndCleanupTopicSheetsMenu() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('Merge & Clean Up Extra Sheets', 'Are you sure you want to copy all questions from individual topic sheets into the single shared "Questions" sheet and delete the extra sheets?', ui.ButtonSet.YES_NO);
  if (response === ui.Button.YES) {
    var result = mergeAndCleanupTopicSheets();
    ui.alert(result);
  }
}

function mergeAndCleanupTopicSheets(ss) {
  if (!ss) ss = getActiveSpreadsheet();
  checkAndSetupSheets(); // Ensure central sheets exist
  
  var MASTER_TABS = ['Topic-Wise Series', 'Subject-Wise Series', 'Series-Wise Series', 'Full Mock Series'];
  var systemSheets = ['Unlocked Tests', 'Payments', 'OTPs', 'Exam Config', 'Exam Responses', 'Exam Attempts', 'Detailed Question Responses', 'Questions', 'Test Series'];
  
  // Build set of referenced Series IDs and partition prefixes from all master sheets
  var activeSeriesMap = {};
  for (var mIdx = 0; mIdx < MASTER_TABS.length; mIdx++) {
    var sheet = ss.getSheetByName(MASTER_TABS[mIdx]);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var sId = String(data[i][0]).trim();
        if (sId) {
          activeSeriesMap[sId] = true;
          // Also check for partition base prefix
          var lastHyphenIdx = sId.lastIndexOf('-');
          if (lastHyphenIdx !== -1) {
            var basePrefix = sId.substring(0, lastHyphenIdx);
            activeSeriesMap[basePrefix] = true;
          }
        }
      }
    }
  }
  
  var questionsSheet = ss.getSheetByName('Questions');
  if (!questionsSheet) {
    return "Error: 'Questions' sheet not found.";
  }
  
  var sheet0 = ss.getSheets()[0];
  var sheet0Name = sheet0.getName();
  
  var sheets = ss.getSheets();
  var mergedCount = 0;
  var deletedCount = 0;
  
  for (var i = sheets.length - 1; i >= 0; i--) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    
    // Check if it is a system sheet or master tab
    if (sheetName === sheet0Name || systemSheets.indexOf(sheetName) !== -1 || MASTER_TABS.indexOf(sheetName) !== -1) {
      continue;
    }
    
    // We only merge and delete if the sheet name matches an active series ID (e.g. N11-PHY-MEASURE)
    // or is a partitioned prefix.
    if (!activeSeriesMap[sheetName]) {
      continue;
    }
    
    // It's a topic sheet! Let's read questions from it and add to "Questions" sheet
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var lastCol = sheet.getLastColumn();
      var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      // Find where "Series ID" column is in this sheet, if it exists
      var seriesIdColIdxInTopic = -1;
      for (var h = 0; h < headers.length; h++) {
        if (String(headers[h]).trim().toLowerCase() === 'series id') {
          seriesIdColIdxInTopic = h;
          break;
        }
      }
      
      // Append rows to Questions sheet
      for (var r = 0; r < data.length; r++) {
        var row = data[r];
        if (!row[1]) continue; // Skip empty questions
        
        var questionNo = row[0] || (r + 1);
        var questionText = String(row[1]).trim();
        var optA = String(row[2] || '').trim();
        var optB = String(row[3] || '').trim();
        var optC = String(row[4] || '').trim();
        var optD = String(row[5] || '').trim();
        var correctOpt = String(row[6] || '').trim().toUpperCase();
        var marks = row[7] !== '' ? Number(row[7]) : 4;
        var negativeMarks = row[8] !== '' ? Number(row[8]) : -1;
        var topic = String(row[9] || 'General').trim();
        
        // Use sheetName (the Series ID) if no Series ID is specified in the row
        var seriesId = (seriesIdColIdxInTopic !== -1 && String(row[seriesIdColIdxInTopic]).trim()) 
                       ? String(row[seriesIdColIdxInTopic]).trim() 
                       : sheetName;
        
        // Append row to the end of the Questions sheet
        questionsSheet.appendRow([
          questionNo,
          questionText,
          optA,
          optB,
          optC,
          optD,
          correctOpt,
          marks,
          negativeMarks,
          topic,
          seriesId
        ]);
        mergedCount++;
      }
    }
    
    // Delete the sheet tab
    ss.deleteSheet(sheet);
    deletedCount++;
  }
  
  // Evict cache
  try {
    CacheService.getScriptCache().remove("catalog_metadata_v3");
  } catch(e){}
  
  return "Successfully migrated " + mergedCount + " questions to 'Questions' sheet and deleted " + deletedCount + " topic sheets!";
}


function getActiveSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.openById("14OukhwMSsE_fVP7RfETFAjoU5Ly-JKi5a3A20UTV_c8");
  }
  return ss;
}

function getUserStreak(ss, email) {
  var attemptSheet = ss.getSheetByName('Exam Attempts');
  if (!attemptSheet) return 1;
  var data = attemptSheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(attemptSheet, 'email', 4);
  var tsCol = getColumnIndexByName(attemptSheet, 'timestamp', 1);
  
  var dates = {};
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][emailCol - 1] || '').toLowerCase().trim();
    if (rowEmail === email) {
      var ts = data[i][tsCol - 1];
      if (ts instanceof Date) {
        var yyyy = ts.getFullYear();
        var mm = String(ts.getMonth() + 1).padStart(2, '0');
        var dd = String(ts.getDate()).padStart(2, '0');
        dates[yyyy + '-' + mm + '-' + dd] = true;
      }
    }
  }
  
  var streak = 0;
  var checkDate = new Date();
  
  function formatDateString(d) {
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }
  
  var todayStr = formatDateString(checkDate);
  checkDate.setDate(checkDate.getDate() - 1);
  var yesterdayStr = formatDateString(checkDate);
  
  var startStr = todayStr;
  if (!dates[todayStr]) {
    if (dates[yesterdayStr]) {
      startStr = yesterdayStr;
    } else {
      return 0;
    }
  }
  
  var curr = new Date(startStr);
  while (true) {
    var key = formatDateString(curr);
    if (dates[key]) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getActiveUsersCount(ss) {
  var regSheet = ss.getSheets()[0];
  if (!regSheet) return 12;
  var count = regSheet.getLastRow() - 1;
  return count > 0 ? count : 12;
}

function seedData(e) {
  var ss = getActiveSpreadsheet();
  
  // 1. Registered Pilot (Sheet index 0)
  var sheet0 = ss.getSheets()[0];
  var headers0 = [
    'Timestamp', 'Full Name', 'Email Address', 'Phone Number', 'Date of Birth', 
    "Father's / Guardian's Name", "Father's / Guardian's Contact Number", 
    'City', 'Institute Name', 'Pin Code', 'Preparation For', 'If Any Referral', 
    'XP Point', 'Referral XP', 'Unlocked Level'
  ];
  if (sheet0.getLastRow() <= 1) {
    sheet0.clear();
    sheet0.appendRow(headers0);
  }
  
  // Check if test users already exist
  var data0 = sheet0.getDataRange().getValues();
  var user1Exists = false;
  var user2Exists = false;
  for (var i = 1; i < data0.length; i++) {
    var email = String(data0[i][2]).toLowerCase().trim();
    if (email === 'ms71766@gmail.com') user1Exists = true;
    if (email === 'amit.jee@gmail.com') user2Exists = true;
  }
  
  if (!user1Exists) {
    sheet0.appendRow([new Date(), 'Rajesh Kumar', 'ms71766@gmail.com', '8707093973', '2000-01-01', 'Guardian', '9999999999', 'Delhi', 'Allen', '110001', 'NEET', '', 12400, 0, 1]);
  }
  if (!user2Exists) {
    sheet0.appendRow([new Date(), 'Amit Sharma', 'amit.jee@gmail.com', '9876543210', '2000-01-01', 'Guardian', '9999999999', 'Mumbai', 'FIITJEE', '400001', 'JEE', '', 5000, 0, 1]);
  }
  
  // Helper to ensure sheet exists and write rows in bulk
  function ensureSheetAndPopulate(sheetName, headers, rows) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh) {
      sh = ss.insertSheet(sheetName);
    }
    sh.clear();
    sh.appendRow(headers);
    if (rows && rows.length > 0) {
      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  }
  
  var masterHeaders = ['Series ID', 'Exam Type', 'Topic/Chapter', 'Upload Time', 'Duration (mins)', 'XP Reward', 'Max Marks', 'Status', 'Test Type', 'Price', 'Has Questions'];
  
  // 2. Topic-Wise Series
  var topicRows = [
    ['N11-PHY-MEASURE-01', 'NEET', 'Units & Measurements (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true],
    ['N11-CHEM-BOND-01', 'NEET', 'Chemical Bonding (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true],
    ['N12-BIO-GENETICS-01', 'NEET', 'Principles of Inheritance (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true],
    ['J11-MATH-SET-01', 'JEE', 'Sets & Relations (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true],
    ['J11-PHY-KINE-01', 'JEE', 'Kinematics 1D (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true],
    ['J12-CHEM-ELECTRO-01', 'JEE', 'Electrochemistry (Topic 1)', '2026-06-10 10:00:00', 15, 10, 15, 'active', 'topic', 'free', true]
  ];
  ensureSheetAndPopulate('Topic-Wise Series', masterHeaders, topicRows);
  
  // 3. Subject-Wise Series
  var subjectRows = [
    ['NEET-PHY-SUB-01', 'NEET', 'Complete Physics Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 45, 30, 45, 'active', 'subject', '7.00', true],
    ['NEET-CHEM-SUB-01', 'NEET', 'Complete Chemistry Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 45, 30, 45, 'active', 'subject', '7.00', true],
    ['NEET-BIO-SUB-01', 'NEET', 'Complete Biology Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 50, 40, 90, 'active', 'subject', 'free', true],
    ['JEE-MATH-SUB-01', 'JEE', 'Complete Mathematics Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 60, 40, 25, 'active', 'subject', '7.00', true],
    ['JEE-PHY-SUB-01', 'JEE', 'Complete Physics Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 60, 40, 25, 'active', 'subject', '7.00', true],
    ['JEE-CHEM-SUB-01', 'JEE', 'Complete Chemistry Syllabus (Subject Test 1)', '2026-06-10 10:00:00', 60, 40, 25, 'active', 'subject', '7.00', true]
  ];
  ensureSheetAndPopulate('Subject-Wise Series', masterHeaders, subjectRows);
  
  // 4. Series-Wise Series
  var seriesRows = [
    ['NEET-SERIES-BOTANY-01', 'NEET', 'Botany Unit Booster Series 1', '2026-06-10 10:00:00', 30, 20, 30, 'active', 'series', 'free', true],
    ['JEE-SERIES-CALCULUS-01', 'JEE', 'Calculus Special Series 1', '2026-06-10 10:00:00', 30, 25, 30, 'active', 'series', 'free', true]
  ];
  ensureSheetAndPopulate('Series-Wise Series', masterHeaders, seriesRows);
  
  // 5. Full Mock Series
  var mockRows = [
    ['NEET-FULL-MOCK-01', 'NEET', 'NEET Full Mock Test 1', '2026-06-10 10:00:00', 180, 100, 180, 'active', 'full', '9.00', true],
    ['NEET-FULL-MOCK-02', 'NEET', 'NEET Full Mock Test 2', '2026-06-10 10:00:00', 180, 100, 180, 'active', 'full', '9.00', true],
    ['JEE-FULL-MOCK-01', 'JEE', 'JEE Main Full Mock Test 1', '2026-06-10 10:00:00', 180, 100, 75, 'active', 'full', '9.00', true]
  ];
  ensureSheetAndPopulate('Full Mock Series', masterHeaders, mockRows);
  
  // 6. Questions (Include Complexity Level as Column L / Col 12)
  var qHeaders = ['Question Number', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks', 'Negative Marks', 'Topic', 'Series ID', 'Complexity Level'];
  var qRows = [];
  var allSeriesIds = [
    'N11-PHY-MEASURE-01', 'N11-CHEM-BOND-01', 'N12-BIO-GENETICS-01',
    'J11-MATH-SET-01', 'J11-PHY-KINE-01', 'J12-CHEM-ELECTRO-01',
    'NEET-PHY-SUB-01', 'NEET-CHEM-SUB-01', 'NEET-BIO-SUB-01',
    'JEE-MATH-SUB-01', 'JEE-PHY-SUB-01', 'JEE-CHEM-SUB-01',
    'NEET-SERIES-BOTANY-01', 'JEE-SERIES-CALCULUS-01',
    'NEET-FULL-MOCK-01', 'NEET-FULL-MOCK-02', 'JEE-FULL-MOCK-01'
  ];
  
  for (var sIdx = 0; sIdx < allSeriesIds.length; sIdx++) {
    var sid = allSeriesIds[sIdx];
    var isNEET = sid.indexOf('NEET') !== -1 || sid.indexOf('N11') !== -1 || sid.indexOf('N12') !== -1;
    var subjectType = isNEET ? 'NEET Prep' : 'JEE Prep';
    
    // Generate 60 questions per series ID to cover Levels 1 to 20
    for (var qNum = 1; qNum <= 60; qNum++) {
      var qLevel = Math.floor((qNum - 1) / 3) + 1; // Maps 1-60 to 1-20 (exactly 3 questions per level)
      var questionText = "Complexity Level " + qLevel + " Question " + qNum + " for " + sid + ": Choose the correct option.";
      var optA = "Option A (L" + qLevel + ")";
      var optB = "Option B (L" + qLevel + ")";
      var optC = "Option C (L" + qLevel + ")";
      var optD = "Option D (L" + qLevel + ")";
      var correctAns = (qNum % 4 === 1) ? 'A' : (qNum % 4 === 2) ? 'B' : (qNum % 4 === 3) ? 'C' : 'D';
      
      qRows.push([
        qNum, questionText, optA, optB, optC, optD, correctAns, 4, -1, subjectType, sid, qLevel
      ]);
    }
  }
  ensureSheetAndPopulate('Questions', qHeaders, qRows);
  
  var bHeaders = [
    'Battle ID', 'Creator Email', 'Creator Name', 'Opponent Email', 'Opponent Name', 
    'Series ID', 'Creator Score', 'Opponent Score', 'Status', 'Winner Email', 
    'Difficulty', 'Creator Stream', 'Opponent Stream'
  ];
  var bSheet = ss.getSheetByName('Battles');
  if (!bSheet) {
    bSheet = ss.insertSheet('Battles');
    bSheet.appendRow(bHeaders);
    bSheet.getRange(1,1,1,bHeaders.length).setFontWeight('bold');
  }
  
  var attemptHeaders = ['Timestamp', 'Series ID', 'Candidate Name', 'Email'];
  var attemptSheet = ss.getSheetByName('Exam Attempts');
  if (!attemptSheet) {
    attemptSheet = ss.insertSheet('Exam Attempts');
    attemptSheet.appendRow(attemptHeaders);
  }
  
  return { success: true, message: "Google Sheets populated successfully!" };
}

function getUnlockedLevelColumn(sheet) {
  var lastCol = sheet.getLastColumn(); if (lastCol === 0) return 15;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) { 
    var h = String(headers[i]).trim();
    if (h === 'Unlocked Level' || h === 'unlocked_level') return i + 1; 
  }
  var newCol = lastCol + 1; sheet.getRange(1, newCol).setValue('Unlocked Level'); sheet.getRange(1, newCol).setFontWeight('bold'); return newCol;
}

function cancelBattle(e) {
  var battleId = (e.parameter.battleId || '').trim();
  var email = (e.parameter.email || '').toLowerCase().trim();
  
  if (!battleId || !email) {
    return { success: false, message: 'Missing parameters.' };
  }
  
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Battles');
  if (!sheet) return { success: false, message: 'Battles sheet not found.' };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === battleId) {
      var status = String(data[i][8]).trim().toLowerCase();
      if (status === 'completed' || status === 'cancelled') {
        return { success: false, message: 'Battle is already completed or cancelled.' };
      }
      
      var creatorEmail = String(data[i][1]).toLowerCase().trim();
      if (creatorEmail !== email) {
        return { success: false, message: 'Only the creator can cancel this challenge.' };
      }
      
      // Update Status (col 9, index 8) to 'cancelled'
      sheet.getRange(i + 1, 9).setValue('cancelled');
      
      // Deduct 50 XP from creator
      var regSheet = ss.getSheets()[0];
      var regData = regSheet.getDataRange().getValues();
      var xpCol = getXPColumn(regSheet);
      var emailCol = getColumnIndexByName(regSheet, 'email', 3);
      
      for (var j = 1; j < regData.length; j++) {
        if (String(regData[j][emailCol - 1]).toLowerCase().trim() === creatorEmail) {
          var currXp = parseFloat(regData[j][xpCol - 1]) || 100;
          regSheet.getRange(j + 1, xpCol).setValue(Math.max(0, currXp - 50));
          break;
        }
      }
      
      // If challenge was accepted (status was 'active'), award +20 XP to opponent
      var opponentEmail = String(data[i][3]).toLowerCase().trim();
      var opponentRewarded = false;
      if (status === 'active' && opponentEmail) {
        for (var j = 1; j < regData.length; j++) {
          if (String(regData[j][emailCol - 1]).toLowerCase().trim() === opponentEmail) {
            var currXp = parseFloat(regData[j][xpCol - 1]) || 100;
            regSheet.getRange(j + 1, xpCol).setValue(currXp + 20);
            opponentRewarded = true;
            break;
          }
        }
      }
      
      var msg = "Challenge cancelled. 50 XP penalty applied.";
      if (opponentRewarded) {
        msg += " Opponent rewarded with +20 XP.";
      }
      return { success: true, message: msg };
    }
  }
  return { success: false, message: 'Battle ID not found.' };
}

function inspectSheets(e) {
  var ss = getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var info = [];
  for (var i = 0; i < sheets.length; i++) {
    var lastRow = sheets[i].getLastRow();
    var lastCol = sheets[i].getLastColumn();
    var headers = lastRow > 0 ? sheets[i].getRange(1, 1, 1, lastCol).getValues()[0] : [];
    info.push({ name: sheets[i].getName(), rows: lastRow, cols: lastCol, headers: headers });
  }
  return { success: true, sheets: info };
}

function sendForgotOTP(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  if (!email) return { success: false, message: 'Email address is required.' };
  
  var ss = getActiveSpreadsheet();
  var regSheet = ss.getSheets()[0];
  var regData = regSheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(regSheet, 'email', 3);
  
  var exists = false;
  for (var i = 1; i < regData.length; i++) {
    var rowEmail = String(regData[i][emailCol - 1] || '').toLowerCase().trim();
    if (rowEmail === email) {
      exists = true;
      break;
    }
  }
  
  if (!exists) {
    return { success: false, message: 'This email is not registered with FUTRIX.' };
  }
  
  var otp = Math.floor(100000 + Math.random() * 900000).toString();
  var sheet = ss.getSheetByName('OTPs');
  if (!sheet) {
    sheet = ss.insertSheet('OTPs');
    sheet.appendRow(['Timestamp', 'Email', 'OTP', 'Status']);
    var hr = sheet.getRange(1, 1, 1, 4);
    hr.setFontWeight('bold');
    hr.setBackground('#ea4335');
    hr.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(), email, otp, 'pending']);
  
  try {
    var subject = "Reset your password - FUTRIX Ecosystem";
    var htmlBody = "<div style=\"background-color:#f8fafc;padding:30px 15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">" +
                   "  <div style=\"max-width:480px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -1px rgba(0,0,0,0.03);\">" +
                   "    <div style=\"background-color:#ea4335;padding:24px;text-align:center;\">" +
                   "      <h1 style=\"color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:1px;\">FUTRIX</h1>" +
                   "      <p style=\"color:#fca5a5;margin:4px 0 0 0;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;\">Password Recovery</p>" +
                   "    </div>" +
                   "    <div style=\"padding:30px 24px;\">" +
                   "      <p style=\"font-size:16px;color:#1e293b;margin:0 0 16px 0;line-height:1.5;\">Hello Competitor,</p>" +
                   "      <p style=\"font-size:14px;color:#475569;margin:0 0 24px 0;line-height:1.6;\">We received a request to reset your password. Use the verification code below to authorize this change:</p>" +
                   "      <div style=\"text-align:center;margin:24px 0;padding:16px;background-color:#f1f5f9;border-radius:12px;\">" +
                   "        <span style=\"font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;color:#ea4335;letter-spacing:6px;display:inline-block;padding-left:6px;\">" + otp + "</span>" +
                   "      </div>" +
                   "      <p style=\"font-size:12px;color:#64748b;margin:0 0 24px 0;line-height:1.5;text-align:center;\">This code is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>" +
                   "    </div>" +
                   "  </div>" +
                   "</div>";
    
    sendEmailViaProvider(email, subject, otp, htmlBody);
    return { success: true };
  } catch (err) {
    return { success: false, message: 'Failed to send OTP: ' + err.message };
  }
}

function verifyForgotOTP(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var otp = (e.parameter.otp || '').trim();
  if (!email || !otp) return { success: false, message: 'Email and OTP are required.' };
  
  var ss = getActiveSpreadsheet();
  var sheet = ss.getSheetByName('OTPs');
  if (!sheet) return { success: false, message: 'No OTP record found.' };
  
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var rowEmail = String(data[i][1]).toLowerCase().trim();
    var rowOtp = String(data[i][2]).trim();
    var rowStatus = String(data[i][3]).trim();
    
    if (rowEmail === email && rowOtp === otp) {
      if (rowStatus !== 'pending') {
        return { success: false, message: 'OTP has already been verified or used.' };
      }
      
      sheet.getRange(i + 1, 4).setValue('verified');
      return { success: true };
    }
  }
  return { success: false, message: 'Invalid OTP code. Please try again.' };
}

function resetPassword(e) {
  var email = (e.parameter.email || '').toLowerCase().trim();
  var newPassword = (e.parameter.password || '').trim();
  var otp = (e.parameter.otp || '').trim();
  if (!email || !newPassword || !otp) return { success: false, message: 'Email, new password, and OTP are required.' };
  
  var ss = getActiveSpreadsheet();
  
  var otpSheet = ss.getSheetByName('OTPs');
  if (!otpSheet) return { success: false, message: 'OTP verification record not found.' };
  var otpData = otpSheet.getDataRange().getValues();
  var otpValid = false;
  for (var i = otpData.length - 1; i >= 1; i--) {
    var rowEmail = String(otpData[i][1]).toLowerCase().trim();
    var rowOtp = String(otpData[i][2]).trim();
    var rowStatus = String(otpData[i][3]).trim();
    if (rowEmail === email && rowOtp === otp && rowStatus === 'verified') {
      otpValid = true;
      otpSheet.getRange(i + 1, 4).setValue('used');
      break;
    }
  }
  
  if (!otpValid) {
    return { success: false, message: 'OTP verification required before resetting password.' };
  }
  
  var regSheet = ss.getSheets()[0];
  var regData = regSheet.getDataRange().getValues();
  var emailCol = getColumnIndexByName(regSheet, 'email', 3);
  var phoneCol = getColumnIndexByName(regSheet, 'phone', 4);
  
  for (var j = 1; j < regData.length; j++) {
    var rowEmail = String(regData[j][emailCol - 1]).toLowerCase().trim();
    if (rowEmail === email) {
      regSheet.getRange(j + 1, phoneCol).setValue(newPassword);
      return { success: true, message: 'Password updated successfully.' };
    }
  }
  
  return { success: false, message: 'User account not found.' };
}
