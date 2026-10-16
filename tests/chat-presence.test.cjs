const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { PresenceIndicator } = require('./source-loader.cjs')()('src/components/chat/PresenceIndicator.tsx');

test('unknown presence never renders an online dot and confirmed inactive status stays gray', () => {
  const render = props => renderToStaticMarkup(React.createElement(PresenceIndicator, props));
  assert.equal(render({}), '');
  assert.match(render({ online: false }), /Inactive/);
  assert.match(render({ online: false }), /bg-zinc-300/);
  assert.doesNotMatch(render({ online: false }), /bg-emerald-500/);
  assert.match(render({ online: true }), /bg-emerald-500/);
  assert.match(render({ online: true, compact: true }), /aria-label="Active"/);
});
