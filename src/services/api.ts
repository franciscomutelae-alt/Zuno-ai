import {
  ChatAttachment,
  AdminStats,
  GeneratedImage,
  ManagedUser,
  UserFeatures,
  PlanType,
  RelatedTopicImage,
  FeedbackItem,
  FeedbackStats,
  FeedbackStatus,
  FeedbackCategoryId,
  FeedbackType,
  FeedbackReply,
  FeedbackAuditEntry,
  FeedbackReport,
  UserNotification,
  UserProfile,
  Conversation,
  VipCodeRecord,
  FavoriteItem,
  DeviceSessionInfo,
  PlatformAnnouncement,
  PlatformFeatureFlags,
  SearchBarCodeActionType,
  SearchBarCodeRecord,
  SearchCodeExecutionResult,
  ToolId,
  GUEST_RESTRICTION_MESSAGE,
} from '../types';
import { auth } from '../firebase';
import {
  cacheOfflineSearchCodes,
  upsertOfflineSearchCode,
  checkOfflineSearchCode,
  executeOfflineSearchCode,
  getCreatorOfflineModePref,
  loadCreatorOfflineVault,
} from './offlineCreator';

function shouldBypassNetworkForCreatorOffline(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return getCreatorOfflineModePref() && Boolean(loadCreatorOfflineVault());
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 2000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

export class AuthRequiredError extends Error {
  requiresAuth = true;
  status: number;
  constructor(message = GUEST_RESTRICTION_MESSAGE, status = 401) {
    super(message);
    this.name = 'AuthRequiredError';
    this.status = status;
  }
}

export function isAuthRequiredError(err: any): boolean {
  return Boolean(err && (err instanceof AuthRequiredError || err.requiresAuth === true));
}

export async function getFirebaseToken(forceRefresh = false): Promise<string | null> {
  try {
    const current = auth.currentUser;
    if (!current) return null;
    return await current.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

const DEVICE_ID_STORAGE_KEY = 'zuno_device_id';

function generateDeviceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'dev_' + crypto.randomUUID();
    }
  } catch {}
  return 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!existing) {
      existing = generateDeviceId();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return generateDeviceId();
  }
}

export function rotateDeviceId(): string {
  const next = generateDeviceId();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
    } catch {}
  }
  return next;
}

export async function getAuthHeaders(
  extra: Record<string, string> = {},
  forceRefresh = false
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'X-Device-Id': getDeviceId(),
    ...extra,
  };
  const token = await getFirebaseToken(forceRefresh);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ----------------------------------------------------
// Auth & Account Session Verification Endpoints
// ----------------------------------------------------
export interface BackendSessionResponse {
  authenticated: boolean;
  serverVerified?: boolean;
  isBlocked?: boolean;
  emailVerified?: boolean;
  providerId?: string;
  user?: UserProfile;
  error?: string;
  revokedRemotely?: boolean;
}

export async function verifyBackendSession(forceRefresh = false): Promise<BackendSessionResponse> {
  const token = await getFirebaseToken(forceRefresh);
  if (!token) {
    return { authenticated: false, error: 'Sessão não iniciada.' };
  }
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Device-Id': getDeviceId(),
    },
  });
  const data = await response.json().catch(() => ({ authenticated: false }));
  if (!response.ok && response.status !== 403) {
    return {
      authenticated: false,
      revokedRemotely: response.status === 401,
      error: data.error || 'Sessão inválida ou expirada.',
    };
  }
  return data;
}

export async function logoutBackendSession(): Promise<void> {
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers['Authorization']) return;
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers,
    });
  } catch {
    // best-effort server revocation
  }
}

export async function fetchDeviceSessionsApi(): Promise<DeviceSessionInfo[]> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) return [];
  const response = await fetch('/api/auth/sessions', { headers });
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function revokeOtherSessionsApi(): Promise<{ revokedCount: number; sessions: DeviceSessionInfo[] }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) throw new AuthRequiredError();
  const response = await fetch('/api/auth/sessions/revoke-others', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível encerrar as sessões nos outros dispositivos.');
  }
  return {
    revokedCount: Number(data.revokedCount || 0),
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
  };
}

