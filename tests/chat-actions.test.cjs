const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const Renderer = require('react-test-renderer');
const { act } = Renderer;
const loader = require('./source-loader.cjs');
const { getReplyRelationship, parseChatReply, makeChatReply, withChatReply } = loader()('src/data/chatReplies.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const message = (id, text = 'Hello admin', extra = {}) => ({ chat_message_id: id, sender_id: 'resident', receiver_id: 'admin',
  message_payload: text, message_type: 'text', createdAt: '2026-10-18T10:00:00Z', ...extra });

test('quotes round-trip through the existing mobile format, including photos, old formats, and multiline snippets', () => {
  const target = message('photo-id', 'First line\nSecond line', { message_type: 'image', image_url: 'https://example.test/photo.jpg' });
  const reply = makeChatReply(target, 'Sakura Sasuke');
  const payload = withChatReply('I received your photo', reply);
  assert.match(payload, /^> \[Sakura Sasuke\|https:\/\/example.test\/photo.jpg\|photo-id\]: First line Second line\n\n/);
  assert.deepEqual(parseChatReply(payload), { text: 'I received your photo', reply });
  assert.equal(makeChatReply(message('nested', payload), 'Admin').text, 'I received your photo');
  assert.equal(parseChatReply(withChatReply('', reply)).text, '📷 Photo');
  assert.equal(parseChatReply('> [You|message-id]: Original\n\nAnswer').reply.messageId, 'message-id');
  assert.equal(parseChatReply('> [You|https://example.test/old.jpg]: Photo\n\nAnswer').reply.imageUri, 'https://example.test/old.jpg');
  assert.deepEqual(parseChatReply('ordinary message'), { text: 'ordinary message' });
});

test('reply relationship labels cover all sender and quoted-author combinations', () => {
  assert.equal(getReplyRelationship(false, true, 'Sakura Sasuke'), 'Sakura Sasuke replied to you');
  assert.equal(getReplyRelationship(false, false, 'Sakura Sasuke'), 'Sakura Sasuke replied to themself');
  assert.equal(getReplyRelationship(true, false, 'Sakura Sasuke'), 'You replied to Sakura Sasuke');
  assert.equal(getReplyRelationship(true, true, 'Sakura Sasuke'), 'You replied to yourself');
});

test('API helpers send quoted text and image captions unchanged and remove through the authenticated endpoint without retries', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { calls.push(args); return { data: message('saved') }; } } })('src/api/adminApi.ts');
  const payload = withChatReply('Answer', makeChatReply(message('original'), 'Sakura'));
  await api.sendChatMessage('resident', payload);
  await api.sendChatImageMessage('resident', new Blob(['image'], { type: 'image/jpeg' }), payload);
  await api.deleteChatMessage(' message/id ');
  assert.equal(JSON.parse(calls[0][1].body).message_payload, payload);
  assert.equal(calls[1][1].body.get('message_payload'), payload);
  assert.equal(calls[2][0], '/api/v1/chat/message/message%2Fid/');
  assert.equal(calls[2][1].method, 'DELETE'); assert.equal(calls[2][1].maxRetries, 0);
});

