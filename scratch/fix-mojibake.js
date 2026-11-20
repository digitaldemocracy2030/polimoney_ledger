const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'api', 'routes', 'export-report.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Map of mojibake -> correct Japanese
const replacements = [
  // Headers - Revenue
  ['"蜿主・蛹ｺ蛻・,', '"収入区分",'],
  ['"遘醍岼繧ｳ繝ｼ繝・,', '"勘定コード",'],
  ['"遘醍岼蜷・,', '"勘定名",'],
  ['"驥鷹｡・,', '"金額",'],
  ['"鞫倩ｦ・ｼ井ｻ｣陦ｨ萓具ｼ・,', '"説明（代表例）",'],
  ['"鞫倩ｦ・,', '"説明",'],
  // Headers - Expense
  ['"謾ｯ蜃ｺ蛹ｺ蛻・,', '"支出区分",'],
  // Headers - Election
  ['"蛹ｺ蛻・,', '"区分",'],
  ['"譌･莉・,', '"日付",'],
  ['"髢｢菫り・錐"', '"関係者名"'],
  ['"蜈ｬ雋ｻ雋諡・｡・,', '"公費負担額",'],
  ['"險ｼ諞鷹屮"', '"証拠書類"'],
  // Categories
  ['"蜈夊ｲｻ繝ｻ莨夊ｲｻ"', '"前年・繰越"'],
  ['"蟇・刋"', '"寄附"'],
  ['"莠区･ｭ蜿主・"', '"事業収入"'],
  ['"莠､莉倬≡"', '"交付金"'],
  ['"縺昴・莉悶・蜿主・"', '"その他の収入"'],
  ['"邨悟ｸｸ邨瑚ｲｻ"', '"経常経費"'],
  ['"謾ｿ豐ｻ豢ｻ蜍戊ｲｻ"', '"政治活動費"'],
  // Sub-totals (template literals)
  ['縲・{cat} 蟆剰ｨ医', '【${cat} 小計】'],
  ['縲仙庶蜈･ 蜷郁ｨ医', '【収入 合計】'],
  ['縲先髪蜃ｺ 蜷郁ｨ医', '【支出 合計】'],
  // Other strings
  ['"蜿主・"', '"収入"'],
  ['"蜿主・蜷郁ｨ・', '"収入合計"'],
  ['"謾ｯ蜃ｺ"', '"支出"'],
  ['"謾ｯ蜃ｺ蜷郁ｨ・', '"支出合計"'],
  ['縲仙庶蜈･縺ｮ驛ｨ縲・', '【収入の部】'],
  ['縲先髪蜃ｺ縺ｮ驛ｨ縲・', '【支出の部】'],
];

for (const [from, to] of replacements) {
  while (content.includes(from)) {
    content = content.replace(from, to);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('export-report.ts fixed');

// Verify no unterminated strings remain
const lines = content.split('\n');
let errors = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Check for mojibake patterns in string literals
  if (/[\u00c0-\u02ff]{4,}/.test(line) && /["']/.test(line)) {
    console.log(`Warning L${i+1}: ${line.trim().substring(0, 100)}`);
    errors++;
  }
}
console.log(`Warnings: ${errors}`);