export async function revokeSingleSessionApi(deviceId: string): Promise<DeviceSessionInfo[]> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) throw new AuthRequiredError();
  const response = await fetch(`/api/auth/sessions/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível terminar a sessão do dispositivo.');
  }
  return Array.isArray(data.sessions) ? data.sessions : [];
}

export async function updateBackendProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/auth/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new AuthRequiredError(data.error || GUEST_RESTRICTION_MESSAGE, 401);
  }
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar perfil.');
  }
  return data.user || null;
}

export async function deleteBackendAccount(): Promise<boolean> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/auth/account', {
    method: 'DELETE',
    headers,
  });
  if (response.status === 401) {
    throw new AuthRequiredError();
  }
  return response.ok;
}

// ----------------------------------------------------
// Isolated Account Conversations Endpoints
// ----------------------------------------------------
export async function fetchAccountConversations(): Promise<Conversation[]> {
  if (shouldBypassNetworkForCreatorOffline()) return [];
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) return [];
  const response = await fetchWithTimeout('/api/conversations', { headers }, 4000).catch(() => null);
  if (!response || response.status === 401 || !response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.conversations) ? data.conversations : [];
}

export async function saveAccountConversation(conv: Conversation): Promise<void> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) return;
  await fetch(`/api/conversations/${encodeURIComponent(conv.id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(conv),
  }).catch(() => {});
}

export async function deleteAccountConversation(convId: string): Promise<void> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) return;
  await fetch(`/api/conversations/${encodeURIComponent(convId)}`, {
    method: 'DELETE',
    headers,
  }).catch(() => {});
}

// ----------------------------------------------------
// Isolated Account Saved Favorites Sync Endpoints
// ----------------------------------------------------
export async function fetchFavoritesApi(): Promise<FavoriteItem[]> {
  if (shouldBypassNetworkForCreatorOffline()) return [];
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) return [];
  const response = await fetchWithTimeout('/api/favorites', { headers }, 4000).catch(() => null);
  if (!response || !response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.favorites) ? data.favorites : [];
}

export async function saveFavoriteApi(
  payload: Omit<FavoriteItem, 'uid' | 'createdAt'>
): Promise<FavoriteItem | null> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    throw new AuthRequiredError(data.error || GUEST_RESTRICTION_MESSAGE, 401);
  }
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao guardar favorito.');
  }
  return data.favorite || null;
}

export async function deleteFavoriteApi(id: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) throw new AuthRequiredError();
  const response = await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  return response.ok;
}

export function reportClientErrorApi(payload: {
  message: string;
  source?: string;
  path?: string;
  device?: string;
}): void {
  try {
    fetch('/api/monitoring/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

// ----------------------------------------------------
// Pricing & VIP Code Endpoints (Authenticated Only)
// ----------------------------------------------------
export async function selectPlanApi(plan: PlanType): Promise<{ success: boolean; user?: UserProfile }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/pricing/select', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plan }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || data.requiresAuth) {
    throw new AuthRequiredError(data.error || GUEST_RESTRICTION_MESSAGE, response.status);
  }
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar plano.');
  }
  return data;
}

export async function redeemVipCodeApi(
  code: string
): Promise<{ success: boolean; plan?: PlanType; user?: UserProfile }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/vip/redeem', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || data.requiresAuth) {
    throw new AuthRequiredError(data.error || GUEST_RESTRICTION_MESSAGE, response.status);
  }
  if (!response.ok) {
    throw new Error(data.error || 'Código VIP inválido.');
  }
  return data;
}

