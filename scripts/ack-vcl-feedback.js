#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const homeDir = process.env.HOME || '';
const workspaceDir = path.join(homeDir, '.openclaw', 'workspace');
const defaultStatePath = path.join(workspaceDir, '.state', 'vcl-feedback-loop-state.json');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function parseArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

const statePath = parseArgValue('--state') || process.env.VCL_FEEDBACK_STATE_PATH || defaultStatePath;
const ids = process.argv
  .slice(2)
  .filter((value, index, values) => value !== '--state' && values[index - 1] !== '--state');

if (!ids.length) {
  console.error('Usage: node ack-vcl-feedback.js <feedbackId> [moreIds...] [--state <path>]');
  process.exit(1);
}

const state = readJson(statePath, {
  ackedKeys: [],
  pendingFindings: [],
  notifiedKeys: [],
  history: [],
  lastFeedFingerprint: null
});

const pending = state.pendingFindings || [];
const acked = new Set(state.ackedKeys || state.seenKeys || []);
const matchedItems = [];
const missingIds = [];

for (const id of ids) {
  const matches = pending.filter((item) => String(item.sourceId) === String(id));
  if (!matches.length) {
    missingIds.push(String(id));
    continue;
  }
  for (const item of matches) {
    matchedItems.push(item);
    acked.add(item.key);
  }
}

if (missingIds.length) {
  console.error(`No pending finding found for id(s): ${missingIds.join(', ')}`);
  process.exit(1);
}

const matchedKeys = new Set(matchedItems.map((item) => item.key));
const matchedIds = new Set(matchedItems.map((item) => String(item.sourceId)));

writeJson(statePath, {
  ackedKeys: Array.from(acked).slice(-500),
  pendingFindings: pending.filter((item) => !matchedKeys.has(item.key)).slice(-100),
  notifiedKeys: (state.notifiedKeys || []).filter((key) => !matchedKeys.has(key)).slice(-500),
  history: [
    ...(state.history || []),
    {
      checkedAt: new Date().toISOString(),
      ackedSourceIds: Array.from(matchedIds),
      ackedKeys: Array.from(matchedKeys)
    }
  ].slice(-200),
  lastFeedFingerprint: state.lastFeedFingerprint || null
});

console.log(`ACKED ${Array.from(matchedIds).join(', ')}`);
