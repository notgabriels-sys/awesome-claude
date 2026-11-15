#!/usr/bin/env node
// Dependency-free structural check for README.md.
// Usage: node scripts/check-readme.mjs [path]
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'README.md';
const lines = readFileSync(file, 'utf8').split('\n');
const errors = [];
const fail = (line, msg) => errors.push(`${file}:${line}: ${msg}`);

// GitHub's heading -> anchor algorithm: lowercase, drop everything that is
// not a letter, number, space, hyphen or underscore, then spaces -> hyphens.
const slug = (text) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, '')
    .replace(/ /g, '-');

const anchors = new Set();
for (const line of lines) {
  const m = /^#{1,6}\s+(.*)$/.exec(line);
  if (m) anchors.add(slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')));
}

// An entry is a list item that opens with a link: "- [Name](url) - Description."
const ENTRY = /^(\s*)- \[([^\]]+)\]\(([^)\s]+)\)(.*)$/;
let section = '';
let seen = new Map();

lines.forEach((line, i) => {
  const n = i + 1;

  if (/[ \t]+$/.test(line)) fail(n, 'trailing whitespace');

  const heading = /^#{2,6}\s+(.*)$/.exec(line);
  if (heading) {
    section = heading[1];
    seen = new Map();
  }

  for (const m of line.matchAll(/\]\((#[^)]*)\)/g)) {
    if (!anchors.has(decodeURIComponent(m[1].slice(1)))) {
      fail(n, `anchor ${m[1]} does not match any heading`);
    }
  }
  for (const m of line.matchAll(/\]\((http:\/\/[^)]*)\)/g)) {
    fail(n, `insecure link ${m[1]} (use https)`);
  }

  const entry = ENTRY.exec(line);
  if (!entry) return;
  const [, , name, url, rest] = entry;
  if (url.startsWith('#')) return; // table of contents

  if (seen.has(url)) {
    fail(n, `"${name}" repeats a link already listed on line ${seen.get(url)} of "${section}"`);
  }
  seen.set(url, n);

  if (!rest.startsWith(' - ')) {
    fail(n, `"${name}" must be followed by " - Description."`);
  } else if (/^ - \s/.test(rest)) {
    fail(n, `"${name}" has extra spaces after the " - " separator`);
  } else if (!/^ - [\p{Lu}\p{N}`"']/u.test(rest)) {
    fail(n, `"${name}" description should start with a capital letter`);
  }
  if (!/[.!?)]$/.test(rest)) {
    fail(n, `"${name}" description should end with a full stop`);
  }
});

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s) in ${file}`);
  process.exit(1);
}
console.log(`${file}: OK (${anchors.size} headings checked)`);
