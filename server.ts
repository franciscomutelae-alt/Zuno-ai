import dns from 'node:dns';
import express, { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Avoid slow IPv6 DNS/TCP stalls in containerized environments
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}
import {
  checkSpamAndAbuse,
  createFeedback,
  listFeedbacks,
  getFeedbackById,
  updateOwnFeedback,
  deleteFeedback,
  addFeedbackReply,
  editReplyByAdmin,
  deleteReplyByAdmin,
  updateFeedbackStatusByAdmin,
  moderateFeedbackByAdmin,
  reportFeedback,
  listReportsForAdmin,
  listAuditHistory,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getFeedbackStats,
} from './src/db/feedbackDb';
import {
  ADMIN_FOUNDER_EMAIL,
  isFounderAdminEmail,
  checkGuestRateLimit,
  clearGuestRateLimits,
  countAllStoredConversations,
  countAllStoredImages,
  createOrProvisionAccount,
  createVipCode,
  defaultFeaturesForPlan as dbDefaultFeaturesForPlan,
  deleteAccountDataByUid,
  deleteUserConversation,
  deleteUserFavorite,
  deleteUserImage,
  deleteVipCode,
  getAccountByEmail,
  getAccountByUid,
  getGuestRateLimitCount,
  getPlatformSetting,
  incrementAccountUsage,
  isDeviceSessionRevoked,
  listAllActiveSessionsForAdmin,
  checkSearchCodeMatch,
  deleteSearchCode,
  executeSearchCode,
  listManagedAccounts,
  listSearchCodes,
  listUserConversations,
  listUserDeviceSessions,
  listUserFavorites,
  listUserImages,
  listVipCodes,
  pingAuthDb,
  redeemVipCode,
  resetAccountDailyQuota,
  revokeDeviceSession,
  revokeOtherDeviceSessions,
  revokeToken,
  saveUserImage,
  setAccountBlocked,
  setAccountFeatures,
  setAccountPlan,
  setAccountRole,
  setPlatformSetting,
  setSearchCodeActive,
  setVipCodeActive,
  updateAccountProfile,
  upsertDeviceSession,
  upsertSearchCode,
  upsertUserConversation,
  upsertUserFavorite,
  upsertVerifiedAccount,
  verifyFirebaseIdToken,
} from './src/db/authDb';
import type {
  PlanType,
  PlatformAnnouncement,
  PlatformFeatureFlags,
  UserProfile,
} from './src/types';

dotenv.config();

const GUEST_RESTRICTION_MESSAGE =
  'Esta funcionalidade exige uma conta ZUNO AI. Cria uma conta ou inicia sessão para continuares.';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = Number(process.env.PORT) || 3000;

// Body parser with generous limits for image/attachment uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Official ZUNO AI public origin & canonical domain configuration
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://zunoai.com').replace(/\/+$/, '');
const CANONICAL_HOST = (process.env.CANONICAL_HOST || 'zunoai.com').toLowerCase();

// Canonical www -> apex redirect in production when hosted on custom domain
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const reqHost = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (reqHost === `www.${CANONICAL_HOST}`) {
      return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
    }
  }
  next();
});

// Robust CORS & security headers compatible with production domain & iframe preview
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedStaticOrigins = new Set([
    'https://zunoai.com',
    'https://www.zunoai.com',
    PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  if (origin) {
    const isDevOrPreview = process.env.NODE_ENV !== 'production';
    const isAllowed =
      allowedStaticOrigins.has(origin) ||
      (isDevOrPreview &&
        (origin.endsWith('.run.app') ||
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:')));
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'https://zunoai.com');
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-User-Id, X-User-Email, X-Device-Id');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Powered-By', 'ZUNO AI Platform');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ----------------------------------------------------
// OFFICIAL IDENTITY & FOUNDER
// ----------------------------------------------------
export const FOUNDER_NAME = 'Francisco Mutela Emanuel';
export const CREATOR_RECOGNITION_CODE = 'Adonai20010';
export const CREATOR_WELCOME_MESSAGE =
  'Seja bem-vindo, Francisco Mutela Emanuel! Identidade de criador da plataforma ZUNO AI reconhecida com sucesso.';
export const FOUNDER_RESPONSES = {
  pt: 'A ZUNO AI foi idealizada e criada por Francisco Mutela Emanuel.',
  en: 'ZUNO AI was conceived and created by Francisco Mutela Emanuel.',
  es: 'ZUNO AI fue concebida y creada por Francisco Mutela Emanuel.',
  fr: 'ZUNO AI a été conçue et créée par Francisco Mutela Emanuel.',
};

// Persistent server telemetry, feature flags, announcement & model configuration
const startTime = Date.now();
let totalApiRequests = 42;
let totalTokensEstimated = 18450;
let totalImagesGenerated = countAllStoredImages();
let activeModel = getPlatformSetting<string>('activeModel', 'gemini-3.1-flash-lite');
let activeImageModel = getPlatformSetting<string>('activeImageModel', 'gemini-3.1-flash-lite-image');

const DEFAULT_PLATFORM_FEATURES: PlatformFeatureFlags = {
  searchGrounding: true,
  imageAnalysis: true,
  voiceDictation: true,
  imageGeneration: true,
  publicSignupEnabled: true,
  guestAccessEnabled: true,
  maintenanceMode: false,
};

let platformFeatures: PlatformFeatureFlags = {
  ...DEFAULT_PLATFORM_FEATURES,
  ...getPlatformSetting<Partial<PlatformFeatureFlags>>('platformFeatures', {}),
};

const DEFAULT_ANNOUNCEMENT: PlatformAnnouncement = {
  enabled: false,
  text: '',
  type: 'info',
  updatedAt: 0,
};

let platformAnnouncement: PlatformAnnouncement = {
  ...DEFAULT_ANNOUNCEMENT,
  ...getPlatformSetting<Partial<PlatformAnnouncement>>('platformAnnouncement', {}),
};

// Image generation limits per plan (persisted in SQLite platform_settings)
const savedImgLimits = getPlatformSetting<Record<string, number>>('imageLimitsPerPlan', {
  free: 3,
  premium: 20,
  pro: 50,
  ultra: 500,
});
const imageLimitsPerPlan: Record<string, number> = {
  free: Number(savedImgLimits.free ?? 3),
  premium: Number(savedImgLimits.premium ?? 20),
  pro: Number(savedImgLimits.pro ?? 50),
  ultra: Number(savedImgLimits.ultra ?? 500),
};

// Global in-memory gallery of generated images
interface ServerGeneratedImage {
  id: string;
  url: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  quality: string;
  createdAt: number;
  model: string;
  userId?: string;
}

const serverImageGallery: ServerGeneratedImage[] = [];

// Track daily user image usage: userId -> count
const userDailyImageCount: Record<string, { count: number; date: string }> = {};

function getUserImageCount(userId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const record = userDailyImageCount[userId];
  if (!record || record.date !== today) {
    userDailyImageCount[userId] = { count: 0, date: today };
    return 0;
  }
  return record.count;
}

function incrementUserImageCount(userId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const record = userDailyImageCount[userId];
  if (!record || record.date !== today) {
    userDailyImageCount[userId] = { count: 1, date: today };
  } else {
    record.count++;
  }
}

const systemLogs: Array<{
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  endpoint?: string;
}> = [
  {
    id: 'log-1',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Servidor ZUNO AI iniciado com sucesso.',
    endpoint: '/server',
  },
  {
    id: 'log-2',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Motor Gemini inicializado com @google/genai.',
    endpoint: '/api/chat',
  },
  {
    id: 'log-3',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Módulo ZUNO AI IMAGE ativo com suporte a gemini-3.1-flash-lite-image.',
    endpoint: '/api/image/generate',
  },
];

const errorTimestamps: number[] = [];
const clientErrorReportLimiter = new Map<string, { count: number; windowStart: number }>();

function checkErrorReportRateLimit(ip: string): boolean {
  const key = ip || 'unknown';
  const now = Date.now();
  const entry = clientErrorReportLimiter.get(key);
  if (!entry || now - entry.windowStart > 60_000) {
    clientErrorReportLimiter.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

function logEvent(level: 'info' | 'warn' | 'error', message: string, endpoint?: string) {
  const now = Date.now();
  if (level === 'error') {
    errorTimestamps.push(now);
    const cutoff = now - 60 * 60 * 1000;
    while (errorTimestamps.length > 0 && errorTimestamps[0] < cutoff) {
      errorTimestamps.shift();
    }
  }
  const log = {
    id: 'log-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date(now).toISOString(),
    level,
    message,
    endpoint,
  };
  systemLogs.unshift(log);
  if (systemLogs.length > 50) systemLogs.pop();
}

// ----------------------------------------------------
// MANAGED USERS, ACTIVITY TRACKING & ACCESS CONTROL
// ----------------------------------------------------
export interface UserFeatures {
  imageGeneration: boolean;
  webSearch: boolean;
  visionMultimodal: boolean;
  ultraModel: boolean;
  voiceAudio: boolean;
  customMemory: boolean;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'premium' | 'pro' | 'ultra';
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  createdAt: string;
  lastActive: string;
  messageCount: number;
  imageCount: number;
  features: UserFeatures;
  notes?: string;
}

function defaultFeaturesForPlan(plan: 'free' | 'premium' | 'pro' | 'ultra'): UserFeatures {
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

const managedUsersStore: ManagedUser[] = [
  {
    id: 'usr-1',
    name: 'Francisco Mutela Emanuel',
    email: 'franciscomutelae@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    plan: 'ultra',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-10T10:00:00Z',
    lastActive: new Date().toISOString(),
    messageCount: 342,
    imageCount: 48,
    features: defaultFeaturesForPlan('ultra'),
    notes: 'Fundador / Administrador da ZUNO AI.',
  },
  {
    id: 'usr-2',
    name: 'Sophie Laurent',
    email: 'sophie.laurent@techparis.fr',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    plan: 'pro',
    role: 'user',
    status: 'active',
    createdAt: '2026-02-14T14:22:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    messageCount: 189,
    imageCount: 26,
    features: defaultFeaturesForPlan('pro'),
    notes: 'Investigadora em IA, utiliza visão e geração artística.',
  },
  {
    id: 'usr-3',
    name: 'Carlos Mendez',
    email: 'carlos.m@madridai.es',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
    plan: 'premium',
    role: 'user',
    status: 'active',
    createdAt: '2026-03-01T09:15:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    messageCount: 94,
    imageCount: 14,
    features: defaultFeaturesForPlan('premium'),
    notes: 'Designer gráfico freelancer.',
  },
  {
    id: 'usr-4',
    name: 'David Smith',
    email: 'david.smith@oxford.ac.uk',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    plan: 'free',
    role: 'user',
    status: 'active',
    createdAt: '2026-03-12T11:00:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    messageCount: 38,
    imageCount: 3,
    features: defaultFeaturesForPlan('free'),
    notes: 'Estudante universitário.',
  },
  {
    id: 'usr-5',
    name: 'Mariana Silva',
    email: 'mariana.silva@lisboatech.pt',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
    plan: 'pro',
    role: 'user',
    status: 'active',
    createdAt: '2026-03-15T16:40:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    messageCount: 142,
    imageCount: 19,
    features: defaultFeaturesForPlan('pro'),
    notes: 'Engenheira de software frontend.',
  },
  {
    id: 'usr-6',
    name: 'Lucas Almeida',
    email: 'lucas.almeida@sptech.br',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=256&q=80',
    plan: 'free',
    role: 'user',
    status: 'blocked',
    createdAt: '2026-02-28T08:30:00Z',
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    messageCount: 15,
    imageCount: 2,
    features: defaultFeaturesForPlan('free'),
    notes: 'Conta suspensa por comportamento abusivo nos prompts.',
  },
];

function findManagedUser(identifier?: string): ManagedUser | undefined {
  if (!identifier) return undefined;
  const lower = identifier.toLowerCase();
  return managedUsersStore.find(
    (u) => u.id.toLowerCase() === lower || u.email.toLowerCase() === lower
  );
}

function isUserBlocked(identifier?: string): boolean {
  const user = findManagedUser(identifier);
  return user ? user.status === 'blocked' : false;
}


let cachedGenAIKey: string | null = null;
let cachedGenAIClient: GoogleGenAI | null = null;

// Helper to get cached GoogleGenAI client with telemetry user-agent
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }
  if (cachedGenAIClient && cachedGenAIKey === apiKey) {
    return cachedGenAIClient;
  }
  cachedGenAIKey = apiKey;
  cachedGenAIClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'ZUNO-AI/2.5 (https://zunoai.com)',
      },
      // Disable the SDK's 5-attempt exponential backoff (1s+2s+4s+8s+16s) so our model failover reacts in ~150ms
      retryOptions: {
        attempts: 1,
      },
    },
  });
  return cachedGenAIClient;
}

interface ParsedApiError {
  status: number;
  code: string;
  message: string;
  isQuotaOrRateLimit: boolean;
  isUnavailable: boolean;
  isTimeout?: boolean;
}

function extractCleanApiError(error: any, fallbackMessage = 'Ocorreu um erro temporário ao contactar o motor de IA.'): ParsedApiError {
  const raw = typeof error === 'string' ? error : (error?.message || String(error || ''));
  let innerMsg = raw;
  let statusNum = Number(error?.status || error?.code || 0) || 500;
  let statusCode = String(error?.statusText || '');

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error) {
      if (parsed.error.code) statusNum = Number(parsed.error.code) || statusNum;
      if (parsed.error.status) statusCode = String(parsed.error.status);
      if (typeof parsed.error.message === 'string') {
        innerMsg = parsed.error.message;
        try {
          const nested = JSON.parse(innerMsg);
          if (nested?.error?.message) innerMsg = nested.error.message;
          if (nested?.error?.code) statusNum = Number(nested.error.code) || statusNum;
          if (nested?.error?.status) statusCode = String(nested.error.status);
        } catch {}
      }
    }
  } catch {}

  const combined = `${raw} ${innerMsg} ${statusCode}`.toLowerCase();
  const isTimeout = combined.includes('timeout') || combined.includes('etimedout') || combined.includes('aborted');
  const isQuotaOrRateLimit = statusNum === 429 || combined.includes('429') || combined.includes('resource_exhausted') || combined.includes('quota');
  const isUnavailable = statusNum === 503 || combined.includes('503') || combined.includes('high demand') || combined.includes('unavailable');
  const isAuthErr = statusNum === 403 || statusNum === 401 || combined.includes('permission_denied') || combined.includes('api_key_invalid');
  const isNotFound = statusNum === 404 || combined.includes('not_found');

  if (isTimeout) {
    return {
      status: 504,
      code: 'GATEWAY_TIMEOUT',
      message: 'A ligação ao motor de IA demorou mais do que o esperado. Por favor tenta novamente.',
      isQuotaOrRateLimit: false,
      isUnavailable: true,
      isTimeout: true,
    };
  }
  if (isQuotaOrRateLimit) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message: 'Limite temporário de requisições da API Gemini atingido. Por favor aguarda alguns segundos e tenta novamente.',
      isQuotaOrRateLimit: true,
      isUnavailable: false,
    };
  }
  if (isUnavailable) {
    return {
      status: 503,
      code: 'UNAVAILABLE',
      message: 'Os servidores de IA estão com alta procura momentânea. Por favor tenta novamente em instantes.',
      isQuotaOrRateLimit: false,
      isUnavailable: true,
    };
  }
  if (isAuthErr) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Chave de API sem permissão para este recurso. Verifica as definições em Settings > Secrets.',
      isQuotaOrRateLimit: false,
      isUnavailable: false,
    };
  }
  if (isNotFound) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: 'Modelo solicitado indisponível ou atualizado. A utilizar o modelo ativo compatível.',
      isQuotaOrRateLimit: false,
      isUnavailable: false,
    };
  }

  return {
    status: statusNum >= 400 && statusNum < 600 ? statusNum : 500,
    code: statusCode || 'INTERNAL_ERROR',
    message: innerMsg && !innerMsg.startsWith('{') ? innerMsg : fallbackMessage,
    isQuotaOrRateLimit: false,
    isUnavailable: false,
  };
}

