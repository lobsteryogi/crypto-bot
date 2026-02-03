#!/usr/bin/env node
/**
 * Generate trading rules from self-learning analysis
 * and update MEMORY.md with insights
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LEARNING_SKILL_PATH = '/root/.openclaw/workspace/skills/crypto-self-learning';
const MEMORY_PATH = '/root/.openclaw/workspace/MEMORY.md';

async function generateRules() {
  console.log('🧠 Generating trading rules from self-learning data...\n');

  try {
    // Run generate_rules.py
    const { stdout } = await execAsync(`python3 ${LEARNING_SKILL_PATH}/scripts/generate_rules.py`);
    return stdout;
  } catch (error) {
    console.error(`❌ Failed to generate rules: ${error.message}`);
    return null;
  }
}

async function updateMemory(rules) {
  if (!rules) {
    console.log('⚠️ No rules to update.');
    return;
  }

  console.log('\n📝 Updating MEMORY.md with learned rules...\n');

  // Read current MEMORY.md
  let memory = '';
  if (fs.existsSync(MEMORY_PATH)) {
    memory = fs.readFileSync(MEMORY_PATH, 'utf8');
  }

  // Check if section exists
  const sectionMarker = '## 🧠 Crypto Bot Learned Rules';
  const hasSection = memory.includes(sectionMarker);

  if (hasSection) {
    // Replace existing section
    const regex = /## 🧠 Crypto Bot Learned Rules[\s\S]*?(?=\n## |$)/;
    const newSection = `${sectionMarker}\n*Auto-generated from trade history analysis*\n\n${rules}\n`;
    memory = memory.replace(regex, newSection);
  } else {
    // Append new section
    const newSection = `\n${sectionMarker}\n*Auto-generated from trade history analysis*\n\n${rules}\n`;
    memory += newSection;
  }

  // Write back
  fs.writeFileSync(MEMORY_PATH, memory);
  console.log('✅ MEMORY.md updated with latest rules');
}

async function main() {
  const rules = await generateRules();
  
  if (rules) {
    console.log(rules);
    await updateMemory(rules);
  }
  
  console.log('\n✅ Done!');
}

main().catch(error => {
  console.error(`❌ Fatal error: ${error.message}`);
  process.exit(1);
});
