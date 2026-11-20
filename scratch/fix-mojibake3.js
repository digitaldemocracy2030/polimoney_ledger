const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'api', 'routes', 'export-report.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Simple line-by-line replacement map: line content pattern -> replacement
const lineReplacements = {
  // Revenue headers
  '"蜿主・蛹ｺ蛻・,': '    "収入区分",',
  '"遘醍岼繧ｳ繝ｼ繝・,': '    "勘定コード",',
  '"遘醍岼蜷・,': '    "勘定名",',
  '"驥鷹｡・,': '    "金額",',
  '"莉ｶ謨ｰ"': '    "件数"',
  '"鞫倩ｦ・ｼ井ｻ｣陦ｨ萓具ｼ・,': '    "説明（代表例）",',
  '"鞫倩ｦ・,': '    "説明",',
  // Expense headers  
  '"謾ｯ蜃ｺ蛹ｺ蛻・,': '    "支出区分",',
  // Election report headers
  '"蛹ｺ蛻・,': '    "区分",',
  '"譌･莉・,': '    "日付",',
  '"髢｢菫り・錐"': '    "関係者名"',
  '"蜈ｬ雋ｻ雋諡・｡・,': '    "公費負担額",',
  '"險ｼ諞鷹屮"': '    "証拠書類"',
  // Income categories
  '"蜈夊ｲｻ繝ｻ莨夊ｲｻ"': '    "前年・繰越"',
  '"蟇・刋"': '    "寄附"',
  '"莠区･ｭ蜿主・"': '    "事業収入"',
  '"莠､莉倬≡"': '    "交付金"',
  '"縺昴・莉悶・蜿主・"': '    "その他の収入"',
  // Expense categories
  '"邨悟ｸｸ邨瑚ｲｻ"': '"経常経費"',
  '"謾ｿ豐ｻ豢ｻ蜍戊ｲｻ"': '"政治活動費"',
};

// Line-specific replacements (using line content matching)
const specificReplacements = [
  // Subtotal rows with template literal
  { match: '縲・{cat} 蟆剰ｨ医疏', replace: '【${cat} 小計】`' },
  // Grand total rows
  { match: '縲仙庶蜈･ 蜷郁ｨ医', replace: '【収入 合計】' },
  { match: '縲先髪蜃ｺ 蜷郁ｨ医', replace: '【支出 合計】' },
  // Revenue/expense labels
  { match: '"蜿主・"', replace: '"収入"' },
  { match: '"蜿主・蜷郁ｨ・', replace: '"収入合計"' },
  { match: '"謾ｯ蜃ｺ"', replace: '"支出"' },
  { match: '"謾ｯ蜃ｺ蜷郁ｨ・', replace: '"支出合計"' },
  // Section headers
  { match: '縲仙庶蜈･縺ｮ驛ｨ縲・', replace: '【収入の部】' },
  { match: '縲先髪蜃ｺ縺ｮ驛ｨ縲・', replace: '【支出の部】' },
  // Error messages
  { match: '莉戊ｨｳ繝・・繧ｿ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆', replace: '仕訳データの取得に失敗しました' },
  { match: 'ledger_id 繧呈欠螳壹＠縺ｦ縺上□縺輔＞', replace: 'ledger_id を指定してください' },
  { match: '繧ｨ繧ｯ繧ｹ繝昴・繝医↓螟ｱ謨励＠縺ｾ縺励◆', replace: 'エクスポートに失敗しました' },
  // Filenames
  { match: '驕ｸ謖咎°蜍戊ｲｻ逕ｨ蜿取髪蝣ｱ蜻頑嶌_陬懷勧', replace: '選挙運動費用収支報告書_概要' },
  { match: '蜿主・縺ｮ驛ｨ', replace: '収入の部' },
  { match: '謾ｯ蜃ｺ縺ｮ驛ｨ', replace: '支出の部' },
  { match: '謾ｿ豐ｻ雉・≡蜿取髪蝣ｱ蜻頑嶌_陬懷勧', replace: '政治資金収支報告書_概要' },
  { match: '蟷ｴ蠎ｦ', replace: '年度' },
];

// Apply line-level replacements
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  for (const [pattern, replacement] of Object.entries(lineReplacements)) {
    if (trimmed.startsWith(pattern)) {
      const indent = lines[i].match(/^(\s*)/)[1];
      lines[i] = indent + replacement.trim() + (lines[i].endsWith('\r') ? '\r' : '');
      break;
    }
  }
}

// Rejoin and apply string replacements
content = lines.join('\n');
for (const { match, replace } of specificReplacements) {
  while (content.includes(match)) {
    content = content.split(match).join(replace);
  }
}

fs.writeFileSync(filePath, content, 'utf8');

// Verify
const finalLines = content.split('\n');
let warnings = 0;
for (let i = 0; i < finalLines.length; i++) {
  const line = finalLines[i];
  // Check for remaining mojibake in string literals
  if (/[\u00c0-\u02ff]{4,}/.test(line) && /["'`]/.test(line)) {
    console.log(`WARNING L${i+1}: ${line.trim().substring(0, 100)}`);
    warnings++;
  }
}
console.log(`Done. Warnings: ${warnings}`);
console.log(`Total lines: ${finalLines.length}`);
