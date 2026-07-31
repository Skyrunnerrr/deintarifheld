#!/usr/bin/env node
/**
 * Print merge-before-upload cutover plan (read-only decision pack).
 */
const lines = [
  'MERGE_BEFORE_PUBLIC_UPLOAD=YES',
  'LIVE_BUILD_SOURCE_BRANCH=main',
  'DEPLOYED_SHA_MUST_EQUAL_REMOTE_MAIN=YES',
  'ORDER=',
  '1. Finish cutover candidate review (this branch)',
  '2. Document privacy legal approval',
  '3. Document mail/notification decision',
  '4. Push cutover branch (later authorized run)',
  '5. Fast-forward / reviewed merge into main',
  '6. Verify local main == origin/main',
  '7. build:static:production from exact remote-main SHA',
  '8. Checkdomain remote backup',
  '9. Checkdomain upload (--apply)',
  '10. Live verification',
  '11. Synthetic E2E + cleanup',
  '12. Monitoring window',
  '13. Decommission Google Apps Script only after traffic proof',
  'FORBIDDEN=ungerged_feature_deploy,force_push,history_rewrite,website_before_main',
  'MAIL_DECISION_REQUIRED=YES',
  'MAIL_MODE_CHANGED=NO',
  'GOOGLE_APPS_SCRIPT_DISABLED=NO',
  'GOOGLE_SHEETS_DELETED=NO',
]
for (const line of lines) console.log(line)