function screen(t, history = [message('incoming'), message('outgoing', 'My message', { sender_id: 'admin', receiver_id: 'resident' })], role = 'SUPERADMIN') {
  const globals = { window: global.window, document: global.document, navigator: Object.getOwnPropertyDescriptor(global, 'navigator') };
  const listeners = new Map();
  const add = (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); };
  const remove = (name, callback) => listeners.get(name)?.delete(callback);
  const calls = { send: [], image: [], remove: [], react: [], fetch: [], confirm: [], refresh: 0, copied: [] };
  let confirm = true, copyFails = false;
  global.window = { addEventListener: add, removeEventListener: remove, innerWidth: 1024, innerHeight: 768,
    setInterval, clearInterval, confirm: text => { calls.confirm.push(text); return confirm; } };
  global.document = { hidden: false, body: {}, addEventListener: add, removeEventListener: remove };
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { async writeText(text) {
    if (copyFails) throw new Error('Unavailable'); calls.copied.push(text);
  } } } });
  const resident = { id: 'resident', name: 'Sakura Sasuke', role: 'HOMEOWNER', avatar: '', email: 'person@example.test',
    barangay: role === 'ADMIN' ? 'Pagatpat' : '', address: '', city: '', joinedDate: '2026-10-18', socialLinks: [], contactNumber: '' };
  const state = { users: [resident, { ...resident, id: 'second', name: 'Second User' }], currentUser: { id: 'admin', name: 'Admin Name', username: 'admin' },
    currentRole: role, selectedBarangay: role === 'ADMIN' ? 'Pagatpat' : 'All Barangays', userBarangays: [], chatInbox: [], requestedChatPartner: null,
    refreshChatInbox() { calls.refresh++; }, refreshUsers() {} };
  let event;
  const request = (kind, args) => { const pending = { ...deferred(), args }; calls[kind].push(pending); return pending.promise; };
  const api = {
    fetchChatThread: (...args) => request('fetch', args), sendChatMessage: (...args) => request('send', args),
    sendChatImageMessage: (...args) => request('image', args), deleteChatMessage: (...args) => request('remove', args),
    toggleChatReaction: (...args) => request('react', args), sendChatTyping: async () => {},
  };
  const load = loader({
    'src/context/AdminContext.tsx': { useAdmin: () => state }, 'src/api/adminApi.ts': api,
    'src/realtime/index.ts': { realtime: { status: 'connected', subscribe(callback) { event = callback; return () => {}; }, subscribeStatus: () => () => {} } },
    'src/hooks/useChatPresence.ts': { useChatPresence: () => () => undefined },
    'src/hooks/useMessagingRestriction.ts': { useMessagingRestriction: () => null },
    'react-dom': { createPortal: content => content },
  });
  const { UserDirectory } = load('src/components/users/UserDirectory.tsx');
  let view;
  act(() => { view = Renderer.create(React.createElement(UserDirectory), { createNodeMock: () => ({
    focus() {}, scrollIntoView() {}, contains() { return false; }, querySelector() { return null; },
  }) }); });
  const click = (node, extra = {}) => act(() => node.props.onClick({ currentTarget: { focus() {}, getBoundingClientRect: () => ({ top: 300, bottom: 328, left: 500, width: 28 }) }, ...extra }));
  const row = id => view.root.findByProps({ id: `chat-message-${id}` });
  const byLabel = (label, parent = view.root) => parent.findByProps({ 'aria-label': label });
  const open = id => click(view.root.findAll(node => node.props.role === 'button').find(node => node.props['aria-label']?.startsWith(`${id === 'resident' ? 'Sakura Sasuke' : 'Second User'},`)));
  const settle = async (request, value, fail = false) => { await act(async () => { fail ? request.reject(new Error(value)) : request.resolve(value); }); };
  t.after(() => {
    act(() => view.unmount()); global.window = globals.window; global.document = globals.document;
    if (globals.navigator) Object.defineProperty(global, 'navigator', globals.navigator); else delete global.navigator;
  });
  open('resident');
  return { calls, view, click, row, byLabel, open, settle, history,
    load: () => settle(calls.fetch[0], history),
    type(text) { act(() => view.root.findByType('textarea').props.onChange({ target: { value: text } })); },
    send() { click(view.root.findAllByType('button').find(node => node.props.title === 'Send message' || node.props.title === 'Send image')); },
    confirm(value) { confirm = value; }, copyFails() { copyFails = true; },
    event(value) { act(() => event(value)); },
    dispatch(name, value) { act(() => [...(listeners.get(name) || [])].forEach(callback => callback(value))); },
    text: () => JSON.stringify(view.toJSON()),
  };
}