export async function fetchVipCodesAdmin(): Promise<{ codes: VipCodeRecord[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/vip/codes', { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao carregar códigos VIP.');
  }
  return { codes: Array.isArray(data.codes) ? data.codes : [] };
}

export async function createVipCodeAdmin(payload: {
  code?: string;
  plan: PlanType;
  maxUses: number;
}): Promise<{ success: boolean; code: VipCodeRecord }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/vip/codes', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao criar código VIP.');
  }
  return data;
}

export async function toggleVipCodeActiveAdmin(
  code: string,
  active: boolean
): Promise<{ success: boolean; code?: VipCodeRecord }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/admin/vip/codes/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar estado do código VIP.');
  }
  return data;
}

export async function deleteVipCodeAdmin(code: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/admin/vip/codes/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao eliminar código VIP.');
  }
  return true;
}

// ----------------------------------------------------
// Custom Search Bar Codes (Admin + Public Execution)
// ----------------------------------------------------
export async function fetchSearchCodesAdmin(): Promise<{ codes: SearchBarCodeRecord[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/search-codes', { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao carregar códigos da barra de pesquisa.');
  }
  const codes = Array.isArray(data.codes) ? data.codes : [];
  cacheOfflineSearchCodes(codes);
  return { codes };
}

export async function saveSearchCodeAdmin(payload: {
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
}): Promise<{ success: boolean; code: SearchBarCodeRecord }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/search-codes', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao guardar código da barra de pesquisa.');
  }
  if (data.code) {
    upsertOfflineSearchCode(data.code);
  }
  return data;
}

export async function toggleSearchCodeActiveAdmin(
  code: string,
  active: boolean
): Promise<{ success: boolean; code?: SearchBarCodeRecord }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/admin/search-codes/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar estado do código.');
  }
  if (data.code) {
    upsertOfflineSearchCode(data.code);
  }
  return data;
}

export async function deleteSearchCodeAdmin(code: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/admin/search-codes/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao eliminar código.');
  }
  return true;
}

export async function checkSearchCodeApi(code: string): Promise<{
  matched: boolean;
  code?: string;
  purpose?: string;
  actionType?: SearchBarCodeActionType;
}> {
  const trimmed = String(code || '').trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2) {
    return { matched: false };
  }
  if (shouldBypassNetworkForCreatorOffline()) {
    return checkOfflineSearchCode(trimmed);
  }
  try {
    const response = await fetchWithTimeout(
      '/api/search-codes/check',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      },
      1500
    );
    if (!response.ok) return checkOfflineSearchCode(trimmed);
    return await response.json();
  } catch {
    return checkOfflineSearchCode(trimmed);
  }
}

export async function executeSearchCodeApi(code: string): Promise<SearchCodeExecutionResult> {
  const trimmed = String(code || '').trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2) {
    return { matched: false, executed: false };
  }
  if (shouldBypassNetworkForCreatorOffline()) {
    return executeOfflineSearchCode(trimmed);
  }
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    const response = await fetchWithTimeout(
      '/api/search-codes/use',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ code: trimmed }),
      },
      1800
    );
    const data = await response.json().catch(() => ({ matched: false, executed: false }));
    return data as SearchCodeExecutionResult;
  } catch {
    return executeOfflineSearchCode(trimmed);
  }
}

export interface PlatformStatusResponse {
  activeModel: string;
  activeImageModel: string;
  featuresEnabled: PlatformFeatureFlags;
  announcement: PlatformAnnouncement;
  publicUrl: string;
  brand: string;
}

