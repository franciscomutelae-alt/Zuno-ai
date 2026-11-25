import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Conversation,
  DeviceSessionInfo,
  FavoriteItem,
  GeneratedImage,
  ManagedUser,
  PlanType,
  SearchBarCodeActionType,
  SearchBarCodeRecord,
  SearchCodeExecutionResult,
  ToolId,
  UserFeatures,
  UserProfile,
} from '../types';

const CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');
let FIREBASE_PROJECT_ID = 'sustained-observer-20z9n';
let FIREBASE_API_KEY = '';

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const rawCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (rawCfg.projectId) FIREBASE_PROJECT_ID = String(rawCfg.projectId);
    if (rawCfg.apiKey) FIREBASE_API_KEY = String(rawCfg.apiKey);
  }
} catch (err) {
  console.warn('[ZUNO AuthDB] Failed to load firebase-applet-config.json:', err);
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'zuno_auth.db');
const authDb = new DatabaseSync(DB_PATH);

authDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA journal_size_limit = 524288;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT 'free',
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    language TEXT NOT NULL DEFAULT 'pt',
    ai_tone TEXT NOT NULL DEFAULT 'balanced',
    custom_instructions TEXT NOT NULL DEFAULT '',
    memory_enabled INTEGER NOT NULL DEFAULT 1,
    memories_json TEXT NOT NULL DEFAULT '[]',
    features_json TEXT NOT NULL,
    message_count_today INTEGER NOT NULL DEFAULT 0,
    image_count_today INTEGER NOT NULL DEFAULT 0,
    usage_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revoked_tokens (
    token_hash TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_conversations (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    tool_id TEXT DEFAULT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    messages_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_conversations_uid ON user_conversations(uid, updated_at DESC);

  CREATE TABLE IF NOT EXISTS user_images (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    style TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    quality TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_images_uid ON user_images(uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS vip_codes (
    code TEXT PRIMARY KEY,
    plan TEXT NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    used_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vip_redemptions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    uid TEXT NOT NULL,
    redeemed_at INTEGER NOT NULL,
    UNIQUE(code, uid)
  );

  CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    conversation_id TEXT DEFAULT NULL,
    conversation_title TEXT DEFAULT NULL,
    message_id TEXT DEFAULT NULL,
    content TEXT NOT NULL,
    note TEXT DEFAULT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_user_favorites_uid ON user_favorites(uid, created_at DESC);

  CREATE TABLE IF NOT EXISTS device_sessions (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    device_label TEXT NOT NULL,
    os_name TEXT NOT NULL,
    browser_name TEXT NOT NULL,
    ip_address TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_device_sessions_uid ON device_sessions(uid, last_active_at DESC);

  CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS search_codes (
    code TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    action_type TEXT NOT NULL DEFAULT 'message',
    target_plan TEXT DEFAULT NULL,
    target_view TEXT DEFAULT NULL,
    target_tool_id TEXT DEFAULT NULL,
    target_features_json TEXT DEFAULT NULL,
    response_text TEXT NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS search_code_redemptions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    uid TEXT NOT NULL,
    redeemed_at INTEGER NOT NULL,
    UNIQUE(code, uid)
  );
`);

export const ADMIN_FOUNDER_EMAIL = 'franciscomutelae@gmail.com';
export const ADMIN_FOUNDER_EMAILS = [
  'franciscomutelae@gmail.com',
  'diegofrancisco26@gmail.com',
] as const;

export function isFounderAdminEmail(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && (ADMIN_FOUNDER_EMAILS as readonly string[]).includes(normalized));
}

export function defaultFeaturesForPlan(plan: PlanType): UserFeatures {
  if (plan === 'ultra' || plan === 'pro') {
    return {
      imageGeneration: true,
      webSearch: true,
      visionMultimodal: true,
      ultraModel: plan === 'ultra',
      voiceAudio: true,
      customMemory: true,
    };
  }
  if (plan === 'premium') {
    return {
      imageGeneration: true,
      webSearch: true,
      visionMultimodal: true,
      ultraModel: false,
      voiceAudio: true,
      customMemory: true,
    };
  }
  return {
    imageGeneration: true,
    webSearch: true,
    visionMultimodal: false,
    ultraModel: false,
    voiceAudio: false,
    customMemory: false,
  };
}

export function planLimits(plan: PlanType): { maxMessages: number; maxImages: number } {
  switch (plan) {
    case 'ultra':
      return { maxMessages: 99999, maxImages: 99999 };
    case 'pro':
      return { maxMessages: 250, maxImages: 50 };
    case 'premium':
      return { maxMessages: 100, maxImages: 20 };
  default:
      return { maxMessages: 25, maxImages: 3 };
  }
}

// Promote founder email(s) immediately if already registered in SQLite from earlier sessions
try {
  const ultraFeaturesJson = JSON.stringify(defaultFeaturesForPlan('ultra'));
  authDb
    .prepare(
      `UPDATE accounts SET
         role = 'admin',
         plan = 'ultra',
         status = 'active',
         features_json = ?,
         updated_at = ?
       WHERE LOWER(email) IN ('franciscomutelae@gmail.com', 'diegofrancisco26@gmail.com')`
    )
    .run(ultraFeaturesJson, new Date().toISOString());
} catch (err) {
  console.warn('[ZUNO AuthDB] Founder account promotion check failed:', err);
}

// ----------------------------------------------------
// Google Firebase RS256 Certificate Verifier (Zero Service Account)
// ----------------------------------------------------
interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}
let certCache: CertCache | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAtMs) {
    return certCache.certs;
  }

  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) {
    if (certCache) return certCache.certs;
    throw new Error('Não foi possível obter os certificados públicos da Google.');
  }

  const certs = (await res.json()) as Record<string, string>;
  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  certCache = {
    certs,
    expiresAtMs: now + Math.max(300, maxAgeSec) * 1000,
  };
  return certs;
}

export interface VerifiedFirebaseClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  providerId?: string;
  exp: number;
  iat: number;
}

interface CachedVerifiedToken {
  claims: VerifiedFirebaseClaims;
  cachedUntilMs: number;
}

const verifiedTokenCache = new Map<string, CachedVerifiedToken>();
let lastRevokedCleanupMs = 0;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function isTokenRevoked(token: string): boolean {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  // Throttle expired revocations cleanup to once every 5 minutes
  if (nowMs - lastRevokedCleanupMs > 5 * 60 * 1000) {
    lastRevokedCleanupMs = nowMs;
    authDb.prepare('DELETE FROM revoked_tokens WHERE expires_at < ?').run(nowSec - 300);
  }
  const row = authDb
    .prepare('SELECT token_hash FROM revoked_tokens WHERE token_hash = ?')
    .get(hashToken(token)) as { token_hash: string } | undefined;
  return Boolean(row);
}

export function revokeToken(token: string, uid: string, exp?: number): void {
  const tokenHash = hashToken(token);
  verifiedTokenCache.delete(tokenHash);
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = typeof exp === 'number' && exp > nowSec ? exp : nowSec + 3600;
  authDb
    .prepare(
      `INSERT OR REPLACE INTO revoked_tokens (token_hash, uid, expires_at, revoked_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(tokenHash, uid, expiresAt, nowSec);
}

function decodeBase64Url(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export async function verifyFirebaseIdToken(
  token: string
): Promise<{ valid: true; claims: VerifiedFirebaseClaims } | { valid: false; reason: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token em falta.' };
  }

  if (isTokenRevoked(token)) {
    return { valid: false, reason: 'Sessão terminada ou token revogado. Inicia sessão novamente.' };
  }

  const tokenHash = hashToken(token);
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const cached = verifiedTokenCache.get(tokenHash);
  if (cached && cached.cachedUntilMs > nowMs && cached.claims.exp > nowSec) {
    return { valid: true, claims: cached.claims };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Formato de token inválido.' };
  }

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf-8')) as {
      alg?: string;
      kid?: string;
    };
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString('utf-8')) as Record<string, any>;

    if (header.alg !== 'RS256' || !header.kid) {
      return { valid: false, reason: 'Algoritmo de assinatura de token inválido.' };
    }

    const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

    if (payload.aud !== FIREBASE_PROJECT_ID) {
      return { valid: false, reason: 'Token de sessão inválido para esta plataforma.' };
    }
    if (payload.iss !== expectedIssuer) {
      return { valid: false, reason: 'Emissor de token inválido.' };
    }
    if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
      return { valid: false, reason: 'Identificador de utilizador inválido no token.' };
    }
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
      return { valid: false, reason: 'Token de sessão expirado.' };
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
      return { valid: false, reason: 'Data de emissão do token inválida.' };
    }

    const certs = await getGooglePublicCerts();
    const certPem = certs[header.kid];
    if (!certPem) {
      return { valid: false, reason: 'Chave pública de assinatura não reconhecida.' };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const sigBuffer = decodeBase64Url(parts[2]);

    if (!verifier.verify(certPem, sigBuffer)) {
      return { valid: false, reason: 'Assinatura criptográfica do token inválida.' };
    }

    const claims: VerifiedFirebaseClaims = {
      uid: String(payload.sub),
      email: String(payload.email || '').toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
      name: typeof payload.name === 'string' ? payload.name : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
      providerId:
        typeof payload.firebase?.sign_in_provider === 'string'
          ? payload.firebase.sign_in_provider
          : undefined,
      exp: Number(payload.exp),
      iat: Number(payload.iat),
    };

    if (verifiedTokenCache.size > 500) {
      const firstKey = verifiedTokenCache.keys().next().value;
      if (firstKey) verifiedTokenCache.delete(firstKey);
    }
    verifiedTokenCache.set(tokenHash, {
      claims,
      cachedUntilMs: Math.min(nowMs + 45_000, claims.exp * 1000),
    });

    return {
      valid: true,
      claims,
    };
  } catch (err: any) {
    return { valid: false, reason: err?.message || 'Falha na validação do token.' };
  }
}

// ----------------------------------------------------
// Account Records CRUD & Isolation
// ----------------------------------------------------
function rowToUserProfile(row: any): UserProfile {
  const plan = (['free', 'premium', 'pro', 'ultra'].includes(row.plan) ? row.plan : 'free') as PlanType;
  const limits = planLimits(plan);
  const today = new Date().toISOString().split('T')[0];
  const msgToday = row.usage_date === today ? Number(row.message_count_today || 0) : 0;
  const imgToday = row.usage_date === today ? Number(row.image_count_today || 0) : 0;

  let memories: string[] = [];
  try {
    const parsed = JSON.parse(row.memories_json || '[]');
    if (Array.isArray(parsed)) memories = parsed.map(String);
  } catch {}

  let features = defaultFeaturesForPlan(plan);
  try {
    features = { ...features, ...JSON.parse(row.features_json || '{}') };
  } catch {}

  return {
    id: row.uid,
    name: row.name,
    email: row.email,
    avatar: row.avatar || undefined,
    plan,
    role: row.role === 'admin' ? 'admin' : 'user',
    status: row.status === 'blocked' ? 'blocked' : 'active',
    isBlocked: row.status === 'blocked',
    createdAt: row.created_at,
    language: (row.language || 'pt') as any,
    messageCountToday: msgToday,
    maxMessagesToday: limits.maxMessages,
    imageCountToday: imgToday,
    maxImagesToday: limits.maxImages,
    customInstructions: row.custom_instructions || '',
    aiTone: (row.ai_tone || 'balanced') as any,
    memoryEnabled: Boolean(row.memory_enabled),
    memories,
    features,
  };
}

export function getAccountByUid(uid: string): UserProfile | null {
  const row = authDb.prepare('SELECT * FROM accounts WHERE uid = ?').get(uid) as any;
  return row ? rowToUserProfile(row) : null;
}

export function getAccountByEmail(email: string): UserProfile | null {
  const row = authDb.prepare('SELECT * FROM accounts WHERE LOWER(email) = LOWER(?)').get(email) as any;
  return row ? rowToUserProfile(row) : null;
}

export function upsertVerifiedAccount(claims: VerifiedFirebaseClaims): UserProfile {
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];
  const emailLower = (claims.email || '').trim().toLowerCase();
  const isFounder = isFounderAdminEmail(emailLower) && claims.emailVerified;

  let existing = authDb.prepare('SELECT * FROM accounts WHERE uid = ?').get(claims.uid) as any;
  if (!existing && emailLower) {
    existing = authDb.prepare('SELECT * FROM accounts WHERE LOWER(email) = LOWER(?)').get(emailLower) as any;
  }

  if (!existing) {
    const initialPlan: PlanType = isFounder ? 'ultra' : 'free';
    const initialRole = isFounder ? 'admin' : 'user';
    const displayName =
      claims.name?.trim() || (emailLower ? emailLower.split('@')[0].replace(/[._]/g, ' ') : 'Utilizador ZUNO');
    const featuresJson = JSON.stringify(defaultFeaturesForPlan(initialPlan));
    const defaultMemories = JSON.stringify([
      'Utilizador autenticado com conta verificada ZUNO AI.',
    ]);

    authDb
      .prepare(
        `INSERT INTO accounts (
          uid, email, name, avatar, plan, role, status, language, ai_tone,
          custom_instructions, memory_enabled, memories_json, features_json,
          message_count_today, image_count_today, usage_date, notes, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'pt', 'balanced', '', 1, ?, ?, 0, 0, ?, ?, ?, ?, ?)`
      )
      .run(
        claims.uid,
        emailLower || `${claims.uid}@zuno.local`,
        displayName.slice(0, 120),
        (claims.picture || '').slice(0, 1024),
        initialPlan,
        initialRole,
        defaultMemories,
        featuresJson,
        today,
        isFounder ? 'Fundador / Administrador ZUNO AI' : 'Conta verificada ZUNO AI',
        nowIso,
        nowIso,
        nowIso
      );

    return getAccountByUid(claims.uid)!;
  }

  // If user logged in with a new Firebase UID for an existing seeded founder/admin email, migrate UID safely
  const targetUid = existing.uid;
  const resolvedRole = isFounder ? 'admin' : existing.role;
  const resolvedPlan = isFounder ? 'ultra' : existing.plan;
  const resolvedStatus = isFounder ? 'active' : existing.status;
  const resolvedFeaturesJson = isFounder
    ? JSON.stringify(defaultFeaturesForPlan('ultra'))
    : existing.features_json;

  authDb
    .prepare(
      `UPDATE accounts SET
        uid = ?,
        name = COALESCE(NULLIF(?, ''), name),
        avatar = COALESCE(NULLIF(?, ''), avatar),
        role = ?,
        plan = ?,
        status = ?,
        features_json = ?,
        updated_at = ?,
        last_login_at = ?
       WHERE uid = ?`
    )
    .run(
      claims.uid,
      existing.name || claims.name || '',
      claims.picture || existing.avatar || '',
      resolvedRole,
      resolvedPlan,
      resolvedStatus,
      resolvedFeaturesJson,
      nowIso,
      nowIso,
      targetUid
    );

  return getAccountByUid(claims.uid)!;
}