for (const role of ['SUPERADMIN', 'ADMIN']) {
  for (const channel of ['text', 'image']) {
    test(`${role} ${channel}: keep Review your message but suppress the extra suspension Notice after sending`, async t => {
      const chat = screen(t, undefined, role); await chat.load(); chat.type('kill');
      if (channel === 'image') {
        act(() => chat.view.root.findByProps({ type: 'file' }).props.onChange({ target: { files: [new Blob(['photo'], { type: 'image/png' })], value: '' } }));
      }
      chat.send();
      assert.match(chat.text(), /Review your message/);
      assert.equal(chat.calls.send.length + chat.calls.image.length, 0);
      chat.click(chat.view.root.findAllByType('button').find(node => node.children.join('') === 'Send Anyway'));
      const request = channel === 'image' ? chat.calls.image[0] : chat.calls.send[0];
      const notice = 'Inappropriate or threatening language was detected. Your Barangay or SerbiSure Support may suspend messaging.';
      await chat.settle(request, message('sent-flagged', 'kill', {
        sender_id: 'admin', receiver_id: 'resident', language_warning: notice,
        ...(channel === 'image' ? { message_type: 'image', image_url: 'https://example.test/photo.png' } : {}),
      }));
      assert.ok(chat.row('sent-flagged'));
      assert.doesNotMatch(chat.text(), /Inappropriate or threatening language|may suspend messaging|Notice:/);
      assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Dismiss language notice' }).length, 0);
    });
  }
}

test('flagged drafts stay unsent until Send Anyway; Close preserves the draft and consent sends only once', async t => {
  const chat = screen(t); await chat.load();
  const button = label => chat.view.root.findAllByType('button').find(node => node.children.join('') === label);
  chat.type('gago ka'); chat.send();
  assert.equal(chat.calls.send.length, 0);
  assert.match(chat.text(), /This message may contain offensive content/);
  chat.click(button('Close'));
  assert.equal(chat.view.root.findByType('textarea').props.value, 'gago ka');
  chat.send();
  const confirm = button('Send Anyway').props.onClick; act(() => { confirm(); confirm(); });
  assert.equal(chat.calls.send.length, 1);
  assert.deepEqual(chat.calls.send[0].args, ['resident', 'gago ka', true]);
  await chat.settle(chat.calls.send[0], message('saved-original', 'gago ka', { sender_id: 'admin', receiver_id: 'resident' }));
  assert.match(chat.text(), /gago ka/);
});

test('flagged captions preserve the selected image and reply until explicit confirmation', async t => {
  const chat = screen(t); await chat.load();
  chat.click(chat.byLabel('Reply to message', chat.row('incoming')));
  chat.type('f*ck');
  act(() => chat.view.root.findByProps({ type: 'file' }).props.onChange({ target: { files: [new Blob(['photo'], { type: 'image/png' })], value: '' } }));
  chat.send();
  assert.equal(chat.calls.image.length, 0);
  chat.click(chat.view.root.findAllByType('button').find(node => node.children.join('') === 'Close'));
  assert.equal(chat.view.root.findAllByProps({ alt: 'Preview' }).length, 1);
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 1);
  chat.send(); chat.click(chat.view.root.findAllByType('button').find(node => node.children.join('') === 'Send Anyway'));
  assert.equal(chat.calls.image.length, 1);
  assert.equal(chat.calls.image[0].args[3], true);
  assert.equal(parseChatReply(chat.calls.image[0].args[2]).text, 'f*ck');
});