export async function fetchPlatformStatusApi(): Promise<PlatformStatusResponse | null> {
  try {
    const response = await fetch('/api/platform/status');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Chat Streaming (Supports Guest Public Search + Auth)
// ----------------------------------------------------
export interface StreamChatOptions {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachments?: ChatAttachment[];
  }>;
  systemInstruction?: string;
  model?: string;
  attachments?: ChatAttachment[];
  userId?: string;
  userEmail?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onRelatedImages?: (images: RelatedTopicImage[]) => void;
  onDone: () => void;
  onError: (error: string, requiresAuth?: boolean) => void;
}

export async function streamChat({
  messages,
  systemInstruction,
  model,
  attachments,
  userId,
  userEmail,
  signal,
  onChunk,
  onRelatedImages,
  onDone,
  onError,
}: StreamChatOptions): Promise<void> {
  const maxRetries = 2;
  let attempt = 0;
  let receivedChunks = 0;

  while (attempt <= maxRetries) {
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          systemInstruction,
          model,
          attachments,
          userId,
          userEmail,
        }),
        signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(async () => {
          const text = await response.text().catch(() => '');
          return { error: text || 'Falha na resposta do servidor' };
        });

        if (response.status === 401 || errJson.requiresAuth) {
          onError(errJson.error || GUEST_RESTRICTION_MESSAGE, true);
          return;
        }
        if (response.status === 429) {
          onError(errJson.error || 'Limite atingido.', Boolean(errJson.requiresAuth));
          return;
        }

        throw new Error(`Erro ${response.status}: ${errJson.error || 'Falha na resposta do servidor'}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming não suportado pelo navegador.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.error) {
                const errStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                if (
                  (errStr.includes('503') || errStr.includes('high demand') || errStr.includes('UNAVAILABLE')) &&
                  receivedChunks === 0 &&
                  attempt < maxRetries
                ) {
                  throw new Error(`503_SPIKE: ${errStr}`);
                }
                onError(typeof data.error === 'string' ? data.error : data.text || 'Erro na resposta.', false);
                return;
              } else if (data.text) {
                receivedChunks++;
                onChunk(data.text);
              } else if (data.relatedImages && onRelatedImages) {
                onRelatedImages(data.relatedImages);
              } else if (data.done) {
                onDone();
                return;
              }
            } catch (e: any) {
              if (e?.message?.startsWith('503_SPIKE')) {
                throw e;
              }
            }
          }
        }
      }

      onDone();
      return;
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        onDone();
        return;
      }

      if (receivedChunks === 0 && attempt < maxRetries) {
        attempt++;
        const backoffMs = attempt * 750;
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }

      let userFriendlyMsg = err.message || 'Erro de conexão com o ZUNO AI.';
      if (userFriendlyMsg.includes('503') || userFriendlyMsg.includes('high demand') || userFriendlyMsg.includes('UNAVAILABLE')) {
        userFriendlyMsg = 'Os servidores da Google estão com alta procura momentânea. Podes tentar novamente em instantes.';
      }

      onError(userFriendlyMsg, false);
      return;
    }
  }
}

export async function fetchRelatedImages(query: string): Promise<RelatedTopicImage[]> {
  try {
    const res = await fetch(`/api/images/related?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.images) ? data.images : [];
  } catch {
    return [];
  }
}

function formatApiErrorMessage(rawError: unknown, fallback: string): string {
  const raw = typeof rawError === 'string' ? rawError : fallback;
  if (!raw) return fallback;
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return 'Limite temporário de requisições atingido. Aguarda alguns segundos e tenta novamente.';
  }
  if (lower.includes('503') || lower.includes('high demand') || lower.includes('unavailable')) {
    return 'Os servidores de IA estão com alta procura momentânea. Tenta novamente em instantes.';
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) {
      return formatApiErrorMessage(parsed.error.message, fallback);
    }
  } catch {}
  return raw;
}

// Public Search (Guests allowed within limits + Authenticated)
export async function searchWithGrounding(query: string, language = 'Português') {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/tools/search', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, language }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    if (response.status === 401 || err.requiresAuth) {
      throw new AuthRequiredError(err.error || GUEST_RESTRICTION_MESSAGE, response.status);
    }
    throw new Error(formatApiErrorMessage(err.error, 'Falha ao realizar pesquisa.'));
  }

  return response.json() as Promise<{
    answer: string;
    citations: Array<{ title: string; url: string }>;
    query: string;
  }>;
}

