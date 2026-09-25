#!/usr/bin/env node
import { validateSkillsAndLog } from '@maestria/core/skill-validator';
import path from 'node:path';

const __dirname = import.meta.dirname;
const root = path.join(__dirname, '..');

const skills = ['orchestrator', 'global-rules', 'handoff', 'iteration-limits'];
const allValid = validateSkillsAndLog({ root, skills });

process.exit(allValid ? 0 : 1);