export function updateAccountProfile(
  uid: string,
  updates: {
    name?: string;
    language?: string;
    aiTone?: string;
    customInstructions?: string;
    memoryEnabled?: boolean;
    memories?: string[];
  }
): UserProfile | null {
  const existing = authDb.prepare('SELECT * FROM accounts WHERE uid = ?').get(uid) as any;
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const nextName = typeof updates.name === 'string' && updates.name.trim()
    ? updates.name.trim().slice(0, 120)
    : existing.name;
  const nextLang = ['pt', 'en', 'es', 'fr'].includes(String(updates.language))
    ? String(updates.language)
    : existing.language;
  const nextTone = ['balanced', 'creative', 'precise', 'friendly', 'academic'].includes(String(updates.aiTone))
    ? String(updates.aiTone)
    : existing.ai_tone;
  const nextInstructions =
    typeof updates.customInstructions === 'string'
      ? updates.customInstructions.slice(0, 2000)
      : existing.custom_instructions;
  const nextMemEnabled =
    typeof updates.memoryEnabled === 'boolean' ? (updates.memoryEnabled ? 1 : 0) : existing.memory_enabled;
  const nextMemoriesJson = Array.isArray(updates.memories)
    ? JSON.stringify(updates.memories.slice(0, 50).map((m) => String(m).trim().slice(0, 300)).filter(Boolean))
    : existing.memories_json;

  authDb
    .prepare(
      `UPDATE accounts SET
        name = ?,
        language = ?,
        ai_tone = ?,
        custom_instructions = ?,
        memory_enabled = ?,
        memories_json = ?,
        updated_at = ?
       WHERE uid = ?`
    )
    .run(nextName, nextLang, nextTone, nextInstructions, nextMemEnabled, nextMemoriesJson, nowIso, uid);

  return getAccountByUid(uid);
}