test('recipient text, quotes, photos and actions stay hidden until Show Message; Close leaves them hidden', async t => {
  const original = '> [Admin||quote]: gago\n\nPrivate original';
  const chat = screen(t, [message('sensitive', original, { message_type: 'image', image_url: 'https://example.test/photo.png', is_sensitive: true })]);
  await chat.load();
  const button = label => chat.view.root.findAllByType('button').find(node => node.children.join('') === label);
  assert.doesNotMatch(chat.text(), /Private original|gago|https:\/\/example.test\/photo.png/);
  assert.equal(chat.row('sensitive').findAllByProps({ 'aria-label': 'Message actions' }).length, 0);
  chat.click(chat.byLabel('Open sensitive message'));
  assert.match(chat.text(), /Would you like to show it/);
  chat.click(button('Close')); assert.doesNotMatch(chat.text(), /Private original/);
  chat.click(chat.byLabel('Open sensitive message')); chat.click(button('Show Message'));
  assert.match(chat.text(), /Private original|gago/);
  chat.open('second'); chat.open('resident');
  assert.doesNotMatch(chat.text(), /Private original/);
});

test('pending warning consent cannot send to a different conversation', async t => {
  const chat = screen(t); await chat.load(); chat.type('gago'); chat.send();
  const confirm = chat.view.root.findAllByType('button').find(node => node.children.join('') === 'Send Anyway').props.onClick;
  chat.open('second'); act(confirm);
  assert.equal(chat.calls.send.length, 0);
});

test('a newer server dictionary can request consent without losing the original draft', async t => {
  const chat = screen(t); await chat.load(); chat.type('Newly flagged wording'); chat.send();
  await act(async () => chat.calls.send[0].reject(Object.assign(new Error('Review message'), { status: 409, data: { code: 'offensive_language_warning' } })));
  assert.equal(chat.view.root.findByType('textarea').props.value, 'Newly flagged wording');
  chat.click(chat.view.root.findAllByType('button').find(node => node.children.join('') === 'Send Anyway'));
  assert.deepEqual(chat.calls.send[1].args, ['resident', 'Newly flagged wording', true]);
});

test('each message shows three compact actions; reactions appear only on demand and toggle using server state', async t => {
  const chat = screen(t); await chat.load();
  assert.equal(chat.byLabel('Message actions', chat.row('incoming')).findAllByType('button').length, 3);
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Choose a reaction' }).length, 0);
  chat.click(chat.byLabel('React to message', chat.row('incoming')));
  assert.equal(chat.byLabel('Choose a reaction').findAllByType('button').length, 6);
  chat.click(chat.byLabel('React 👍'));
  assert.deepEqual(chat.calls.react[0].args, ['incoming', '👍']);
  await chat.settle(chat.calls.react[0], { data: { my_reaction: '👍', reaction_counts: { '👍': 1 } } });
  chat.click(chat.byLabel('React to message', chat.row('incoming')));
  assert.equal(chat.byLabel('React 👍').props['aria-pressed'], true);
  chat.click(chat.byLabel('React 👍'));
  await chat.settle(chat.calls.react[1], { data: { my_reaction: null, reaction_counts: {} } });
  assert.equal(chat.row('incoming').findAllByProps({ title: 'Remove 👍 reaction' }).length, 0);
});

test('text replies send mobile-compatible quotes, prevent duplicate sends and show the saved quoted bubble', async t => {
  const chat = screen(t); await chat.load();
  chat.click(chat.byLabel('Reply to message', chat.row('incoming')));
  assert.match(chat.text(), /Replying to Sakura Sasuke/);
  chat.type('I can help'); chat.send(); chat.send();
  assert.equal(chat.calls.send.length, 1);
  const payload = chat.calls.send[0].args[1];
  assert.deepEqual(parseChatReply(payload), { text: 'I can help', reply: { author: 'Sakura Sasuke', text: 'Hello admin', imageUri: undefined, messageId: 'incoming' } });
  await chat.settle(chat.calls.send[0], message('saved', payload, { sender_id: 'admin', receiver_id: 'resident' }));
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 0);
  assert.equal(chat.row('saved').findByProps({ 'aria-label': 'Reply relationship' }).findByType('span').children.join(''), 'You replied to Sakura Sasuke');
  assert.doesNotMatch(chat.text(), /> \[Sakura/);
});

