#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const homeDir = process.env.HOME || '';
const workspaceDir = path.join(homeDir, '.openclaw', 'workspace');
const defaultConfigPath = path.join(workspaceDir, '.openclaw', 'vcl-feedback-loop.json');
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

function inferProjectId(config) {
  if (process.env.VCL_PROJECT_ID) return String(process.env.VCL_PROJECT_ID);
  if (config?.projectId) return String(config.projectId);
  if (!config?.url) return null;
  const match = config.url.match(/\/projects\/(\d+)\//);
  return match ? match[1] : null;
}

function loadConfig() {
  const configPath = parseArgValue('--config') || process.env.VCL_FEEDBACK_CONFIG_PATH || defaultConfigPath;
  const fileConfig = readJson(configPath, {}) || {};
  const projectId = inferProjectId(fileConfig);
  const apiKey = parseArgValue('--api-key') || process.env.VCL_FEEDBACK_API_KEY || fileConfig.apiKey || null;
  const baseUrl = String(parseArgValue('--base-url') || process.env.VCL_BASE_URL || fileConfig.baseUrl || 'https://vibecodinglist.com').replace(/\/+$/, '');
  const statePath = parseArgValue('--state') || process.env.VCL_FEEDBACK_STATE_PATH || defaultStatePath;
  return { configPath, statePath, projectId, apiKey, baseUrl };
}

function httpsJson(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 1000)}`));
          return;
        }
        if (!data.trim()) {
          resolve({ ok: true });
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postFeedbackReply(config, content, parentId) {
  if (!config.projectId || !config.apiKey) {
    throw new Error(`Missing VCL write config. Need projectId and apiKey via ${config.configPath}, env vars, or CLI flags.`);
  }

  const url = `${config.baseUrl}/api/project-intelligence/v1/projects/${config.projectId}/feedback`;
  return httpsJson('POST', url, {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-project-api-key': config.apiKey,
    'User-Agent': 'openclaw-vcl-feedback-loop'
  }, JSON.stringify({
    content,
    type: 'comment',
    parentId: Number(parentId)
  }));
}

function ackBySourceId(statePath, id) {
  const state = readJson(statePath, {
    ackedKeys: [],
    pendingFindings: [],
    pendingReplies: [],
    notifiedKeys: [],
    authoredSourceIds: [],
    authoredTexts: [],
    history: [],
    lastFeedFingerprint: null,
    feedKind: null
  });

  const pending = state.pendingFindings || [];
  const matched = pending.filter((item) => String(item.sourceId) === String(id));
  if (!matched.length) {
    return false;
  }

  const acked = new Set(state.ackedKeys || state.seenKeys || []);
  for (const item of matched) acked.add(item.key);
  const matchedKeys = new Set(matched.map((item) => item.key));
  const notifiedKeys = (state.notifiedKeys || []).filter((key) => !matchedKeys.has(key));

  writeJson(statePath, {
    ...state,
    ackedKeys: Array.from(acked).slice(-500),
    pendingFindings: pending.filter((item) => String(item.sourceId) !== String(id)).slice(-100),
    notifiedKeys: notifiedKeys.slice(-1000),
    history: [
      ...(state.history || []),
      {
        checkedAt: new Date().toISOString(),
        ackedSourceId: String(id),
        ackedKeys: matched.map((item) => item.key),
        ackReason: 'response-handler'
      }
    ].slice(-200)
  });

  return true;
}

function getPendingFindings(statePath) {
  const state = readJson(statePath, { pendingFindings: [] });
  return (state.pendingFindings || []).filter(Boolean);
}

function resolveFeedbackId(statePath, requestedId) {
  if (requestedId) return String(requestedId);
  const pending = getPendingFindings(statePath);
  if (pending.length === 1) return String(pending[0].sourceId);
  if (!pending.length) throw new Error('No pending feedback items to infer an id from');
  throw new Error(`Multiple pending feedback items exist; specify an id (${pending.map((item) => item.sourceId).join(', ')})`);
}

function parseInput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Missing response text');

  const okMatch = trimmed.match(/^OK(?:\s+(\d+))?(?:\s+.*)?$/i);
  if (okMatch) return { action: 'ok', id: okMatch[1] || null, remainder: '' };

  const holdMatch = trimmed.match(/^HOLD(?:\s+(\d+))?(?:\s+.*)?$/i);
  if (holdMatch) return { action: 'hold', id: holdMatch[1] || null, remainder: '' };

  const askMatch = trimmed.match(/^(?:ASK|QUESTION|Q)(?:\s+(\d+))?\s+([\s\S]+)$/i);
  if (askMatch) return { action: 'ask', id: askMatch[1] || null, remainder: askMatch[2].trim() };

  const explicitIdQuestion = trimmed.match(/^(\d+)\s+([\s\S]+)$/);
  if (explicitIdQuestion) return { action: 'ask', id: explicitIdQuestion[1], remainder: explicitIdQuestion[2].trim() };

  return { action: 'ask', id: null, remainder: trimmed };
}

async function main() {
  const config = loadConfig();
  const text = process.argv.slice(2).filter((part, index, values) => {
    const prev = values[index - 1];
    return part !== '--config' && part !== '--state' && part !== '--api-key' && part !== '--base-url' && prev !== '--config' && prev !== '--state' && prev !== '--api-key' && prev !== '--base-url';
  }).join(' ').trim();

  if (!text) {
    console.error('Usage: node scripts/handle-vcl-response.js "OK 24"');
    console.error('       node scripts/handle-vcl-response.js "HOLD 24"');
    console.error('       node scripts/handle-vcl-response.js "ASK 24 Could you clarify ...?"');
    console.error('       node scripts/handle-vcl-response.js "Could you ask whether this is only on mobile?"');
    process.exit(1);
  }

  const parsed = parseInput(text);
  const id = resolveFeedbackId(config.statePath, parsed.id);

  if (parsed.action === 'ok') {
    const acked = ackBySourceId(config.statePath, id);
    process.stdout.write(JSON.stringify({ ok: true, action: 'ok', feedbackId: Number(id), acked }, null, 2));
    return;
  }

  if (parsed.action === 'hold') {
    const acked = ackBySourceId(config.statePath, id);
    process.stdout.write(JSON.stringify({ ok: true, action: 'hold', feedbackId: Number(id), acked }, null, 2));
    return;
  }

  const result = await postFeedbackReply(config, parsed.remainder, id);
  process.stdout.write(JSON.stringify({ ok: true, action: 'ask', feedbackId: Number(id), posted: true, content: parsed.remainder, result }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