export function incrementAccountUsage(uid: string, kind: 'message' | 'image'): UserProfile | null {
  const existing = authDb.prepare('SELECT * FROM accounts WHERE uid = ?').get(uid) as any;
  if (!existing) return null;
  const today = new Date().toISOString().split('T')[0];
  let msgCount = existing.usage_date === today ? Number(existing.message_count_today || 0) : 0;
  let imgCount = existing.usage_date === today ? Number(existing.image_count_today || 0) : 0;

  if (kind === 'message') msgCount++;
  else imgCount++;

  authDb
    .prepare(
      `UPDATE accounts SET
        message_count_today = ?,
        image_count_today = ?,
        usage_date = ?,
        last_login_at = ?
       WHERE uid = ?`
    )
    .run(msgCount, imgCount, today, new Date().toISOString(), uid);

  return getAccountByUid(uid);
}

export function setAccountPlan(uid: string, plan: PlanType): UserProfile | null {
  const existing = authDb.prepare('SELECT * FROM accounts WHERE uid = ?').get(uid) as any;
  if (!existing) return null;
  const featuresJson = JSON.stringify(defaultFeaturesForPlan(plan));
  authDb
    .prepare('UPDATE accounts SET plan = ?, features_json = ?, updated_at = ? WHERE uid = ?')
    .run(plan, featuresJson, new Date().toISOString(), uid);
  return getAccountByUid(uid);
}

export function setAccountBlocked(uid: string, blocked: boolean, reason?: string): UserProfile | null {
  const existing = authDb.prepare('SELECT * FROM accounts WHERE uid = ? OR LOWER(email) = LOWER(?)').get(uid, uid) as any;
  if (!existing) return null;
  const nextNotes = reason ? `${existing.notes ? existing.notes + ' | ' : ''}Bloqueio: ${reason}` : existing.notes;
  authDb
    .prepare('UPDATE accounts SET status = ?, notes = ?, updated_at = ? WHERE uid = ?')
    .run(blocked ? 'blocked' : 'active', nextNotes, new Date().toISOString(), existing.uid);
  return getAccountByUid(existing.uid);
}

export function deleteAccountDataByUid(uid: string): boolean {
  const info = authDb.prepare('DELETE FROM accounts WHERE uid = ?').run(uid);
  authDb.prepare('DELETE FROM user_conversations WHERE uid = ?').run(uid);
  authDb.prepare('DELETE FROM user_images WHERE uid = ?').run(uid);
  authDb.prepare('DELETE FROM user_favorites WHERE uid = ?').run(uid);
  authDb.prepare('DELETE FROM device_sessions WHERE uid = ?').run(uid);
  authDb.prepare('DELETE FROM revoked_tokens WHERE uid = ?').run(uid);
  return Number(info.changes || 0) > 0;
}

export function listManagedAccounts(): ManagedUser[] {
  const rows = authDb.prepare('SELECT * FROM accounts ORDER BY last_login_at DESC').all() as any[];
  return rows.map((r) => {
    let features = defaultFeaturesForPlan((r.plan || 'free') as PlanType);
    try {
      features = { ...features, ...JSON.parse(r.features_json || '{}') };
    } catch {}
    return {
      id: r.uid,
      name: r.name,
      email: r.email,
      avatar: r.avatar || undefined,
      plan: (r.plan || 'free') as PlanType,
      role: r.role === 'admin' ? 'admin' : 'user',
      status: r.status === 'blocked' ? 'blocked' : 'active',
      createdAt: r.created_at,
      lastActive: r.last_login_at,
      messageCount: Number(r.message_count_today || 0),
      imageCount: Number(r.image_count_today || 0),
      features,
      notes: r.notes || undefined,
    };
  });
}

