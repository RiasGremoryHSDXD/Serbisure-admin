const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { renderToStaticMarkup } = require('react-dom/server');
const loader = require('./source-loader.cjs');
const data = loader()('src/data/reviewerCorrections.ts');

const snapshot = () => ({
  version: 'a'.repeat(64), document_type: 'police_clearance',
  profile: { first_name: 'Jameszzz', middle_name: null, last_name: 'Santos', date_of_birth: '1998-01-01' },
  document: { first_name: 'James', middle_name: null, last_name: 'Santos', date_of_birth: '1998-01-01',
    document_number: 'WR0NG', date_issued: '2026-04-28', valid_until: '2028-10-20' },
});

test('correction patch keeps account and document edits separate and sends only changed fields', () => {
  const original = snapshot(), draft = structuredClone(original);
  draft.profile.first_name = 'James'; draft.document.valid_until = '2026-10-28';
  assert.deepEqual(data.buildCorrectionPatch(original, draft), {
    version: original.version, profile: { first_name: 'James' }, document: { valid_until: '2026-10-28' },
  });
  assert.equal(original.profile.first_name, 'Jameszzz');
});

test('unchanged whitespace and optional empty values do not create fake edits; clearing a date does', () => {
  const original = snapshot(), draft = structuredClone(original);
  draft.profile.middle_name = ''; draft.profile.first_name = ' Jameszzz ';
  assert.equal(data.buildCorrectionPatch(original, draft), null);
  draft.profile.date_of_birth = '';
  assert.deepEqual(data.buildCorrectionPatch(original, draft).profile, { date_of_birth: null });
});

test('validation errors show the backend guidance instead of a generic API 400', () => {
  const error = Object.assign(new Error('API Error: 400'), { data: { document: { date_issued: ['Issue date cannot be in the future. Check the year on the document.'] } } });
  assert.match(data.correctionErrorMessage(error), /Check the year/);
});