// Exclusive Authenticated Tools (Guests strictly blocked)
export async function runTool(toolId: string, input: string, options?: any, attachments?: ChatAttachment[]) {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    throw new AuthRequiredError();
  }
  const response = await fetch('/api/tools/execute', {
    method: 'POST',
    headers,
    body: JSON.stringify({ toolId, input, options, attachments }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    if (response.status === 401 || err.requiresAuth) {
      throw new AuthRequiredError(err.error || GUEST_RESTRICTION_MESSAGE, response.status);
    }
    throw new Error(formatApiErrorMessage(err.error, 'Falha ao executar ferramenta.'));
  }

  return response.json() as Promise<{
    toolId: string;
    result: string;
    timestamp: number;
  }>;
}

// ----------------------------------------------------
// Admin Endpoints (Bearer Verified)
// ----------------------------------------------------
export async function getAdminStats(): Promise<AdminStats> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/stats', { headers });
  if (!response.ok) {
    throw new Error('Falha ao obter métricas de administração.');
  }
  return response.json();
}

export async function updateAdminModel(model: string) {
  return updateAdminConfig({ model });
}

export async function updateAdminConfig(payload: {
  model?: string;
  features?: Partial<PlatformFeatureFlags>;
  announcement?: Partial<PlatformAnnouncement>;
}) {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/config', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar configurações globais.');
  }
  return data;
}

export interface AdminSecuritySessionRecord {
  uid: string;
  email: string;
  userName: string;
  deviceId: string;
  deviceLabel: string;
  osName: string;
  browserName: string;
  ipAddress: string;
  createdAt: number;
  lastActiveAt: number;
}

export async function fetchAdminSecuritySessions(): Promise<{
  sessions: AdminSecuritySessionRecord[];
  guestRateLimitCount: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/security/sessions', { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao carregar sessões ativas.');
  }
  return {
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    guestRateLimitCount: Number(data.guestRateLimitCount || 0),
  };
}

export async function revokeAdminDeviceSession(
  uid: string,
  deviceId: string
): Promise<{ success: boolean; sessions: AdminSecuritySessionRecord[] }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/security/sessions/revoke', {
    method: 'POST',
    headers,
    body: JSON.stringify({ uid, deviceId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao encerrar sessão de dispositivo.');
  }
  return data;
}

export async function clearGuestRateLimitsAdmin(): Promise<{ success: boolean; cleared: number }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/security/clear-rate-limits', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao limpar limites de visitantes.');
  }
  return data;
}

export async function clearAdminLogs(): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/logs/clear', {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao limpar registos.');
  }
  return data;
}

// ----------------------------------------------------
// Image Studio Endpoints (Strictly Authenticated)
// ----------------------------------------------------
export interface GenerateImageParams {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
  userId?: string;
  plan?: string;
  referenceImage?: string;
  isEdit?: boolean;
  signal?: AbortSignal;
}

