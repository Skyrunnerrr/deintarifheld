import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redactEmail,
  buildInboxItemFromLead,
  buildInboxItemFromCareer,
  InboxRequestKind,
  InboxAssignmentStatus,
} from './cc-read-models.js';

test('redactEmail minimizes local part', () => {
  assert.equal(redactEmail('synth-owner@example.test'), 's***@example.test');
});

test('inbox projection from lead and career without inventing SoT', () => {
  const lead = buildInboxItemFromLead(
    {
      id: 'l1',
      lead_ref: 'L-1',
      lead_type: 'business_energy',
      page_source: 'unternehmen',
      created_at: '2026-01-01T00:00:00Z',
      status: 'new',
      email: 'a@example.test',
      source_page: '/unternehmen',
    },
    'c1',
  );
  assert.equal(lead.requestKind, InboxRequestKind.LEAD);
  assert.equal(lead.assignmentStatus, InboxAssignmentStatus.LINKED_TO_CASE);
  assert.equal(lead.contactRedacted, 'a***@example.test');

  const career = buildInboxItemFromCareer({
    id: 'capp1',
    application_ref: 'C-1',
    created_at: '2026-01-02T00:00:00Z',
    status: 'new',
    email: 'b@example.test',
    source_page: '/karriere',
  });
  assert.equal(career.requestKind, InboxRequestKind.CAREER_APPLICATION);
  assert.equal(career.assignmentStatus, InboxAssignmentStatus.UNASSIGNED);
});
