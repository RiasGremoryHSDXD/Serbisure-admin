const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const loader = require('./source-loader.cjs');
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');

function activity(t, role) {
  const state = {
    currentRole: role, selectedBarangay: 'Agusan', setActiveNav() {}, isLoadingDashboardActivity: false, isLoadingAuditLogs: false,
    bookings: Array.from({ length: 7 }, (_, index) => ({
      id: String(index + 1), homeownerName: `Homeowner ${index + 1}`, workerName: `Worker ${index + 1}`,
      homeownerAvatar: '', workerAvatar: '', offeredWage: 600, barangay: index === 6 ? 'Carmen' : 'Agusan',
      ratePeriod: index === 5 ? 'month' : 'day', contractType: index === 5 ? 'Formal Kasambahay (Long-Term)' : 'Short-Term On-Demand', bookingStatus: 'Accepted',
    })),
    verifications: [{ id: 'doc', name: 'Document Applicant', role: 'KASAMBAHAY', documentType: 'Police Clearance', barangay: 'Agusan', submittedDate: 'Oct 20, 2026', status: 'VERIFIED', avatar: '' }],
    auditLogs: [{ log_id: 'log', actor_name: 'Reviewing Officer', actor_role: 'ADMIN', actor_barangay: 'Agusan', target_name: 'Document Applicant', target_barangay: 'Agusan', action: 'APPROVED', document_type: 'police_clearance', previous_status: 'PENDING', new_status: 'VERIFIED', created_at: '2026-10-20T08:00:00Z', reason: 'Reviewed submitted document' }],
  };
  const { DashboardActivityTable } = loader({
    'src/context/AdminContext.tsx': { useAdmin: () => state }, jspdf: () => {}, html2canvas: () => {},
  })('src/components/dashboard/DashboardActivityTable.tsx');
  let view; act(() => { view = create(React.createElement(DashboardActivityTable)); });
  t.after(() => act(() => view.unmount()));
  return {
    view,
    rows: () => view.root.findByType('tbody').findAllByType('tr'),
    click: name => act(() => view.root.findAllByType('button').find(node => node.props['aria-label'] === name || text(node).startsWith(name)).props.onClick()),
    search: value => act(() => view.root.findByProps({ 'aria-label': 'Search dashboard records' }).props.onChange({ target: { value } })),
  };
}

for (const role of ['ADMIN', 'SUPERADMIN']) test(`responsive activity records preserve ${role} scope, pagination, search, pay and status`, t => {
  const f = activity(t, role);
  assert.equal(f.rows().length, 5);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Employer', 'Kasambahay', 'Pay', 'Contract', 'Status']);
  f.click('Next placements page');
  assert.equal(f.rows().length, role === 'ADMIN' ? 1 : 2);
  assert.match(text(f.rows()[0]), /Homeowner 6.*Worker 6.*600 \/ month.*Formal Kasambahay.*Accepted/);
  f.search('Worker 1');
  assert.equal(f.rows().length, 1);
  assert.match(text(f.rows()[0]), /Worker 1/);
  assert.equal(f.view.root.findAllByProps({ 'aria-label': 'Previous placements page' }).length, 0);
  f.search('');
  assert.equal(f.rows().length, 5);
  assert.equal(f.view.root.findByProps({ 'aria-label': 'Previous placements page' }).props.disabled, true);
});

test('clearance and audit cards retain all record details when switching tabs and searching', t => {
  const f = activity(t, 'SUPERADMIN');
  f.click('Recent Clearances');
  assert.match(text(f.rows()[0]), /Document Applicant.*Police Clearance.*Agusan.*Oct 20, 2026.*VERIFIED/);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Applicant', 'Document', 'Barangay', 'Submitted', 'Status']);
  f.click('Audit Trail');
  assert.match(text(f.rows()[0]), /Reviewing Officer.*Approved.*Document Applicant.*Police Clearance.*VERIFIED.*Reviewed submitted document/);
  assert.deepEqual(f.rows()[0].findAllByType('td').map(node => node.props['data-label']), ['Official', 'Action', 'Resident', 'Change', 'Recorded']);
  f.search('no matching record');
  assert.match(text(f.view.root), /No audit logs matching/);
});