export function createOrProvisionAccount(params: {
  name: string;
  email: string;
  plan?: PlanType;
  role?: 'user' | 'admin';
  notes?: string;
  features?: Partial<UserFeatures>;
}): ManagedUser {
  const cleanEmail = String(params.email || '').trim().toLowerCase();
  const cleanName = String(params.name || '').trim() || cleanEmail.split('@')[0] || 'Utilizador ZUNO';
  const plan: PlanType = ['free', 'premium', 'pro', 'ultra'].includes(String(params.plan))
    ? (params.plan as PlanType)
    : 'free';
  const role: 'user' | 'admin' = params.role === 'admin' ? 'admin' : 'user';
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];
  const uid = 'manual_' + crypto.randomUUID();
  const mergedFeatures = { ...defaultFeaturesForPlan(plan), ...(params.features || {}) };

  authDb
    .prepare(
      `INSERT INTO accounts (
        uid, email, name, avatar, plan, role, status, language, ai_tone,
        custom_instructions, memory_enabled, memories_json, features_json,
        message_count_today, image_count_today, usage_date, notes, created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, '', ?, ?, 'active', 'pt', 'balanced', '', 1, '[]', ?, 0, 0, ?, ?, ?, ?, ?)`
    )
    .run(
      uid,
      cleanEmail,
      cleanName.slice(0, 120),
      plan,
      role,
      JSON.stringify(mergedFeatures),
      today,
      String(params.notes || 'Conta pré-registada pelo administrador ZUNO AI.').slice(0, 500),
      nowIso,
      nowIso,
      nowIso
    );

  return {
    id: uid,
    name: cleanName,
    email: cleanEmail,
    plan,
    role,
    status: 'active',
    createdAt: nowIso,
    lastActive: nowIso,
    messageCount: 0,
    imageCount: 0,
    features: mergedFeatures,
    notes: params.notes || 'Conta pré-registada pelo administrador ZUNO AI.',
  };
}

export function setAccountFeatures(uidOrEmail: string, features: Partial<UserFeatures>): UserProfile | null {
  const existing = authDb
    .prepare('SELECT * FROM accounts WHERE uid = ? OR LOWER(email) = LOWER(?)')
    .get(uidOrEmail, uidOrEmail) as any;
  if (!existing) return null;
  let current = defaultFeaturesForPlan((existing.plan || 'free') as PlanType);
  try {
    current = { ...current, ...JSON.parse(existing.features_json || '{}') };
  } catch {}
  const nextFeatures = { ...current, ...features };
  authDb
    .prepare('UPDATE accounts SET features_json = ?, updated_at = ? WHERE uid = ?')
    .run(JSON.stringify(nextFeatures), new Date().toISOString(), existing.uid);
  return getAccountByUid(existing.uid);
}

export function setAccountRole(uidOrEmail: string, role: 'user' | 'admin'): UserProfile | null {
  const existing = authDb
    .prepare('SELECT * FROM accounts WHERE uid = ? OR LOWER(email) = LOWER(?)')
    .get(uidOrEmail, uidOrEmail) as any;
  if (!existing) return null;
  if (isFounderAdminEmail(existing.email) && role !== 'admin') {
    return getAccountByUid(existing.uid);
  }
  const safeRole = role === 'admin' ? 'admin' : 'user';
  authDb
    .prepare('UPDATE accounts SET role = ?, updated_at = ? WHERE uid = ?')
    .run(safeRole, new Date().toISOString(), existing.uid);
  return getAccountByUid(existing.uid);
}

export function resetAccountDailyQuota(uidOrEmail: string): UserProfile | null {
  const existing = authDb
    .prepare('SELECT * FROM accounts WHERE uid = ? OR LOWER(email) = LOWER(?)')
    .get(uidOrEmail, uidOrEmail) as any;
  if (!existing) return null;
  const today = new Date().toISOString().split('T')[0];
  authDb
    .prepare('UPDATE accounts SET message_count_today = 0, image_count_today = 0, usage_date = ?, updated_at = ? WHERE uid = ?')
    .run(today, new Date().toISOString(), existing.uid);
  return getAccountByUid(existing.uid);
}

export function countAllStoredConversations(): number {
  try {
    const row = authDb.prepare('SELECT COUNT(*) AS cnt FROM user_conversations').get() as { cnt: number };
    return Number(row?.cnt || 0);
  } catch {
    return 0;
  }
}

export function countAllStoredImages(): number {
  try {
    const row = authDb.prepare('SELECT COUNT(*) AS cnt FROM user_images').get() as { cnt: number };
    return Number(row?.cnt || 0);
  } catch {
    return 0;
  }
}

export function getPlatformSetting<T>(key: string, fallback: T): T {
  try {
    const row = authDb.prepare('SELECT value_json FROM platform_settings WHERE key = ?').get(key) as
      | { value_json: string }
      | undefined;
    if (!row) return fallback;
    return JSON.parse(row.value_json) as T;
  } catch {
    return fallback;
  }
}