export interface GenerateImageResult {
  success?: boolean;
  image?: GeneratedImage;
  error?: string;
  requiresAuth?: boolean;
  adapterRequired?: boolean;
  setupGuide?: {
    step1: string;
    step2: string;
    step3: string;
  };
  dailyUsage?: {
    count: number;
    limit: number;
    plan: string;
  };
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers['Authorization']) {
    return {
      error: GUEST_RESTRICTION_MESSAGE,
      requiresAuth: true,
    };
  }

  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: params.prompt,
        style: params.style,
        aspectRatio: params.aspectRatio,
        quality: params.quality,
        count: params.count,
        referenceImage: params.referenceImage,
        isEdit: params.isEdit,
      }),
      signal: params.signal,
    });

    const data = await response.json().catch(() => ({ error: 'Erro de comunicação ao gerar imagem.' }));

    if (response.status === 401 || data.requiresAuth) {
      return {
        error: data.error || GUEST_RESTRICTION_MESSAGE,
        requiresAuth: true,
      };
    }

    if (response.status === 403) {
      return {
        error: data.error || 'Sem permissão para gerar imagens.',
      };
    }

    if (response.ok && data.success && data.image) {
      return data;
    }

    if (response.status === 429 && data.quotaExceeded) {
      return {
        error: data.error,
        dailyUsage: data.dailyUsage,
      };
    }

    return {
      error: data.error || 'Não foi possível gerar a imagem no momento. Por favor tenta novamente em instantes.',
    };
  } catch (err: any) {
    if (err.name === 'AbortError' || params.signal?.aborted) {
      return { error: 'Geração cancelada pelo utilizador.' };
    }
    return {
      error: err.message || 'Não foi possível gerar a imagem no momento.',
    };
  }
}

export async function fetchImageHistory(): Promise<{ images: GeneratedImage[]; totalGenerated: number }> {
  if (shouldBypassNetworkForCreatorOffline()) {
    return { images: [], totalGenerated: 0 };
  }
  const headers = await getAuthHeaders();
  if (!headers['Authorization']) {
    return { images: [], totalGenerated: 0 };
  }
  const response = await fetchWithTimeout('/api/image/history', { headers }, 4000).catch(() => null);
  if (!response || !response.ok) {
    return { images: [], totalGenerated: 0 };
  }
  return response.json();
}

