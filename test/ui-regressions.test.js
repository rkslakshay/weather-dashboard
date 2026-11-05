const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the sky scene contains its overflow, so the hero cannot be scrolled sideways', () => {
  const rule = read('style.css').match(/\.scene \{[^}]*\}/);
  assert.ok(rule, 'expected a .scene rule');
  assert.match(rule[0], /overflow:\s*hidden/);
});

test('the PDF confirmation does not claim the browser has saved the file', () => {
  const script = read('script.js');
  assert.ok(!script.includes("toast('Report downloaded')"));
  assert.match(script, /PDF report created\. Check your downloads\./);
});
