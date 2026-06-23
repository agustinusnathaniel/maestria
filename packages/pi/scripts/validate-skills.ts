#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const __dirname = import.meta.dirname;
const root = join(__dirname, '..');

const skills = ['handoff', 'iteration-limits'];
let allValid = true;

for (const name of skills) {
  const path = join(root, 'skills', name, 'SKILL.md');
  if (!existsSync(path)) {
    console.error(`❌ Missing: skills/${name}/SKILL.md`);
    allValid = false;
    continue;
  }
  const content = readFileSync(path, 'utf-8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    console.error(`❌ skills/${name}/SKILL.md: missing or invalid frontmatter`);
    allValid = false;
    continue;
  }
  const frontmatter = frontmatterMatch[1];
  if (!frontmatter.includes('name:')) {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter missing "name"`);
    allValid = false;
  }
  if (!frontmatter.includes('description:')) {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter missing "description"`);
    allValid = false;
  }
  if (content.trim().split('\n---')[1]?.trim().length === 0) {
    console.error(`❌ skills/${name}/SKILL.md: no body content after frontmatter`);
    allValid = false;
  }
  console.log(`✅ skills/${name}/SKILL.md`);
}

process.exit(allValid ? 0 : 1);
