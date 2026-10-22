const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loader = require('./source-loader.cjs');
const { containsOffensiveLanguage } = loader()('src/utils/offensiveLanguage.ts');
const root = path.resolve(__dirname, '../../');
const cases = require('./fixtures/chat-language-cases.json');

test('English/Filipino obfuscations and ordinary work phrases use the shared regression corpus', () => {
  for (const [group, expected] of [['flagged', true], ['clean', false]]) {
    for (const text of cases[group]) assert.equal(containsOffensiveLanguage(text), expected, text);
  }
  assert.equal(containsOffensiveLanguage('> [Bobo|https://example.test/shit|id]: Hello\n\nThank you'), false);
  assert.equal(containsOffensiveLanguage('> [Person||id]: gago\n\nThank you'), true);
});

test('mobile and web ship the exact same offline detector', { skip: !fs.existsSync(path.join(root, 'front_end_2/SerbiSure-Frontend/src/features/chat/offensiveLanguage.ts')) }, () => {
  assert.equal(fs.readFileSync(path.join(root, 'serbisure-admin/src/utils/offensiveLanguage.ts'), 'utf8'),
    fs.readFileSync(path.join(root, 'front_end_2/SerbiSure-Frontend/src/features/chat/offensiveLanguage.ts'), 'utf8'));
});
