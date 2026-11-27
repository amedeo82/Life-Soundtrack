#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = join(import.meta.dirname, '..');
const workflow = readFileSync(join(root, '.github/workflows/auto-status-done.yml'), 'utf8');
const lines = workflow.split('\n');
const scriptStart = lines.findIndex((line) => /^\s*script:\s*\|\s*$/.test(line));
assert.notEqual(scriptStart, -1);
const baseIndent = lines[scriptStart].match(/^\s*/)[0].length;
const body = [];
for (let i = scriptStart + 1; i < lines.length; i++) {
  const indent = lines[i].match(/^\s*/)[0].length;
  if (lines[i].trim() && indent <= baseIndent) break;
  body.push(lines[i].slice(baseIndent + 2));
}
const source = body.join('\n');
const run = new Function('github', 'context', 'core', `return (async () => {\n${source}\n})();`);

function harness({ prNumber, body, target, mutationError }) {
  const state = { failures: [], added: [], removed: [], comments: [] };
  const core = {
    info() {},
    warning() {},
    setFailed(message) {
      state.failures.push(message);
    },
  };
  const context = {
    repo: { owner: 'amedeo82', repo: 'Life-Soundtrack' },
    payload: {
      pull_request: {
        number: prNumber,
        body,
        merge_commit_sha: 'abc123',
        merged_at: '2026-11-13T10:19:44Z',
      },
    },
  };
  const github = {
    paginate: async () => [{ id: 1, body: 'claim: kilo-test (UTC 2026-11-13T10:00:00Z)' }],
    rest: {
      issues: {
        get: async () => ({ data: target }),
        addLabels: async (input) => {
          if (mutationError) throw mutationError;
          state.added.push(input);
        },
        removeLabel: async (input) => {
          state.removed.push(input);
        },
        createComment: async (input) => {
          state.comments.push(input);
        },
        listComments: async () => [],
      },
    },
  };
  return { state, execute: () => run(github, context, core) };
}

{
  const h = harness({
    prNumber: 330,
    body: 'Closes #330',
    target: { number: 330, state: 'open' },
  });
  await h.execute();
  assert.equal(h.state.failures.length, 1);
  assert.match(h.state.failures[0], /pull request itself/);
  assert.equal(h.state.added.length, 0);
  assert.equal(h.state.removed.length, 0);
}

{
  const h = harness({
    prNumber: 331,
    body: 'Closes #330',
    target: { number: 330, state: 'open', pull_request: { url: 'https://api.github.com/pulls/330' } },
  });
  await h.execute();
  assert.equal(h.state.failures.length, 1);
  assert.match(h.state.failures[0], /is a pull request/);
  assert.equal(h.state.added.length, 0);
  assert.equal(h.state.removed.length, 0);
}

{
  const h = harness({
    prNumber: 331,
    body: 'Closes #330',
    target: { number: 330, state: 'open' },
  });
  await h.execute();
  assert.equal(h.state.failures.length, 0);
  assert.equal(h.state.added.length, 1);
  assert.equal(h.state.removed.length, 3);
  assert.equal(h.state.comments.length, 1);
}

{
  const h = harness({
    prNumber: 331,
    body: 'Closes #330',
    target: { number: 330, state: 'open' },
    mutationError: new Error('permission denied'),
  });
  await h.execute();
  assert.equal(h.state.failures.length, 1);
  assert.match(h.state.failures[0], /permission denied/);
}

console.log('ALL PASS: auto-status-done rejects PR targets and fails closed');
