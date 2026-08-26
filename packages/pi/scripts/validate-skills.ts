#!/usr/bin/env node
import { join } from 'node:path';
import { validateSkillsAndLog } from '@maestria/core/skill-validator';

const __dirname = import.meta.dirname;
const root = join(__dirname, '..');

const skills = ['orchestrator', 'global-rules', 'handoff', 'iteration-limits'];
const allValid = validateSkillsAndLog({ root, skills });

process.exit(allValid ? 0 : 1);