export function setPlatformSetting<T>(key: string, value: T): T {
  authDb
    .prepare(
      `INSERT INTO platform_settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    .run(key, JSON.stringify(value), Date.now());
  return value;
}

// ----------------------------------------------------
// Strictly Isolated Conversations Store (uid = owner)
// ----------------------------------------------------
export function listUserConversations(uid: string): Conversation[] {
  const rows = authDb
    .prepare('SELECT * FROM user_conversations WHERE uid = ? ORDER BY updated_at DESC')
    .all(uid) as any[];

  return rows.map((r) => {
    let messages = [];
    try {
      messages = JSON.parse(r.messages_json || '[]');
    } catch {}
    return {
      id: r.id,
      title: r.title,
      model: r.model || 'gemini-3.1-flash-lite',
      toolId: r.tool_id || undefined,
      isPinned: Boolean(r.is_pinned),
      messages: Array.isArray(messages) ? messages : [],
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    };
  });
}

export function upsertUserConversation(uid: string, conv: Conversation): Conversation {
  // Ownership check: never let one user overwrite another user's conversation ID!
  const existing = authDb
    .prepare('SELECT uid FROM user_conversations WHERE id = ?')
    .get(conv.id) as { uid: string } | undefined;

  if (existing && existing.uid !== uid) {
    throw new Error('CONV_OWNERSHIP_DENIED');
  }

  const now = Date.now();
  const safeMessages = Array.isArray(conv.messages) ? conv.messages.slice(-200) : [];
  authDb
    .prepare(
      `INSERT INTO user_conversations (id, uid, title, model, tool_id, is_pinned, messages_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         model = excluded.model,
         tool_id = excluded.tool_id,
         is_pinned = excluded.is_pinned,
         messages_json = excluded.messages_json,
         updated_at = excluded.updated_at`
    )
    .run(
      conv.id,
      uid,
      String(conv.title || 'Nova conversa').slice(0, 200),
      String(conv.model || 'gemini-3.1-flash-lite').slice(0, 80),
      conv.toolId || null,
      conv.isPinned ? 1 : 0,
      JSON.stringify(safeMessages),
      Number(conv.createdAt || now),
      Number(conv.updatedAt || now)
    );

  return {
    ...conv,
    messages: safeMessages,
  };
}

export function deleteUserConversation(uid: string, convId: string): boolean {
  const info = authDb.prepare('DELETE FROM user_conversations WHERE id = ? AND uid = ?').run(convId, uid);
  return Number(info.changes || 0) > 0;
}

// ----------------------------------------------------
// Strictly Isolated Generated Images Store (uid = owner)
// ----------------------------------------------------
export function saveUserImage(uid: string, img: GeneratedImage): void {
  authDb
    .prepare(
      `INSERT OR REPLACE INTO user_images (id, uid, url, prompt, style, aspect_ratio, quality, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      img.id,
      uid,
      img.url,
      String(img.prompt || '').slice(0, 2000),
      String(img.style || 'realista').slice(0, 64),
      String(img.aspectRatio || '1:1').slice(0, 16),
      String(img.quality || 'hd').slice(0, 32),
      String(img.model || 'ZUNO Engine').slice(0, 100),
      Number(img.createdAt || Date.now())
    );
}

export function listUserImages(uid: string, limit = 50): GeneratedImage[] {
  const rows = authDb
    .prepare('SELECT * FROM user_images WHERE uid = ? ORDER BY created_at DESC LIMIT ?')
    .all(uid, limit) as any[];

  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    prompt: r.prompt,
    style: r.style as any,
    aspectRatio: r.aspect_ratio as any,
    quality: r.quality as any,
    model: r.model,
    userId: r.uid,
    createdAt: Number(r.created_at),
  }));
}

export function deleteUserImage(uid: string, imageId: string): boolean {
  const info = authDb.prepare('DELETE FROM user_images WHERE id = ? AND uid = ?').run(imageId, uid);
  return Number(info.changes || 0) > 0;
}

// ----------------------------------------------------
// VIP Codes (Strictly Authenticated + Admin Created)
// ----------------------------------------------------
export interface VipCodeRecord {
  code: string;
  plan: PlanType;
  maxUses: number;
  usedCount: number;
  createdBy: string;
  active: boolean;
  createdAt: number;
}

