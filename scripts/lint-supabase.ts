import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const IGNORE_DIRS = ['node_modules', '.git', '.tanstack', 'dist'];

function walk(dir: string, callback: (path: string) => void) {
  readdirSync(dir).forEach(f => {
    const path = join(dir, f);
    if (IGNORE_DIRS.some(d => path.includes(d))) return;
    if (statSync(path).isDirectory()) walk(path, callback);
    else if (path.endsWith('.ts') || path.endsWith('.tsx')) callback(path);
  });
}

let violations = 0;
const fileViolations: Record<string, number> = {};

walk('src', (path) => {
  const content = readFileSync(path, 'utf8');
  // Match supabase.from/rpc calls that don't destructure 'error'
  // Simplified regex for the report
  const matches = content.match(/await\s+([a-zA-Z0-9_]+\.)?supabase(Admin)?\.(from|rpc|auth)\b/g);
  if (matches) {
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('await') && (line.includes('supabase.from') || line.includes('supabase.rpc')) && !line.includes('error')) {
        violations++;
        fileViolations[path] = (fileViolations[path] || 0) + 1;
      }
    });
  }
});

console.log('--- LINT REPORT ---');
console.log('Total violations found:', violations);
const sortedFiles = Object.entries(fileViolations).sort((a, b) => b[1] - a[1]);
console.log('Worst 5 files:');
sortedFiles.slice(0, 5).forEach(([f, c]) => console.log(`${f}: ${c} violations`));