test('a phone swipe across nested message text opens the actual reply composer with the correct quote', async t => {
  const chat = screen(t); await chat.load();
  const surface = chat.byLabel('Message options', chat.row('incoming'));
  const captured = new Set();
  const element = { setPointerCapture: id => captured.add(id), hasPointerCapture: id => captured.has(id), releasePointerCapture: id => captured.delete(id) };
  const text = {};
  const event = extra => ({ pointerType: 'touch', pointerId: 1, isPrimary: true, currentTarget: element, target: text, clientX: 100, clientY: 200, ...extra });
  act(() => surface.props.onPointerDown(event()));
  act(() => surface.props.onPointerMove(event({ clientX: 125, clientY: 204 })));
  act(() => surface.props.onLostPointerCapture(event()));
  act(() => surface.props.onPointerMove(event({ clientX: 150, clientY: 210 })));
  act(() => surface.props.onPointerUp(event({ clientX: 165, clientY: 212 })));
  assert.match(chat.text(), /Replying to Sakura Sasuke/);
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 1);
  chat.type('Swipe answer'); chat.send();
  assert.equal(chat.calls.send.length, 1);
  assert.equal(parseChatReply(chat.calls.send[0].args[1]).reply.messageId, 'incoming');
  assert.equal(captured.size, 0);
});

test('replying to an own message uses the simple self label without changing the stored author', async t => {
  const chat = screen(t); await chat.load();
  chat.click(chat.byLabel('Reply to message', chat.row('outgoing')));
  assert.match(chat.text(), /Replying to yourself/);
  assert.doesNotMatch(chat.text(), /Replying to Admin Name/);
  const preview = chat.byLabel('Reply preview');
  assert.equal(preview.findAll(node => typeof node.props.className === 'string' && node.props.className.includes('bg-zinc-100')).length, 0);
  chat.type('Following up'); chat.send();
  assert.equal(parseChatReply(chat.calls.send[0].args[1]).reply.author, 'Admin Name');
});

test('saved replies render Messenger-style relationship headers without a repeated author inside the quote', async t => {
  const quote = (body, author, target) => withChatReply(body, { author, text: `Quote ${target}`, messageId: target });
  const history = [
    message('admin-original', 'Admin original', { sender_id: 'admin', receiver_id: 'resident' }),
    message('incoming-to-admin', quote('Incoming answer', 'Admin Name', 'admin-original')),
    message('resident-original', 'Resident original'),
    message('incoming-self', quote('Incoming follow-up', 'You', 'resident-original')),
    message('outgoing-to-user', quote('Outgoing answer', 'Sakura Sasuke', 'resident-original'), { sender_id: 'admin', receiver_id: 'resident' }),
    message('outgoing-self', quote('Outgoing follow-up', 'Admin Name', 'admin-original'), { sender_id: 'admin', receiver_id: 'resident' }),
  ];
  const chat = screen(t, history); await chat.load();
  const expected = {
    'incoming-to-admin': 'Sakura Sasuke replied to you',
    'incoming-self': 'Sakura Sasuke replied to themself',
    'outgoing-to-user': 'You replied to Sakura Sasuke',
    'outgoing-self': 'You replied to yourself',
  };
  for (const [id, label] of Object.entries(expected)) {
    const row = chat.row(id);
    const relationship = row.findByProps({ 'aria-label': 'Reply relationship' });
    assert.equal(relationship.findByType('span').children.join(''), label);
    assert.equal(row.findAll(node => node.type === 'p' && node.props.title === `Quote ${id.includes('self') && id.startsWith('incoming') ? 'resident-original' : id.includes('user') ? 'resident-original' : 'admin-original'}`).length, 1);
  }
});

