#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const homeDir = process.env.HOME || '';
const workspaceDir = path.join(homeDir, '.openclaw', 'workspace');
const defaultConfigPath = path.join(workspaceDir, '.openclaw', 'vcl-feedback-loop.json');

function parseArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeJson(filePath, value, { force = false } = {}) {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`Config already exists at ${filePath}. Re-run with --force to overwrite.`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function redactSecret(value) {
  if (!value) return '(missing)';
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function normalizeCurlText(text) {
  return String(text || '')
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuotes(value) {
  if (!value) return value;
  return value.replace(/^['"]|['"]$/g, '');
}

function extractUrlFromCurl(text) {
  const patterns = [
    /--url\s+("[^"]+"|'[^']+'|\S+)/i,
    /curl\s+("[^"]+"|'[^']+'|https?:\/\/\S+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return stripQuotes(match[1]);
  }
  return null;
}

function extractApiKeyFromCurl(text) {
  const headerPattern = /x-project-api-key\s*:\s*([^"'\\\s]+)/i;
  const match = text.match(headerPattern);
  if (match) return stripQuotes(match[1]);
  return null;
}

function summarizeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const configPath = parseArgValue('--config') || process.env.VCL_FEEDBACK_CONFIG_PATH || defaultConfigPath;
const force = hasFlag('--force');
const curlFile = parseArgValue('--curl-file');
const curlTextArg = parseArgValue('--curl');
const apiKeyArg = parseArgValue('--api-key') || process.env.VCL_FEEDBACK_API_KEY || null;
const urlArg = parseArgValue('--url') || process.env.VCL_FEEDBACK_URL || null;
const channel = parseArgValue('--channel') || process.env.OPENCLAW_NOTIFY_CHANNEL || null;
const target = parseArgValue('--target') || process.env.OPENCLAW_NOTIFY_TARGET || null;
const account = parseArgValue('--account') || process.env.OPENCLAW_NOTIFY_ACCOUNT || 'default';

let curlText = '';
if (curlFile) {
  curlText = readText(curlFile);
} else if (curlTextArg) {
  curlText = curlTextArg;
}

const normalizedCurl = normalizeCurlText(curlText);
const url = urlArg || extractUrlFromCurl(normalizedCurl);
const apiKey = apiKeyArg || extractApiKeyFromCurl(normalizedCurl);

if (!url || !apiKey) {
  console.error('Usage: node bootstrap-vcl-feedback-loop.js (--curl-file <file> | --curl <text> | --url <url> --api-key <key>) [--channel telegram --target <id> --account default] [--config <path>] [--force]');
  console.error('Tip: paste the exact VCL example curl command into a file and pass --curl-file.');
  process.exit(1);
}

const config = { url, apiKey };
if (target) {
  config.notify = {
    channel: channel || 'telegram',
    target,
    account
  };
}

try {
  writeJson(configPath, config, { force });
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}

console.log(`WROTE ${configPath}`);
console.log(`URL ${summarizeUrl(url)}`);
console.log(`API_KEY ${redactSecret(apiKey)}`);
if (config.notify) {
  console.log(`NOTIFY ${config.notify.channel}:${config.notify.target} (${config.notify.account})`);
}
