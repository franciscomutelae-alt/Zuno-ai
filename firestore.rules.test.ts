/**
 * ZUNO AI Security Rules Verification Suite (Dirty Dozen Adversarial Payloads)
 * Designed for @firebase/rules-unit-testing against firestore.rules.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  actor: { uid?: string; email?: string; email_verified?: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Creation',
    actor: null,
    operation: 'create',
    path: '/users/guest_123',
    payload: { uid: 'guest_123', name: 'Guest', email: 'g@zuno.ai', plan: 'free', role: 'user', status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-Account PII Read',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'get',
    path: '/users/user_B',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Blanket User List Scraping',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'list',
    path: '/users',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Assigned Admin Escalation on Create',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/users/user_A',
    payload: { uid: 'user_A', name: 'Hacker', email: 'a@example.com', plan: 'ultra', role: 'admin', status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Update-Gap Plan Escalation',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: '/users/user_A',
    payload: { name: 'User A', plan: 'ultra' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Ghost Field Injection',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/users/user_A',
    payload: {
      uid: 'user_A',
      name: 'User A',
      email: 'a@example.com',
      plan: 'free',
      role: 'user',
      status: 'active',
      isVerifiedAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unverified Admin Email Spoofing',
    actor: { uid: 'spoof_uid', email: 'franciscomutelae@gmail.com', email_verified: false },
    operation: 'list',
    path: '/users',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-Tenant Conversation Ownership Spoof',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/users/user_A/conversations/conv_1',
    payload: { id: 'conv_1', userId: 'user_B', title: 'Stolen', model: 'gemini-3.8-flash' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Blocked User Image Creation',
    actor: { uid: 'user_blocked', email: 'blocked@example.com', email_verified: true },
    operation: 'create',
    path: '/users/user_blocked/images/img_1',
    payload: { id: 'img_1', userId: 'user_blocked', prompt: 'test', style: 'realista', aspectRatio: '1:1', model: 'zuno' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Client-Forged Timestamp',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/users/user_A/conversations/conv_2',
    payload: { id: 'conv_2', userId: 'user_A', title: 'Forged Time', model: 'gemini-3.8-flash', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Path ID Poisoning (1.5KB ID)',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: `/users/user_A/conversations/${'a'.repeat(1500)}`,
    payload: { id: 'conv_big', userId: 'user_A', title: 'Big', model: 'gemini-3.8-flash' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Custom Instructions Overflow (>2000 chars)',
    actor: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: '/users/user_A',
    payload: { customInstructions: 'x'.repeat(2500) },
    expectedResult: 'PERMISSION_DENIED',
  },
];
