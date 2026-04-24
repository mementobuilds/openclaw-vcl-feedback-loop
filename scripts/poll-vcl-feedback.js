#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const homeDir = process.env.HOME || '';
const workspaceDir = path.join(homeDir, '.openclaw', 'workspace');
const defaultConfigPath = path.join(workspaceDir, '.openclaw', 'vcl-feedback-loop.json');
const defaultStatePath = path.join(workspaceDir, '.state', 'vcl-feedback-loop-state.json');
const defaultOpenclawBin = path.join(homeDir, '.npm-global', 'bin', 'openclaw');
const openclawBin = process.env.OPENCLAW_BIN || (fs.existsSync(defaultOpenclawBin) ? defaultOpenclawBin : 'openclaw');
const MAX_ITEMS_PER_MESSAGE = Number(process.env.VCL_MAX_ITEMS_PER_MESSAGE || 5);

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

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) return null;
  return String(baseUrl).replace(/\/+$/, '');
}

function buildInsightsUrl(baseUrl, projectId, range, source) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!normalizedBaseUrl || !projectId) return null;
  const params = new URLSearchParams({
    range: range || '30d',
    source: source || 'all'
  });
  return `${normalizedBaseUrl}/api/project-intelligence/v1/projects/${encodeURIComponent(String(projectId))}/insights?${params.toString()}`;
}

function loadConfig() {
  const configPath = parseArgValue('--config') || process.env.VCL_FEEDBACK_CONFIG_PATH || defaultConfigPath;
  const fileConfig = readJson(configPath, {}) || {};
  const projectId = parseArgValue('--project') || process.env.VCL_PROJECT_ID || fileConfig.projectId || null;
  const range = parseArgValue('--range') || process.env.VCL_RANGE || fileConfig.range || '30d';
  const source = parseArgValue('--source') || process.env.VCL_SOURCE || fileConfig.source || 'all';
  const baseUrl = parseArgValue('--base-url') || process.env.VCL_BASE_URL || fileConfig.baseUrl || null;
  const url = parseArgValue('--url') || process.env.VCL_FEEDBACK_URL || fileConfig.url || buildInsightsUrl(baseUrl, projectId, range, source);
  const apiKey = parseArgValue('--api-key') || process.env.VCL_FEEDBACK_API_KEY || fileConfig.apiKey || null;
  const notify = fileConfig.notify || {};
  const notifyChannel = parseArgValue('--channel') || process.env.OPENCLAW_NOTIFY_CHANNEL || notify.channel || 'telegram';
  const notifyTarget = parseArgValue('--target') || process.env.OPENCLAW_NOTIFY_TARGET || notify.target || null;
  const notifyAccount = parseArgValue('--account') || process.env.OPENCLAW_NOTIFY_ACCOUNT || notify.account || 'default';
  const statePath = parseArgValue('--state') || process.env.VCL_FEEDBACK_STATE_PATH || defaultStatePath;

  return {
    configPath,
    statePath,
    url,
    apiKey,
    projectId: projectId || fileConfig.projectId || null,
    range,
    source,
    notifyChannel,
    notifyTarget,
    notifyAccount
  };
}

function normalizeFinding(item) {
  const key = [item.sourceType || 'unknown', item.sourceId || 'na', item.createdAt || 'na'].join(':');
  return {
    key,
    sourceType: item.sourceType || 'unknown',
    sourceId: item.sourceId ?? null,
    createdAt: item.createdAt || null,
    category: item.category || 'general',
    sourcePath: item.sourcePath || null,
    text: String(item.text || '').trim(),
    media: item.media || null
  };
}

function httpsJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid JSON: ${error.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildFeedFingerprint(findings) {
  const normalized = findings
    .map((item) => ({
      key: item.key,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      createdAt: item.createdAt,
      category: item.category,
      sourcePath: item.sourcePath,
      text: item.text,
      media: item.media || null
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return stableStringify(normalized);
}

function hasFeedChanged(previousFingerprint, nextFingerprint) {
  return previousFingerprint !== nextFingerprint;
}

function mergePending(existingPending, findings) {
  const byKey = new Map();
  for (const item of existingPending || []) {
    byKey.set(item.key, item);
  }
  for (const item of findings || []) {
    byKey.set(item.key, item);
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const left = a.createdAt || '';
    const right = b.createdAt || '';
    return left.localeCompare(right);
  });
}

function selectNotifyCandidates(pendingFindings, notifiedSet) {
  return pendingFindings
    .filter((item) => !notifiedSet.has(item.key))
    .slice(0, MAX_ITEMS_PER_MESSAGE);
}

function toMessage(items, projectId) {
  if (!items.length) return 'NO_NEW_FEEDBACK';

  const heading = projectId ? `Pending VCL feedback for project ${projectId}.` : 'Pending VCL feedback.';
  const lines = [
    heading,
    '',
    ...items.flatMap((item, index) => {
      const block = [
        `${index + 1}. [${item.sourceType}] id=${item.sourceId} · ${item.createdAt || 'unknown time'}`,
        item.text || '(no text)'
      ];
      if (item.sourcePath) block.push(`Path: ${item.sourcePath}`);
      if (item.media && Array.isArray(item.media.imageUrls) && item.media.imageUrls.length) {
        block.push(`Media: ${item.media.imageUrls.join(', ')}`);
      }
      return [...block, ''];
    }),
    'Reply with: OK <id> or HOLD <id>'
  ];

  return lines.join('\n').trim();
}

function sendOpenclawMessage(message, channel, target, account) {
  if (!target) {
    throw new Error('Missing notify target. Set --target, OPENCLAW_NOTIFY_TARGET, or notify.target in config.');
  }

  const args = ['message', 'send', '--channel', channel || 'telegram'];
  if (account) {
    args.push('--account', account);
  }
  args.push('--target', String(target), '--message', message, '--json');

  const result = spawnSync(openclawBin, args, {
    cwd: workspaceDir,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(details || `openclaw message send exited with code ${result.status}`);
  }

  return result.stdout.trim();
}

(async () => {
  const shouldPrintMessage = process.argv.includes('--message');
  const shouldPrintNewMessage = process.argv.includes('--new-message');
  const shouldNotifyOpenclaw = process.argv.includes('--notify-openclaw');
  const config = loadConfig();

  if (!config.url || !config.apiKey) {
    console.error(`Missing VCL config. Provide url+apiKey, or baseUrl+projectId+apiKey. Checked ${config.configPath}`);
    process.exit(1);
  }

  const state = readJson(config.statePath, {
    ackedKeys: [],
    pendingFindings: [],
    notifiedKeys: [],
    history: [],
    lastFeedFingerprint: null
  });

  const payload = await httpsJson(config.url, {
    Accept: 'application/json',
    'x-project-api-key': config.apiKey,
    'User-Agent': 'openclaw-vcl-feedback-loop'
  });

  const findings = (payload.findings || []).map(normalizeFinding);
  const feedFingerprint = buildFeedFingerprint(findings);
  const acked = new Set((state.ackedKeys || state.seenKeys || []).slice(-500));
  const notified = new Set((state.notifiedKeys || []).filter((key) => !acked.has(key)).slice(-500));
  const currentPending = (state.pendingFindings || []).filter((item) => item && !acked.has(item.key));
  const feedChanged = hasFeedChanged(state.lastFeedFingerprint || null, feedFingerprint);

  let pendingFindings = currentPending;
  let surfacedFindings = currentPending.slice(0, MAX_ITEMS_PER_MESSAGE);
  let notifyCandidates = selectNotifyCandidates(currentPending, notified);
  let brandNewFindings = [];
  let nextState = {
    ackedKeys: Array.from(acked).slice(-500),
    pendingFindings: currentPending.slice(-100),
    notifiedKeys: Array.from(notified).slice(-500),
    history: (state.history || []).slice(-200),
    lastFeedFingerprint: state.lastFeedFingerprint || null
  };

  if (feedChanged) {
    const pendingFromFeed = findings.filter((item) => !acked.has(item.key));
    pendingFindings = mergePending(currentPending, pendingFromFeed);
    surfacedFindings = pendingFindings.slice(0, MAX_ITEMS_PER_MESSAGE);
    notifyCandidates = selectNotifyCandidates(pendingFindings, notified);
    brandNewFindings = findings.filter((item) => !acked.has(item.key) && !currentPending.some((pending) => pending.key === item.key));

    nextState = {
      ackedKeys: Array.from(acked).slice(-500),
      pendingFindings: pendingFindings.slice(-100),
      notifiedKeys: Array.from(notified).slice(-500),
      history: [
        ...(state.history || []),
        {
          checkedAt: new Date().toISOString(),
          totalFindings: findings.length,
          pendingKeys: pendingFindings.map((item) => item.key),
          surfacedKeys: surfacedFindings.map((item) => item.key),
          notifyCandidateKeys: notifyCandidates.map((item) => item.key),
          brandNewKeys: brandNewFindings.map((item) => item.key),
          feedChanged: true
        }
      ].slice(-200),
      lastFeedFingerprint: feedFingerprint
    };

    writeJson(config.statePath, nextState);
  }

  const result = {
    checkedAt: new Date().toISOString(),
    projectId: payload.projectId || config.projectId || null,
    totalFindings: findings.length,
    pendingCount: pendingFindings.length,
    surfacedCount: surfacedFindings.length,
    notifyCandidateCount: notifyCandidates.length,
    brandNewCount: brandNewFindings.length,
    pendingFindings,
    surfacedFindings,
    notifyCandidates,
    statePath: config.statePath,
    sourceBreakdown: payload.sourceBreakdown || null,
    feedChanged
  };

  if (shouldNotifyOpenclaw) {
    const message = toMessage(notifyCandidates, result.projectId);
    if (message === 'NO_NEW_FEEDBACK') {
      process.stdout.write('NO_NEW_FEEDBACK');
      return;
    }

    sendOpenclawMessage(message, config.notifyChannel, config.notifyTarget, config.notifyAccount);

    const notifiedAfterSend = new Set(nextState.notifiedKeys || []);
    for (const item of notifyCandidates) {
      notifiedAfterSend.add(item.key);
    }

    writeJson(config.statePath, {
      ...nextState,
      notifiedKeys: Array.from(notifiedAfterSend).slice(-500),
      history: [
        ...nextState.history,
        {
          checkedAt: new Date().toISOString(),
          notifiedKeys: notifyCandidates.map((item) => item.key),
          notifyTarget: `${config.notifyChannel || 'telegram'}:${config.notifyTarget}`
        }
      ].slice(-200)
    });

    process.stdout.write(message);
    return;
  }

  if (shouldPrintNewMessage) {
    process.stdout.write(toMessage(notifyCandidates, result.projectId));
    return;
  }

  if (shouldPrintMessage) {
    process.stdout.write(toMessage(surfacedFindings, result.projectId));
    return;
  }

  process.stdout.write(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
