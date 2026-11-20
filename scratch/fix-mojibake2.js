const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'api', 'routes', 'export-report.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix all remaining mojibake issues
// Template literal subtotals with trailing garbage
content = content.replace(/【\$\{cat\} 小計】[^\`]*/g, '【${cat} 小計】`');
// Fix the full line pattern for subtotal rows
content = content.replace(
  /rows\.push\(\[`【\$\{cat\} 小計】`[^)]*\)/g,
  'rows.push([`【${cat} 小計】`, "", "", catTotal, "", ""])'
);

// Fix grand total rows with trailing garbage
content = content.replace(
  /\["【収入 合計】[^"]*"/g,
  '["【収入 合計】"'
);
content = content.replace(
  /\["【支出 合計】[^"]*"/g, 
  '["【支出 合計】"'
);

fs.writeFileSync(filePath, content, 'utf8');

// Verify by checking for syntax issues
const lines = content.split('\n');
let found = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.includes('小計') || line.includes('合計')) {
    console.log(`L${i+1}: ${line}`);
    found++;
  }
}
console.log(`\nTotal lines with 小計/合計: ${found}`);
