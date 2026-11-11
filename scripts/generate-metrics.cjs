// 用途：从两个 Git 版本的 TypeScript 运行源码生成文件职责、行数和 AST 圈复杂度对照。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript/unstable/ast');
const { API } = require('typescript/unstable/sync');
const { createVirtualFileSystem } = require('typescript/unstable/fs');

const root = path.resolve(__dirname, '..');
const [beforeRef = 'final', afterRef = 'HEAD', destination = 'docs/metrics'] = process.argv.slice(2);
function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
function classify(file) {
  if (file.startsWith('extensions/vscode-svg/src/')) return 'VSCode';
  if (file.startsWith('plugins/') || file.startsWith('src/builtins/')) return '插件';
  if (file === 'src/main.ts' || file.startsWith('src/bootstrap/')) return '装配处';
  return '内核';
}
function decision(node) {
  if (ts.isIfStatement(node) || ts.isConditionalExpression(node) || ts.isCaseClause(node) ||
      ts.isCatchClause(node) || ts.isForStatement(node) || ts.isForInStatement(node) ||
      ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) return 1;
  return ts.isBinaryExpression(node) && [ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind) ? 1 : 0;
}
function analyze(source, tree) {
  let functions = 0;
  let branches = 0;
  let topLevelBranches = 0;
  function walk(node, inFunction = false) {
    // 仅统计带实现的函数/方法，接口方法签名和重载声明不增加基数。
    const ownFunction = ts.isFunctionLikeDeclaration(node) && node.body !== undefined;
    if (ownFunction) functions += 1;
    const increment = decision(node);
    branches += increment;
    if (!inFunction && !ownFunction) topLevelBranches += increment;
    node.forEachChild(child => walk(child, inFunction || ownFunction));
  }
  walk(tree);
  const lines = source === '' ? [] : source.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const firstLine = (lines[0] ?? '').replace(/^\uFEFF/, '');
  const responsibility = firstLine.replace(/^\s*\/\/\s*(用途[：:]\s*)?/, '').trim();
  return { lines: lines.length, nonblank: lines.filter(line => line.trim() !== '').length,
    functions, decisions: branches, complexity: functions + branches + (topLevelBranches > 0 ? 1 : 0),
    responsibility };
}
function snapshot(ref) {
  const commit = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
  const files = git('ls-tree', '-r', '--name-only', commit).trim().split('\n').filter(file =>
    file.endsWith('.ts') && !file.endsWith('.d.ts') &&
    (file.startsWith('src/') || /^plugins\/[^/]+\/src\//.test(file) || file.startsWith('extensions/vscode-svg/src/')));
  // TypeScript 7 通过 API 获取 AST。虚拟文件系统只承载 Git 内容，不创建历史源码副本。
  const base = path.join(root, 'ai-notes', '.metrics-virtual', commit).replace(/\\/g, '/');
  const config = `${base}/tsconfig.json`;
  const sources = new Map(files.map(file => [file, git('show', `${commit}:${file}`)]));
  const virtualFiles = Object.fromEntries([...sources].map(([file, source]) => [`${base}/${file}`, source]));
  virtualFiles[config] = JSON.stringify({ compilerOptions: { noLib: true, noResolve: true, types: [] }, files });
  const api = new API({ cwd: root, fs: createVirtualFileSystem(virtualFiles) });
  let rows;
  try {
    const project = api.updateSnapshot({ openProjects: [config] }).getProject(config);
    if (project === undefined) throw new Error(`cannot parse historical project: ${ref}`);
    rows = files.map(file => {
      const tree = project.program.getSourceFile(`${base}/${file}`);
      if (tree === undefined) throw new Error(`missing historical AST: ${file}`);
      return { file, category: classify(file), ...analyze(sources.get(file), tree) };
    });
  } finally {
    api.close();
  }
  const totals = {};
  for (const category of ['内核', '装配处', '插件', 'VSCode']) {
    const members = rows.filter(row => row.category === category);
    totals[category] = { files: members.length, lines: 0, nonblank: 0, functions: 0, decisions: 0, complexity: 0 };
    for (const row of members) for (const field of ['lines', 'nonblank', 'functions', 'decisions', 'complexity']) {
      totals[category][field] += row[field];
    }
  }
  return { ref, commit, totals, files: rows };
}
const before = snapshot(beforeRef);
const after = snapshot(afterRef);
const delta = {};
for (const category of Object.keys(before.totals)) {
  delta[category] = {};
  for (const field of Object.keys(before.totals[category])) delta[category][field] = after.totals[category][field] - before.totals[category][field];
}
const out = path.resolve(root, destination);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify({ schema: 1, before, after, delta }, null, 2) + '\n');
const esc = value => String(value).replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
let inventory = '# 文件清单与职责（自动生成）\n\n';
for (const [label, data] of [['基线', before], ['目标', after]]) {
  inventory += `## ${label}：${data.ref} (${data.commit.slice(0, 7)})\n\n| 文件 | 分类 | 物理行 | 非空行 | CCN | 职责（源码首行） |\n| --- | --- | ---: | ---: | ---: | --- |\n`;
  for (const row of data.files) inventory += `| ${row.file} | ${row.category} | ${row.lines} | ${row.nonblank} | ${row.complexity} | ${esc(row.responsibility)} |\n`;
  inventory += '\n';
}
fs.writeFileSync(path.join(out, 'files.md'), inventory);
let summary = '# 代码指标（自动生成）\n\n';
summary += `基线：\`${before.ref}\` / \`${before.commit}\`。目标：\`${after.ref}\` / \`${after.commit}\`。\n\n`;
summary += '| 分类 | 文件数 前→后 | 物理行 前→后（增量） | CCN 前→后（增量） |\n| --- | ---: | ---: | ---: |\n';
for (const category of Object.keys(before.totals)) {
  const a = before.totals[category], b = after.totals[category], d = delta[category];
  const signed = value => value >= 0 ? `+${value}` : String(value);
  summary += `| ${category} | ${a.files}→${b.files} | ${a.lines}→${b.lines}（${signed(d.lines)}） | ${a.complexity}→${b.complexity}（${signed(d.complexity)}） |\n`;
}
summary += '\nCLI 总计不含 VSCode：';
for (const field of ['lines', 'complexity']) {
  const total = data => ['内核', '装配处', '插件'].reduce((sum, category) => sum + data.totals[category][field], 0);
  summary += ` ${field} ${total(before)}→${total(after)}（增量 ${total(after) - total(before)}）；`;
}
summary += '\n\n口径、分类及复算命令见 README.md；文件清单与职责见 files.md，原始结构化结果见 metrics.json。\n';
fs.writeFileSync(path.join(out, 'summary.md'), summary);
process.stdout.write(summary);
