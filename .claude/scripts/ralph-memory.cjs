#!/usr/bin/env node
/**
 * Ralph Memory CLI — Persistent learnings across iterations
 *
 * Usage:
 *   node .claude/scripts/ralph-memory.js add --type pattern --tags "tag1,tag2" "content"
 *   node .claude/scripts/ralph-memory.js search "term"
 *   node .claude/scripts/ralph-memory.js list [--type TYPE] [--days N]
 *   node .claude/scripts/ralph-memory.js inject --budget 2000
 *   node .claude/scripts/ralph-memory.js prune --before DATE
 */

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', 'memories.md');

function readMemories() {
  if (!fs.existsSync(MEMORY_FILE)) return '';
  return fs.readFileSync(MEMORY_FILE, 'utf8');
}

function writeMemories(content) {
  fs.writeFileSync(MEMORY_FILE, content, 'utf8');
}

function generateId() {
  const ts = Math.floor(Date.now() / 1000);
  const rand = Math.random().toString(36).substring(2, 6);
  return `mem-${ts}-${rand}`;
}

function parseMemories(content) {
  const memories = [];
  const lines = content.split('\n');
  let currentType = null;
  let currentId = null;
  let currentContent = null;
  let currentTags = [];
  let currentDate = null;

  for (const line of lines) {
    const typeMatch = line.match(/^## (\w+)/);
    if (typeMatch) {
      currentType = typeMatch[1].toLowerCase();
      continue;
    }

    const idMatch = line.match(/^### (mem-[\w-]+)/);
    if (idMatch) {
      currentId = idMatch[1];
      continue;
    }

    const contentMatch = line.match(/^> (.+)/);
    if (contentMatch && currentId) {
      currentContent = contentMatch[1];
      continue;
    }

    const metaMatch = line.match(/<!-- tags: (.+?) \| created: (.+?) -->/);
    if (metaMatch && currentId) {
      currentTags = metaMatch[1].split(',').map(t => t.trim());
      currentDate = metaMatch[2].trim();
      memories.push({
        id: currentId,
        type: currentType,
        content: currentContent,
        tags: currentTags,
        date: currentDate,
      });
      currentId = null;
      currentContent = null;
    }
  }

  return memories;
}

function addMemory(type, tags, content) {
  const validTypes = ['patterns', 'decisions', 'fixes', 'context'];
  if (!validTypes.includes(type)) {
    console.error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const id = generateId();
  const date = new Date().toISOString().split('T')[0];
  const tagStr = tags.join(', ');

  const memoryBlock = `\n### ${id}\n> ${content}\n<!-- tags: ${tagStr} | created: ${date} -->\n`;

  let file = readMemories();
  const sectionHeader = `## ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const sectionIndex = file.indexOf(sectionHeader);

  if (sectionIndex === -1) {
    file += `\n${sectionHeader}\n${memoryBlock}`;
  } else {
    const nextSection = file.indexOf('\n## ', sectionIndex + 1);
    if (nextSection === -1) {
      file += memoryBlock;
    } else {
      file = file.slice(0, nextSection) + memoryBlock + file.slice(nextSection);
    }
  }

  writeMemories(file);
  console.log(`Added ${type} memory: ${id}`);
}

function searchMemories(term) {
  const memories = parseMemories(readMemories());
  const termLower = term.toLowerCase();
  const results = memories.filter(m =>
    m.content.toLowerCase().includes(termLower) ||
    m.tags.some(t => t.toLowerCase().includes(termLower))
  );

  if (results.length === 0) {
    console.log('No memories found.');
    return;
  }

  for (const m of results) {
    console.log(`[${m.type}] ${m.id} (${m.date})`);
    console.log(`  ${m.content}`);
    console.log(`  tags: ${m.tags.join(', ')}`);
    console.log();
  }
}

function listMemories(type, days) {
  let memories = parseMemories(readMemories());

  if (type) {
    memories = memories.filter(m => m.type === type);
  }

  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    memories = memories.filter(m => new Date(m.date) >= cutoff);
  }

  if (memories.length === 0) {
    console.log('No memories found.');
    return;
  }

  for (const m of memories) {
    console.log(`[${m.type}] ${m.id} (${m.date})`);
    console.log(`  ${m.content}`);
    console.log(`  tags: ${m.tags.join(', ')}`);
    console.log();
  }
}

function injectMemories(budget) {
  const memories = parseMemories(readMemories());
  let output = '# Memories from prior iterations:\n\n';
  let chars = output.length;

  for (const m of memories) {
    const line = `- [${m.type}] ${m.content} (${m.tags.join(', ')})\n`;
    if (chars + line.length > budget) break;
    output += line;
    chars += line.length;
  }

  console.log(output);
}

function pruneMemories(beforeDate) {
  const content = readMemories();
  const memories = parseMemories(content);
  const cutoff = new Date(beforeDate);
  const keep = memories.filter(m => new Date(m.date) >= cutoff);
  const removed = memories.length - keep.length;

  // Rebuild file
  let output = '';
  const types = ['patterns', 'decisions', 'fixes', 'context'];
  for (const type of types) {
    output += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n`;
    for (const m of keep.filter(mem => mem.type === type)) {
      output += `\n### ${m.id}\n> ${m.content}\n<!-- tags: ${m.tags.join(', ')} | created: ${m.date} -->\n`;
    }
    output += '\n';
  }

  writeMemories(output);
  console.log(`Pruned ${removed} memories before ${beforeDate}.`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add': {
    let type = 'context';
    let tags = [];
    let content = '';
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--type') { type = args[++i]; continue; }
      if (args[i] === '--tags') { tags = args[++i].split(',').map(t => t.trim()); continue; }
      content = args[i];
    }
    if (!content) { console.error('Usage: add --type TYPE --tags "t1,t2" "content"'); process.exit(1); }
    addMemory(type, tags, content);
    break;
  }
  case 'search': {
    searchMemories(args[1] || '');
    break;
  }
  case 'list': {
    let type = null;
    let days = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--type') { type = args[++i]; continue; }
      if (args[i] === '--days') { days = parseInt(args[++i]); continue; }
    }
    listMemories(type, days);
    break;
  }
  case 'inject': {
    let budget = 2000;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--budget') { budget = parseInt(args[++i]); continue; }
    }
    injectMemories(budget);
    break;
  }
  case 'prune': {
    let before = null;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--before') { before = args[++i]; continue; }
    }
    if (!before) { console.error('Usage: prune --before YYYY-MM-DD'); process.exit(1); }
    pruneMemories(before);
    break;
  }
  default:
    console.error('Commands: add, search, list, inject, prune');
    process.exit(1);
}
