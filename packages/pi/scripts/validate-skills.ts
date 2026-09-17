#!/usr/bin/env node
import { validateSkillsAndLog } from '@maestria/core/skill-validator';

const root = new URL('../', import.meta.url).pathname;

const skills = ['orchestrator', 'global-rules', 'handoff', 'iteration-limits'];
const allValid = validateSkillsAndLog({ root, skills });

if (!allValid) {
  throw new Error('Skill validation failed');
}