test('failed sends keep the reply and draft; cancelling or changing conversation clears the quote', async t => {
  const chat = screen(t); await chat.load(); chat.click(chat.byLabel('Reply to message', chat.row('incoming')));
  chat.type('Retry this'); chat.send(); await chat.settle(chat.calls.send[0], 'Offline', true);
  assert.equal(chat.view.root.findByType('textarea').props.value, 'Retry this');
  assert.equal(chat.byLabel('Dismiss message notice').type, 'button', 'send errors are visible beside the composer, not only above the message history');
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 1);
  chat.click(chat.byLabel('Cancel reply'));
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 0);
  chat.click(chat.byLabel('Reply to message', chat.row('incoming'))); chat.open('second');
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 0);
});

test('an oversized reply keeps the draft and quote without sending a request', async t => {
  const chat = screen(t); await chat.load();
  chat.click(chat.byLabel('Reply to message', chat.row('incoming')));
  chat.type('a'.repeat(501)); chat.send();
  assert.equal(chat.calls.send.length, 0);
  assert.equal(chat.view.root.findByType('textarea').props.value.length, 501);
  assert.equal(chat.view.root.findAllByProps({ 'aria-label': 'Reply preview' }).length, 1);
  assert.match(chat.text(), /Message is too long/);
});

test('failed image sends keep the selected file and caption, show a composer notice, and can be retried', async t => {
  const chat = screen(t); await chat.load();
  chat.type('Image caption');
  act(() => chat.view.root.findByProps({ type: 'file' }).props.onChange({ target: { files: [new Blob(['photo'], { type: 'image/png' })], value: '' } }));
  chat.send(); await chat.settle(chat.calls.image[0], 'Offline', true);
  assert.equal(chat.view.root.findByType('textarea').props.value, 'Image caption');
  assert.equal(chat.view.root.findAllByProps({ alt: 'Preview' }).length, 1);
  assert.equal(chat.byLabel('Dismiss message notice').type, 'button');
  chat.send(); assert.equal(chat.calls.image.length, 2);
  await chat.settle(chat.calls.image[1], message('photo-saved', 'Image caption', { message_type: 'image', image_url: 'https://example.test/photo.png', sender_id: 'admin', receiver_id: 'resident' }));
  assert.equal(chat.view.root.findByType('textarea').props.value, '');
  assert.equal(chat.view.root.findAllByProps({ alt: 'Preview' }).length, 0);
});

test('photo replies preserve the image preview and can send another image without a caption', async t => {
  const chat = screen(t, [message('photo', null, { message_type: 'image', image_url: 'https://example.test/photo.jpg' })]);
  await chat.load(); chat.click(chat.byLabel('Reply to message', chat.row('photo')));
  const preview = chat.byLabel('Reply preview');
  assert.equal(preview.findAllByProps({ alt: 'Quoted photo' }).length, 1);
  assert.equal(preview.findAllByProps({ title: '📷 Photo' }).length, 0);
  act(() => chat.view.root.findByProps({ type: 'file' }).props.onChange({ target: { files: [new Blob(['photo'], { type: 'image/jpeg' })], value: '' } }));
  chat.send(); const payload = chat.calls.image[0].args[2];
  assert.equal(parseChatReply(payload).reply.messageId, 'photo');
  assert.equal(parseChatReply(payload).reply.imageUri, 'https://example.test/photo.jpg');
  assert.equal(parseChatReply(payload).text, '📷 Photo');
  await chat.settle(chat.calls.image[0], message('saved-photo', payload, { message_type: 'image', image_url: 'https://example.test/new.jpg', sender_id: 'admin', receiver_id: 'resident' }));
  const savedQuote = chat.row('saved-photo').findAllByProps({ alt: 'Quoted photo' });
  assert.equal(savedQuote.length, 1);
  assert.match(savedQuote[0].props.className, /h-20 w-20/);
  assert.equal(chat.row('saved-photo').findAllByProps({ title: '📷 Photo' }).length, 0);
});