async function form(t, { fail = false, kind = 'police_clearance' } = {}) {
  const calls = [];
  const details = { ...snapshot(), document_type: kind };
  const { ReviewerCorrectionsForm } = loader({ 'src/api/adminApi.ts': {
    fetchReviewerCorrections: async id => { calls.push(['get', id]); return structuredClone(details); },
    saveReviewerCorrections: async (id, patch) => {
      calls.push(['save', id, patch]);
      if (fail) throw Error('These details changed. Close and reopen the form.');
      return { ...details, changed: true };
    },
  } })('src/components/verifications/ReviewerCorrectionsForm.tsx');
  let view;
  await act(async () => { view = create(React.createElement(ReviewerCorrectionsForm, { documentId: 'doc-1', onSaved: async () => { calls.push(['refresh']); } })); });
  t.after(() => act(() => view.unmount()));
  const click = async text => act(async () => { view.root.findAllByType('button').find(button => button.children.includes(text)).props.onClick(); });
  await click('Edit details');
  const change = (label, value) => act(() => view.root.findByProps({ 'aria-label': label }).props.onChange({ target: { value } }));
  const save = async () => act(async () => { view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  return { view, calls, click, change, save };
}

test('inline editor offers identity fields while login, contact and jurisdiction inputs stay locked', async t => {
  const f = await form(t);
  const labels = f.view.root.findAllByType('input').map(input => input.props['aria-label']);
  assert.ok(labels.includes('Account first name'));
  assert.ok(labels.includes('Document expiry date'));
  assert.ok(labels.includes('Document document number'));
  assert.equal(labels.some(label => /email|username|password|contact|barangay|role/i.test(label)), false);
});

test('save corrects one field without approving or leaving preview and refreshes the review data', async t => {
  const f = await form(t);
  f.change('Account first name', 'James');
  await f.save();
  assert.deepEqual(f.calls.map(call => call[0]), ['get', 'save', 'refresh']);
  assert.deepEqual(f.calls[1][2], { version: snapshot().version, profile: { first_name: 'James' } });
  assert.equal(f.view.root.findAllByType('form').length, 0);
  assert.match(f.view.root.findByProps({ role: 'status' }).children.join(''), /continue reviewing/);
});

test('cancel and no-op saves never send corrections or create an audit event', async t => {
  const f = await form(t);
  await f.save();
  assert.deepEqual(f.calls.map(call => call[0]), ['get']);
  f.change('Account first name', 'Discard this');
  await f.click('Cancel');
  assert.deepEqual(f.calls.map(call => call[0]), ['get']);
});

test('stale-save error keeps the draft visible and does not claim success', async t => {
  const f = await form(t, { fail: true });
  f.change('Document document number', 'HUMAN-123');
  await f.save();
  assert.match(f.view.root.findByProps({ role: 'alert' }).children.join(''), /Close and reopen/);
  assert.equal(f.view.root.findByProps({ 'aria-label': 'Document document number' }).props.value, 'HUMAN-123');
  assert.deepEqual(f.calls.map(call => call[0]), ['get', 'save']);
});

test('permanent National IDs do not offer clearance issue or expiry dates', async t => {
  const f = await form(t, { kind: 'national_id_front' });
  const labels = f.view.root.findAllByType('input').map(input => input.props['aria-label']);
  assert.equal(labels.includes('Document issue date'), false);
  assert.equal(labels.includes('Document expiry date'), false);
});

test('audit changes show clear before/after values and escape supplied text', () => {
  const { AuditCorrectionDetails } = loader()('src/components/dashboard/AuditCorrectionDetails.tsx');
  const metadata = { reason_code: 'reviewer_correction', changes: [
    { section: 'profile', field: 'first_name', old: 'Jameszzz', new: 'James' },
    { section: 'document', field: 'document_number', old: '<script>unsafe</script>', new: '123' },
  ] };
  const html = renderToStaticMarkup(React.createElement(AuditCorrectionDetails, { metadata }));
  assert.match(html, /Account · First name: Jameszzz → James/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('Document Preview uses the saved document number and issue date ahead of stale OCR values', () => {
  const doc = { id: 'doc-1', userId: 'resident', name: 'James Santos', role: 'KASAMBAHAY', avatar: '',
    barangay: 'Pagatpat', documentType: 'Police Clearance', rawDocumentType: 'police_clearance',
    documentNumber: 'CORRECT-123', issuedDate: 'Apr 28, 2026', validityDate: 'Oct 28, 2026',
    status: 'PENDING / REVIEW', recordStatus: 'Under Review', documentImage: '',
    ocrExtractedData: { clearance_number: 'WRONG-999', date_issued: '2028-04-28' },
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  const html = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(html, /CORRECT-123/);
  assert.match(html, /Apr 28, 2026/);
  assert.doesNotMatch(html, /WRONG-999|Apr 28, 2028/);
});

test('existing Audit Trail displays the correction, officer, resident and document in the same row', () => {
  const state = { currentRole: 'ADMIN', selectedBarangay: 'Pagatpat', setActiveNav() {}, bookings: [], verifications: [],
    auditLogs: [{ log_id: 'edit-1', actor_name: 'Reviewing Officer', actor_role: 'Barangay', target_name: 'James Santos',
      target_barangay: 'Brgy. Pagatpat', action: 'UPDATED', document_type: 'police_clearance', created_at: '2026-10-30T02:00:00Z',
      previous_status: 'Pending', new_status: 'Pending', metadata: { reason_code: 'reviewer_correction', changes: [
        { section: 'profile', field: 'first_name', old: 'Jameszzz', new: 'James' },
      ] } }],
  };
  const { DashboardActivityTable } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state }, jspdf: () => {}, html2canvas: () => {} })('src/components/dashboard/DashboardActivityTable.tsx');
  let view; act(() => { view = create(React.createElement(DashboardActivityTable)); });
  try {
    const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join('');
    act(() => view.root.findAllByType('button').find(button => text(button).startsWith('Audit Trail')).props.onClick());
    assert.match(text(view.root.findByType('tbody')), /Reviewing Officer.*James Santos.*Police Clearance.*Jameszzz → James/);
  } finally { act(() => view.unmount()); }
});

test('document preview compares OCR and registration for both roles and marks only flagged fields', () => {
  const doc = {
    id: 'doc-1', userId: 'resident', name: 'Christine Tagupa',
    role: 'HOMEOWNER', barangay: 'Agusan', documentType: 'National ID (Front)', rawDocumentType: 'national_id_front',
    status: 'PENDING / REVIEW', recordStatus: 'Flagged', documentImage: '',
    documentNumber: '1234-5678-9012-3456',
    accountRegistration: {
      first_name: 'Christine', middle_name: 'Cruz', last_name: 'Tagupa',
      date_of_birth: '2004-09-24', address: 'Lot 3, Agusan, Cagayan de Oro, Misamis Oriental, 9000',
    },
    ocrExtractedData: {
      first_name: 'JAMES CHRISTOPHER', middle_name: 'CINCHES', last_name: 'TAGUPA',
      date_of_birth: 'Sep 24, 2004', address: 'Lot 3, Agusan',
      _reviewer_corrections: { last_name: {} },
    },
    ocrDiscrepancies: [
      { field: 'first_name', message: 'First names differ.' },
      { field: 'middle_name', message: 'Middle names differ.' },
      { field: 'barangay', message: 'Barangays differ.' },
    ],
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    state.currentRole = role;
    const html = renderToStaticMarkup(React.createElement(DocumentPreview));
    assert.match(html, /OCR Result \(Document\)<\/th>.*Account Registration<\/th>/);
    const fields = html.match(/<tbody[^>]*>.*?<\/tbody>/g);
    assert.equal(fields.length, 5);
    assert.match(fields[0], /First Name.*Mismatch.*JAMES CHRISTOPHER.*Christine/);
    assert.match(fields[1], /Middle Name.*Mismatch.*CINCHES.*Cruz/);
    assert.match(fields[2], /Last Name.*TAGUPA.*Reviewer corrected.*Tagupa/);
    assert.match(fields[3], /Birthdate.*Sep 24, 2004.*Sep 24, 2004/);
    assert.match(fields[4], /Address.*Mismatch.*Lot 3, Agusan.*Lot 3, Agusan, Cagayan de Oro, Misamis Oriental, 9000/);
    assert.doesNotMatch(fields[2] + fields[3], /Mismatch/);
    assert.doesNotMatch(html, /Account Name<\/span>|ID Name \(OCR\)<\/span>/);
    assert.match(html, /<\/table>.*ID Type.*Copy to clipboard.*Verify on PhilSys eVerify.*Date Issued.*Validity.*Status.*Edit details/);
    assert.match(html, /Flagged Discrepancies \(3\)/);
  }
});

test('document preview shows placeholders and retains legacy OCR evidence and quality warnings', () => {
  const doc = {
    id: 'legacy-doc', userId: 'resident', name: 'Christine Tagupa',
    role: 'HOMEOWNER', barangay: 'Agusan', documentType: 'National ID (Front)', rawDocumentType: 'national_id_front',
    status: 'PENDING / REVIEW', recordStatus: 'Flagged', documentImage: '',
    accountRegistration: { first_name: 'Christine', last_name: 'Tagupa', middle_name: null, date_of_birth: '', address: '  ' },
  };
  const state = { verifications: [doc], selectedVerificationId: doc.id, isComparisonModalOpen: false };
  const { DocumentPreview } = loader({ 'src/context/AdminContext.tsx': { useAdmin: () => state } })('src/components/verifications/DocumentPreview.tsx');
  for (const ocr of [null, {}, { first_name: null, last_name: '', address: '  ' }]) {
    doc.ocrExtractedData = ocr;
    doc.ocrDiscrepancies = [{ field: 'image_quality', message: 'No readable text detected by OCR — please check if the uploaded image is valid.' }];
    const html = renderToStaticMarkup(React.createElement(DocumentPreview));
    assert.equal((html.match(/>Not detected<\/td>/g) || []).length, 5);
    assert.equal((html.match(/>Not provided<\/td>/g) || []).length, 3);
    assert.match(html, /Flagged Discrepancies \(1\).*No readable text detected by OCR/);
    assert.doesNotMatch(html, /Mismatch|Full name from OCR/);
  }
  doc.ocrExtractedData = { full_name: 'JAMES CHRISTOPHER TAGUPA' };
  doc.ocrDiscrepancies = null;
  delete doc.accountRegistration;
  const legacy = renderToStaticMarkup(React.createElement(DocumentPreview));
  assert.match(legacy, /Full name from OCR .*JAMES CHRISTOPHER TAGUPA/);
  assert.equal((legacy.match(/>Not detected<\/td>/g) || []).length, 5);
  assert.equal((legacy.match(/>Not provided<\/td>/g) || []).length, 5);
});

test('correction API uses PATCH with no automatic mutation retries', async () => {
  const calls = [];
  const api = loader({ 'src/api/apiClient.ts': { fetchApi: async (...args) => { calls.push(args); return {}; } } })('src/api/adminApi.ts');
  await api.saveReviewerCorrections('doc-1', { version: 'a'.repeat(64), profile: { first_name: 'James' } });
  assert.match(calls[0][0], /doc-1\/corrections\/$/);
  assert.equal(calls[0][1].method, 'PATCH');
  assert.equal(calls[0][1].maxRetries, 0);
});