export function createVipCode(params: {
  code?: string;
  plan: PlanType;
  maxUses?: number;
  createdBy: string;
}): VipCodeRecord {
  const cleanCode = (
    params.code?.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '') ||
    `ZUNO-${params.plan.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  ).slice(0, 32);

  const now = Date.now();
  const maxUses = Math.max(1, Math.min(1000, Number(params.maxUses || 1)));
  authDb
    .prepare(
      `INSERT INTO vip_codes (code, plan, max_uses, used_count, created_by, active, created_at)
       VALUES (?, ?, ?, 0, ?, 1, ?)`
    )
    .run(cleanCode, params.plan, maxUses, params.createdBy, now);

  return {
    code: cleanCode,
    plan: params.plan,
    maxUses,
    usedCount: 0,
    createdBy: params.createdBy,
    active: true,
    createdAt: now,
  };
}

export function listVipCodes(): VipCodeRecord[] {
  const rows = authDb.prepare('SELECT * FROM vip_codes ORDER BY created_at DESC').all() as any[];
  return rows.map((r) => ({
    code: r.code,
    plan: r.plan as PlanType,
    maxUses: Number(r.max_uses),
    usedCount: Number(r.used_count),
    createdBy: r.created_by,
    active: Boolean(r.active),
    createdAt: Number(r.created_at),
  }));
}

export function setVipCodeActive(code: string, active: boolean): VipCodeRecord | null {
  const clean = String(code || '').trim().toUpperCase();
  const res = authDb.prepare('UPDATE vip_codes SET active = ? WHERE code = ?').run(active ? 1 : 0, clean);
  if (Number(res.changes || 0) === 0) return null;
  const row = authDb.prepare('SELECT * FROM vip_codes WHERE code = ?').get(clean) as any;
  if (!row) return null;
  return {
    code: row.code,
    plan: row.plan as PlanType,
    maxUses: Number(row.max_uses),
    usedCount: Number(row.used_count),
    createdBy: row.created_by,
    active: Boolean(row.active),
    createdAt: Number(row.created_at),
  };
}

export function deleteVipCode(code: string): boolean {
  const clean = String(code || '').trim().toUpperCase();
  const res = authDb.prepare('DELETE FROM vip_codes WHERE code = ?').run(clean);
  return Number(res.changes || 0) > 0;
}

export function redeemVipCode(
  code: string,
  uid: string
): { success: boolean; error?: string; user?: UserProfile; plan?: PlanType } {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    return { success: false, error: 'Código VIP obrigatório.' };
  }

  const row = authDb.prepare('SELECT * FROM vip_codes WHERE code = ?').get(normalized) as any;
  if (!row || !row.active) {
    return { success: false, error: 'Código VIP inválido ou inativo.' };
  }
  if (Number(row.used_count) >= Number(row.max_uses)) {
    return { success: false, error: 'Este código VIP já atingiu o limite máximo de utilizações.' };
  }

  const already = authDb
    .prepare('SELECT id FROM vip_redemptions WHERE code = ? AND uid = ?')
    .get(normalized, uid) as any;
  if (already) {
    return { success: false, error: 'Este código VIP já foi utilizado na tua conta.' };
  }

  const targetPlan = (['premium', 'pro', 'ultra'].includes(row.plan) ? row.plan : 'pro') as PlanType;
  const redemptionId = 'vip_' + crypto.randomUUID();

  authDb
    .prepare('INSERT INTO vip_redemptions (id, code, uid, redeemed_at) VALUES (?, ?, ?, ?)')
    .run(redemptionId, normalized, uid, Date.now());
  authDb.prepare('UPDATE vip_codes SET used_count = used_count + 1 WHERE code = ?').run(normalized);

  const updatedUser = setAccountPlan(uid, targetPlan);
  if (!updatedUser) {
    return { success: false, error: 'Conta de utilizador não encontrada.' };
  }

  return { success: true, user: updatedUser, plan: targetPlan };
}

// ----------------------------------------------------
// Guest Public Search / Q&A IP Rate Limiter
// ----------------------------------------------------
const guestUsageByIp = new Map<string, { count: number; windowStart: number }>();

export function checkGuestRateLimit(ip: string, maxPerHour = 15): { allowed: boolean; remaining: number } {
  const key = ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const entry = guestUsageByIp.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    guestUsageByIp.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxPerHour - 1 };
  }

  if (entry.count >= maxPerHour) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxPerHour - entry.count };
}

export function clearGuestRateLimits(): number {
  const count = guestUsageByIp.size;
  guestUsageByIp.clear();
  return count;
}

export function getGuestRateLimitCount(): number {
  return guestUsageByIp.size;
}

// ----------------------------------------------------
// Database Health Probe
// ----------------------------------------------------
export function pingAuthDb(): boolean {
  try {
    const row = authDb.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    return row?.ok === 1;
  } catch {
    return false;
  }
}

// ----------------------------------------------------
// Strictly Isolated Saved Favorites Store (uid = owner)
// ----------------------------------------------------
export function listUserFavorites(uid: string): FavoriteItem[] {
  const rows = authDb
    .prepare('SELECT * FROM user_favorites WHERE uid = ? ORDER BY created_at DESC')
    .all(uid) as any[];

  return rows.map((r) => ({
    id: r.id,
    uid: r.uid,
    conversationId: r.conversation_id || undefined,
    conversationTitle: r.conversation_title || undefined,
    messageId: r.message_id || undefined,
    content: r.content,
    note: r.note || undefined,
    createdAt: Number(r.created_at),
  }));
}

export function upsertUserFavorite(
  uid: string,
  fav: Partial<FavoriteItem> & { id: string; content: string }
): FavoriteItem {
  const existing = authDb
    .prepare('SELECT uid FROM user_favorites WHERE id = ?')
    .get(fav.id) as { uid: string } | undefined;

  if (existing && existing.uid !== uid) {
    throw new Error('FAV_OWNERSHIP_DENIED');
  }

  const now = Number(fav.createdAt || Date.now());
  const cleanContent = String(fav.content || '').slice(0, 20000);
  const cleanTitle = fav.conversationTitle ? String(fav.conversationTitle).slice(0, 200) : null;
  const cleanNote = fav.note ? String(fav.note).slice(0, 500) : null;

  authDb
    .prepare(
      `INSERT INTO user_favorites (id, uid, conversation_id, conversation_title, message_id, content, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         conversation_id = excluded.conversation_id,
         conversation_title = excluded.conversation_title,
         message_id = excluded.message_id,
         content = excluded.content,
         note = excluded.note`
    )
    .run(
      fav.id,
      uid,
      fav.conversationId || null,
      cleanTitle,
      fav.messageId || null,
      cleanContent,
      cleanNote,
      now
    );

  return {
    id: fav.id,
    uid,
    conversationId: fav.conversationId,
    conversationTitle: cleanTitle || undefined,
    messageId: fav.messageId,
    content: cleanContent,
    note: cleanNote || undefined,
    createdAt: now,
  };
}

export function deleteUserFavorite(uid: string, favId: string): boolean {
  const info = authDb.prepare('DELETE FROM user_favorites WHERE id = ? AND uid = ?').run(favId, uid);
  return Number(info.changes || 0) > 0;
}

// ----------------------------------------------------
// Multi-Device Sessions & Remote Sign-Out Control
// ----------------------------------------------------
export function parseDeviceMetadata(
  userAgent: string,
  ip?: string
): { deviceLabel: string; osName: string; browserName: string; ipAddress: string } {
  const ua = String(userAgent || '');

  let osName = 'Computador';
  if (/CrOS/i.test(ua)) osName = 'Chromebook';
  else if (/iPad/i.test(ua)) osName = 'iPad (iPadOS)';
  else if (/iPhone|iPod/i.test(ua)) osName = 'iPhone (iOS)';
  else if (/Android/i.test(ua)) osName = /Mobile/i.test(ua) ? 'Android' : 'Tablet Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) osName = 'macOS';
  else if (/Windows/i.test(ua)) osName = 'Windows';
  else if (/Linux/i.test(ua)) osName = 'Linux';

  let browserName = 'Navegador Web';
  if (/SamsungBrowser/i.test(ua)) browserName = 'Samsung Internet';
  else if (/Edg\//i.test(ua)) browserName = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browserName = 'Opera';
  else if (/Firefox|FxiOS/i.test(ua)) browserName = 'Firefox';
  else if (/CriOS|Chrome/i.test(ua)) browserName = 'Google Chrome';
  else if (/Safari/i.test(ua)) browserName = 'Safari';

  const cleanIp = String(ip || '')
    .replace('::ffff:', '')
    .split(',')[0]
    .trim()
    .slice(0, 64);

  return {
    deviceLabel: `${osName} • ${browserName}`,
    osName,
    browserName,
    ipAddress: cleanIp || 'Rede atual',
  };
}

function makeScopedDeviceKey(uid: string, deviceId: string): string {
  return `${uid}::${deviceId.trim().slice(0, 128)}`;
}

export function upsertDeviceSession(
  uid: string,
  deviceId: string,
  meta: { userAgent?: string; ip?: string }
): void {
  const cleanDeviceId = String(deviceId || '').trim();
  if (!cleanDeviceId) return;

  const scopedId = makeScopedDeviceKey(uid, cleanDeviceId);
  const parsed = parseDeviceMetadata(meta.userAgent || '', meta.ip);
  const now = Date.now();

  const existing = authDb
    .prepare('SELECT id, is_revoked FROM device_sessions WHERE id = ?')
    .get(scopedId) as { id: string; is_revoked: number } | undefined;

  if (existing && existing.is_revoked === 1) {
    return;
  }

  authDb
    .prepare(
      `INSERT INTO device_sessions (id, uid, device_label, os_name, browser_name, ip_address, created_at, last_active_at, is_revoked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(id) DO UPDATE SET
         device_label = excluded.device_label,
         os_name = excluded.os_name,
         browser_name = excluded.browser_name,
         ip_address = excluded.ip_address,
         last_active_at = excluded.last_active_at`
    )
    .run(
      scopedId,
      uid,
      parsed.deviceLabel,
      parsed.osName,
      parsed.browserName,
      parsed.ipAddress,
      now,
      now
    );
}

export function isDeviceSessionRevoked(uid: string, deviceId?: string | null): boolean {
  const cleanDeviceId = String(deviceId || '').trim();
  if (!cleanDeviceId) return false;
  const scopedId = makeScopedDeviceKey(uid, cleanDeviceId);
  const row = authDb
    .prepare('SELECT is_revoked FROM device_sessions WHERE id = ? AND uid = ?')
    .get(scopedId, uid) as { is_revoked: number } | undefined;
  return Boolean(row && row.is_revoked === 1);
}

export function revokeDeviceSession(uid: string, rawDeviceId: string): boolean {
  const cleanId = String(rawDeviceId || '').trim();
  if (!cleanId) return false;
  const scopedId = cleanId.startsWith(`${uid}::`) ? cleanId : makeScopedDeviceKey(uid, cleanId);
  const info = authDb
    .prepare('UPDATE device_sessions SET is_revoked = 1 WHERE id = ? AND uid = ?')
    .run(scopedId, uid);
  return Number(info.changes || 0) > 0;
}

export function revokeOtherDeviceSessions(uid: string, currentDeviceId: string): number {
  const currentScoped = currentDeviceId
    ? makeScopedDeviceKey(uid, currentDeviceId)
    : '';
  const info = currentScoped
    ? authDb
        .prepare('UPDATE device_sessions SET is_revoked = 1 WHERE uid = ? AND id != ? AND is_revoked = 0')
        .run(uid, currentScoped)
    : authDb
        .prepare('UPDATE device_sessions SET is_revoked = 1 WHERE uid = ? AND is_revoked = 0')
        .run(uid);
  return Number(info.changes || 0);
}

export function listUserDeviceSessions(uid: string, currentDeviceId?: string): DeviceSessionInfo[] {
  const currentScoped = currentDeviceId ? makeScopedDeviceKey(uid, currentDeviceId) : '';
  const rows = authDb
    .prepare('SELECT * FROM device_sessions WHERE uid = ? AND is_revoked = 0 ORDER BY last_active_at DESC LIMIT 20')
    .all(uid) as any[];

  return rows.map((r) => ({
    id: r.id.includes('::') ? r.id.split('::').slice(1).join('::') : r.id,
    deviceLabel: r.device_label,
    osName: r.os_name,
    browserName: r.browser_name,
    ipAddress: r.ip_address || 'Rede atual',
    createdAt: Number(r.created_at),
    lastActiveAt: Number(r.last_active_at),
    isRevoked: Boolean(r.is_revoked),
    isCurrent: Boolean(currentScoped && r.id === currentScoped),
  }));
}

export function listAllActiveSessionsForAdmin(): Array<DeviceSessionInfo & { uid: string; email: string; userName: string }> {
  const rows = authDb
    .prepare(
      `SELECT ds.*, a.email, a.name AS user_name
       FROM device_sessions ds
       LEFT JOIN accounts a ON ds.uid = a.uid
       WHERE ds.is_revoked = 0
       ORDER BY ds.last_active_at DESC
       LIMIT 60`
    )
    .all() as any[];

  return rows.map((r) => ({
    id: r.id.includes('::') ? r.id.split('::').slice(1).join('::') : r.id,
    uid: r.uid,
    email: r.email || r.uid,
    userName: r.user_name || 'Utilizador ZUNO',
    deviceLabel: r.device_label,
    osName: r.os_name,
    browserName: r.browser_name,
    ipAddress: r.ip_address || 'Rede atual',
    createdAt: Number(r.created_at),
    lastActiveAt: Number(r.last_active_at),
    isRevoked: Boolean(r.is_revoked),
    isCurrent: false,
  }));
}

export function clearGuestRateLimitsHelper(mapRef: Map<string, any>): number {
  const count = mapRef.size;
  mapRef.clear();
  return count;
}

// ----------------------------------------------------
// Custom Search Bar Codes (Admin Created & Purpose-Driven)
// ----------------------------------------------------
const VALID_SEARCH_ACTIONS: SearchBarCodeActionType[] = [
  'message',
  'upgrade_plan',
  'unlock_features',
  'navigate',
  'open_tool',
  'creator_greeting',
];

const VALID_TOOLS: ToolId[] = [
  'writer',
  'study',
  'code',
  'translate',
  'vision',
  'pdf',
  'voice',
  'creative',
  'image',
  'search',
];

function normalizeSearchCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-_@#$.]/g, '')
    .slice(0, 48);
}

function mapSearchCodeRow(row: any): SearchBarCodeRecord {
  let targetFeatures: Partial<UserFeatures> | undefined;
  if (row.target_features_json) {
    try {
      targetFeatures = JSON.parse(row.target_features_json);
    } catch {
      targetFeatures = undefined;
    }
  }
  return {
    code: row.code,
    purpose: row.purpose,
    description: row.description || '',
    actionType: (VALID_SEARCH_ACTIONS.includes(row.action_type)
      ? row.action_type
      : 'message') as SearchBarCodeActionType,
    targetPlan: row.target_plan || undefined,
    targetView: row.target_view || undefined,
    targetToolId: row.target_tool_id || undefined,
    targetFeatures,
    responseText: row.response_text,
    maxUses: Number(row.max_uses || 0),
    usedCount: Number(row.used_count || 0),
    active: Boolean(row.active),
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at || row.created_at),
  };
}

export function listSearchCodes(): SearchBarCodeRecord[] {
  const rows = authDb.prepare('SELECT * FROM search_codes ORDER BY updated_at DESC, created_at DESC').all() as any[];
  return rows.map(mapSearchCodeRow);
}

export function upsertSearchCode(params: {
  code: string;
  purpose: string;
  description?: string;
  actionType: SearchBarCodeActionType;
  targetPlan?: PlanType;
  targetView?: string;
  targetToolId?: ToolId;
  targetFeatures?: Partial<UserFeatures>;
  responseText: string;
  maxUses?: number;
  active?: boolean;
  createdBy: string;
}): SearchBarCodeRecord {
  const cleanCode = normalizeSearchCode(params.code);
  if (!cleanCode || cleanCode.length < 2) {
    throw new Error('O código deve ter pelo menos 2 caracteres alfanuméricos.');
  }
  if (cleanCode === 'ADONAI20010') {
    throw new Error('O código Adonai20010 é reservado ao criador da plataforma.');
  }

  const purpose = String(params.purpose || '').trim().slice(0, 140);
  if (!purpose) {
    throw new Error('Define para que serve o código.');
  }

  const actionType: SearchBarCodeActionType = VALID_SEARCH_ACTIONS.includes(params.actionType)
    ? params.actionType
    : 'message';
  const targetPlan =
    actionType === 'upgrade_plan' && ['free', 'premium', 'pro', 'ultra'].includes(String(params.targetPlan))
      ? (params.targetPlan as PlanType)
      : null;
  const targetView =
    actionType === 'navigate' &&
    ['chat', 'image', 'tools', 'pricing', 'feedback', 'settings'].includes(String(params.targetView))
      ? String(params.targetView)
      : null;
  const targetToolId =
    actionType === 'open_tool' && VALID_TOOLS.includes(params.targetToolId as ToolId)
      ? (params.targetToolId as ToolId)
      : null;
  const targetFeaturesJson =
    actionType === 'unlock_features' && params.targetFeatures && typeof params.targetFeatures === 'object'
      ? JSON.stringify(params.targetFeatures)
      : null;

  const responseText = String(params.responseText || '').trim().slice(0, 2000) || `Código ${cleanCode} ativado (${purpose}).`;
  const description = String(params.description || '').trim().slice(0, 400);
  const maxUses = Math.max(0, Math.min(100000, Math.floor(Number(params.maxUses || 0))));
  const active = params.active !== false ? 1 : 0;
  const now = Date.now();

  const existing = authDb.prepare('SELECT * FROM search_codes WHERE code = ?').get(cleanCode) as any;

  if (existing) {
    authDb
      .prepare(
        `UPDATE search_codes SET
          purpose = ?,
          description = ?,
          action_type = ?,
          target_plan = ?,
          target_view = ?,
          target_tool_id = ?,
          target_features_json = ?,
          response_text = ?,
          max_uses = ?,
          active = ?,
          updated_at = ?
         WHERE code = ?`
      )
      .run(
        purpose,
        description,
        actionType,
        targetPlan,
        targetView,
        targetToolId,
        targetFeaturesJson,
        responseText,
        maxUses,
        active,
        now,
        cleanCode
      );
  } else {
    authDb
      .prepare(
        `INSERT INTO search_codes (
          code, purpose, description, action_type, target_plan, target_view, target_tool_id,
          target_features_json, response_text, max_uses, used_count, active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
      )
      .run(
        cleanCode,
        purpose,
        description,
        actionType,
        targetPlan,
        targetView,
        targetToolId,
        targetFeaturesJson,
        responseText,
        maxUses,
        active,
        params.createdBy,
        now,
        now
      );
  }

  const saved = authDb.prepare('SELECT * FROM search_codes WHERE code = ?').get(cleanCode);
  return mapSearchCodeRow(saved);
}

export function setSearchCodeActive(code: string, active: boolean): SearchBarCodeRecord | null {
  const cleanCode = normalizeSearchCode(code);
  const info = authDb
    .prepare('UPDATE search_codes SET active = ?, updated_at = ? WHERE code = ?')
    .run(active ? 1 : 0, Date.now(), cleanCode);
  if (Number(info.changes || 0) === 0) return null;
  const row = authDb.prepare('SELECT * FROM search_codes WHERE code = ?').get(cleanCode);
  return row ? mapSearchCodeRow(row) : null;
}

export function deleteSearchCode(code: string): boolean {
  const cleanCode = normalizeSearchCode(code);
  const info = authDb.prepare('DELETE FROM search_codes WHERE code = ?').run(cleanCode);
  authDb.prepare('DELETE FROM search_code_redemptions WHERE code = ?').run(cleanCode);
  return Number(info.changes || 0) > 0;
}

export function checkSearchCodeMatch(rawQuery: string): {
  matched: boolean;
  code?: string;
  purpose?: string;
  actionType?: SearchBarCodeActionType;
} {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2 || trimmed.length > 48) {
    return { matched: false };
  }
  const cleanCode = normalizeSearchCode(trimmed);
  if (!cleanCode) return { matched: false };
  if (cleanCode === 'ADONAI20010') {
    return {
      matched: true,
      code: 'Adonai20010',
      purpose: 'Reconhecimento Oficial do Criador (Francisco Mutela Emanuel)',
      actionType: 'creator_greeting',
    };
  }
  const row = authDb
    .prepare('SELECT code, purpose, action_type, max_uses, used_count, active FROM search_codes WHERE code = ?')
    .get(cleanCode) as any;
  if (!row || !row.active) return { matched: false };
  if (Number(row.max_uses || 0) > 0 && Number(row.used_count || 0) >= Number(row.max_uses)) {
    return { matched: false };
  }
  return {
    matched: true,
    code: row.code,
    purpose: row.purpose,
    actionType: row.action_type as SearchBarCodeActionType,
  };
}