test('remove requires confirmation, waits for success, blocks double clicks and filters stale refresh results', async t => {
  const chat = screen(t); await chat.load();
  const remove = () => { chat.click(chat.byLabel('More message options', chat.row('incoming'))); chat.click(chat.view.root.findAllByType('button').find(node => node.children.includes('Remove message'))); };
  remove(); assert.equal(chat.calls.remove.length, 0);
  assert.match(chat.text(), /Other chat members will still be able to see it/);
  assert.equal(chat.view.root.findAllByProps({ role: 'dialog' }).length, 1);
  chat.click(chat.byLabel('Cancel removal'));
  assert.equal(chat.calls.remove.length, 0);
  assert.equal(chat.view.root.findAllByProps({ role: 'dialog' }).length, 0);
  remove();
  const confirmRemoval = chat.byLabel('Confirm removal');
  chat.click(confirmRemoval); chat.click(confirmRemoval); assert.equal(chat.calls.remove.length, 1);
  assert.ok(chat.row('incoming'));
  chat.event({ type: 'chat.changed', partner_id: 'resident' });
  await chat.settle(chat.calls.remove[0], undefined);
  assert.equal(chat.view.root.findAllByProps({ id: 'chat-message-incoming' }).length, 0);
  assert.deepEqual(chat.calls.confirm, [], 'Removal never opens a browser confirmation');
  await chat.settle(chat.calls.fetch[1], chat.history);
  assert.equal(chat.view.root.findAllByProps({ id: 'chat-message-incoming' }).length, 0);
  assert.match(chat.text(), /Message removed/);
});

test('failed remove or reaction keeps the message and displays a concise error; late actions cannot affect another chat', async t => {
  const chat = screen(t); await chat.load();
  chat.click(chat.byLabel('More message options', chat.row('incoming')));
  chat.click(chat.view.root.findAllByType('button').find(node => node.children.includes('Remove message')));
  chat.click(chat.byLabel('Confirm removal'));
  await chat.settle(chat.calls.remove[0], 'Forbidden', true); assert.ok(chat.row('incoming'));
  assert.match(chat.text(), /Could not remove the message/);
  chat.click(chat.byLabel('Cancel removal'));
  chat.click(chat.byLabel('React to message', chat.row('incoming'))); chat.click(chat.byLabel('React ❤️'));
  await chat.settle(chat.calls.react[0], 'Offline', true); assert.match(chat.text(), /Could not update the reaction/);
  chat.click(chat.byLabel('More message options', chat.row('incoming')));
  chat.click(chat.view.root.findAllByType('button').find(node => node.children.includes('Remove message')));
  chat.click(chat.byLabel('Confirm removal'));
  chat.open('second'); await chat.settle(chat.calls.fetch[1], [message('second-message')]);
  await chat.settle(chat.calls.remove[1], undefined);
  assert.ok(chat.row('second-message')); assert.doesNotMatch(chat.text(), /Message removed/);
});

test('copy excludes quoted metadata, handles denied clipboard access, and popovers close on Escape or outside click', async t => {
  const payload = '> [You||original]: Earlier\n\nOnly copy this text';
  const chat = screen(t, [message('quoted', payload)]); await chat.load();
  const more = () => chat.click(chat.byLabel('More message options', chat.row('quoted')));
  more(); chat.click(chat.view.root.findAllByType('button').find(node => node.children.includes('Copy text')));
  await act(async () => {}); assert.deepEqual(chat.calls.copied, ['Only copy this text']);
  chat.copyFails(); more(); chat.click(chat.view.root.findAllByType('button').find(node => node.children.includes('Copy text')));
  await act(async () => {}); assert.match(chat.text(), /Could not copy the text/);
  more(); chat.dispatch('keydown', { key: 'Escape' });
  assert.equal(chat.byLabel('More message options', chat.row('quoted')).props['aria-expanded'], false);
  more(); chat.dispatch('pointerdown', { target: {} });
  assert.equal(chat.byLabel('More message options', chat.row('quoted')).props['aria-expanded'], false);
});