export async function deleteImage(id: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    if (!headers['Authorization']) return false;
    const response = await fetch(`/api/image/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminImageConfig() {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/image-config', { headers });
  if (!response.ok) throw new Error('Falha ao obter configuração de imagens.');
  return response.json();
}

export async function updateAdminImageConfig(limits?: any, model?: string) {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/image-config', {
    method: 'POST',
    headers,
    body: JSON.stringify({ limits, model }),
  });
  return response.json();
}

// ----------------------------------------------------
// Admin User Management & Access Control
// ----------------------------------------------------
export interface AdminUsersResponse {
  users: ManagedUser[];
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  totalOnline: number;
}

export async function fetchAdminUsers(): Promise<AdminUsersResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/admin/users', { headers });
  if (!response.ok) throw new Error('Falha ao carregar utilizadores.');
  return response.json();
}

export async function updateAdminUser(
  userId: string,
  updates: Partial<ManagedUser>
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/update', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, updates }),
  });
  if (!response.ok) throw new Error('Falha ao atualizar utilizador.');
  return response.json();
}

export async function toggleBlockUser(
  userId: string,
  blocked: boolean,
  reason?: string
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/block', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, blocked, reason }),
  });
  if (!response.ok) throw new Error('Falha ao alterar estado de bloqueio do utilizador.');
  return response.json();
}

export async function updateUserPlanByAdmin(
  userId: string,
  plan: PlanType
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/plan', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, plan }),
  });
  if (!response.ok) throw new Error('Falha ao alterar plano do utilizador.');
  return response.json();
}

export async function updateUserFeaturesByAdmin(
  userId: string,
  features: Partial<UserFeatures>
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/features', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, features }),
  });
  if (!response.ok) throw new Error('Falha ao atualizar funções do utilizador.');
  return response.json();
}

export async function createAdminUser(data: {
  name: string;
  email: string;
  plan?: PlanType;
  role?: string;
  notes?: string;
  features?: Partial<UserFeatures>;
}): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/create', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const resData = await response.json();
  if (!response.ok) throw new Error(resData.error || 'Falha ao criar utilizador.');
  return resData;
}

export async function deleteAdminUser(userId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao eliminar utilizador.');
  }
  return true;
}

export async function updateUserRoleByAdmin(
  userId: string,
  role: 'user' | 'admin'
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/role', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId, role }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Falha ao atualizar função do utilizador.');
  return data;
}

export async function resetUserQuotaByAdmin(
  userId: string
): Promise<{ success: boolean; user: ManagedUser }> {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/admin/users/reset-quota', {
    method: 'POST',
    headers,
    body: JSON.stringify({ userId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Falha ao reiniciar quota do utilizador.');
  return data;
}

export async function syncUserActivity(): Promise<any> {
  if (shouldBypassNetworkForCreatorOffline()) return null;
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers['Authorization']) return null;
    const response = await fetchWithTimeout(
      '/api/users/sync',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      },
      3000
    );
    if (response.status === 401) {
      const data = await response.json().catch(() => ({}));
      return { revokedRemotely: true, error: data.error };
    }
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// Feedback, Ratings, Official Replies & Notifications
// ----------------------------------------------------
export interface UserIdentityHeader {
  id?: string;
  email?: string;
  name?: string;
}

async function buildIdentityHeaders(user?: UserIdentityHeader | null): Promise<Record<string, string>> {
  const extra: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (user?.id) extra['X-User-Id'] = user.id;
  if (user?.email) extra['X-User-Email'] = user.email;
  return getAuthHeaders(extra);
}

export interface FeedbackFilterParams {
  category?: string;
  rating?: number | string;
  status?: string;
  feedbackType?: string;
  likedFilter?: 'all' | 'liked' | 'disliked';
  search?: string;
  dateFilter?: 'all' | 'today' | '7d' | '30d';
  onlyMine?: boolean;
  visibilityFilter?: 'all' | 'public' | 'private' | 'reported';
}

function buildFeedbackQuery(filters: FeedbackFilterParams = {}): string {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.rating && filters.rating !== 'all') params.set('rating', String(filters.rating));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.feedbackType && filters.feedbackType !== 'all') params.set('feedbackType', filters.feedbackType);
  if (filters.likedFilter && filters.likedFilter !== 'all') params.set('likedFilter', filters.likedFilter);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.dateFilter && filters.dateFilter !== 'all') params.set('dateFilter', filters.dateFilter);
  if (filters.onlyMine) params.set('onlyMine', 'true');
  if (filters.visibilityFilter && filters.visibilityFilter !== 'all') {
    params.set('visibilityFilter', filters.visibilityFilter);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchPublicFeedback(
  filters: FeedbackFilterParams = {},
  user?: UserIdentityHeader | null
): Promise<{ items: FeedbackItem[]; stats: FeedbackStats }> {
  const qs = buildFeedbackQuery(filters);
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/feedback${qs}`, { headers });
  if (!response.ok) {
    throw new Error('Falha ao carregar comentários e avaliações.');
  }
  return response.json();
}

export interface SubmitFeedbackPayload {
  authorName?: string;
  isAnonymous: boolean;
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
  isPublic: boolean;
}

export async function submitFeedback(
  payload: SubmitFeedbackPayload,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; item: FeedbackItem }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      userId: user?.id,
      userEmail: user?.email,
      authorName: payload.authorName || user?.name || 'Utilizador ZUNO',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar o feedback.');
  }
  return data;
}

export async function updateOwnFeedbackApi(
  id: string,
  updates: Partial<SubmitFeedbackPayload>,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; item: FeedbackItem }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível atualizar o comentário.');
  }
  return data;
}

export async function deleteFeedbackApi(
  id: string,
  user?: UserIdentityHeader | null
): Promise<boolean> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/feedback/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível eliminar o comentário.');
  }
  return true;
}

export async function replyToFeedback(
  feedbackId: string,
  content: string,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; reply: FeedbackReply }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/feedback/${encodeURIComponent(feedbackId)}/replies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content,
      authorName: user?.name || 'Utilizador ZUNO',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar a resposta.');
  }
  return data;
}

export async function reportFeedbackApi(
  feedbackId: string,
  reason: string,
  details?: string,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/feedback/${encodeURIComponent(feedbackId)}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason, details }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar a denúncia.');
  }
  return data;
}