function normalizeTextModelId(model?: string): string {
  if (!model || model === 'gemini-3.8-flash' || model === 'gemini-flash-latest') {
    return 'gemini-3.1-flash-lite';
  }
  return model;
}

const modelCooldownUntil = new Map<string, number>();

function markModelUnhealthy(model: string, durationMs = 15000) {
  modelCooldownUntil.set(model, Date.now() + durationMs);
}

function getFastModelChain(preferredModel: string): string[] {
  const normalized = normalizeTextModelId(preferredModel);
  const base =
    normalized === 'gemini-4-hydrogen'
      ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
      : [normalized, 'gemini-3.1-flash-lite', 'gemini-4-hydrogen'].filter(
          (v, i, a) => Boolean(v) && a.indexOf(v) === i
        );

  const now = Date.now();
  const healthy = base.filter((m) => (modelCooldownUntil.get(m) || 0) <= now);
  const cooled = base.filter((m) => (modelCooldownUntil.get(m) || 0) > now);
  return [...healthy, ...cooled];
}

// Resilient generateContent helper that fails over cleanly across fast Gemini models
async function safeGenerateContent(ai: GoogleGenAI, preferredModel: string, params: any) {
  const uniqueModels = getFastModelChain(preferredModel);
  let lastError: any = null;

  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i];
    const isLastModel = i === uniqueModels.length - 1;
    const attemptController = new AbortController();
    const timer = setTimeout(() => attemptController.abort(new Error('MODEL_TIMEOUT_6500MS')), 6500);

    try {
      const modelConfig = { ...(params.config || {}), abortSignal: attemptController.signal };
      if (model === 'gemini-4-hydrogen') {
        modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      } else if (model === 'gemini-3.1-flash-lite') {
        modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      } else {
        delete modelConfig.thinkingConfig;
      }

      const result = await Promise.race([
        ai.models.generateContent({
          ...params,
          config: modelConfig,
          model,
        }),
        new Promise<never>((_, reject) =>
          attemptController.signal.addEventListener('abort', () =>
            reject(attemptController.signal.reason || new Error('MODEL_TIMEOUT_6500MS'))
          )
        ),
      ]);
      clearTimeout(timer);
      modelCooldownUntil.delete(model);
      return result;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      const parsed = extractCleanApiError(err);
      if (parsed.isUnavailable || parsed.isQuotaOrRateLimit || parsed.isTimeout) {
        markModelUnhealthy(model, parsed.isQuotaOrRateLimit ? 20000 : 12000);
      }

      if (!isLastModel) {
        console.info(`[ZUNO AI] Content failover from ${model} -> ${uniqueModels[i + 1]} (${parsed.code})`);
        continue;
      }
    }
  }

  throw lastError;
}

export interface PrimedStreamResult {
  firstChunk: any | null;
  iterator: AsyncIterator<any>;
  modelUsed: string;
}

// Resilient generateContentStream helper that primes the first chunk with abortable strict TTFT timeout
async function safeGenerateContentStream(
  ai: GoogleGenAI,
  preferredModel: string,
  params: any,
  clientAbortSignal?: AbortSignal
): Promise<PrimedStreamResult> {
  const uniqueModels = getFastModelChain(preferredModel);
  let lastError: any = null;

  for (let i = 0; i < uniqueModels.length; i++) {
    if (clientAbortSignal?.aborted) {
      throw new Error('CLIENT_ABORTED');
    }

    const model = uniqueModels[i];
    const isLastModel = i === uniqueModels.length - 1;
    const attemptController = new AbortController();
    const onClientAbort = () => attemptController.abort(new Error('CLIENT_ABORTED'));
    clientAbortSignal?.addEventListener('abort', onClientAbort, { once: true });

    let ttftResolved = false;
    const ttftTimer = setTimeout(() => {
      if (!ttftResolved) {
        attemptController.abort(new Error('STREAM_TTFT_TIMEOUT_3200MS'));
      }
    }, 3200);

    try {
      const modelConfig = { ...(params.config || {}), abortSignal: attemptController.signal };
      if (model === 'gemini-4-hydrogen') {
        modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      } else if (model === 'gemini-3.1-flash-lite') {
        modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      } else {
        delete modelConfig.thinkingConfig;
      }

      const primed = await Promise.race([
        (async () => {
          const stream = await ai.models.generateContentStream({
            ...params,
            config: modelConfig,
            model,
          });
          const iterator = stream[Symbol.asyncIterator]();
          const firstStep = await iterator.next();
          ttftResolved = true;
          clearTimeout(ttftTimer);
          return {
            firstChunk: firstStep.done ? null : firstStep.value,
            iterator,
            modelUsed: model,
          };
        })(),
        new Promise<never>((_, reject) =>
          attemptController.signal.addEventListener(
            'abort',
            () => reject(attemptController.signal.reason || new Error('STREAM_TTFT_TIMEOUT_3200MS')),
            { once: true }
          )
        ),
      ]);

      clientAbortSignal?.removeEventListener('abort', onClientAbort);
      modelCooldownUntil.delete(model);
      return primed;
    } catch (err: any) {
      clearTimeout(ttftTimer);
      clientAbortSignal?.removeEventListener('abort', onClientAbort);
      lastError = err;

      if (clientAbortSignal?.aborted) {
        throw err;
      }

      const parsed = extractCleanApiError(err);
      if (parsed.isUnavailable || parsed.isQuotaOrRateLimit || parsed.isTimeout) {
        markModelUnhealthy(model, parsed.isQuotaOrRateLimit ? 20000 : 12000);
      }

      if (!isLastModel) {
        console.info(`[ZUNO AI] Stream failover from ${model} -> ${uniqueModels[i + 1]} (${parsed.code})`);
        continue;
      }
    }
  }

  throw lastError;
}

