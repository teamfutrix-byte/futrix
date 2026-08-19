const fs = require('fs');

function extractFunction(filePath, funcName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`function\\s+${funcName}\\s*\\([\\s\\S]*?\\}\\s*\\}`, 'g');
  
  // Alternative match for standard function block:
  const lines = content.split('\n');
  let startIdx = -1;
  let bracesCount = 0;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`function ${funcName}`)) {
      startIdx = i;
      bracesCount = 0;
    }
    if (startIdx !== -1) {
      codeLines.push(lines[i]);
      const openCount = (lines[i].match(/\{/g) || []).length;
      const closeCount = (lines[i].match(/\}/g) || []).length;
      bracesCount += openCount - closeCount;
      if (bracesCount === 0 && codeLines.length > 1) {
        break;
      }
    }
  }

  if (startIdx === -1) {
    throw new Error(`Function ${funcName} not found in ${filePath}`);
  }
  return codeLines.join('\n');
}

async function main() {
  console.log("Extracting preprocessTextForTTS from floating-ai-mentor.js...");
  const mentorFuncCode = extractFunction('floating-ai-mentor.js', 'preprocessTextForTTS');
  
  console.log("Extracting preprocessTextForTTS from memory-lab.html...");
  const memoryFuncCode = extractFunction('features/memory-lab/memory-lab.html', 'preprocessTextForTTS');

  // Eval the functions into local scope
  eval(mentorFuncCode);
  const mentorPreprocess = preprocessTextForTTS;

  eval(memoryFuncCode);
  const memoryPreprocess = preprocessTextForTTS;

  const testCases = [
    { text: "Welcome to FUTRIX AI!", lang: "en-IN", expected: "Welcome to Fewtricks AI!" },
    { text: "Futrix is the best app", lang: "en-US", expected: "Fewtricks is the best app" },
    { text: "futrix ai tools are cool", lang: "en-IN", expected: "Fewtricks AI tools are cool" },
    { text: "FUTRIX में आपका स्वागत है!", lang: "hi-IN", expected: "फ्यूट्रिक्स में आपका स्वागत है!" },
    { text: "Futrix AI की रणनीति", lang: "hi-IN", expected: "फ्यूट्रिक्स एआई की रणनीति" }
  ];

  console.log("\n--- TESTING floating-ai-mentor.js FUNCTION ---");
  for (const tc of testCases) {
    const result = mentorPreprocess(tc.text, tc.lang);
    if (result === tc.expected) {
      console.log(`✅ MATCH: "${tc.text}" [${tc.lang}] -> "${result}"`);
    } else {
      console.error(`❌ MISMATCH: "${tc.text}" [${tc.lang}] -> "${result}" (Expected: "${tc.expected}")`);
      process.exit(1);
    }
  }

  console.log("\n--- TESTING memory-lab.html FUNCTION ---");
  for (const tc of testCases) {
    const result = memoryPreprocess(tc.text, tc.lang);
    if (result === tc.expected) {
      console.log(`✅ MATCH: "${tc.text}" [${tc.lang}] -> "${result}"`);
    } else {
      console.error(`❌ MISMATCH: "${tc.text}" [${tc.lang}] -> "${result}" (Expected: "${tc.expected}")`);
      process.exit(1);
    }
  }

  console.log("\n✅ All unit tests passed successfully!");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
