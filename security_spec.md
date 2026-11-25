# ZUNO AI Firestore Security Specification

## 1. Data Invariants
1. **Identity Isolation (Multi-Tenant Strict Ownership)**: Every `/users/{userId}` document and every sub-document under `/users/{userId}/conversations/{conversationId}` and `/users/{userId}/images/{imageId}` MUST strictly belong to `request.auth.uid == userId` AND carry `email_verified == true`.
2. **Privilege Escalation Prevention (Anti-Self-Admin / Anti-Free-Upgrade)**: Users creating or updating their own `/users/{userId}` document CANNOT assign `role: 'admin'`, unblock themselves (`status: 'blocked' -> 'active'`), or self-grant paid plans (`premium`, `pro`, `ultra`) on creation unless they are a verified admin.
3. **Master Gate Parent Synchronization**: Subcollections (`/conversations/{conversationId}` and `/images/{imageId}`) MUST verify via `exists()` / `get()` that the parent `/users/{userId}` exists and is `status == 'active'`.
4. **Immutable Ownership & Temporal Integrity**: `uid`, `userId`, and `createdAt` MUST remain immutable after creation. Creation MUST use `request.time` for `createdAt` and `updatedAt`; updates MUST use `request.time` for `updatedAt`.
5. **No Blanket Reads / No Guest Database Access**: Unauthenticated visitors (`request.auth == null`) and unverified tokens have ZERO read/write access to `/users/{userId}` or any private subcollection. `allow list` MUST always enforce `resource.data.userId == request.auth.uid` or `resource.data.uid == request.auth.uid`.
6. **Path ID Poisoning & Volumetric Guards**: Every document ID (`userId`, `conversationId`, `imageId`) MUST match `^[a-zA-Z0-9_\-]+$` with length `<= 128`. Every string and array MUST enforce explicit `.size()` boundaries.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Profile Creation (Guest Bypass)**: Unauthenticated client attempts `create` on `/users/guest_123`. Expected: `PERMISSION_DENIED`.
2. **Cross-Account Read (PII Leak)**: Authenticated User A (`uidA`) attempts `get` on `/users/uidB`. Expected: `PERMISSION_DENIED`.
3. **Blanket User List Scraping**: Authenticated User A attempts `list` on `/users`. Expected: `PERMISSION_DENIED`.
4. **Self-Assigned Admin Escalation**: Authenticated regular user creates `/users/uidA` with `{ role: 'admin', plan: 'ultra' }`. Expected: `PERMISSION_DENIED`.
5. **Update-Gap Plan Escalation**: Authenticated regular user updates `/users/uidA` changing `{ plan: 'ultra' }` alongside `name`. Expected: `PERMISSION_DENIED`.
6. **Shadow Ghost Field Injection**: Authenticated user creates `/users/uidA` with extra undeclared field `{ isVerifiedAdmin: true }`. Expected: `PERMISSION_DENIED`.
7. **Email Spoofing Without Verification**: User with `token.email == 'franciscomutelae@gmail.com'` and `token.email_verified == false` attempts admin read/write. Expected: `PERMISSION_DENIED`.
8. **Cross-Tenant Conversation Injection**: User A attempts `create` on `/users/uidB/conversations/conv1` or sets `userId: 'uidB'` under `/users/uidA/conversations/conv1`. Expected: `PERMISSION_DENIED`.
9. **Blocked User Subcollection Write**: User with `status: 'blocked'` in `/users/uidBlocked` attempts `create` on `/users/uidBlocked/images/img1`. Expected: `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: User creates conversation with `createdAt: Timestamp(2020-01-01)` instead of server `request.time`. Expected: `PERMISSION_DENIED`.
11. **Path ID Poisoning (1.5KB Junk ID)**: User attempts write to `/users/uidA/conversations/${'a'.repeat(1500)}`. Expected: `PERMISSION_DENIED`.
12. **Array / String Overflow (Denial of Wallet)**: User writes `/users/uidA` with `memories` array > 50 items or `customInstructions` > 2000 chars. Expected: `PERMISSION_DENIED`.
