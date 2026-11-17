import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Verifies CaterEase Firestore rules structure &Dirty Dozen invariants statically,
 * enforcing every security pillar in security_spec.md against the deployed ruleset.
 */
describe('CaterEase Firestore Rules Invariants', () => {
  const rulesText = fs.readFileSync('firestore.rules', 'utf8');

  it('uses rules_version = 2 and defines global default-deny catch-all first', () => {
    assert.match(rulesText, /^rules_version\s*=\s*'2';/);
    const catchAllIdx = rulesText.indexOf('match /{document=**}');
    const usersIdx = rulesText.indexOf('match /users/{userId}');
    assert.ok(catchAllIdx > 0 && catchAllIdx < usersIdx, 'Global catch-all must appear before collection rules');
    assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  });

  it('enforces verified email check for bootstrapped admin & write operations', () => {
    assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
    assert.match(rulesText, /request\.auth\.token\.email == 'koyyadileep7@gmail\.com'/);
  });

  it('isolates PII into /private subcollection and forbids unauthenticated list scraping', () => {
    assert.match(rulesText, /match \/private\/\{docId\}/);
    assert.doesNotMatch(rulesText, /allow list:\s*if\s*isSignedIn\(\)\s*;/);
  });

  it('prevents self-role escalation on user profile creation and updates', () => {
    assert.match(rulesText, /incoming\(\)\.role == 'CUSTOMER'/);
    assert.match(rulesText, /incoming\(\)\.role == existing\(\)\.role/);
  });

  it('applies Master Gate parent ownership check on chat session messages', () => {
    assert.match(rulesText, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/chatSessions\/\$\(sessionId\)\)/);
    assert.match(rulesText, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/chatSessions\/\$\(sessionId\)\)\.data\.ownerUid == userId/);
  });

  it('validates server request.time timestamps and ID regex guards across entities', () => {
    assert.match(rulesText, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
    assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
    assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  });
});
