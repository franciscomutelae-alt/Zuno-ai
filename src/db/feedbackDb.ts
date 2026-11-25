import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  FeedbackCategoryId,
  FeedbackType,
  FeedbackStatus,
  FeedbackItem,
  FeedbackReply,
  FeedbackAuditEntry,
  FeedbackReport,
  UserNotification,
  FeedbackStats,
} from '../types';
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from '../data/feedbackCategories';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'zuno_feedback.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for reliability and performance
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA journal_size_limit = 524288;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS feedbacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL DEFAULT '',
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    category TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    title TEXT NOT NULL,
    comment TEXT NOT NULL,
    liked_most TEXT DEFAULT '',
    improvement_suggestion TEXT DEFAULT '',
    device_info TEXT DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Recebido',
    is_hidden INTEGER NOT NULL DEFAULT 0,
    report_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback_replies (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    is_official INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS feedback_reply_history (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    reply_id TEXT,
    action TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback_reports (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    reporter_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (feedback_id) REFERENCES feedbacks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feedback_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON feedbacks(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks(category);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_user ON feedbacks(user_id);
  CREATE INDEX IF NOT EXISTS idx_replies_feedback ON feedback_replies(feedback_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id, is_read, created_at DESC);
`);

// Backward-compatible schema migration for liked_app & improvement_area
try {
  const cols = db.prepare(`PRAGMA table_info(feedbacks)`).all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has('liked_app')) {
    db.exec(`ALTER TABLE feedbacks ADD COLUMN liked_app INTEGER DEFAULT NULL`);
  }
  if (!colNames.has('improvement_area')) {
    db.exec(`ALTER TABLE feedbacks ADD COLUMN improvement_area TEXT DEFAULT ''`);
  }
} catch (err) {
  console.warn('[ZUNO FeedbackDB] Column migration check warning:', err);
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// Sanitize text to prevent HTML/script injection while preserving clean text
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

// Spam & abuse guardrails
const submissionTimestamps = new Map<string, number[]>();

export function checkSpamAndAbuse(
  userId: string,
  comment: string,
  title: string
): { allowed: boolean; reason?: string } {
  const cleanComment = sanitizeText(comment);
  const combined = `${sanitizeText(title)} ${cleanComment}`.trim();

  if (cleanComment.length < 3) {
    return { allowed: false, reason: 'Escreve um comentário com pelo menos 3 caracteres.' };
  }

  if (cleanComment.length > 3000) {
    return { allowed: false, reason: 'O comentário excede o limite máximo de 3000 caracteres.' };
  }

  // Block excessive repetitive characters (e.g. aaaaaaaaaa)
  if (/(.)\1{9,}/.test(combined)) {
    return { allowed: false, reason: 'Texto detetado como repetição excessiva (anti-spam).' };
  }

  // Block link spam (more than 2 URLs)
  const urls = combined.match(/https?:\/\/[^\s]+/gi) || [];
  if (urls.length > 2) {
    return { allowed: false, reason: 'Por proteção contra spam, não são permitidos múltiplos links num comentário.' };
  }

  // Rate limit: max 5 submissions per 5 minutes per user, and 8s cooldown
  const now = Date.now();
  const recent = (submissionTimestamps.get(userId) || []).filter((ts) => now - ts < 5 * 60 * 1000);
  if (recent.length > 0 && now - recent[recent.length - 1] < 4000) {
    return { allowed: false, reason: 'Aguarda alguns segundos antes de enviar novo feedback.' };
  }
  if (recent.length >= 8) {
    return { allowed: false, reason: 'Limite temporário de envios atingido. Aguarda alguns minutos.' };
  }

  // Check duplicate recent comment by same user in DB
  const dupStmt = db.prepare(
    `SELECT id FROM feedbacks WHERE user_id = ? AND lower(trim(comment)) = lower(trim(?)) AND created_at > ? LIMIT 1`
  );
  const dup = dupStmt.get(userId, comment, now - 10 * 60 * 1000);
  if (dup) {
    return { allowed: false, reason: 'Já enviaste exatamente este comentário recentemente.' };
  }

  recent.push(now);
  submissionTimestamps.set(userId, recent);
  return { allowed: true };
}

function mapReplyRow(row: any): FeedbackReply {
  const isOfficial = Boolean(row.is_official);
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    userId: isOfficial ? 'official_zuno_team' : row.user_id,
    authorName: isOfficial ? 'Equipa ZUNO AI' : row.author_name,
    authorRole: isOfficial ? 'official_team' : 'user',
    isOfficial,
    officialBadgeLabel: isOfficial ? 'Resposta oficial da equipa ZUNO AI' : undefined,
    content: row.content,
    isEdited: Boolean(row.is_edited),
    isDeleted: Boolean(row.is_deleted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRepliesForFeedback(feedbackId: string, includeDeleted = false): FeedbackReply[] {
  const stmt = includeDeleted
    ? db.prepare(`SELECT * FROM feedback_replies WHERE feedback_id = ? ORDER BY created_at ASC`)
    : db.prepare(`SELECT * FROM feedback_replies WHERE feedback_id = ? AND is_deleted = 0 ORDER BY created_at ASC`);
  const rows = stmt.all(feedbackId) as any[];
  return rows.map(mapReplyRow);
}

function mapFeedbackRow(
  row: any,
  viewerUserId: string,
  isAdminViewer: boolean
): FeedbackItem {
  const isOwner = Boolean(viewerUserId && row.user_id === viewerUserId);
  const isAnonymous = Boolean(row.is_anonymous);

  // Never reveal email publicly or even in standard FeedbackItem DTO!
  let displayName = row.author_name || 'Utilizador ZUNO';
  if (isAnonymous && !isOwner && !isAdminViewer) {
    displayName = 'Utilizador Anónimo';
  } else if (isAnonymous && isAdminViewer && !isOwner) {
    displayName = `${row.author_name} (Anónimo publicamente)`;
  }

  const likedAppVal =
    row.liked_app === 1 || row.liked_app === true
      ? true
      : row.liked_app === 0 || row.liked_app === false
      ? false
      : null;

  return {
    id: row.id,
    userId: isOwner || isAdminViewer ? row.user_id : 'protected',
    authorDisplayName: displayName,
    isAnonymous,
    rating: Number(row.rating),
    likedApp: likedAppVal,
    improvementArea: row.improvement_area || undefined,
    category: row.category as FeedbackCategoryId,
    feedbackType: row.feedback_type as FeedbackType,
    title: row.title,
    comment: row.comment,
    likedMost: row.liked_most || undefined,
    improvementSuggestion: row.improvement_suggestion || undefined,
    deviceInfo: row.device_info || undefined,
    isPublic: Boolean(row.is_public),
    status: row.status as FeedbackStatus,
    isHidden: Boolean(row.is_hidden),
    reportCount: Number(row.report_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: getRepliesForFeedback(row.id, false),
    canEdit: isOwner,
    canDelete: isOwner || isAdminViewer,
  };
}

export function createFeedback(params: {
  userId: string;
  authorName: string;
  authorEmail?: string;
  isAnonymous?: boolean;
  rating: number;
  likedApp?: boolean | null;
  improvementArea?: string;
  category: FeedbackCategoryId;
  feedbackType: FeedbackType;
  title: string;
  comment: string;
  likedMost?: string;
  improvementSuggestion?: string;
  deviceInfo?: string;
  isPublic?: boolean;
}): FeedbackItem {
  const now = Date.now();
  const id = genId('fb');

  // Ensure non-admin users cannot sneak "Equipa ZUNO AI" as their display name
  let cleanAuthor = sanitizeText(params.authorName) || 'Utilizador ZUNO';
  if (/equipa\s+zuno|oficial\s+zuno|zuno\s+ai\s+team|staff\s+zuno/i.test(cleanAuthor)) {
    cleanAuthor = 'Utilizador ZUNO';
  }

  const validCategory = FEEDBACK_CATEGORIES.some((c) => c.id === params.category)
    ? params.category
    : 'sugestao_geral';

  const validRating = Math.min(5, Math.max(1, Math.round(Number(params.rating) || 5)));
  const validType: FeedbackType = ['praise', 'improvement', 'bug', 'feature_request'].includes(
    params.feedbackType
  )
    ? params.feedbackType
    : 'praise';

  const cleanTitle = sanitizeText(params.title) || 'Comentário sobre a ZUNO AI';
  const cleanComment = sanitizeText(params.comment);
  const cleanLiked = sanitizeText(params.likedMost || '');
  const cleanImp = sanitizeText(params.improvementSuggestion || '');
  const cleanImpArea = sanitizeText(params.improvementArea || '');
  const likedAppDb =
    params.likedApp === true ? 1 : params.likedApp === false ? 0 : validRating >= 4 ? 1 : validRating <= 2 ? 0 : null;
  const cleanDevice = sanitizeText(params.deviceInfo || '');
  const isPublic = params.isPublic !== false ? 1 : 0;
  const isAnon = params.isAnonymous ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO feedbacks (
      id, user_id, author_name, author_email, is_anonymous, rating, liked_app, improvement_area,
      category, feedback_type, title, comment, liked_most, improvement_suggestion,
      device_info, is_public, status, is_hidden, report_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Recebido', 0, 0, ?, ?)
  `);

  stmt.run(
    id,
    params.userId,
    cleanAuthor,
    params.authorEmail || '',
    isAnon,
    validRating,
    likedAppDb,
    cleanImpArea,
    validCategory,
    validType,
    cleanTitle,
    cleanComment,
    cleanLiked,
    cleanImp,
    cleanDevice,
    isPublic,
    now,
    now
  );

  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id);
  return mapFeedbackRow(row, params.userId, false);
}

export function listFeedbacks(options: {
  viewerUserId: string;
  isAdminViewer: boolean;
  category?: string;
  rating?: number;
  likedFilter?: 'all' | 'liked' | 'disliked';
  status?: string;
  feedbackType?: string;
  search?: string;
  dateFilter?: 'all' | 'today' | '7d' | '30d';
  visibilityFilter?: 'all' | 'public' | 'private' | 'reported';
  onlyMine?: boolean;
}): FeedbackItem[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (!options.isAdminViewer) {
    // Public viewers only see non-hidden public feedback OR their own private feedback
    if (options.onlyMine && options.viewerUserId) {
      conditions.push(`user_id = ?`);
      params.push(options.viewerUserId);
    } else if (options.viewerUserId) {
      conditions.push(`((is_public = 1 AND is_hidden = 0) OR user_id = ?)`);
      params.push(options.viewerUserId);
    } else {
      conditions.push(`(is_public = 1 AND is_hidden = 0)`);
    }
  } else {
    // Admin can filter by visibility/reported
    if (options.visibilityFilter === 'public') {
      conditions.push(`is_public = 1`);
    } else if (options.visibilityFilter === 'private') {
      conditions.push(`is_public = 0`);
    } else if (options.visibilityFilter === 'reported') {
      conditions.push(`report_count > 0`);
    }
  }

  if (options.category && options.category !== 'all') {
    conditions.push(`category = ?`);
    params.push(options.category);
  }

  if (options.rating && options.rating >= 1 && options.rating <= 5) {
    conditions.push(`rating = ?`);
    params.push(options.rating);
  }

  if (options.likedFilter === 'liked') {
    conditions.push(`(liked_app = 1 OR (liked_app IS NULL AND rating >= 4))`);
  } else if (options.likedFilter === 'disliked') {
    conditions.push(`(liked_app = 0 OR (liked_app IS NULL AND rating <= 2))`);
  }

  if (options.status && options.status !== 'all') {
    conditions.push(`status = ?`);
    params.push(options.status);
  }

  if (options.feedbackType && options.feedbackType !== 'all') {
    conditions.push(`feedback_type = ?`);
    params.push(options.feedbackType);
  }

  if (options.dateFilter && options.dateFilter !== 'all') {
    const now = Date.now();
    let cutoff = 0;
    if (options.dateFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      cutoff = startOfDay.getTime();
    } else if (options.dateFilter === '7d') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (options.dateFilter === '30d') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }
    if (cutoff > 0) {
      conditions.push(`created_at >= ?`);
      params.push(cutoff);
    }
  }

  if (options.search && options.search.trim()) {
    const q = `%${options.search.trim().toLowerCase()}%`;
    conditions.push(
      `(lower(title) LIKE ? OR lower(comment) LIKE ? OR lower(liked_most) LIKE ? OR lower(improvement_suggestion) LIKE ? OR lower(author_name) LIKE ?)`
    );
    params.push(q, q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const stmt = db.prepare(`SELECT * FROM feedbacks ${whereClause} ORDER BY created_at DESC`);
  const rows = stmt.all(...params) as any[];

  return rows.map((r) => mapFeedbackRow(r, options.viewerUserId, options.isAdminViewer));
}

export function getFeedbackById(
  id: string,
  viewerUserId: string,
  isAdminViewer: boolean
): FeedbackItem | null {
  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id) as any;
  if (!row) return null;

  const isOwner = Boolean(viewerUserId && row.user_id === viewerUserId);
  if (!isAdminViewer && !isOwner && (!row.is_public || row.is_hidden)) {
    return null;
  }
  return mapFeedbackRow(row, viewerUserId, isAdminViewer);
}

export function updateOwnFeedback(
  id: string,
  userId: string,
  updates: {
    rating?: number;
    likedApp?: boolean | null;
    improvementArea?: string;
    category?: FeedbackCategoryId;
    feedbackType?: FeedbackType;
    title?: string;
    comment?: string;
    likedMost?: string;
    improvementSuggestion?: string;
    isPublic?: boolean;
    isAnonymous?: boolean;
  }
): { success: boolean; item?: FeedbackItem; error?: string; statusCode?: number } {
  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id) as any;
  if (!row) return { success: false, error: 'Feedback não encontrado.', statusCode: 404 };
  if (row.user_id !== userId) {
    return { success: false, error: 'Apenas o autor pode editar este comentário.', statusCode: 403 };
  }

  const nextRating =
    updates.rating !== undefined
      ? Math.min(5, Math.max(1, Math.round(Number(updates.rating))))
      : row.rating;
  const nextLikedApp =
    updates.likedApp === true ? 1 : updates.likedApp === false ? 0 : updates.likedApp === null ? null : row.liked_app;
  const nextImpArea =
    updates.improvementArea !== undefined ? sanitizeText(updates.improvementArea) : row.improvement_area || '';
  const nextCategory =
    updates.category && FEEDBACK_CATEGORIES.some((c) => c.id === updates.category)
      ? updates.category
      : row.category;
  const nextType =
    updates.feedbackType && ['praise', 'improvement', 'bug', 'feature_request'].includes(updates.feedbackType)
      ? updates.feedbackType
      : row.feedback_type;
  const nextTitle = updates.title !== undefined ? sanitizeText(updates.title) || row.title : row.title;
  const nextComment = updates.comment !== undefined ? sanitizeText(updates.comment) : row.comment;

  if (!nextComment || nextComment.length < 3) {
    return { success: false, error: 'O comentário deve ter pelo menos 3 caracteres.', statusCode: 400 };
  }

  const nextLiked = updates.likedMost !== undefined ? sanitizeText(updates.likedMost) : row.liked_most;
  const nextImp =
    updates.improvementSuggestion !== undefined
      ? sanitizeText(updates.improvementSuggestion)
      : row.improvement_suggestion;
  const nextPublic = updates.isPublic !== undefined ? (updates.isPublic ? 1 : 0) : row.is_public;
  const nextAnon = updates.isAnonymous !== undefined ? (updates.isAnonymous ? 1 : 0) : row.is_anonymous;
  const now = Date.now();

  db.prepare(`
    UPDATE feedbacks
    SET rating = ?, liked_app = ?, improvement_area = ?, category = ?, feedback_type = ?, title = ?, comment = ?,
        liked_most = ?, improvement_suggestion = ?, is_public = ?, is_anonymous = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nextRating,
    nextLikedApp,
    nextImpArea,
    nextCategory,
    nextType,
    nextTitle,
    nextComment,
    nextLiked,
    nextImp,
    nextPublic,
    nextAnon,
    now,
    id
  );

  const updated = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id);
  return { success: true, item: mapFeedbackRow(updated, userId, false) };
}

export function deleteFeedback(
  id: string,
  requesterUserId: string,
  isAdmin: boolean
): { success: boolean; error?: string; statusCode?: number } {
  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(id) as any;
  if (!row) return { success: false, error: 'Feedback não encontrado.', statusCode: 404 };
  if (!isAdmin && row.user_id !== requesterUserId) {
    return { success: false, error: 'Sem permissão para eliminar este comentário.', statusCode: 403 };
  }

  db.prepare(`DELETE FROM user_notifications WHERE feedback_id = ?`).run(id);
  db.prepare(`DELETE FROM feedbacks WHERE id = ?`).run(id);
  return { success: true };
}

function recordAuditHistory(params: {
  feedbackId: string;
  replyId?: string;
  action: FeedbackAuditEntry['action'];
  actorName: string;
  actorRole: string;
  previousValue?: string;
  newValue?: string;
}) {
  db.prepare(`
    INSERT INTO feedback_reply_history (
      id, feedback_id, reply_id, action, actor_name, actor_role, previous_value, new_value, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    genId('hist'),
    params.feedbackId,
    params.replyId || null,
    params.action,
    params.actorName,
    params.actorRole,
    params.previousValue || null,
    params.newValue || null,
    Date.now()
  );
}

function createNotification(params: {
  userId: string;
  feedbackId: string;
  type: 'official_reply' | 'status_update';
  title: string;
  message: string;
}) {
  if (!params.userId) return;
  db.prepare(`
    INSERT INTO user_notifications (id, user_id, feedback_id, type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    genId('notif'),
    params.userId,
    params.feedbackId,
    params.type,
    params.title,
    params.message,
    Date.now()
  );
}

// Add reply: strictly separate official team replies (admin-only) from user replies
export function addFeedbackReply(params: {
  feedbackId: string;
  userId: string;
  authorName: string;
  isOfficialVerifiedAdmin: boolean;
  content: string;
  updateStatus?: FeedbackStatus;
}): { success: boolean; reply?: FeedbackReply; error?: string; statusCode?: number } {
  const fb = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(params.feedbackId) as any;
  if (!fb) return { success: false, error: 'Comentário não encontrado.', statusCode: 404 };

  const cleanContent = sanitizeText(params.content);
  if (!cleanContent || cleanContent.length < 2) {
    return { success: false, error: 'A resposta não pode estar vazia.', statusCode: 400 };
  }

  // Only the feedback owner or verified admin can participate in private feedback threads;
  // On public threads, only the author or verified admin can reply to the official thread cleanly
  if (!params.isOfficialVerifiedAdmin && fb.user_id !== params.userId && !fb.is_public) {
    return { success: false, error: 'Não tens permissão para responder a este feedback privado.', statusCode: 403 };
  }

  // Prevent normal users from impersonating official team via authorName
  let safeAuthorName = sanitizeText(params.authorName) || 'Utilizador';
  if (!params.isOfficialVerifiedAdmin) {
    if (/equipa\s+zuno|oficial\s+zuno|zuno\s+ai\s+team|staff/i.test(safeAuthorName)) {
      safeAuthorName = 'Utilizador ZUNO';
    }
  } else {
    safeAuthorName = 'Equipa ZUNO AI';
  }

  const now = Date.now();
  const replyId = genId('rep');
  const isOfficial = params.isOfficialVerifiedAdmin ? 1 : 0;
  const authorRole = isOfficial ? 'official_team' : 'user';

  db.prepare(`
    INSERT INTO feedback_replies (
      id, feedback_id, user_id, author_name, author_role, is_official, content, is_edited, is_deleted, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(
    replyId,
    params.feedbackId,
    params.userId,
    safeAuthorName,
    authorRole,
    isOfficial,
    cleanContent,
    now,
    now
  );

  if (isOfficial) {
    const nextStatus =
      params.updateStatus && FEEDBACK_STATUSES.includes(params.updateStatus)
        ? params.updateStatus
        : fb.status === 'Recebido' || fb.status === 'Em análise'
        ? 'Respondido'
        : fb.status;

    if (nextStatus !== fb.status) {
      db.prepare(`UPDATE feedbacks SET status = ?, updated_at = ? WHERE id = ?`).run(
        nextStatus,
        now,
        params.feedbackId
      );
    }

    recordAuditHistory({
      feedbackId: params.feedbackId,
      replyId,
      action: 'reply_created',
      actorName: 'Equipa ZUNO AI',
      actorRole: 'official_team',
      newValue: cleanContent,
    });

    createNotification({
      userId: fb.user_id,
      feedbackId: params.feedbackId,
      type: 'official_reply',
      title: 'Resposta oficial da equipa ZUNO AI',
      message: `A equipa ZUNO AI respondeu ao teu comentário "${fb.title.slice(0, 50)}".`,
    });
  } else {
    recordAuditHistory({
      feedbackId: params.feedbackId,
      replyId,
      action: 'reply_created',
      actorName: safeAuthorName,
      actorRole: 'user',
      newValue: cleanContent,
    });
  }

  const createdRow = db.prepare(`SELECT * FROM feedback_replies WHERE id = ?`).get(replyId);
  return { success: true, reply: mapReplyRow(createdRow) };
}

export function editReplyByAdmin(params: {
  replyId: string;
  adminName: string;
  newContent: string;
}): { success: boolean; reply?: FeedbackReply; error?: string } {
  const row = db.prepare(`SELECT * FROM feedback_replies WHERE id = ?`).get(params.replyId) as any;
  if (!row || row.is_deleted) return { success: false, error: 'Resposta não encontrada.' };

  const clean = sanitizeText(params.newContent);
  if (!clean || clean.length < 2) return { success: false, error: 'O conteúdo da resposta é inválido.' };

  const now = Date.now();
  db.prepare(`
    UPDATE feedback_replies SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?
  `).run(clean, now, params.replyId);

  recordAuditHistory({
    feedbackId: row.feedback_id,
    replyId: params.replyId,
    action: 'reply_edited',
    actorName: params.adminName || 'Fundador ZUNO AI',
    actorRole: 'official_team',
    previousValue: row.content,
    newValue: clean,
  });

  const updated = db.prepare(`SELECT * FROM feedback_replies WHERE id = ?`).get(params.replyId);
  return { success: true, reply: mapReplyRow(updated) };
}

export function deleteReplyByAdmin(params: {
  replyId: string;
  adminName: string;
}): { success: boolean; error?: string } {
  const row = db.prepare(`SELECT * FROM feedback_replies WHERE id = ?`).get(params.replyId) as any;
  if (!row || row.is_deleted) return { success: false, error: 'Resposta não encontrada.' };

  const now = Date.now();
  db.prepare(`UPDATE feedback_replies SET is_deleted = 1, updated_at = ? WHERE id = ?`).run(
    now,
    params.replyId
  );

  recordAuditHistory({
    feedbackId: row.feedback_id,
    replyId: params.replyId,
    action: 'reply_deleted',
    actorName: params.adminName || 'Fundador ZUNO AI',
    actorRole: 'official_team',
    previousValue: row.content,
    newValue: '[Resposta eliminada pelo administrador]',
  });

  return { success: true };
}

export function updateFeedbackStatusByAdmin(params: {
  feedbackId: string;
  status: FeedbackStatus;
  adminName: string;
}): { success: boolean; item?: FeedbackItem; error?: string } {
  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(params.feedbackId) as any;
  if (!row) return { success: false, error: 'Feedback não encontrado.' };

  if (!FEEDBACK_STATUSES.includes(params.status)) {
    return { success: false, error: 'Estado inválido.' };
  }

  const prevStatus = row.status;
  const now = Date.now();
  db.prepare(`UPDATE feedbacks SET status = ?, updated_at = ? WHERE id = ?`).run(
    params.status,
    now,
    params.feedbackId
  );

  if (prevStatus !== params.status) {
    recordAuditHistory({
      feedbackId: params.feedbackId,
      action: 'status_changed',
      actorName: params.adminName || 'Fundador ZUNO AI',
      actorRole: 'official_team',
      previousValue: prevStatus,
      newValue: params.status,
    });

    createNotification({
      userId: row.user_id,
      feedbackId: params.feedbackId,
      type: 'status_update',
      title: `Estado atualizado: ${params.status}`,
      message: `O teu feedback "${row.title.slice(0, 50)}" passou para o estado "${params.status}".`,
    });
  }

  const updated = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(params.feedbackId);
  return { success: true, item: mapFeedbackRow(updated, '', true) };
}

export function moderateFeedbackByAdmin(params: {
  feedbackId: string;
  isHidden: boolean;
  adminName: string;
}): { success: boolean; error?: string } {
  const row = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(params.feedbackId) as any;
  if (!row) return { success: false, error: 'Feedback não encontrado.' };

  const now = Date.now();
  db.prepare(`UPDATE feedbacks SET is_hidden = ?, updated_at = ? WHERE id = ?`).run(
    params.isHidden ? 1 : 0,
    now,
    params.feedbackId
  );

  if (!params.isHidden) {
    db.prepare(`UPDATE feedback_reports SET status = 'dismissed' WHERE feedback_id = ?`).run(
      params.feedbackId
    );
  } else {
    db.prepare(`UPDATE feedback_reports SET status = 'reviewed' WHERE feedback_id = ?`).run(
      params.feedbackId
    );
  }

  recordAuditHistory({
    feedbackId: params.feedbackId,
    action: 'moderated',
    actorName: params.adminName || 'Fundador ZUNO AI',
    actorRole: 'official_team',
    previousValue: row.is_hidden ? 'Oculto' : 'Visível',
    newValue: params.isHidden ? 'Oculto por moderação' : 'Restaurado / Visível',
  });

  return { success: true };
}

export function reportFeedback(params: {
  feedbackId: string;
  reporterUserId: string;
  reason: string;
  details?: string;
}): { success: boolean; error?: string } {
  const fb = db.prepare(`SELECT * FROM feedbacks WHERE id = ?`).get(params.feedbackId) as any;
  if (!fb) return { success: false, error: 'Comentário não encontrado.' };

  const existing = db
    .prepare(`SELECT id FROM feedback_reports WHERE feedback_id = ? AND reporter_user_id = ?`)
    .get(params.feedbackId, params.reporterUserId);
  if (existing) {
    return { success: false, error: 'Já denunciaste este comentário anteriormente.' };
  }

  const cleanReason = sanitizeText(params.reason) || 'Conteúdo inadequado';
  const cleanDetails = sanitizeText(params.details || '');

  db.prepare(`
    INSERT INTO feedback_reports (id, feedback_id, reporter_user_id, reason, details, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(genId('rep_ab'), params.feedbackId, params.reporterUserId, cleanReason, cleanDetails, Date.now());

  db.prepare(`UPDATE feedbacks SET report_count = report_count + 1 WHERE id = ?`).run(params.feedbackId);
  return { success: true };
}

export function listReportsForAdmin(): FeedbackReport[] {
  const rows = db.prepare(`SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 100`).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    feedbackId: r.feedback_id,
    reporterUserId: r.reporter_user_id,
    reason: r.reason,
    details: r.details || undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function listAuditHistory(feedbackId?: string): FeedbackAuditEntry[] {
  const rows = feedbackId
    ? (db
        .prepare(`SELECT * FROM feedback_reply_history WHERE feedback_id = ? ORDER BY created_at DESC LIMIT 100`)
        .all(feedbackId) as any[])
    : (db
        .prepare(`SELECT * FROM feedback_reply_history ORDER BY created_at DESC LIMIT 150`)
        .all() as any[]);

  return rows.map((r) => ({
    id: r.id,
    feedbackId: r.feedback_id,
    replyId: r.reply_id || undefined,
    action: r.action,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    previousValue: r.previous_value || undefined,
    newValue: r.new_value || undefined,
    createdAt: r.created_at,
  }));
}

export function getUserNotifications(userId: string): {
  notifications: UserNotification[];
  unreadCount: number;
} {
  if (!userId) return { notifications: [], unreadCount: 0 };
  const rows = db
    .prepare(`SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`)
    .all(userId) as any[];

  const notifications: UserNotification[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    feedbackId: r.feedback_id,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  }));

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  return { notifications, unreadCount };
}

export function markNotificationRead(notificationId: string, userId: string): boolean {
  const res = db
    .prepare(`UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
  return res.changes > 0;
}

export function markAllNotificationsRead(userId: string): void {
  db.prepare(`UPDATE user_notifications SET is_read = 1 WHERE user_id = ?`).run(userId);
}

// Compute 100% REAL statistics from stored SQLite records (zero fake/hardcoded numbers!)
export function getFeedbackStats(onlyPublic = false): FeedbackStats {
  const where = onlyPublic ? `WHERE is_public = 1 AND is_hidden = 0` : '';
  const rows = db.prepare(`SELECT * FROM feedbacks ${where}`).all() as any[];

  const totalFeedbacks = rows.length;
  let sumRating = 0;
  let likedCount = 0;
  let dislikedCount = 0;
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let praiseCount = 0;
  let criticismCount = 0;
  let improvementCount = 0;
  let featureRequestCount = 0;

  const statusCounts: Record<FeedbackStatus, number> = {
    Recebido: 0,
    'Em análise': 0,
    Respondido: 0,
    Implementado: 0,
    'Não planeado': 0,
  };

  const categoryCounts = new Map<FeedbackCategoryId, number>();
  const improvementAreaCounts = new Map<string, number>();
  const suggestionClusters = new Map<
    string,
    { topic: string; category: FeedbackCategoryId; count: number; sampleTitles: string[] }
  >();

  for (const r of rows) {
    const rating = Number(r.rating) || 0;
    if (rating >= 1 && rating <= 5) {
      sumRating += rating;
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    }

    if (r.liked_app === 1) {
      likedCount++;
    } else if (r.liked_app === 0) {
      dislikedCount++;
    } else if (rating >= 4) {
      likedCount++;
    } else if (rating <= 2) {
      dislikedCount++;
    }

    if (r.improvement_area && String(r.improvement_area).trim()) {
      const area = String(r.improvement_area).trim();
      improvementAreaCounts.set(area, (improvementAreaCounts.get(area) || 0) + 1);
    }

    if (r.feedback_type === 'praise') {
      praiseCount++;
    }
    if (r.feedback_type === 'bug' || rating <= 2 || r.liked_app === 0) {
      criticismCount++;
    }
    if (r.feedback_type === 'improvement') {
      improvementCount++;
    }
    if (r.feedback_type === 'feature_request') {
      featureRequestCount++;
    }

    const st = r.status as FeedbackStatus;
    if (statusCounts[st] !== undefined) {
      statusCounts[st]++;
    }

    const cat = r.category as FeedbackCategoryId;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);

    if (r.feedback_type === 'improvement' || r.feedback_type === 'feature_request' || r.feedback_type === 'bug') {
      const catMeta = FEEDBACK_CATEGORIES.find((c) => c.id === cat);
      const key = `${cat}__${r.feedback_type}`;
      const typeLabel =
        r.feedback_type === 'feature_request'
          ? 'Nova funcionalidade'
          : r.feedback_type === 'improvement'
          ? 'Melhoria'
          : 'Erro reportado';
      const existing = suggestionClusters.get(key) || {
        topic: `${catMeta?.label || cat} (${typeLabel})`,
        category: cat,
        count: 0,
        sampleTitles: [],
      };
      existing.count++;
      if (existing.sampleTitles.length < 3 && r.title) {
        existing.sampleTitles.push(r.title);
      }
      suggestionClusters.set(key, existing);
    }
  }

  const averageRating = totalFeedbacks > 0 ? Number((sumRating / totalFeedbacks).toFixed(2)) : 0;
  const totalReactions = likedCount + dislikedCount;
  const approvalRate = totalReactions > 0 ? Math.round((likedCount / totalReactions) * 100) : 0;

  const topCategories = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const topImprovementAreas = Array.from(improvementAreaCounts.entries())
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);

  const frequentSuggestions = Array.from(suggestionClusters.values()).sort((a, b) => b.count - a.count);

  return {
    totalFeedbacks,
    ratedFeedbacks: totalFeedbacks,
    averageRating,
    likedCount,
    dislikedCount,
    approvalRate,
    ratingDistribution,
    praiseCount,
    criticismCount,
    improvementCount,
    featureRequestCount,
    statusCounts,
    topCategories,
    topImprovementAreas,
    frequentSuggestions,
  };
}
