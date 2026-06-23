#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const __dirname = import.meta.dirname;
const root = join(__dirname, '..');

const prompts = [
  'orchestrator',
  'adventurer',
  'architect',
  'builder',
  'diagnose',
  'planner',
  'reviewer',
  'writer',
];

let allValid = true;

for (const name of prompts) {
  const path = join(root, 'prompts', `${name}.md`);
  if (!existsSync(path)) {
    console.error(`❌ Missing: prompts/${name}.md`);
    allValid = false;
    continue;
  }
  const content = readFileSync(path, 'utf-8');

  // Check no lingering task() references
  if (content.includes('task(')) {
    console.error(`❌ prompts/${name}.md: contains "task(" (should be "maestria_subagent(")`);
    allValid = false;
  }

  // Check body is non-empty
  const body = content.trim();
  if (body.length === 0) {
    console.error(`❌ prompts/${name}.md: empty body`);
    allValid = false;
  }

  console.log(`✅ prompts/${name}.md`);
}

process.exit(allValid ? 0 : 1);