export function executeSearchCode(rawQuery: string, uid?: string | null): SearchCodeExecutionResult {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2 || trimmed.length > 48) {
    return { matched: false, executed: false };
  }
  const cleanCode = normalizeSearchCode(trimmed);
  if (cleanCode === 'ADONAI20010') {
    return {
      matched: true,
      executed: true,
      code: 'Adonai20010',
      purpose: 'Reconhecimento Oficial do Criador',
      actionType: 'creator_greeting',
      responseText:
        'Seja bem-vindo, Francisco Mutela Emanuel! Identidade de criador da plataforma ZUNO AI reconhecida com sucesso.',
    };
  }
  const row = authDb.prepare('SELECT * FROM search_codes WHERE code = ?').get(cleanCode) as any;
  if (!row) {
    return { matched: false, executed: false };
  }

  const record = mapSearchCodeRow(row);
  if (!record.active) {
    return {
      matched: true,
      executed: false,
      code: record.code,
      purpose: record.purpose,
      error: `O código ${record.code} encontra-se pausado pelo administrador.`,
    };
  }
  if (record.maxUses > 0 && record.usedCount >= record.maxUses) {
    return {
      matched: true,
      executed: false,
      code: record.code,
      purpose: record.purpose,
      error: `O código ${record.code} já atingiu o limite máximo de utilizações.`,
    };
  }

  const needsAuth = record.actionType === 'upgrade_plan' || record.actionType === 'unlock_features';
  if (needsAuth && !uid) {
    return {
      matched: true,
      executed: false,
      requiresAuth: true,
      code: record.code,
      purpose: record.purpose,
      actionType: record.actionType,
      error: 'Inicia sessão com Google para ativares este código na tua conta ZUNO AI.',
    };
  }

  let updatedUser: UserProfile | undefined;

  if (needsAuth && uid) {
    const alreadyRedeemed = authDb
      .prepare('SELECT id FROM search_code_redemptions WHERE code = ? AND uid = ?')
      .get(record.code, uid);
    if (alreadyRedeemed) {
      return {
        matched: true,
        executed: false,
        code: record.code,
        purpose: record.purpose,
        actionType: record.actionType,
        error: `Já ativaste o código ${record.code} anteriormente nesta conta.`,
      };
    }

    if (record.actionType === 'upgrade_plan' && record.targetPlan) {
      updatedUser = setAccountPlan(uid, record.targetPlan) || undefined;
    } else if (record.actionType === 'unlock_features' && record.targetFeatures) {
      updatedUser = setAccountFeatures(uid, record.targetFeatures) || undefined;
    }

    authDb
      .prepare('INSERT INTO search_code_redemptions (id, code, uid, redeemed_at) VALUES (?, ?, ?, ?)')
      .run('sc_' + crypto.randomUUID(), record.code, uid, Date.now());
  }

  authDb
    .prepare('UPDATE search_codes SET used_count = used_count + 1, updated_at = ? WHERE code = ?')
    .run(Date.now(), record.code);

  return {
    matched: true,
    executed: true,
    code: record.code,
    purpose: record.purpose,
    description: record.description,
    actionType: record.actionType,
    targetPlan: record.targetPlan,
    targetView: record.targetView,
    targetToolId: record.targetToolId,
    responseText: record.responseText,
    user: updatedUser,
  };
}