export async function fetchNotifications(
  user?: UserIdentityHeader | null
): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  if (!user?.id) return { notifications: [], unreadCount: 0 };
  const headers = await buildIdentityHeaders(user);
  if (!headers['Authorization']) return { notifications: [], unreadCount: 0 };
  const response = await fetch('/api/notifications', { headers });
  if (!response.ok) return { notifications: [], unreadCount: 0 };
  return response.json();
}

export async function markNotificationsRead(
  user?: UserIdentityHeader | null,
  notificationId?: string,
  markAll?: boolean
): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  if (!user?.id) return { notifications: [], unreadCount: 0 };
  const headers = await buildIdentityHeaders(user);
  if (!headers['Authorization']) return { notifications: [], unreadCount: 0 };
  const response = await fetch('/api/notifications/read', {
    method: 'POST',
    headers,
    body: JSON.stringify({ notificationId, markAll }),
  });
  if (!response.ok) return { notifications: [], unreadCount: 0 };
  return response.json();
}

export interface AdminFeedbackResponse {
  items: FeedbackItem[];
  stats: FeedbackStats;
  reports: FeedbackReport[];
  auditHistory: FeedbackAuditEntry[];
}

export async function fetchAdminFeedback(
  filters: FeedbackFilterParams = {},
  user?: UserIdentityHeader | null
): Promise<AdminFeedbackResponse> {
  const qs = buildFeedbackQuery(filters);
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback${qs}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao carregar feedback administrativo.');
  }
  return data;
}

export async function postAdminOfficialReply(
  feedbackId: string,
  content: string,
  updateStatus?: FeedbackStatus,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; reply: FeedbackReply; feedback?: FeedbackItem }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/reply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, updateStatus }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao publicar resposta oficial.');
  }
  return data;
}

export async function editAdminReply(
  replyId: string,
  content: string,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; reply: FeedbackReply }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/reply/${encodeURIComponent(replyId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ content, adminName: user?.name || 'Fundador ZUNO AI' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao editar resposta oficial.');
  }
  return data;
}

export async function deleteAdminReply(
  replyId: string,
  user?: UserIdentityHeader | null
): Promise<boolean> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/reply/${encodeURIComponent(replyId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao eliminar resposta oficial.');
  }
  return true;
}

export async function updateFeedbackStatusApi(
  feedbackId: string,
  status: FeedbackStatus,
  user?: UserIdentityHeader | null
): Promise<{ success: boolean; item: FeedbackItem }> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, adminName: user?.name || 'Fundador ZUNO AI' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao atualizar estado do feedback.');
  }
  return data;
}

export async function moderateFeedbackApi(
  feedbackId: string,
  isHidden: boolean,
  user?: UserIdentityHeader | null
): Promise<boolean> {
  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/${encodeURIComponent(feedbackId)}/moderate`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ isHidden, adminName: user?.name || 'Fundador ZUNO AI' }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Falha ao moderar comentário.');
  }
  return true;
}

export async function downloadFeedbackReport(
  format: 'csv' | 'json',
  filters: FeedbackFilterParams = {},
  user?: UserIdentityHeader | null
): Promise<void> {
  const params = new URLSearchParams();
  params.set('format', format);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.rating && filters.rating !== 'all') params.set('rating', String(filters.rating));
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.likedFilter && filters.likedFilter !== 'all') params.set('likedFilter', filters.likedFilter);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.dateFilter && filters.dateFilter !== 'all') params.set('dateFilter', filters.dateFilter);

  const headers = await buildIdentityHeaders(user);
  const response = await fetch(`/api/admin/feedback/export?${params.toString()}`, { headers });
  if (!response.ok) {
    throw new Error('Falha ao exportar relatório de feedback.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = format === 'json' ? 'zuno-feedback-report.json' : 'zuno-feedback-report.csv';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
