# CaterEase Firestore Security Specification

## 1. Data Invariants
1. **Default Deny Catch-All**: All unmatched paths default to `allow read, write: if false;`.
2. **PII Split Isolation**: User public profile documents (`/users/{userId}`) strictly forbid `email`, `phone`, or `address`. Email, city, and dietary preferences live exclusively under `/users/{userId}/private/{docId}` readable only by the verified owner (`request.auth.uid == userId`) or verified admin (`koyyadileep7@gmail.com` with `email_verified == true` or `/admins/{uid}`).
3. **Self-Role Escalation Prevention**: Users creating `/users/{userId}` can only assign `role == 'CUSTOMER'` unless `isAdmin()` is true, and can never modify `role`, `uid`, or `createdAt` on update.
4. **Master Gate Relational Sync**: `/users/{userId}/chatSessions/{sessionId}/messages/{messageId}` requires `exists(/databases/.../chatSessions/{sessionId})` AND verifies parent `ownerUid == request.auth.uid` on writes.
5. **Temporal Integrity**: All `createdAt` fields must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both creation and update.
6. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true` and valid regex document IDs (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
7. **Query Enforcement**: Every `allow list` explicitly checks `resource.data` (`resource.data.ownerUid == request.auth.uid` or `resource.data.visibility == 'leaderboard'`), with zero `get()`/`exists()` inside `allow list`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unverified Admin Email Spoof**: `{ auth: { uid: "atk1", token: { email: "koyyadileep7@gmail.com", email_verified: false } } }` reading/writing `/users/victim`. -> MUST RETURN `PERMISSION_DENIED`.
2. **Self-Role Escalation on Create**: Creating `/users/u1` with `{ uid: "u1", displayName: "Eve", role: "ADMIN", createdAt: serverTimestamp, updatedAt: serverTimestamp }`. -> MUST RETURN `PERMISSION_DENIED`.
3. **Shadow Ghost Field Injection**: Creating `/users/u1/studioPresets/p1` with extra `isOfficial: true` field. -> MUST RETURN `PERMISSION_DENIED`.
4. **ID Poisoning (>128 chars or invalid chars)**: Creating `/gameScores/bad$id..` or 200-char doc ID. -> MUST RETURN `PERMISSION_DENIED`.
5. **Owner UID Spoofing**: Signed in as `u1`, creating `/users/u1/studioPresets/p1` with `ownerUid: "u2"`. -> MUST RETURN `PERMISSION_DENIED`.
6. **PII Cross-User Read**: Signed in as `u1`, calling `get(/users/u2/private/profile)`. -> MUST RETURN `PERMISSION_DENIED`.
7. **Orphaned Subcollection Write**: Creating `/users/u1/chatSessions/missing_session/messages/m1` where `missing_session` does not exist. -> MUST RETURN `PERMISSION_DENIED`.
8. **Fake Timestamp Injection**: Creating `/users/u1/chatSessions/s1` with `createdAt: Timestamp(2099-01-01)` instead of `request.time`. -> MUST RETURN `PERMISSION_DENIED`.
9. **Immutable Field Mutation**: Updating `/users/u1` changing `uid` or `createdAt`. -> MUST RETURN `PERMISSION_DENIED`.
10. **Score Overflow / Negative Injection**: Creating `/gameScores/sc1` with `score: 99999999` or `score: -50`. -> MUST RETURN `PERMISSION_DENIED`.
11. **Array Size Exhaustion**: Creating `ChatMessage` with `groundingUrls` array length `> 10` or non-string first element. -> MUST RETURN `PERMISSION_DENIED`.
12. **Cross-Tenant Chat Session Hijack**: Signed in as `u1`, reading or listing `/users/u2/chatSessions`. -> MUST RETURN `PERMISSION_DENIED`.