async function fetchWebKnowledgeFallback(
  rawQuery: string
): Promise<{ articles: Array<{ title: string; snippet: string; url: string; lang: string }> }> {
  const cleanQ = extractCleanTopicQuery(rawQuery) || rawQuery.trim();
  const stopWords = new Set(['sobre', 'como', 'para', 'com', 'que', 'dos', 'das', 'uma', 'uns', 'umas', 'the', 'and', 'for', 'with', 'about']);
  const queryTerms = cleanQ
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const searchLang = async (lang: string): Promise<Array<{ title: string; snippet: string; url: string; lang: string }>> => {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQ)}&gsrlimit=4&prop=extracts|info&exintro=1&explaintext=1&exsentences=6&inprop=url&format=json&origin=*`;
      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': 'ZunoAI/2.5 (https://zunoai.com; suporte@zunoai.com)' },
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) return [];
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {}) as any[];
      pages.sort((a, b) => (a.index || 99) - (b.index || 99));
      const list: Array<{ title: string; snippet: string; url: string; lang: string }> = [];
      for (const p of pages) {
        if (!p.title || !p.extract) continue;
        const normalizedHaystack = `${p.title} ${p.extract}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        if (queryTerms.length > 0 && !queryTerms.some((term) => normalizedHaystack.includes(term))) {
          continue;
        }
        const url = p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/\s+/g, '_'))}`;
        list.push({
          title: p.title,
          snippet: String(p.extract).trim(),
          url,
          lang: lang.toUpperCase(),
        });
      }
      return list;
    } catch {
      return [];
    }
  };

  const [ptArticles, enArticles] = await Promise.all([searchLang('pt'), searchLang('en')]);
  const combined = [...ptArticles];
  for (const item of enArticles) {
    if (combined.length >= 4) break;
    if (!combined.some((a) => a.url === item.url || a.title.toLowerCase() === item.title.toLowerCase())) {
      combined.push(item);
    }
  }

  return { articles: combined.slice(0, 4) };
}

function buildGreetingFallbackResponse(rawMsg: string): string | null {
  const t = rawMsg.trim().toLowerCase().replace(/[\.\!\?\,\s]+$/g, '');
  if (!t) return null;
  if (/^(ol[aá]|oi|e a[ií]|hey|hi|hello)$/.test(t)) {
    return 'Olá! Sou a **ZUNO AI**. Em que posso ajudar-te hoje?';
  }
  if (/^(bom dia|good morning)$/.test(t)) {
    return 'Bom dia! Como posso ajudar-te hoje?';
  }
  if (/^(boa tarde|good afternoon)$/.test(t)) {
    return 'Boa tarde! Como posso ajudar-te hoje?';
  }
  if (/^(boa noite|good evening|good night)$/.test(t)) {
    return 'Boa noite! Como posso ajudar-te hoje?';
  }
  if (/^(tudo bem|como est[aá]s|how are you)$/.test(t)) {
    return 'Tudo ótimo por aqui! Diz-me o que precisas de pesquisar, escrever ou analisar.';
  }
  if (/^(obrigad[oa]|valeu|thanks|thank you)$/.test(t)) {
    return 'De nada! Sempre que precisares, estou por aqui.';
  }
  return null;
}

// ----------------------------------------------------
// RELATED TOPIC IMAGES INTERFACE
// ----------------------------------------------------
export interface RelatedTopicImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  pageUrl: string;
  caption?: string;
  width?: number;
  height?: number;
}


function isUserRequestingCode(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /\b(c[oó]digo|codigos|code|codes|script|scripts|fun[cç][aã]o|fun[cç][oõ]es|function|functions|programar|programa[cç][aã]o|program|developer|desenvolver|implementar|implementa|typescript|javascript|python|react|html|css|sql|api|backend|frontend|classe|class|classes|algoritmo|algoritmos|syntax|sintaxe|compil|debug|endpoint|componente|componentes|component|components|snippet|snippets|json|regex|bash|shell|terminal|docker|git|c\+\+|c\#|java|rust|golang|php|swift|kotlin)\b/i.test(text);
}

function cleanAiResponse(text: string, isCodeRequested: boolean): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove clichéd AI opening statements (e.g., "Como um modelo de inteligência artificial...", "Como uma IA focada em texto...")
  cleaned = cleaned.replace(
    /^(?:Como\s+(?:um\s+)?modelo\s+de\s+(?:linguagem|IA|inteligência\s+artificial)[^.\n]*[.\n]+|Como\s+uma\s+(?:IA|inteligência\s+artificial)[^.\n]*[.\n]+|Sou\s+(?:apenas\s+)?um\s+modelo\s+de\s+texto[^.\n]*[.\n]+|Como\s+uma\s+inteligência\s+artificial\s+focada\s+em[^.\n]*[.\n]+)/i,
    ''
  ).trim();

  // 2. If user did NOT request code, strip unrequested code blocks (TypeScript, JavaScript, React, interfaces, imports)
  if (!isCodeRequested) {
    cleaned = cleaned.replace(/```(?:typescript|ts|javascript|js|tsx|jsx|react|code|json|bash|sh)?\n[\s\S]*?(?:```|$)/gi, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  return cleaned;
}

// ----------------------------------------------------
// REAL AI IMAGE GENERATION ENGINE (GEMINI & NEURAL DIFFUSION)
// ----------------------------------------------------
function inferImageStyleServer(t: string): string {
  if (/log[oó]tipo|logo|emblema|marca/i.test(t)) return 'logotipo';
  if (/anime|mang[aá]|otaku|naruto|goku|luffy|sasuke|dragon ball/i.test(t)) return 'anime';
  if (/3d|tridimensional|render|octane|personagem 3d/i.test(t)) return '3d';
  if (/cartoon|desenho animado|pixar|disney|gatinho fofo/i.test(t)) return 'cartoon';
  if (/futurista|cyberpunk|neon|sci-fi|espacial|metr[oó]pole/i.test(t)) return 'futurista';
  if (/paisagem|natureza|montanha|lago|floresta|praia|alpino/i.test(t)) return 'paisagem';
  if (/interior|interiores|decora[cç][aã]o|sala|quarto|cozinha|apartamento/i.test(t)) return 'interiores';
  if (/fantasia|drag[aã]o|m[aá]gic|criatura|imagina[cç][aã]o|encantad/i.test(t)) return 'fantasia';
  if (/fotogr[aá]fic[oa]|fotografia|foto real|retrato/i.test(t)) return 'fotografico';
  if (/cinematogr[aá]fic[oa]|filme|movie/i.test(t)) return 'cinematografico';
  if (/minimalista|minimalismo|clean|simples/i.test(t)) return 'minimalista';
  if (/ilustra[cç][aã]o|vetor|editorial|bot[aâ]nic/i.test(t)) return 'ilustracao';
  if (/art[ií]stic[oa]|pintura|[oó]leo/i.test(t)) return 'artistico';
  if (/produto|comercial|publicidade|auscultadores|embalagem/i.test(t)) return 'produto';
  return 'realista';
}

function detectImageIntentServer(text: string): { prompt: string; style: string } | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim().replace(/[\.\!\?]+$/g, '').trim();

  // 1. Explicit /image command
  if (t.toLowerCase().startsWith('/image ')) {
    return { prompt: t.slice(7).trim() || 'Composição artística de alta definição', style: 'realista' };
  }

  // 2. Avoid pure questions, learning intents, coding, or text generation requests
  if (
    /^(como|explique|explica|qual|quais|quando|onde|quanto|quem|o\s+que|porque|por\s+que|ajuda|saber|aprender|entender|compreender)\b/i.test(t) ||
    /^(?:eu\s+)?(?:quero|gostaria\s+de|queria|preciso\s+de|podes)\s+(?:saber|aprender|entender|compreender|conhecer|pesquisar|perguntar|explicar|ajuda|falar|conversar|escrever|resumir)\b/i.test(t) ||
    /\b(?:c[oó]digo|script|fun[cç][aã]o|texto|reda[cç][aã]o|artigo|resumo|lista|tabela|plano|hist[oó]ria|poema|e-mail|email)\b/i.test(t)
  ) {
    return null;
  }

  const visualNounPattern = '(?:imagem|imagens|foto|fotos|fotografia|fotografias|ilustra[cç][aã]o|ilustra[cç][oõ]es|desenho|desenhos|arte|quadro|pintura|log[oó]tipo|logo|wallpaper|avatar|retrato|cartaz|poster|banner|cen[aá]rio|capa|miniatura|thumbnail|render)';

  // 3. Exact standalone matches: "Cria uma imagem", "Gera uma imagem", "Desenha um logótipo"
  const standaloneMatch = t.match(
    new RegExp(`^(?:por\\s+favor\\s*,?\\s*|podes\\s+)?(?:cria|criar|gera|gerar|desenha|desenhar|faz|fazer|pinta|pintar|produz|produzir|imagina|imaginar)\\s+(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?(${visualNounPattern}|paisagem|personagem)$`, 'i')
  );
  if (standaloneMatch) {
    const type = standaloneMatch[1].toLowerCase();
    if (/log[oó]tipo|logo/.test(type)) return { prompt: 'Logótipo moderno minimalista, elegante e futurista com linhas limpas', style: 'logotipo' };
    if (/paisagem/.test(type)) return { prompt: 'Paisagem natural majestosa com montanhas, céu crepuscular e iluminação cinematográfica', style: 'cinematografico' };
    if (/personagem/.test(type)) return { prompt: 'Personagem heroica detalhada com vestes estilizadas e iluminação épica', style: 'realista' };
    if (/ilustra/.test(type)) return { prompt: 'Ilustração artística e conceitual rica em cores e detalhes estilizados', style: 'ilustracao' };
    return { prompt: 'Composição visual espetacular de arte digital com iluminação cinematográfica e cores vívidas', style: 'realista' };
  }

  // 4a. Strictly visual verbs (desenha, pinta, renderiza, ilustra)
  const visualVerbRegex = /^(?:por\s+favor\s*,?\s*|podes\s+)?(?:desenha|desenhar|pinta|pintar|renderiza|renderizar|ilustra|ilustrar|draw|paint|render)\s+(?:para\s+mim\s+)?(.+)$/i;
  const mVisualVerb = t.match(visualVerbRegex);
  if (mVisualVerb) {
    let target = mVisualVerb[1]
      .replace(/^(?:uma?\s+|an?\s+|o\s+|a\s+|os\s+|as\s+)?(?:imagem|foto|fotografia|ilustra[cç][aã]o|desenho|arte|quadro|log[oó]tipo|logo|wallpaper|avatar|retrato)?\s*(?:de\s+|do\s+|da\s+|dos\s+|das\s+|sobre\s+|com\s+|em\s+|for\s+|of\s+|with\s+|o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?/i, '')
      .trim() || t;
    let style = inferImageStyleServer(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  // 4b. Generic action verbs (cria, gera, faz) ONLY when paired with a REQUIRED visual asset noun
  const genericVerbWithNounRegex = new RegExp(
    `^(?:por\\s+favor\\s*,?\\s*|podes\\s+)?(?:cria|criar|gera|gerar|faz|fazer|produz|produzir|imagina|imaginar|generate|create|make)\\s+(?:para\\s+mim\\s+)?(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?${visualNounPattern}(?:\\s+(?:em\\s+estilo\\s+|no\\s+estilo\\s+|estilo\\s+|de\\s+|do\\s+|da\\s+|dos\\s+|das\\s+|sobre\\s+|com\\s+|para\\s+|for\\s+|of\\s+|with\\s+)?(.+))?$`,
    'i'
  );
  const mGeneric = t.match(genericVerbWithNounRegex);
  if (mGeneric) {
    let target = (mGeneric[1] || t).trim();
    let style = inferImageStyleServer(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  // 5. "Quero / Gostaria de / Preciso de" ONLY when paired with a REQUIRED visual asset noun
  const wantWithNounRegex = new RegExp(
    `^(?:eu\\s+)?(?:quero|preciso\\s+de|gostaria\\s+de|queria|want|need|would\\s+like)\\s+(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?${visualNounPattern}(?:\\s+(?:em\\s+estilo\\s+|no\\s+estilo\\s+|estilo\\s+|de\\s+|do\\s+|da\\s+|dos\\s+|das\\s+|sobre\\s+|com\\s+|para\\s+|for\\s+|of\\s+|with\\s+)?(.+))?$`,
    'i'
  );
  const m2 = t.match(wantWithNounRegex);
  if (m2) {
    let target = (m2[1] || t).trim();
    let style = inferImageStyleServer(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  return null;
}

// ----------------------------------------------------
// RELATED TOPIC IMAGES SEARCH (WIKIPEDIA / WIKIMEDIA COMMONS)
// ----------------------------------------------------
function shouldSearchRelatedImages(rawText: string): boolean {
  if (!rawText || typeof rawText !== 'string') return false;
  const trimmed = rawText.trim();
  if (trimmed.length < 2) return false;

  // Filter out pure greetings, short conversational words or simple meta commands
  const isGreeting = /^(ol[aá]|bom dia|boa tarde|boa noite|hello|hi|hey|oi|como est[aá]s?|tudo bem|ok|sim|n[aã]o|obrigad[oa]|valeu|bye|tchau|e a[ií]|diz\s+(?:apenas|s[oó])\s+.+)[\s,\.!\?]*$/i.test(trimmed);
  if (isGreeting) return false;

  // Filter out image CREATION / GENERATION requests (these belong to AI Image Generation, not topic search)
  if (
    detectImageIntentServer(trimmed) ||
    /^(?:por\s+favor\s*,?\s*|podes\s+)?(?:desenha|desenhar|pinta|pintar|renderiza|renderizar|ilustra|ilustrar|draw|paint|render)\b/i.test(trimmed) ||
    /^(?:quero|gostaria\s+de)\s+(?:uma?\s+)?(?:imagem|foto|desenho|arte)/i.test(trimmed)
  ) {
    return false;
  }

  // Filter out creator / founder or ZUNO AI self-description questions (handled by system prompt, not Wikipedia)
  if (
    /(quem\s+(é\s+o\s+)?(criador|fundador|criou|fundou)|who\s+(is\s+the\s+)?(creator|founder|created|founded))/i.test(trimmed) ||
    /\bzuno\s*(?:ai|ia)\b/i.test(trimmed)
  ) {
    return false;
  }

  // Filter out programming / code requests
  if (isUserRequestingCode(trimmed)) {
    return false;
  }

  // Filter out math calculations
  if (/^(\d+[\s\+\-\*\/\^x\=]+|\bcalcule\b|\bquanto\s+[eé]\b|\bresolve\b)/i.test(trimmed)) {
    return false;
  }

  return true;
}

function extractCleanTopicQuery(rawText: string): string {
  let q = rawText.trim()
    .replace(/^(?:ol[aá]\s*,?\s*|oi\s*,?\s*|por\s+favor\s*,?\s*)+/i, '')
    .replace(/^(?:eu\s+)?(?:quero|gostaria\s+de|queria|preciso\s+de|podes)\s+(?:saber|aprender|entender|compreender|conhecer|explicar)\s+(?:mais\s+)?(?:sobre|acerca\s+de|o\s+que\s+[eé]\s+)?/i, '')
    .replace(/^(quem\s+(?:foi|é|eram|são)|o\s+que\s+(?:é|são|foi)|qual\s+(?:é|era)\s+(?:a|o)\s+|me\s+fale\s+sobre|fale\s+sobre|explica-me\s+sobre|explica\s+(?:o\s+que\s+[eé]|sobre)|como\s+(?:funciona|é)|o\s+que\s+significa|hist[oó]ria\s+d[eoa]s?|biografia\s+d[eoa]s?|curiosidades\s+sobre|tudo\s+sobre|fale-me\s+de|qual\s+a\s+origem\s+d[eoa]s?|resumo\s+d[eoa]s?|pesquisa\s+sobre|artigo\s+sobre|what\s+is|who\s+is|tell\s+me\s+about)\s+/i, '')
    .replace(/\b(?:responde|explica|resume|em)\s+(?:apenas\s+)?(?:\d+|uma|duas|tr[eê]s|poucas)\s+(?:frases?|linhas?|palavras?)\b.*$/i, '')
    .replace(/^(a|o|as|os|the|um|uma|uns|umas)\s+/i, '')
    .replace(/[\?\!\.\:\,\;\"\#\*\`\(\)]+$/g, '')
    .trim();

  return q;
}

const relatedImagesCache = new Map<string, { images: RelatedTopicImage[]; expiresAt: number }>();

async function searchRelatedTopicImages(rawText: string): Promise<RelatedTopicImage[]> {
  if (!shouldSearchRelatedImages(rawText)) return [];

  const cleanQuery = extractCleanTopicQuery(rawText);
  if (cleanQuery.length < 2 || cleanQuery.length > 80) return [];

  const cacheKey = cleanQuery.toLowerCase();
  const cached = relatedImagesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.images;
  }

  const excludedTerms = [
    'disambig', 'question_book', 'ambox', 'wiki_letter', 'red_penc',
    'crystal_clear', 'folder_hexagonal', 'padlock', 'mergefrom', 'splitsection',
    'information_icon', 'edit-clear', 'gnome', 'symbol_question', 'commons-logo'
  ];

  const fetchWiki = async (lang: string): Promise<RelatedTopicImage[]> => {
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery)}&gsrlimit=6&prop=pageimages|pageterms|info&inprop=url&pithumbsize=600&piprop=thumbnail|original&format=json&origin=*`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ZunoAI/2.5 (https://zunoai.com; suporte@zunoai.com)' },
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) return [];
      const data = await res.json();
      const pages = Object.values(data.query?.pages || {}) as any[];
      const list: RelatedTopicImage[] = [];

      for (const p of pages) {
        const thumb = p.thumbnail?.source || p.original?.source;
        if (!thumb || typeof thumb !== 'string') continue;
        const lower = thumb.toLowerCase();
        if (excludedTerms.some((t) => lower.includes(t))) continue;
        if (
          !lower.endsWith('.jpg') &&
          !lower.endsWith('.jpeg') &&
          !lower.endsWith('.png') &&
          !lower.endsWith('.webp') &&
          !lower.includes('.jpg?') &&
          !lower.includes('.png?') &&
          !lower.includes('.jpeg?')
        ) {
          continue;
        }

        list.push({
          id: `rel_${p.pageid || Math.random().toString(36).substring(2, 9)}`,
          url: p.original?.source || thumb,
          thumbnailUrl: thumb,
          title: p.title || cleanQuery,
          source: `Wikipédia (${lang.toUpperCase()}) / Wikimedia Commons`,
          pageUrl: p.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title || cleanQuery)}`,
          caption: p.terms?.description?.[0] || p.title || cleanQuery,
          width: p.thumbnail?.width || 600,
          height: p.thumbnail?.height || 400,
        });
      }
      return list;
    } catch (e) {
      return [];
    }
  };

  try {
    // Run PT and EN Wikipedia lookups in parallel to cut latency in half
    const [ptResults, enResults] = await Promise.all([fetchWiki('pt'), fetchWiki('en')]);
    const results = [...ptResults];
    for (const enItem of enResults) {
      if (results.length >= 4) break;
      if (!results.some((r) => r.title.toLowerCase() === enItem.title.toLowerCase())) {
        results.push(enItem);
      }
    }
    const finalResults = results.slice(0, 4);
    if (relatedImagesCache.size > 200) {
      const firstKey = relatedImagesCache.keys().next().value;
      if (firstKey) relatedImagesCache.delete(firstKey);
    }
    relatedImagesCache.set(cacheKey, { images: finalResults, expiresAt: Date.now() + 15 * 60 * 1000 });
    return finalResults;
  } catch (err) {
    return [];
  }
}


async function generateRealImageCore(params: {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  quality?: string;
  userId?: string;
  referenceImage?: string;
  isEdit?: boolean;
}): Promise<ServerGeneratedImage | null> {
  const {
    prompt,
    style = 'realista',
    aspectRatio = '1:1',
    quality = 'hd',
    userId = 'guest',
    referenceImage,
    isEdit,
  } = params;

  const styleModifiers: Record<string, string> = {
    realista: 'ultra-crisp photorealistic studio photography, rich vibrant natural colors, warm golden-hour rim light, razor-sharp focal detail, creamy DSLR f/1.8 bokeh, lifelike textures, clean polished composition',
    fotografico: 'high-end editorial portrait photography, natural sunlit clarity, authentic candid feel, shallow depth of field, 50mm f/1.4 optical bokeh, rich dynamic range',
    anime: 'vibrant modern Makoto Shinkai anime masterpiece, luminous golden-hour clouds, crisp clean linework, expressive glowing eyes, vivid saturated sky and rich cel-shaded highlights',
    '3d': 'vibrant stylized 3D character render, Pixar and Nintendo cinema quality, soft global illumination, glossy subsurface scattering, expressive appealing design, octane 3D studio render',
    cartoon: 'charming expressive 2D cartoon illustration, bold clean ink outlines, warm cheerful pastel glow, soft cel shading, appealing proportions, vibrant modern storybook polish',
    paisagem: 'breathtaking alpine landscape and nature photography, mirror-calm crystal lake reflections, sunlit snow-capped peaks, lush emerald pines, crisp golden-blue hour clarity, vivid natural depth',
    logotipo: 'sleek glowing neon vector brand emblem on deep obsidian navy background, luminous electric blue and neon violet gradient glow, symmetrical geometric mark, futuristic high-craft branding',
    produto: 'luxury commercial studio product photography on deep dark backdrop, dramatic electric blue and neon purple rim lighting, crisp metallic and matte reflections, sleek advertising showcase',
    futurista: 'epic sci-fi futuristic neon cyberpunk metropolis, towering luminous glass skyscrapers, glowing electric blue and magenta holograms, flying spacecraft, sleek reflective city atmosphere',
    ilustracao: 'lush painterly editorial fantasy illustration, intricate botanical details, delicate expressive ink linework, luminous warm-cool color harmony, richly textured digital art polish',
    cinematografico: 'epic dramatic IMAX 70mm cinematic frame, glowing twilight sky and moonlit clouds, dramatic rim lighting, anamorphic depth, rich golden and deep indigo contrast',
    interiores: 'luxury architectural interior design photography, warm natural sunlight streaming through tall windows, lush indoor plants, modern refined furniture, soft natural shadows, editorial magazine aesthetic',
    fantasia: 'enchanting free-imagination fantasy creature and magical world, bioluminescent forest sparkles, adorable hyper-detailed scales and glowing highlights, vivid 3D digital fantasy art',
    artistico: 'fine art masterpiece, expressive luminous oil and digital brushwork, rich harmonious color palette, evocative museum-grade composition',
    minimalista: 'ultra-clean minimalist composition, balanced negative space, crisp geometric simplicity, subtle luminous accent lighting, refined gallery design',
  };

  const modifier = styleModifiers[style] || styleModifiers.realista;
  let enrichedPrompt = `${prompt.trim()}, ${modifier}, studio-grade vivid contrast, crisp clarity, quality: ${quality}`;
  if (isEdit) {
    enrichedPrompt = `Detailed modification of previous visual composition: ${prompt.trim()}, preserving visual essence with ${modifier}`;
  }

  let width = 1024;
  let height = 1024;
  let targetRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1';

  if (aspectRatio === '16:9') {
    targetRatio = '16:9';
    width = 1280;
    height = 720;
  } else if (aspectRatio === '9:16') {
    targetRatio = '9:16';
    width = 720;
    height = 1280;
  } else if (aspectRatio === '4:3') {
    targetRatio = '4:3';
    width = 1024;
    height = 768;
  } else if (aspectRatio === '3:4' || aspectRatio === '4:5') {
    targetRatio = '3:4';
    width = 768;
    height = 1024;
  }

  let generatedBase64: string | null = null;
  let mimeType = 'image/png';
  let usedModel = activeImageModel;

  // 1. Try Google Gemini Image Generation model first if API key has sufficient scopes
  try {
    const ai = getGenAI();
    const parts: any[] = [];

    if (referenceImage && typeof referenceImage === 'string' && referenceImage.includes('base64,')) {
      const [meta, b64] = referenceImage.split('base64,');
      const mMatch = meta.match(/data:([^;]+);/);
      parts.push({
        inlineData: {
          mimeType: mMatch ? mMatch[1] : 'image/jpeg',
          data: b64,
        },
      });
    }

    parts.push({ text: enrichedPrompt });

    const response = await ai.models.generateContent({
      model: activeImageModel,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: targetRatio,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        generatedBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType ?? 'image/png';
        usedModel = activeImageModel;
        break;
      }
    }
  } catch (modelErr: any) {
    logEvent('info', `Modelo primário de imagem ${activeImageModel} com fallback ativo: ${modelErr.message}`, '/api/image/generate');
  }

  // 2. High-Quality Real Neural Diffusion Synthesis Engine (Flux / Sana adapter)
  if (!generatedBase64) {
    try {
      const cleanPrompt = encodeURIComponent(enrichedPrompt);
      const seed = Math.floor(Math.random() * 9999999);
      
      const candidateEndpoints = [
        `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true&seed=${seed}`,
        `https://pollinations.ai/p/${cleanPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`,
        `https://pollinations.ai/p/${cleanPrompt}?width=768&height=768&nologo=true&seed=${seed + 1}`,
      ];

      for (const endpoint of candidateEndpoints) {
        try {
          const pollResponse = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/jpeg,image/png,image/*;q=0.9',
            },
            signal: AbortSignal.timeout(18000),
          });

          if (pollResponse.ok) {
            const arrayBuffer = await pollResponse.arrayBuffer();
            if (arrayBuffer.byteLength > 1500) {
              generatedBase64 = Buffer.from(arrayBuffer).toString('base64');
              mimeType = pollResponse.headers.get('content-type') || 'image/jpeg';
              usedModel = 'ZUNO Diffusion Engine (Flux/Sana)';
              break;
            }
          }
        } catch (singleErr: any) {
          console.warn(`Endpoint attempt failed: ${singleErr.message}`);
        }
      }
    } catch (diffErr: any) {
      console.error('Neural diffusion adapter error:', diffErr.message);
    }
  }

  if (generatedBase64) {
    const dataUrl = `data:${mimeType};base64,${generatedBase64}`;
    const imageRecord: ServerGeneratedImage = {
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      url: dataUrl,
      prompt: prompt.trim(),
      style,
      aspectRatio,
      quality,
      createdAt: Date.now(),
      model: usedModel,
      userId,
    };

    serverImageGallery.unshift(imageRecord);
    if (serverImageGallery.length > 100) serverImageGallery.pop();

    incrementUserImageCount(userId);
    totalImagesGenerated++;
    logEvent('info', `Imagem gerada com sucesso via ${usedModel}: "${prompt.slice(0, 30)}..."`, '/api/image/generate');

    return imageRecord;
  }

  return null;
}

// ----------------------------------------------------
// SERVER-SIDE AUTHENTICATION & AUTHORIZATION HELPERS
// ----------------------------------------------------
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function extractDeviceId(req: Request): string {
  const raw = req.headers['x-device-id'];
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().slice(0, 128);
}

interface ResolvedAuthContext {
  authenticated: boolean;
  user: UserProfile | null;
  token?: string;
  exp?: number;
  deviceId?: string;
  emailVerified?: boolean;
  providerId?: string;
  error?: string;
}

async function resolveAuthContext(req: Request): Promise<ResolvedAuthContext> {
  const token = extractBearerToken(req);
  if (!token) {
    return { authenticated: false, user: null };
  }

  const verified = await verifyFirebaseIdToken(token);
  if (!verified.valid) {
    return { authenticated: false, user: null, error: verified.reason };
  }

  const account = upsertVerifiedAccount(verified.claims);
  const deviceId = extractDeviceId(req);
  if (deviceId && isDeviceSessionRevoked(account.id, deviceId)) {
    return {
      authenticated: false,
      user: null,
      error: 'Sessão encerrada remotamente noutro dispositivo. Inicia sessão novamente.',
    };
  }

  return {
    authenticated: true,
    user: account,
    token,
    exp: verified.claims.exp,
    deviceId: deviceId || undefined,
    emailVerified: verified.claims.emailVerified,
    providerId: verified.claims.providerId,
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health & Availability Monitoring
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req: Request, res: Response) => {
  const dbOk = pingAuthDb();
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recentErrorCount = errorTimestamps.filter((ts) => ts >= cutoff).length;
  const memUsage = process.memoryUsage();
  const status = dbOk ? 'ok' : 'degraded';

  res.status(dbOk ? 200 : 503).json({
    status,
    database: dbOk ? 'connected' : 'error',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeModel,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    environment: process.env.NODE_ENV || 'development',
    errorCountLastHour: recentErrorCount,
    memoryRssMb: Math.round(memUsage.rss / (1024 * 1024)),
    timestamp: new Date().toISOString(),
  });
});

// Public platform status (feature flags + global announcement banner)
app.get('/api/platform/status', (_req: Request, res: Response) => {
  res.json({
    featuresEnabled: platformFeatures,
    announcement: platformAnnouncement,
    activeModel,
    publicUrl: PUBLIC_APP_URL,
  });
});

app.post('/api/monitoring/error', (req: Request, res: Response) => {
  if (!checkErrorReportRateLimit(req.ip || 'web')) {
    return res.status(429).json({ recorded: false });
  }
  const { message, source, path: pagePath, device } = req.body || {};
  const cleanMsg = String(message || '').trim().slice(0, 300);
  if (!cleanMsg || cleanMsg.includes('extension://')) {
    return res.json({ recorded: false });
  }
  const cleanSource = String(source || 'client').trim().slice(0, 80);
  const cleanPath = String(pagePath || '/').trim().slice(0, 120);
  const cleanDevice = String(device || '').trim().slice(0, 80);
  logEvent(
    'error',
    `[Client:${cleanSource}] ${cleanMsg}${cleanDevice ? ` (${cleanDevice})` : ''}`,
    cleanPath
  );
  res.json({ recorded: true });
});

// 1b. Authentication & Account Isolation Endpoints
app.post('/api/auth/session', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({
      authenticated: false,
      error: ctx.error || GUEST_RESTRICTION_MESSAGE,
      requiresAuth: true,
    });
  }

  if (ctx.user.status === 'blocked' || ctx.user.isBlocked) {
    return res.status(403).json({
      authenticated: true,
      isBlocked: true,
      error: 'A tua conta encontra-se suspensa pelo administrador da ZUNO AI.',
      user: ctx.user,
    });
  }

  if (ctx.deviceId) {
    upsertDeviceSession(ctx.user.id, ctx.deviceId, {
      userAgent: String(req.headers['user-agent'] || ''),
      ip: req.ip,
    });
  }

  res.json({
    authenticated: true,
    serverVerified: true,
    emailVerified: ctx.emailVerified ?? false,
    providerId: ctx.providerId || 'firebase',
    user: ctx.user,
  });
});

app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const token = extractBearerToken(req);
  const deviceId = extractDeviceId(req);
  if (token) {
    const verified = await verifyFirebaseIdToken(token);
    if (verified.valid) {
      revokeToken(token, verified.claims.uid, verified.claims.exp);
      if (deviceId) {
        revokeDeviceSession(verified.claims.uid, deviceId);
      }
      logEvent('info', `Sessão terminada e token revogado para ${verified.claims.email || verified.claims.uid}.`, '/api/auth/logout');
    }
  }
  res.json({ success: true, loggedOut: true });
});

app.get('/api/auth/sessions', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.deviceId) {
    upsertDeviceSession(ctx.user.id, ctx.deviceId, {
      userAgent: String(req.headers['user-agent'] || ''),
      ip: req.ip,
    });
  }
  const sessions = listUserDeviceSessions(ctx.user.id, ctx.deviceId);
  res.json({ sessions });
});

app.post('/api/auth/sessions/revoke-others', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const revokedCount = revokeOtherDeviceSessions(ctx.user.id, ctx.deviceId || '');
  logEvent('info', `Sessões noutros dispositivos encerradas (${revokedCount}) para ${ctx.user.email}.`, '/api/auth/sessions/revoke-others');
  const sessions = listUserDeviceSessions(ctx.user.id, ctx.deviceId);
  res.json({ success: true, revokedCount, sessions });
});

app.delete('/api/auth/sessions/:deviceId', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const targetId = decodeURIComponent(String(req.params.deviceId || ''));
  const revoked = revokeDeviceSession(ctx.user.id, targetId);
  const sessions = listUserDeviceSessions(ctx.user.id, ctx.deviceId);
  res.json({ success: true, revoked, sessions });
});

app.patch('/api/auth/profile', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }

  const updated = updateAccountProfile(ctx.user.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Conta não encontrada.' });
  res.json({ success: true, user: updated });
});

app.delete('/api/auth/account', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.token) {
    revokeToken(ctx.token, ctx.user.id, ctx.exp);
  }
  deleteAccountDataByUid(ctx.user.id);
  logEvent('warn', `Conta removida pelo utilizador: ${ctx.user.email}`, '/api/auth/account');
  res.json({ success: true });
});

// Isolated Per-User Saved Favorites Sync Endpoints
app.get('/api/favorites', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  res.json({ favorites: listUserFavorites(ctx.user.id) });
});

app.post('/api/favorites', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }
  const { id, conversationId, conversationTitle, messageId, content, note } = req.body || {};
  const cleanId = String(id || '').trim();
  const cleanContent = String(content || '').trim();
  if (!cleanId || !/^[a-zA-Z0-9_\-]{2,128}$/.test(cleanId) || !cleanContent) {
    return res.status(400).json({ error: 'Dados de favorito inválidos.' });
  }
  try {
    const favorite = upsertUserFavorite(ctx.user.id, {
      id: cleanId,
      conversationId: conversationId ? String(conversationId) : undefined,
      conversationTitle: conversationTitle ? String(conversationTitle) : undefined,
      messageId: messageId ? String(messageId) : undefined,
      content: cleanContent,
      note: note ? String(note) : undefined,
      createdAt: Date.now(),
    });
    res.status(201).json({ success: true, favorite });
  } catch (err: any) {
    if (err?.message === 'FAV_OWNERSHIP_DENIED') {
      return res.status(403).json({ error: 'Não tens permissão para alterar um favorito de outra conta.' });
    }
    res.status(400).json({ error: 'Não foi possível guardar nos favoritos.' });
  }
});

app.delete('/api/favorites/:id', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const deleted = deleteUserFavorite(ctx.user.id, String(req.params.id || ''));
  res.json({ success: true, deleted });
});

// Isolated Per-User Conversations Endpoints
app.get('/api/conversations', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const conversations = listUserConversations(ctx.user.id);
  res.json({ conversations });
});

app.put('/api/conversations/:id', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }
  const convId = String(req.params.id || '').trim();
  if (!convId || !/^[a-zA-Z0-9_\-]{2,128}$/.test(convId)) {
    return res.status(400).json({ error: 'Identificador de conversa inválido.' });
  }

  try {
    const saved = upsertUserConversation(ctx.user.id, {
      ...(req.body || {}),
      id: convId,
    });
    res.json({ success: true, conversation: saved });
  } catch (err: any) {
    if (err?.message === 'CONV_OWNERSHIP_DENIED') {
      return res.status(403).json({ error: 'Não tens permissão para alterar uma conversa de outra conta.' });
    }
    res.status(400).json({ error: err?.message || 'Falha ao guardar conversa.' });
  }
});

app.delete('/api/conversations/:id', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const deleted = deleteUserConversation(ctx.user.id, String(req.params.id || ''));
  res.json({ success: true, deleted });
});

// Plan & VIP Code Endpoints (Strictly Authenticated)
app.post('/api/pricing/select', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const plan = String(req.body?.plan || 'free') as PlanType;
  if (!['free', 'premium', 'pro', 'ultra'].includes(plan)) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }
  const updated = setAccountPlan(ctx.user.id, plan);
  res.json({ success: true, user: updated });
});

app.post('/api/vip/redeem', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  if (ctx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }
  const result = redeemVipCode(String(req.body?.code || ''), ctx.user.id);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Código VIP inválido.' });
  }
  logEvent('info', `Código VIP resgatado por ${ctx.user.email} -> ${result.plan?.toUpperCase()}`, '/api/vip/redeem');
  res.json({ success: true, plan: result.plan, user: result.user });
});

app.get('/api/admin/vip/codes', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  res.json({ codes: listVipCodes() });
});

app.post('/api/admin/vip/codes', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const plan = (['premium', 'pro', 'ultra'].includes(req.body?.plan) ? req.body.plan : 'pro') as PlanType;
  const created = createVipCode({
    code: req.body?.code,
    plan,
    maxUses: Number(req.body?.maxUses || 1),
    createdBy: ctx.user?.email || ADMIN_FOUNDER_EMAIL,
  });
  logEvent('info', `Código VIP criado (${created.code} - ${created.plan.toUpperCase()})`, '/api/admin/vip/codes');
  res.status(201).json({ success: true, code: created });
});

app.patch('/api/admin/vip/codes/:code', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const updated = setVipCodeActive(req.params.code, Boolean(req.body?.active));
  if (!updated) {
    return res.status(404).json({ error: 'Código VIP não encontrado.' });
  }
  logEvent(
    'info',
    `Código VIP ${updated.code} ${updated.active ? 'ativado' : 'desativado'} pelo administrador.`,
    '/api/admin/vip/codes'
  );
  res.json({ success: true, code: updated });
});

app.delete('/api/admin/vip/codes/:code', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const removed = deleteVipCode(req.params.code);
  if (!removed) {
    return res.status(404).json({ error: 'Código VIP não encontrado.' });
  }
  logEvent('warn', `Código VIP ${req.params.code} eliminado pelo administrador.`, '/api/admin/vip/codes');
  res.json({ success: true });
});

// 2. Chat with Server-Sent Events (SSE) Streaming
app.post('/api/chat/stream', async (req: Request, res: Response) => {
  totalApiRequests++;
  const { messages, systemInstruction, model, attachments } = req.body || {};

  // Verify Bearer token if provided; invalid/expired/revoked tokens are strictly rejected
  const hasAuthHeader = Boolean(extractBearerToken(req));
  const authCtx = await resolveAuthContext(req);
  if (hasAuthHeader && !authCtx.authenticated) {
    return res.status(401).json({ error: authCtx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }

  const isGuestRequest = !authCtx.authenticated || !authCtx.user;
  const isAdminUser = authCtx.user?.role === 'admin';
  const lastUserMsg = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m.role === 'user')?.content || ''
    : '';

  if (platformFeatures.maintenanceMode && !isAdminUser) {
    return res.status(503).json({
      error: 'A ZUNO AI está em manutenção programada neste momento. Por favor tenta novamente dentro de instantes.',
    });
  }

  // Guest mode enforcement: public informational Q&A only!
  if (isGuestRequest) {
    if (!platformFeatures.guestAccessEnabled) {
      return res.status(401).json({ error: GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      return res.status(401).json({ error: GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
    }
    if (detectImageIntentServer(lastUserMsg)) {
      return res.status(401).json({ error: GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
    }
    const rateCheck = checkGuestRateLimit(req.ip || 'guest', 15);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Atingiste o limite de perguntas públicas como visitante. Cria uma conta ou inicia sessão para continuares sem interrupções.',
        requiresAuth: true,
      });
    }
  } else if (authCtx.user) {
    // Blocked user verification
    if (authCtx.user.status === 'blocked' || isUserBlocked(authCtx.user.id) || isUserBlocked(authCtx.user.email)) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.write(': connected\n\n');
      res.write(
        `data: ${JSON.stringify({
          text: '⛔ **CONTA SUSPENSA**: O teu acesso à ZUNO AI foi bloqueado pelo administrador da plataforma. Não é possível enviar mensagens nem interagir com os modelos. Por favor contacta o administrador ou a equipa de suporte para reativar a tua conta.',
          error: true,
          done: true,
        })}\n\n`
      );
      res.end();
      return;
    }

    incrementAccountUsage(authCtx.user.id, 'message');
  }

  // Use requested model or fast primary model (guests always use ultra-fast public base model)
  const chosenModel = isGuestRequest ? 'gemini-3.1-flash-lite' : normalizeTextModelId(model || activeModel || 'gemini-3.1-flash-lite');

  // Set SSE headers with anti-buffering optimizations for instant TTFT
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevents proxy buffering in Cloud Run & Nginx
  res.flushHeaders?.();
  res.write(': connected\n\n'); // immediate heartbeat ping to establish HTTP stream
  if ((res as any).flush) {
    (res as any).flush();
  }

  let relatedImagesPromise: Promise<RelatedTopicImage[]> = Promise.resolve([]);

  try {
    const ai = getGenAI();

    // Prepare contents array for Gemini (windowed to last 14 turns for consistently fast TTFT)
    const formattedContents: any[] = [];
    const recentMessages = Array.isArray(messages) ? messages.slice(-14) : [];

    for (let idx = 0; idx < recentMessages.length; idx++) {
      const msg = recentMessages[idx];
      const parts: any[] = [];
      const includeInlineAttachments = idx >= recentMessages.length - 2;

      // Include heavy base64 image attachments only for the latest 2 turns
      if (includeInlineAttachments && msg.attachments && Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att.dataUrl && att.dataUrl.includes('base64,')) {
            const [meta, base64Data] = att.dataUrl.split('base64,');
            const mimeMatch = meta.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (parts.length > 0) {
        formattedContents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    // If client supplied attachments directly in the request body for current message
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const lastContent = formattedContents[formattedContents.length - 1];
      if (lastContent && lastContent.role === 'user') {
        for (const att of attachments) {
          if (att.dataUrl && att.dataUrl.includes('base64,')) {
            const [meta, base64Data] = att.dataUrl.split('base64,');
            const mimeMatch = meta.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            lastContent.parts.unshift({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }
    }

    // Check if the user is asking about the founder/creator
    const lastUserMsg = Array.isArray(messages)
      ? [...messages].reverse().find((m) => m.role === 'user')?.content || ''
      : '';

    if (lastUserMsg.trim().toLowerCase() === CREATOR_RECOGNITION_CODE.toLowerCase()) {
      res.write(`data: ${JSON.stringify({ text: CREATOR_WELCOME_MESSAGE })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, creatorRecognized: true })}\n\n`);
      res.end();
      return;
    }

    const mentionsZunoPlatform = /\b(?:zuno(?:\s*(?:ai|ia))?|(?:esta|essa|a)\s+plataforma)\b/i.test(lastUserMsg);
    const asksAuthorship = /\b(?:quem|criador|criadora|criou|fundador|fundadora|fundou|desenvolveu|desenvolvedor|fez|construiu|programou|inventou|idealizou|lan[çc]ou|dono|propriet[áa]rio|respons[áa]vel|autor|autoria|por\s+tr[áa]s|de\s+quem\s+[eé]|who|creator|created|founder|founded|developed|developer|made|built|owner|behind|qui|cr[ée]ateur|cr[ée][ée]|fondateur|fond[ée]|qui[ée]n|creador|cre[óo]|fund[óo])\b/i.test(lastUserMsg);
    const asksDirectSelfCreator = /\b(?:quem\s+(?:te\s+(?:criou|fez|desenvolveu|fundou|programou|construiu)|(?:[eé]\s+(?:o\s+)?)?(?:teu|seu)\s*(?:criador|fundador|desenvolvedor|dono))|who\s+(?:created|made|built|developed|founded)\s+(?:you|this)|who\s+is\s+(?:your|the)\s+(?:creator|founder|developer|owner)|qui\s+t'a\s+(?:cr[ée][ée]|fond[ée])|qui[ée]n\s+te\s+(?:cre[óo]|fund[óo]))\b|\bquem\s+[eé]\s+o\s+(?:criador|fundador)\s*\??$/i.test(lastUserMsg.trim());

    if ((mentionsZunoPlatform && asksAuthorship) || asksDirectSelfCreator) {
      // Determine language
      let founderAns = FOUNDER_RESPONSES.pt;
      if (/\b(who|created|founder|developer|owner|made|built)\b/i.test(lastUserMsg)) {
        founderAns = FOUNDER_RESPONSES.en;
      } else if (/\b(quién|creó|fundó|creador)\b/i.test(lastUserMsg)) {
        founderAns = FOUNDER_RESPONSES.es;
      } else if (/\b(qui|créé|fondé|créateur)\b/i.test(lastUserMsg)) {
        founderAns = FOUNDER_RESPONSES.fr;
      }

      res.write(`data: ${JSON.stringify({ text: founderAns })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // Guests cannot load private/custom system instructions or generate in-chat images
    const effectiveSystemInstruction = isGuestRequest ? '' : systemInstruction;

    // Check if the user is asking to create, draw or generate an image directly in chat
    const inStreamImageIntent = isGuestRequest ? null : detectImageIntentServer(lastUserMsg);
    if (inStreamImageIntent && authCtx.user) {
      if (!platformFeatures.imageGeneration && !isAdminUser) {
        res.write(`data: ${JSON.stringify({ text: '⚠️ A geração de imagens encontra-se temporariamente desativada pelo administrador da ZUNO AI.' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify({ text: `🎨 **ZUNO AI IMAGE**: A sintetizar imagem em alta resolução para "*${inStreamImageIntent.prompt}*" (${inStreamImageIntent.style})...\n\n` })}\n\n`);
      if ((res as any).flush) (res as any).flush();

      try {
        const generatedImg = await generateRealImageCore({
          prompt: inStreamImageIntent.prompt,
          style: inStreamImageIntent.style,
          aspectRatio: '1:1',
          quality: 'hd',
          userId: authCtx.user.id,
        });

        if (generatedImg && generatedImg.url) {
          saveUserImage(authCtx.user.id, generatedImg as any);
          incrementAccountUsage(authCtx.user.id, 'image');
          const completionText = `Aqui está a tua imagem criada pelo **ZUNO AI IMAGE**:\n\n![${inStreamImageIntent.prompt}](${generatedImg.url} "${inStreamImageIntent.prompt}")\n\n> **Prompt:** "${inStreamImageIntent.prompt}"\n> **Estilo:** ${inStreamImageIntent.style.toUpperCase()}\n> **Motor de IA:** ${generatedImg.model}\n\n> [!TIP] Dica: Podes clicar na imagem para abrir em alta resolução ou guardá-la no teu dispositivo. Podes também pedir alterações descrevendo o que pretendes ajustar.`;
          res.write(`data: ${JSON.stringify({ text: completionText })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ text: `⚠️ Não foi possível sintetizar a imagem no momento. Por favor tenta novamente em instantes.` })}\n\n`);
        }
      } catch (genErr: any) {
        res.write(`data: ${JSON.stringify({ text: `⚠️ Falha ao sintetizar imagem: ${genErr.message}` })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // Launch progressive topic images search concurrently in the background (ZERO text latency)
    relatedImagesPromise = shouldSearchRelatedImages(lastUserMsg)
      ? searchRelatedTopicImages(lastUserMsg)
      : Promise.resolve([]);

    const isCodeRequested = isUserRequestingCode(lastUserMsg);
    const codePolicy = isCodeRequested
      ? 'O utilizador solicitou código/programação. Apresenta código limpo, robusto e moderno com destaque de sintaxe adequado e explicação clara.'
      : 'ATENÇÃO CRÍTICA: O utilizador NÃO pediu código. É TERMINANTEMENTE PROIBIDO incluir blocos de código (```typescript, ```javascript, ```python, etc.), interfaces, imports, funções, classes ou exemplos de código nesta resposta. Responde EXCLUSIVAMENTE em linguagem natural, clara, elegante, estruturada e visual com títulos, negrito, listas e tabelas comparativas GFM. Nunca mostres detalhes internos, componentes ou código.';

    const defaultSysInstruction =
      (effectiveSystemInstruction ? effectiveSystemInstruction + '\n\n' : '') +
      'És o ZUNO AI ("Intelligence Without Limits").\n' +
      'Regras:\n' +
      '- A ZUNO AI é uma plataforma internacional utilizada em diferentes países. Responde sempre automaticamente no idioma em que o utilizador escrever (Português, Inglês, Espanhol, Francês, Alemão, Italiano, Árabe, Chinês, Japonês ou qualquer outro).\n' +
      '- Sê natural, direto, claro e proporcional à pergunta: perguntas simples merecem respostas objetivas e rápidas; tópicos complexos merecem secções Markdown (`#`, `##`), **negrito**, listas ou tabelas GFM.\n' +
      '- Nunca uses clichês como "Como um modelo de IA..." nem inventes URLs.\n' +
      `- ${codePolicy}\n` +
      '- A plataforma ZUNO AI foi idealizada, desenvolvida e criada por **Francisco Mutela Emanuel**. Sempre que perguntarem quem criou, desenvolveu, fundou, programou ou é o responsável pela plataforma ZUNO AI — ou sempre que pedirem informações sobre a plataforma ZUNO AI — afirma claramente que foi criada por **Francisco Mutela Emanuel**. Nunca atribuas a criação da ZUNO AI a outra pessoa ou plataforma.\n' +
      '- Para pedidos de criar/desenhar imagem, nunca digas que és apenas texto; para pesquisas de entidades/tópicos, responde normalmente sem inventar URLs de imagem.';

    const streamConfig: any = {
      systemInstruction: defaultSysInstruction,
    };

    const streamController = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) {
        streamController.abort(new Error('CLIENT_ABORTED'));
      }
    });

    const primed = await safeGenerateContentStream(
      ai,
      chosenModel,
      {
        contents: formattedContents.length > 0 ? formattedContents : [{ role: 'user', parts: [{ text: 'Olá!' }] }],
        config: streamConfig,
      },
      streamController.signal
    );

    let fullText = '';

    const emitChunk = (chunk: any) => {
      const chunkText = chunk?.text || '';
      if (chunkText) {
        fullText += chunkText;
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        if ((res as any).flush) {
          (res as any).flush();
        }
      }
    };

    if (primed.firstChunk) {
      emitChunk(primed.firstChunk);
    }

    while (true) {
      if (streamController.signal.aborted) break;
      const step = await primed.iterator.next();
      if (step.done) break;
      emitChunk(step.value);
    }

    if (streamController.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }

    // Estimate tokens
    totalTokensEstimated += Math.ceil(fullText.length / 4);

    // Progressive Related Images: emit if resolved within 450ms so Wikipedia never stalls stream completion
    try {
      const relatedImages = await Promise.race([
        relatedImagesPromise,
        new Promise<RelatedTopicImage[]>((resolve) => setTimeout(() => resolve([]), 450)),
      ]);
      if (Array.isArray(relatedImages) && relatedImages.length > 0) {
        res.write(`data: ${JSON.stringify({ relatedImages })}\n\n`);
        if ((res as any).flush) {
          (res as any).flush();
        }
      }
    } catch {
      // Non-blocking fallback
    }

    res.write(`data: ${JSON.stringify({ done: true, model: primed.modelUsed })}\n\n`);
    res.end();
  } catch (error: any) {
    if (error?.message === 'CLIENT_ABORTED' || res.writableEnded) {
      if (!res.writableEnded) res.end();
      return;
    }
    const parsed = extractCleanApiError(error, 'Os servidores de IA estão com alta procura momentânea. Por favor clica em "Tentar novamente" em instantes.');
    logEvent(
      parsed.isQuotaOrRateLimit || parsed.isUnavailable ? 'warn' : 'error',
      `Chat stream failover (${parsed.code}): ${parsed.message}`,
      '/api/chat/stream'
    );

    // Graceful resilience on temporary 429/503/timeout spikes: never leave factual queries or greetings in a dead-end error
    if (parsed.isQuotaOrRateLimit || parsed.isUnavailable || parsed.isTimeout) {
      const greetingAns = buildGreetingFallbackResponse(lastUserMsg);
      if (greetingAns) {
        res.write(`data: ${JSON.stringify({ text: greetingAns })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, fallback: 'greeting' })}\n\n`);
        res.end();
        return;
      }

      if (/\bzuno\s*(?:ai|ia)\b/i.test(lastUserMsg) && !detectImageIntentServer(lastUserMsg)) {
        const zunoOverview =
          `A **ZUNO AI** (*Intelligence Without Limits*) é uma plataforma independente de inteligência artificial idealizada e criada por **Francisco Mutela Emanuel**, desenhada para conversar, pesquisar, criar conteúdos, programar e gerar imagens de alta qualidade num único ambiente.\n\n` +
          `### Principais capacidades:\n` +
          `- **Chat Inteligente (ZUNO Chat):** Respostas claras, análise de informação, ajuda em estudos, escrita e programação.\n` +
          `- **Pesquisa em Tempo Real (ZUNO Search):** Consulta de informação atualizada com identificação de fontes.\n` +
          `- **Geração de Imagens (ZUNO AI IMAGE):** Criação de imagens realistas, anime, 3D, logótipos, paisagens e ilustrações a partir de pedidos explícitos (como *"cria uma imagem de..."* ou \`/image ...\`).\n` +
          `- **Conta, Favoritos e Sincronização:** Histórico de conversas, favoritos, preferências e gestão de sessões entre dispositivos.`;
        res.write(`data: ${JSON.stringify({ text: zunoOverview })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, fallback: 'zuno_profile' })}\n\n`);
        res.end();
        return;
      }

      const cleanTopic = extractCleanTopicQuery(lastUserMsg);
      if (!isUserRequestingCode(lastUserMsg) && !detectImageIntentServer(lastUserMsg) && cleanTopic.length >= 2) {
        try {
          const [{ articles }, relImages] = await Promise.all([
            fetchWebKnowledgeFallback(lastUserMsg),
            Promise.race([
              relatedImagesPromise,
              new Promise<RelatedTopicImage[]>((resolve) => setTimeout(() => resolve([]), 1500)),
            ]),
          ]);

          if (articles.length > 0) {
            const summaryMarkdown =
              articles
                .slice(0, 2)
                .map((a) => `## ${a.title}\n\n${a.snippet}\n\n[Fonte: Wikipédia (${a.lang})](${a.url})`)
                .join('\n\n---\n\n') +
              `\n\n> [!NOTE] Resposta obtida em modo de contingência a partir de fontes enciclopédicas públicas devido ao limite temporário de pedidos no motor principal de IA.`;

            res.write(`data: ${JSON.stringify({ text: summaryMarkdown })}\n\n`);
            if (Array.isArray(relImages) && relImages.length > 0) {
              res.write(`data: ${JSON.stringify({ relatedImages: relImages })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ done: true, fallback: 'wikipedia' })}\n\n`);
            res.end();
            return;
          }
        } catch {
          // Continue to clean error notification below if encyclopedic fallback yields no entries
        }
      }
    } else {
      console.error(`SSE Chat unexpected error (${parsed.code}):`, parsed.message);
    }

    res.write(
      `data: ${JSON.stringify({
        error: parsed.message,
        done: true,
      })}\n\n`
    );
    res.end();
  }
});

// 3. Web Search Grounding endpoint (Public Search allowed for Guests within rate limits + Authenticated users)
app.post('/api/tools/search', async (req: Request, res: Response) => {
  totalApiRequests++;
  const hasAuthHeader = Boolean(extractBearerToken(req));
  const authCtx = await resolveAuthContext(req);
  if (hasAuthHeader && !authCtx.authenticated) {
    return res.status(401).json({ error: authCtx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }

  if (platformFeatures.maintenanceMode && authCtx.user?.role !== 'admin') {
    return res.status(503).json({
      error: 'A ZUNO AI está em manutenção programada neste momento. Tenta novamente em instantes.',
    });
  }

  if (!platformFeatures.searchGrounding && authCtx.user?.role !== 'admin') {
    return res.status(503).json({
      error: 'O módulo ZUNO Search encontra-se temporariamente desativado pelo administrador.',
    });
  }

  if (!authCtx.authenticated) {
    if (!platformFeatures.guestAccessEnabled) {
      return res.status(401).json({ error: GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
    }
    const rate = checkGuestRateLimit(req.ip || 'guest', 15);
    if (!rate.allowed) {
      return res.status(429).json({
        error: 'Limite de pesquisa pública para visitantes atingido. Cria uma conta ou inicia sessão para continuares.',
        requiresAuth: true,
      });
    }
  } else if (authCtx.user?.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }

  const { query, language } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query de pesquisa obrigatória.' });
  }

  if (query.trim().toLowerCase() === CREATOR_RECOGNITION_CODE.toLowerCase()) {
    return res.json({
      answer: CREATOR_WELCOME_MESSAGE,
      citations: [],
      query,
      creatorRecognized: true,
    });
  }

  try {
    const ai = getGenAI();

    const systemInstruction = `És o ZUNO Search, o módulo de pesquisa em tempo real do ZUNO AI.
Pesquisa informações atualizadas na web sobre a questão do utilizador.
Apresenta uma resposta rica, factual, bem organizada e sintetizada no idioma ${language || 'Português'}.`;

    const response = await safeGenerateContent(ai, 'gemini-4-hydrogen', {
      contents: [{ role: 'user', parts: [{ text: query }] }],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const answer = response.text || '';
    totalTokensEstimated += Math.ceil(answer.length / 4) + 150;

    // Extract grounding chunks for citations
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const citations: Array<{ title: string; url: string }> = [];

    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        citations.push({
          title: chunk.web.title || chunk.web.uri,
          url: chunk.web.uri,
        });
      }
    }

    return res.json({
      answer,
      citations,
      query,
    });
  } catch (error: any) {
    const parsed = extractCleanApiError(error, 'Não foi possível concluir a pesquisa em tempo real no momento.');
    logEvent('warn', `ZUNO Search grounding failover (${parsed.code}): ${parsed.message}`, '/api/tools/search');

    // Graceful real web knowledge fallback (Wikipedia API + Gemini synthesis without googleSearch quota)
    if (parsed.isQuotaOrRateLimit || parsed.isUnavailable || parsed.status === 403 || parsed.status === 404) {
      try {
        const { articles } = await fetchWebKnowledgeFallback(query);
        const citations = articles.map((a) => ({ title: `${a.title} (Wikipédia ${a.lang})`, url: a.url }));
        const contextText = articles.length > 0
          ? `\n\nContexto enciclopédico recolhido:\n${articles.map((a) => `### ${a.title}\n${a.snippet}`).join('\n\n')}`
          : '';

        // Try Gemini synthesis only if failure wasn't already a quota exhaustion
        if (!parsed.isQuotaOrRateLimit) {
          try {
            const ai = getGenAI();
            const synth = await safeGenerateContent(ai, 'gemini-4-hydrogen', {
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Responde de forma clara, completa, organizada e factual no idioma ${language || 'Português'} à seguinte pergunta do utilizador, utilizando os teus conhecimentos e complementando com o contexto abaixo quando relevante.\n\nPergunta: ${query}${contextText}`,
                    },
                  ],
                },
              ],
            });
            const synthAnswer = synth.text?.trim();
            if (synthAnswer) {
              totalTokensEstimated += Math.ceil(synthAnswer.length / 4) + 100;
              return res.json({
                answer: synthAnswer,
                citations,
                query,
              });
            }
          } catch {
            // If Gemini synthesis also hits rate limit, serve the verified retrieved summary if available
          }
        }

        if (articles.length > 0) {
          const directSummary =
            `# Resultados de Pesquisa Web Verificados\n\n` +
            articles.map((a) => `## ${a.title}\n${a.snippet}`).join('\n\n') +
            `\n\n> [!NOTE] Pesquisa obtida em modo de contingência a partir de fontes enciclopédicas públicas devido à alta procura temporária no motor de pesquisa principal.`;

          return res.json({
            answer: directSummary,
            citations,
            query,
          });
        }
      } catch {}
    }

    logEvent('warn', `Pesquisa indisponível (${parsed.code}): ${parsed.message}`, '/api/tools/search');
    return res.status(parsed.status).json({
      error: parsed.message,
    });
  }
});

// 4. Dedicated Tool Execution (Authenticated Users Only — Blocked for Guests)
app.post('/api/tools/execute', async (req: Request, res: Response) => {
  totalApiRequests++;
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({
      error: authCtx.error || GUEST_RESTRICTION_MESSAGE,
      requiresAuth: true,
    });
  }
  if (authCtx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta suspensa.' });
  }
  if (platformFeatures.maintenanceMode && authCtx.user.role !== 'admin') {
    return res.status(503).json({
      error: 'A ZUNO AI está em manutenção programada neste momento.',
    });
  }

  const { toolId, input, options, attachments } = req.body;

  if (!input && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ error: 'Conteúdo de entrada ou anexo obrigatório.' });
  }

  try {
    const ai = getGenAI();

    let toolPrompt = input;
    let systemInstruction = 'És uma ferramenta especializada da plataforma ZUNO AI.';

    switch (toolId) {
      case 'writer':
        systemInstruction = `És o ZUNO Writer, especialista premiado em redação, copywriting, e-mails executivos e criação de conteúdo.
Produz textos persuasivos, com estrutura impecável, tom ${options?.tone || 'profissional'} e formato ${options?.format || 'artigo'}.`;
        break;

      case 'study':
        systemInstruction = `És o ZUNO Study, tutor pedagógico internacional de topo.
Explica matérias complexas de forma cristalina, com exemplos intuitivos, analogias e exercícios práticos. Nível: ${options?.level || 'intermédio'}.`;
        break;

      case 'code':
        systemInstruction = `És o ZUNO Code, arquiteto de software sénior e especialista em engenharia de sistemas.
Fornece código limpo, moderno, robusto, com tipagem TypeScript/idiomática, tratamento de erros e explicação concisa.`;
        break;

      case 'translate':
        systemInstruction = `És o ZUNO Translate, mestre em linguística e tradução intercultural.
Traduz com fidelidade e naturalidade para o idioma destino (${options?.targetLang || 'Inglês'}). Explica nuances culturais e termos idiomáticos.`;
        break;

      case 'vision':
        systemInstruction = `És o ZUNO Vision, especialista em análise visual multimodal por IA.
Analisa detalhadamente as imagens enviadas: objetos, textos (OCR), diagramas, estética, erros de design ou qualquer pergunta feita pelo utilizador.`;
        break;

      case 'pdf':
        systemInstruction = `És o ZUNO PDF & Docs, analista especializado em documentos e relatórios extensos.
Sintetiza pontos-chave, extrai dados cruciais, identifica conclusões e responde com precisão milimétrica sobre o texto fornecido.`;
        break;

      case 'voice':
        systemInstruction = `És o ZUNO Voice, assistente de diálogo natural e conversação em tempo real.
Responde de forma concisa, fluida, humana e adequada para leitura em voz alta.`;
        break;

      case 'creative':
        systemInstruction = `És o ZUNO Creative, diretor de criação, storytelling e inovação.
Gera ideias originais, enredos envolventes, conceitos de campanhas memoráveis e títulos de alto impacto.`;
        break;

      case 'image':
        systemInstruction = `És o ZUNO Image Studio.
A tua função é criar descrições e prompts visuais ultra-detalhados para geração de imagens fotorealistas ou artísticas com estilos, iluminação cinematográfica, lente e paleta de cores. Nunca apresentes código TypeScript.`;
        break;

      default:
        systemInstruction = 'És o ZUNO AI, o teu assistente de inteligência artificial sem limites.';
    }

    const parts: any[] = [];

    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (att.dataUrl && att.dataUrl.includes('base64,')) {
          const [meta, base64Data] = att.dataUrl.split('base64,');
          const mimeMatch = meta.match(/data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }
      }
    }

    parts.push({ text: toolPrompt });

    const response = await safeGenerateContent(ai, activeModel || 'gemini-4-hydrogen', {
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction,
      },
    });

    const result = response.text || '';
    totalTokensEstimated += Math.ceil(result.length / 4);

    res.json({
      toolId,
      result,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    const parsed = extractCleanApiError(error, 'Falha ao processar ferramenta de IA.');
    logEvent(parsed.isQuotaOrRateLimit || parsed.isUnavailable ? 'warn' : 'error', `Erro na ferramenta ${toolId} (${parsed.code}): ${parsed.message}`, '/api/tools/execute');
    res.status(parsed.status).json({
      error: parsed.message,
    });
  }
});

// ----------------------------------------------------
// 5. ZUNO AI IMAGE - Generation & History (Authenticated Users Only)
// ----------------------------------------------------
app.post('/api/image/generate', async (req: Request, res: Response) => {
  totalApiRequests++;
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({
      error: authCtx.error || GUEST_RESTRICTION_MESSAGE,
      requiresAuth: true,
    });
  }

  const verifiedUser = authCtx.user;
  const userId = verifiedUser.id;
  const {
    prompt,
    style = 'realista',
    aspectRatio = '1:1',
    quality = 'hd',
    referenceImage,
    isEdit,
  } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt de descrição da imagem é obrigatório.' });
  }

  // Blocked user verification
  if (verifiedUser.status === 'blocked' || isUserBlocked(userId) || isUserBlocked(verifiedUser.email)) {
    return res.status(403).json({
      error: '⛔ A tua conta foi suspensa pelo administrador da ZUNO AI. Não é possível gerar imagens.',
      isBlocked: true,
    });
  }

  if (platformFeatures.maintenanceMode && verifiedUser.role !== 'admin') {
    return res.status(503).json({
      error: 'A plataforma encontra-se em manutenção programada neste momento.',
    });
  }

  if (!platformFeatures.imageGeneration && verifiedUser.role !== 'admin') {
    return res.status(403).json({
      error: '⚠️ A geração de imagens encontra-se temporariamente desativada pelo administrador.',
      featureDisabled: true,
    });
  }

  if (verifiedUser.features && verifiedUser.features.imageGeneration === false) {
    return res.status(403).json({
      error: '⚠️ A funcionalidade de geração de imagem não está liberada para a tua conta pelo administrador.',
      featureDisabled: true,
    });
  }

  // Quota check per verified server plan (free, premium, pro, ultra)
  const userPlan = verifiedUser.plan;
  const dailyLimit = imageLimitsPerPlan[userPlan] || imageLimitsPerPlan.free || 3;
  const currentCount = Math.max(getUserImageCount(userId), verifiedUser.imageCountToday || 0);

  if (currentCount >= dailyLimit && userPlan !== 'ultra') {
    return res.status(429).json({
      error: `Limite diário de imagens atingido para o plano ${userPlan.toUpperCase()} (${dailyLimit} imagens/dia). Atualiza para Premium, Pro ou Ultra para continuar gerando imagens.`,
      quotaExceeded: true,
      currentCount,
      dailyLimit,
    });
  }

  try {
    const imageRecord = await generateRealImageCore({
      prompt,
      style,
      aspectRatio,
      quality,
      userId,
      referenceImage,
      isEdit,
    });

    if (imageRecord) {
      saveUserImage(userId, imageRecord as any);
      incrementAccountUsage(userId, 'image');
      return res.json({
        success: true,
        image: imageRecord,
        dailyUsage: {
          count: getUserImageCount(userId),
          limit: dailyLimit,
          plan: userPlan,
        },
      });
    }

    return res.status(500).json({
      error: 'Não foi possível gerar a imagem no momento. Por favor tente novamente em instantes.',
    });
  } catch (err: any) {
    console.error('Image generation error:', err);
    logEvent('error', `Falha no ZUNO Image: ${err.message}`, '/api/image/generate');
    res.status(500).json({
      error: err.message || 'Erro inesperado ao gerar imagem.',
    });
  }
});

// Image delete endpoint (owner-isolated)
app.delete('/api/image/:id', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({ error: authCtx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const { id } = req.params;
  deleteUserImage(authCtx.user.id, id);
  const idx = serverImageGallery.findIndex((img) => img.id === id && img.userId === authCtx.user!.id);
  if (idx !== -1) {
    serverImageGallery.splice(idx, 1);
    logEvent('info', `Imagem eliminada: ${id}`, '/api/image/:id');
  }
  res.json({ success: true, message: 'Imagem removida da conta.' });
});

// Dedicated Related Topic Images search endpoint (Public informational search safe)
app.get('/api/images/related', async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  if (!query || query.trim().length < 2) {
    return res.json({ images: [] });
  }
  try {
    const images = await searchRelatedTopicImages(query);
    res.json({ images });
  } catch (err: any) {
    res.json({ images: [] });
  }
});

// Image history endpoint (strictly isolated per verified user UID)
app.get('/api/image/history', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({ error: authCtx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }
  const persisted = listUserImages(authCtx.user.id, 50);
  res.json({
    images: persisted,
    totalGenerated: persisted.length,
  });
});

// Admin Image Limits & Config
app.get('/api/admin/image-config', async (req: Request, res: Response) => {
  res.json({
    imageLimitsPerPlan,
    activeImageModel,
    totalImagesGenerated,
  });
});

app.post('/api/admin/image-config', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { limits, imageLimitsPerPlan: bodyLimits, model } = req.body;
  const targetLimits = limits || bodyLimits;
  if (targetLimits) {
    if (typeof targetLimits.free === 'number') imageLimitsPerPlan.free = targetLimits.free;
    if (typeof targetLimits.premium === 'number') imageLimitsPerPlan.premium = targetLimits.premium;
    if (typeof targetLimits.pro === 'number') imageLimitsPerPlan.pro = targetLimits.pro;
    if (typeof targetLimits.ultra === 'number') imageLimitsPerPlan.ultra = targetLimits.ultra;
    setPlatformSetting('imageLimitsPerPlan', imageLimitsPerPlan);
  }
  if (model) {
    activeImageModel = model;
    setPlatformSetting('activeImageModel', activeImageModel);
    logEvent('info', `Modelo de imagem alterado para: ${model}`, '/api/admin/image-config');
  }
  res.json({ success: true, imageLimitsPerPlan, activeImageModel });
});

// 6. Admin Panel Stats, Config, Security & Audit API
app.get('/api/admin/stats', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const dbAccounts = listManagedAccounts();
  const feedbackSummary = getFeedbackStats(false);
  const storedConvs = countAllStoredConversations();
  const storedImgs = countAllStoredImages();
  const memUsage = process.memoryUsage();
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recentErrorCount = errorTimestamps.filter((ts) => ts >= cutoff).length;
  const onlineNow = dbAccounts.filter(
    (u) => Date.now() - new Date(u.lastActive).getTime() < 15 * 60 * 1000
  ).length;

  res.json({
    totalUsers: dbAccounts.length,
    activeUsers: dbAccounts.filter((u) => u.status === 'active').length,
    blockedUsers: dbAccounts.filter((u) => u.status === 'blocked').length,
    onlineUsers: onlineNow,
    totalConversations: storedConvs,
    totalImages: Math.max(totalImagesGenerated, storedImgs),
    totalApiRequests,
    estimatedTokens: totalTokensEstimated,
    activeModel,
    activeImageModel,
    systemStatus: pingAuthDb() ? 'optimal' : 'degraded',
    databaseStatus: pingAuthDb() ? 'connected' : 'error',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    memoryRssMb: Math.round(memUsage.rss / (1024 * 1024)),
    errorCountLastHour: recentErrorCount,
    guestRateLimitCount: getGuestRateLimitCount(),
    feedbackSummary: {
      total: feedbackSummary.totalFeedbacks,
      likedCount: feedbackSummary.likedCount,
      dislikedCount: feedbackSummary.dislikedCount,
      approvalRate: feedbackSummary.approvalRate,
      averageRating: feedbackSummary.averageRating,
    },
    featuresEnabled: platformFeatures,
    announcement: platformAnnouncement,
    recentLogs: systemLogs,
  });
});

app.post('/api/admin/config', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { model, features, announcement } = req.body || {};
  if (model && typeof model === 'string') {
    activeModel = model.trim();
    setPlatformSetting('activeModel', activeModel);
    logEvent('info', `Modelo padrão do sistema alterado para: ${activeModel}`, '/api/admin/config');
  }
  if (features && typeof features === 'object') {
    platformFeatures = {
      ...platformFeatures,
      ...(typeof features.searchGrounding === 'boolean' ? { searchGrounding: features.searchGrounding } : {}),
      ...(typeof features.imageAnalysis === 'boolean' ? { imageAnalysis: features.imageAnalysis } : {}),
      ...(typeof features.voiceDictation === 'boolean' ? { voiceDictation: features.voiceDictation } : {}),
      ...(typeof features.imageGeneration === 'boolean' ? { imageGeneration: features.imageGeneration } : {}),
      ...(typeof features.publicSignupEnabled === 'boolean' ? { publicSignupEnabled: features.publicSignupEnabled } : {}),
      ...(typeof features.guestAccessEnabled === 'boolean' ? { guestAccessEnabled: features.guestAccessEnabled } : {}),
      ...(typeof features.maintenanceMode === 'boolean' ? { maintenanceMode: features.maintenanceMode } : {}),
    };
    setPlatformSetting('platformFeatures', platformFeatures);
    logEvent('info', `Configurações globais de módulos atualizadas pelo administrador.`, '/api/admin/config');
  }
  if (announcement && typeof announcement === 'object') {
    platformAnnouncement = {
      enabled: Boolean(announcement.enabled),
      text: String(announcement.text || '').trim().slice(0, 300),
      type: ['info', 'warning', 'success'].includes(announcement.type) ? announcement.type : 'info',
      updatedAt: Date.now(),
    };
    setPlatformSetting('platformAnnouncement', platformAnnouncement);
    logEvent(
      'info',
      `Comunicado global ${platformAnnouncement.enabled ? 'publicado' : 'desativado'} pelo administrador.`,
      '/api/admin/config'
    );
  }
  res.json({
    success: true,
    activeModel,
    featuresEnabled: platformFeatures,
    announcement: platformAnnouncement,
  });
});

// Admin Security, Active Sessions & Logs Management
app.get('/api/admin/security/sessions', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const sessions = listAllActiveSessionsForAdmin();
  res.json({ sessions, guestRateLimitCount: getGuestRateLimitCount() });
});

app.post('/api/admin/security/sessions/revoke', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { uid, deviceId } = req.body || {};
  if (!uid || !deviceId) {
    return res.status(400).json({ error: 'UID e ID do dispositivo são obrigatórios.' });
  }
  const revoked = revokeDeviceSession(String(uid), String(deviceId));
  logEvent('warn', `Sessão de dispositivo encerrada pelo admin (${uid})`, '/api/admin/security/sessions/revoke');
  res.json({ success: true, revoked, sessions: listAllActiveSessionsForAdmin() });
});

app.post('/api/admin/security/clear-rate-limits', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const cleared = clearGuestRateLimits();
  logEvent('info', `Limites de pedidos de visitantes limpos (${cleared} registos).`, '/api/admin/security/clear-rate-limits');
  res.json({ success: true, cleared });
});

app.post('/api/admin/logs/clear', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  systemLogs.length = 0;
  logEvent('info', 'Histórico de eventos limpo pelo administrador.', '/api/admin/logs/clear');
  res.json({ success: true, recentLogs: systemLogs });
});

// ----------------------------------------------------
// 6B. Custom Search Bar Codes (Admin Created & Public Execution)
// ----------------------------------------------------
app.get('/api/admin/search-codes', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  res.json({ codes: listSearchCodes() });
});

app.post('/api/admin/search-codes', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const authCtx = await resolveAuthContext(req);
  try {
    const record = upsertSearchCode({
      code: String(req.body?.code || ''),
      purpose: String(req.body?.purpose || ''),
      description: String(req.body?.description || ''),
      actionType: req.body?.actionType || 'message',
      targetPlan: req.body?.targetPlan,
      targetView: req.body?.targetView,
      targetToolId: req.body?.targetToolId,
      targetFeatures: req.body?.targetFeatures,
      responseText: String(req.body?.responseText || ''),
      maxUses: Number(req.body?.maxUses || 0),
      active: req.body?.active !== false,
      createdBy: authCtx.user?.email || 'Admin ZUNO AI',
    });
    logEvent(
      'info',
      `Código de pesquisa ${record.code} guardado (${record.actionType} · ${record.purpose}).`,
      '/api/admin/search-codes'
    );
    res.json({ success: true, code: record });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Dados inválidos para código de pesquisa.' });
  }
});

app.patch('/api/admin/search-codes/:code', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const active = Boolean(req.body?.active);
  const updated = setSearchCodeActive(req.params.code, active);
  if (!updated) {
    return res.status(404).json({ error: 'Código de pesquisa não encontrado.' });
  }
  logEvent(
    'info',
    `Código de pesquisa ${updated.code} ${active ? 'ativado' : 'pausado'} pelo administrador.`,
    '/api/admin/search-codes/:code'
  );
  res.json({ success: true, code: updated });
});

app.delete('/api/admin/search-codes/:code', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const removed = deleteSearchCode(req.params.code);
  if (!removed) {
    return res.status(404).json({ error: 'Código de pesquisa não encontrado.' });
  }
  logEvent('warn', `Código de pesquisa ${req.params.code} eliminado.`, '/api/admin/search-codes/:code');
  res.json({ success: true });
});

app.post('/api/search-codes/check', (req: Request, res: Response) => {
  const query = typeof req.body?.code === 'string' ? req.body.code : '';
  const result = checkSearchCodeMatch(query);
  res.json(result);
});

app.post('/api/search-codes/use', async (req: Request, res: Response) => {
  const query = typeof req.body?.code === 'string' ? req.body.code : '';
  const authCtx = await resolveAuthContext(req);
  const result = executeSearchCode(query, authCtx.authenticated && authCtx.user ? authCtx.user.id : null);
  if (result.matched && result.executed) {
    logEvent(
      'info',
      `Código de pesquisa ${result.code} utilizado (${result.actionType}).`,
      '/api/search-codes/use'
    );
  }
  if (result.requiresAuth) {
    return res.status(401).json(result);
  }
  if (result.matched && !result.executed && result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

// ----------------------------------------------------
// 7. Admin User Management & Access Control Endpoints
// ----------------------------------------------------

// List all users with status and activity (Admin only)
app.get('/api/admin/users', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const dbAccounts = listManagedAccounts();
  const merged = [...dbAccounts];
  for (const legacy of managedUsersStore) {
    if (!merged.some((u) => u.email.toLowerCase() === legacy.email.toLowerCase())) {
      merged.push(legacy);
    }
  }
  const now = Date.now();
  const onlineCount = merged.filter(
    (u) => now - new Date(u.lastActive).getTime() < 15 * 60 * 1000
  ).length;

  res.json({
    users: merged,
    totalUsers: merged.length,
    activeUsers: merged.filter((u) => u.status === 'active').length,
    blockedUsers: merged.filter((u) => u.status === 'blocked').length,
    totalOnline: onlineCount,
  });
});

// Update user details
app.post('/api/admin/users/update', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId, updates } = req.body;
  let dbUpdated = updates?.plan ? setAccountPlan(userId, updates.plan) : getAccountByUid(userId);
  if (updates?.role) {
    dbUpdated = setAccountRole(userId, updates.role) || dbUpdated;
  }
  if (updates?.features) {
    dbUpdated = setAccountFeatures(userId, updates.features) || dbUpdated;
  }
  const user = findManagedUser(userId);
  if (!user && !dbUpdated) return res.status(404).json({ error: 'Utilizador não encontrado.' });

  if (user && updates) {
    if (updates.name) user.name = updates.name;
    if (updates.email) user.email = updates.email;
    if (updates.plan) user.plan = updates.plan;
    if (updates.status) user.status = updates.status;
    if (updates.role) user.role = updates.role;
    if (updates.notes !== undefined) user.notes = updates.notes;
    if (updates.features) {
      user.features = { ...user.features, ...updates.features };
    }
  }

  logEvent('info', `Utilizador atualizado pelo administrador: ${userId}`, '/api/admin/users/update');
  res.json({ success: true, user: dbUpdated || user });
});

// Block or unblock a user
app.post('/api/admin/users/block', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId, blocked, reason } = req.body;
  const dbUpdated = setAccountBlocked(userId, Boolean(blocked), reason);
  const user = findManagedUser(userId);
  if (!user && !dbUpdated) return res.status(404).json({ error: 'Utilizador não encontrado.' });

  if (user) {
    user.status = blocked ? 'blocked' : 'active';
    if (reason) {
      user.notes = (user.notes ? user.notes + ' | ' : '') + `Bloqueio: ${reason}`;
    }
  }

  logEvent(
    'warn',
    `Utilizador ${userId} foi ${blocked ? 'BLOQUEADO' : 'DESBLOQUEADO'} pelo administrador.`,
    '/api/admin/users/block'
  );
  res.json({ success: true, user: dbUpdated || user });
});

// Liberate / upgrade user plan
app.post('/api/admin/users/plan', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId, plan } = req.body;
  const validPlans = ['free', 'premium', 'pro', 'ultra'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  const dbUpdated = setAccountPlan(userId, plan as PlanType);
  const user = findManagedUser(userId);
  if (!user && !dbUpdated) return res.status(404).json({ error: 'Utilizador não encontrado.' });

  if (user) {
    user.plan = plan;
    user.features = {
      ...user.features,
      ...defaultFeaturesForPlan(plan),
    };
  }

  logEvent(
    'info',
    `Plano do utilizador ${userId} liberado para ${plan.toUpperCase()} pelo administrador.`,
    '/api/admin/users/plan'
  );
  res.json({ success: true, user: dbUpdated || user });
});

// Liberate / customize specific features for a user (persisted in SQLite)
app.post('/api/admin/users/features', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId, features } = req.body;
  const dbUpdated = features && typeof features === 'object' ? setAccountFeatures(userId, features) : getAccountByUid(userId);
  const user = findManagedUser(userId);
  if (!user && !dbUpdated) return res.status(404).json({ error: 'Utilizador não encontrado.' });

  if (user && features && typeof features === 'object') {
    user.features = {
      ...user.features,
      ...features,
    };
  }

  logEvent('info', `Permissões e funções atualizadas para ${userId}.`, '/api/admin/users/features');
  res.json({ success: true, user: dbUpdated || user });
});

// Change user role (user <-> admin)
app.post('/api/admin/users/role', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId, role } = req.body || {};
  const targetRole = role === 'admin' ? 'admin' : 'user';
  const dbUpdated = setAccountRole(String(userId || ''), targetRole);
  const user = findManagedUser(String(userId || ''));
  if (!dbUpdated && !user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
  if (user && !isFounderAdminEmail(user.email)) {
    user.role = targetRole;
  }
  logEvent('warn', `Função do utilizador ${userId} alterada para ${targetRole.toUpperCase()}.`, '/api/admin/users/role');
  res.json({ success: true, user: dbUpdated || user });
});

// Reset daily usage quota for a user
app.post('/api/admin/users/reset-quota', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { userId } = req.body || {};
  const dbUpdated = resetAccountDailyQuota(String(userId || ''));
  const user = findManagedUser(String(userId || ''));
  if (!dbUpdated && !user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
  if (user) {
    user.messageCount = 0;
    user.imageCount = 0;
  }
  logEvent('info', `Quota diária reposta a zeros para ${userId}.`, '/api/admin/users/reset-quota');
  res.json({ success: true, user: dbUpdated || user });
});

// Create / pre-provision a user directly in SQLite & admin directory
app.post('/api/admin/users/create', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const { name, email, plan = 'free', role = 'user', notes, features } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Nome e E-mail são obrigatórios.' });
  }

  const existingDb = getAccountByEmail(email);
  const existingLegacy = findManagedUser(email);
  if (existingDb || existingLegacy) {
    return res.status(400).json({ error: 'Já existe um utilizador registado com este e-mail.' });
  }

  const createdUser = createOrProvisionAccount({
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    plan,
    role: role === 'admin' ? 'admin' : 'user',
    notes,
    features,
  });

  logEvent('info', `Novo utilizador registado pelo administrador: ${name} (${email}) - Plano: ${String(plan).toUpperCase()}`, '/api/admin/users/create');
  res.json({ success: true, user: createdUser });
});

// Delete user from directory
app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const id = req.params.id;
  const targetAccount = getAccountByUid(id) || getAccountByEmail(id);
  if (targetAccount && isFounderAdminEmail(targetAccount.email)) {
    return res.status(403).json({ error: 'Não é possível eliminar a conta principal do fundador.' });
  }
  const dbDeleted = deleteAccountDataByUid(id);
  const idx = managedUsersStore.findIndex(
    (u) => u.id === id || u.email.toLowerCase() === id.toLowerCase()
  );
  if (idx === -1 && !dbDeleted) return res.status(404).json({ error: 'Utilizador não encontrado.' });

  if (idx !== -1) {
    const removed = managedUsersStore.splice(idx, 1)[0];
    logEvent('warn', `Utilizador ${removed.name} (${removed.email}) removido pelo administrador.`, '/api/admin/users/delete');
  } else {
    logEvent('warn', `Utilizador ${id} removido pelo administrador.`, '/api/admin/users/delete');
  }
  res.json({ success: true, message: 'Utilizador removido com sucesso.' });
});

// User activity sync (Requires verified Bearer token — rejects forged identity or revoked devices)
app.post('/api/users/sync', async (req: Request, res: Response) => {
  const ctx = await resolveAuthContext(req);
  if (!ctx.authenticated || !ctx.user) {
    return res.status(401).json({ error: ctx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }

  if (ctx.deviceId) {
    upsertDeviceSession(ctx.user.id, ctx.deviceId, {
      userAgent: String(req.headers['user-agent'] || ''),
      ip: req.ip,
    });
  }

  res.json({
    success: true,
    user: ctx.user,
    isBlocked: ctx.user.status === 'blocked',
    status: ctx.user.status,
    plan: ctx.user.plan,
    features: ctx.user.features || dbDefaultFeaturesForPlan(ctx.user.plan),
  });
});

// ----------------------------------------------------
// 8. FEEDBACK, RATINGS, REPLIES & NOTIFICATIONS API
// ----------------------------------------------------
function getRequesterIdentity(req: Request) {
  const userId = String(req.headers['x-user-id'] || req.body?.userId || req.query?.userId || '').trim();
  const userEmail = String(req.headers['x-user-email'] || req.body?.userEmail || req.query?.userEmail || '')
    .trim()
    .toLowerCase();
  return { userId, userEmail };
}

async function isVerifiedAdminRequestAsync(req: Request): Promise<boolean> {
  const ctx = await resolveAuthContext(req);
  if (ctx.authenticated && ctx.user) {
    if (isFounderAdminEmail(ctx.user.email) && ctx.emailVerified) return true;
    if (ctx.user.role === 'admin' && ctx.user.status === 'active') return true;
    return false;
  }
  return false;
}

function isVerifiedAdminRequest(req: Request): boolean {
  // Legacy synchronous signature retained only if no token; reject spoofing unless resolved via async middleware
  return false;
}

// Public / user feedback listing (strictly filters out private & hidden items unless viewer is verified owner)
app.get('/api/feedback', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  const viewerUid = authCtx.authenticated && authCtx.user ? authCtx.user.id : '';
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;
  const likedFilter = (req.query.likedFilter as any) || 'all';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const feedbackType = typeof req.query.feedbackType === 'string' ? req.query.feedbackType : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const dateFilter = (req.query.dateFilter as any) || 'all';
  const onlyMine = req.query.onlyMine === 'true';

  const items = listFeedbacks({
    viewerUserId: viewerUid,
    isAdminViewer: false,
    category,
    rating,
    likedFilter,
    status,
    feedbackType,
    search,
    dateFilter,
    onlyMine,
  });

  const stats = getFeedbackStats(true);
  res.json({ items, stats });
});

app.get('/api/feedback/stats', (req: Request, res: Response) => {
  res.json(getFeedbackStats(true));
});

app.post('/api/feedback', async (req: Request, res: Response) => {
  const hasAuthHeader = Boolean(extractBearerToken(req));
  const authCtx = await resolveAuthContext(req);
  if (hasAuthHeader && !authCtx.authenticated) {
    return res.status(401).json({ error: authCtx.error || GUEST_RESTRICTION_MESSAGE, requiresAuth: true });
  }

  const requesterId = authCtx.user?.id || 'guest_' + (req.ip || 'anon');
  const userEmail = authCtx.user?.email || '';

  if (authCtx.user?.status === 'blocked' || isUserBlocked(requesterId) || isUserBlocked(userEmail)) {
    return res.status(403).json({ error: 'Conta bloqueada. Não é possível enviar feedback.' });
  }

  const {
    authorName,
    isAnonymous,
    rating,
    likedApp,
    improvementArea,
    category,
    feedbackType,
    title,
    comment,
    likedMost,
    improvementSuggestion,
    deviceInfo,
    isPublic,
  } = req.body;

  const effectiveComment = String(comment || improvementSuggestion || likedMost || '').trim();
  const spamCheck = checkSpamAndAbuse(requesterId, effectiveComment, String(title || ''));
  if (!spamCheck.allowed) {
    return res.status(400).json({ error: spamCheck.reason || 'Comentário rejeitado pela proteção anti-spam.' });
  }

  const created = createFeedback({
    userId: requesterId,
    authorName: authorName || authCtx.user?.name || 'Utilizador ZUNO',
    authorEmail: userEmail,
    isAnonymous: Boolean(isAnonymous),
    rating: Number(rating) || (likedApp === false ? 2 : 5),
    likedApp: typeof likedApp === 'boolean' ? likedApp : null,
    improvementArea: typeof improvementArea === 'string' ? improvementArea : undefined,
    category,
    feedbackType,
    title,
    comment: effectiveComment,
    likedMost,
    improvementSuggestion,
    deviceInfo,
    isPublic: isPublic !== false,
  });

  const reactionTag = created.likedApp === true ? '👍 Gostou' : created.likedApp === false ? '👎 Não gostou' : `${created.rating}★`;
  logEvent('info', `Novo comentário recebido (${reactionTag} · ${created.category})`, '/api/feedback');
  res.status(201).json({ success: true, item: created });
});

app.put('/api/feedback/:id', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({ error: authCtx.error || 'Identificação necessária para editar feedback.' });
  }

  const result = updateOwnFeedback(req.params.id, authCtx.user.id, req.body || {});
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }
  res.json({ success: true, item: result.item });
});

app.delete('/api/feedback/:id', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  const isAdmin = await isVerifiedAdminRequestAsync(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({ error: authCtx.error || 'Identificação necessária para eliminar feedback.' });
  }

  const result = deleteFeedback(req.params.id, authCtx.user.id, isAdmin);
  if (!result.success) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }
  res.json({ success: true });
});

// User thread reply (STRICTLY blocks impersonation of official ZUNO AI team)
app.post('/api/feedback/:id/replies', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) {
    return res.status(401).json({ error: authCtx.error || 'Inicia sessão para responder na conversa.' });
  }
  if (authCtx.user.status === 'blocked') {
    return res.status(403).json({ error: 'Conta bloqueada.' });
  }

  // Strictly reject or strip any client attempt to spoof official team status!
  const { content, authorName } = req.body || {};
  const result = addFeedbackReply({
    feedbackId: req.params.id,
    userId: authCtx.user.id,
    authorName: authorName || authCtx.user.name || 'Utilizador ZUNO',
    isOfficialVerifiedAdmin: false, // NEVER true on user reply endpoint!
    content: String(content || ''),
  });

  if (!result.success) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }
  res.status(201).json({ success: true, reply: result.reply });
});

// Report inappropriate public comment
app.post('/api/feedback/:id/report', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  const reporterId = authCtx.user?.id || 'anon_' + (req.ip || 'web');
  const { reason, details } = req.body || {};

  const result = reportFeedback({
    feedbackId: req.params.id,
    reporterUserId: reporterId,
    reason: String(reason || 'Conteúdo inadequado'),
    details: String(details || ''),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  logEvent('warn', `Denúncia recebida no feedback ${req.params.id}`, '/api/feedback/:id/report');
  res.json({ success: true });
});

// Notifications for user feedback replies & status changes
app.get('/api/notifications', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) return res.json({ notifications: [], unreadCount: 0 });
  res.json(getUserNotifications(authCtx.user.id));
});

app.post('/api/notifications/read', async (req: Request, res: Response) => {
  const authCtx = await resolveAuthContext(req);
  if (!authCtx.authenticated || !authCtx.user) return res.json({ success: true, notifications: [], unreadCount: 0 });
  const { notificationId, markAll } = req.body || {};
  if (markAll) {
    markAllNotificationsRead(authCtx.user.id);
  } else if (notificationId) {
    markNotificationRead(String(notificationId), authCtx.user.id);
  }
  res.json({ success: true, ...getUserNotifications(authCtx.user.id) });
});

// ----------------------------------------------------
// ADMIN FEEDBACK MANAGEMENT & ANALYTICS ENDPOINTS
// ----------------------------------------------------
app.get('/api/admin/feedback', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const authCtx = await resolveAuthContext(req);
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  const rating = req.query.rating ? Number(req.query.rating) : undefined;
  const likedFilter = (req.query.likedFilter as any) || 'all';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const feedbackType = typeof req.query.feedbackType === 'string' ? req.query.feedbackType : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const dateFilter = (req.query.dateFilter as any) || 'all';
  const visibilityFilter = (req.query.visibilityFilter as any) || 'all';

  const items = listFeedbacks({
    viewerUserId: authCtx.user?.id || '',
    isAdminViewer: true,
    category,
    rating,
    likedFilter,
    status,
    feedbackType,
    search,
    dateFilter,
    visibilityFilter,
  });

  const stats = getFeedbackStats(false);
  const reports = listReportsForAdmin();
  const auditHistory = listAuditHistory();

  res.json({ items, stats, reports, auditHistory });
});

app.post('/api/admin/feedback/:id/reply', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Apenas o fundador/equipa oficial pode publicar respostas oficiais.' });
  }
  const authCtx = await resolveAuthContext(req);
  const adminUid = authCtx.user?.id || 'admin_founder';
  const { content, updateStatus } = req.body || {};

  const result = addFeedbackReply({
    feedbackId: req.params.id,
    userId: adminUid,
    authorName: 'Equipa ZUNO AI',
    isOfficialVerifiedAdmin: true,
    content: String(content || ''),
    updateStatus,
  });

  if (!result.success) {
    return res.status(result.statusCode || 400).json({ error: result.error });
  }

  const updatedFeedback = getFeedbackById(req.params.id, adminUid, true);
  logEvent('info', `Resposta oficial publicada para feedback ${req.params.id}`, '/api/admin/feedback/:id/reply');
  res.status(201).json({ success: true, reply: result.reply, feedback: updatedFeedback });
});

app.put('/api/admin/feedback/reply/:replyId', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  const { content, adminName } = req.body || {};
  const result = editReplyByAdmin({
    replyId: req.params.replyId,
    adminName: adminName || 'Fundador ZUNO AI',
    newContent: String(content || ''),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  logEvent('info', `Resposta oficial editada (${req.params.replyId})`, '/api/admin/feedback/reply');
  res.json({ success: true, reply: result.reply });
});

app.delete('/api/admin/feedback/reply/:replyId', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  const result = deleteReplyByAdmin({
    replyId: req.params.replyId,
    adminName: 'Fundador ZUNO AI',
  });

  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  logEvent('warn', `Resposta oficial eliminada (${req.params.replyId})`, '/api/admin/feedback/reply');
  res.json({ success: true });
});

app.patch('/api/admin/feedback/:id/status', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  const { status, adminName } = req.body || {};
  const result = updateFeedbackStatusByAdmin({
    feedbackId: req.params.id,
    status,
    adminName: adminName || 'Fundador ZUNO AI',
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  logEvent('info', `Estado do feedback ${req.params.id} alterado para ${status}`, '/api/admin/feedback/:id/status');
  res.json({ success: true, item: result.item });
});

app.patch('/api/admin/feedback/:id/moderate', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  const { isHidden, adminName } = req.body || {};
  const result = moderateFeedbackByAdmin({
    feedbackId: req.params.id,
    isHidden: Boolean(isHidden),
    adminName: adminName || 'Fundador ZUNO AI',
  });

  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }
  res.json({ success: true });
});

app.get('/api/admin/feedback/export', async (req: Request, res: Response) => {
  if (!(await isVerifiedAdminRequestAsync(req))) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  const authCtx = await resolveAuthContext(req);
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const items = listFeedbacks({
    viewerUserId: authCtx.user?.id || '',
    isAdminViewer: true,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    rating: req.query.rating ? Number(req.query.rating) : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    dateFilter: (req.query.dateFilter as any) || 'all',
  });

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="zuno-feedback-report.json"');
    return res.send(JSON.stringify({ exportedAt: new Date().toISOString(), total: items.length, items }, null, 2));
  }

  const escapeCsv = (val: unknown) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'ID',
    'Data',
    'Utilizador',
    'Gostou da App',
    'Classificação',
    'Área a Melhorar',
    'Categoria',
    'Tipo',
    'Estado',
    'Visibilidade',
    'Título',
    'Comentário',
    'O que gostou',
    'Sugestão de melhoria',
    'Dispositivo',
    'Denúncias',
    'Respostas Oficiais',
  ];

  const csvRows = [
    headers.map(escapeCsv).join(','),
    ...items.map((item) =>
      [
        item.id,
        new Date(item.createdAt).toISOString(),
        item.authorDisplayName,
        item.likedApp === true ? 'Sim (Gostou)' : item.likedApp === false ? 'Não gostou' : 'Neutro',
        item.rating,
        item.improvementArea || '',
        item.category,
        item.feedbackType,
        item.status,
        item.isPublic ? 'Público' : 'Privado',
        item.title,
        item.comment,
        item.likedMost || '',
        item.improvementSuggestion || '',
        item.deviceInfo || '',
        item.reportCount,
        item.replies
          .filter((r) => r.isOfficial)
          .map((r) => r.content)
          .join(' | '),
      ]
        .map(escapeCsv)
        .join(',')
    ),
  ];

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="zuno-feedback-report.csv"');
  res.send('\uFEFF' + csvRows.join('\n'));
});

// ----------------------------------------------------
// INTERNATIONAL SEO: robots.txt & sitemap.xml
// ----------------------------------------------------
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain');
  res.send(
    `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nSitemap: ${PUBLIC_APP_URL}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const routes = [
    '/',
    '/chat',
    '/tools',
    '/image',
    '/pricing',
    '/feedback',
    '/criar-conta',
    '/iniciar-sessao',
  ];
  const langs = ['pt', 'en', 'es', 'fr'];
  const urlsXml = routes
    .map((route) => {
      const loc = `${PUBLIC_APP_URL}${route}`;
      const alternates = langs
        .map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l}" href="${loc}" />`
        )
        .join('\n');
      return `  <url>\n    <loc>${loc}</loc>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />\n${alternates}\n    <changefreq>daily</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n  </url>`;
    })
    .join('\n');
  res.type('application/xml');
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlsXml}\n</urlset>`
  );
});

// ----------------------------------------------------
// SERVER & VITE INTEGRATION
// ----------------------------------------------------
async function startServer() {
  // Return clean JSON 404 for unknown API routes before SPA fallback
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint não encontrado na API ZUNO AI.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`>>> ZUNO AI Full-Stack Server running on http://0.0.0.0:${PORT}`);
    // Pre-warm DNS + TLS sockets to Gemini & Wikipedia without consuming any API quota
    setTimeout(() => {
      fetch('https://generativelanguage.googleapis.com', { method: 'HEAD', signal: AbortSignal.timeout(2500) }).catch(() => {});
      fetch('https://pt.wikipedia.org', { method: 'HEAD', signal: AbortSignal.timeout(2500) }).catch(() => {});
    }, 300);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ZUNO AI server:', err);
});
