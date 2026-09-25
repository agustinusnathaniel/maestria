#!/usr/bin/env node
// Validates the generated Prime Agent skills against the documented Agent
// Skills contract that Prime enforces: skills/<name>/SKILL.md exists, frontmatter
// carries a required `name` (1-64 lowercase a-z/0-9/hyphens, no leading/trailing
// or consecutive hyphens, matching the parent directory) and a required
// non-empty `description` of at most 1024 characters, and the body is non-empty.
// Prime does not load skills with a missing description; name mismatches and
// other violations warn but still load.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  DESCRIPTION_MAX,
  frontmatterValue,
  isValidSkillName,
  NAME_MAX,
} from './skill-validation.ts';

const __dirname = import.meta.dirname;
const root = path.join(__dirname, '..');

const skills = [
  'adventurer',
  'architect',
  'blitz',
  'builder',
  'diagnose',
  'fein',
  'global-rules',
  'handoff',
  'iteration-limits',
  'orchestrator',
  'planner',
  'reviewer',
  'sonar',
  'writer',
];
// Prime's documented skill name grammar, length limit, and description limit
// (Agent Skills specification) live in `skill-validation.ts` so the validator
// and its tests share one source of truth.

let allValid = true;

for (const name of skills) {
  const skillPath = path.join(root, 'skills', name, 'SKILL.md');
  if (!existsSync(skillPath)) {
    console.error(`❌ Missing: skills/${name}/SKILL.md`);
    allValid = false;
    continue;
  }
  const content = readFileSync(skillPath, 'utf-8');
  const frontmatterMatch = /^---\n(?<frontmatter>[\s\S]*?)\n---/u.exec(content);
  const frontmatter = frontmatterMatch?.groups?.frontmatter;
  if (frontmatter === undefined) {
    console.error(`❌ skills/${name}/SKILL.md: missing or invalid frontmatter`);
    allValid = false;
    continue;
  }
  const nameValue = frontmatterValue(frontmatter, 'name');
  if (nameValue === undefined) {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter missing "name"`);
    allValid = false;
  } else if (nameValue === '') {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter "name" is empty`);
    allValid = false;
  } else if (nameValue !== name || !isValidSkillName(nameValue)) {
    console.error(
      `❌ skills/${name}/SKILL.md: frontmatter name "${nameValue}" does not match the skill directory or violates the Agent Skills name grammar (1-${NAME_MAX} lowercase a-z/0-9/hyphens, no leading/trailing or consecutive hyphens)`,
    );
    allValid = false;
  }

  const description = frontmatterValue(frontmatter, 'description');
  if (description === undefined) {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter missing "description"`);
    allValid = false;
  } else if (description === '') {
    console.error(`❌ skills/${name}/SKILL.md: frontmatter description is empty`);
    allValid = false;
  } else if (description.length > DESCRIPTION_MAX) {
    console.error(
      `❌ skills/${name}/SKILL.md: frontmatter description is ${description.length} characters, exceeding the ${DESCRIPTION_MAX}-character limit`,
    );
    allValid = false;
  }

  if (content.trim().split('\n---')[1]?.trim().length === 0) {
    console.error(`❌ skills/${name}/SKILL.md: no body content after frontmatter`);
    allValid = false;
  }
  if (!content.includes('Auto-generated from @maestria/core')) {
    console.error(`❌ skills/${name}/SKILL.md: missing auto-generated header`);
    allValid = false;
  }
  console.log(`✅ skills/${name}/SKILL.md`);
}

process.exit(allValid ? 0 : 1);
