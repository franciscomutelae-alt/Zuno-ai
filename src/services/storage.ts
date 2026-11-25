import { Conversation, KnownAccountSummary, UserProfile } from '../types';

const STORAGE_KEYS = {
  LEGACY_USER: 'zuno_user_profile',
  LEGACY_CONVERSATIONS: 'zuno_conversations',
  LEGACY_CURRENT_CONV_ID: 'zuno_current_conv_id',
  LEGACY_MEMORIES: 'zuno_custom_memories',
  LEGACY_GENERATED_IMAGES: 'zuno_generated_images',
  LEGACY_ADMIN_TOKEN: 'zuno_admin_auth',
  THEME: 'zuno_theme_mode',
  KNOWN_ACCOUNTS: 'zuno_known_accounts',
  KEEP_SIGNED_IN: 'zuno_keep_signed_in',
  GUEST_MODE: 'zuno_guest_mode',
  CONV_PREFIX: 'zuno_convs_',
  ACTIVE_CONV_PREFIX: 'zuno_active_conv_',
  IMAGES_PREFIX: 'zuno_images_',
};

export function createInitialUserConversation(name?: string): Conversation {
  const firstName = name?.trim().split(' ')[0];
  const greeting = firstName ? `Olá, ${firstName}! Sou o ZUNO AI. 👋` : 'Olá! Sou o ZUNO AI. 👋';
  return {
    id: 'conv_welcome_' + Math.random().toString(36).substring(2, 7),
    title: 'Boas-vindas ao ZUNO AI',
    createdAt: Date.now() - 60000,
    updatedAt: Date.now(),
    model: 'gemini-3.1-flash-lite',
    isPinned: false,
    messages: [
      {
        id: 'msg-welcome-1',
        role: 'assistant',
        content: `### ${greeting}

A tua conta está ativa e o teu histórico está isolado e protegido. Posso ajudar-te com:

* ⚡ **Geração e análise de código** em qualquer linguagem
* 📝 **Redação e refinamento de textos** profissionais
* 🔍 **Pesquisa em tempo real** com fontes verificadas e imagens relacionadas
* 🎨 **Estúdio ZUNO AI IMAGE** e ferramentas multimodais

Como posso ajudar-te hoje?`,
        timestamp: Date.now(),
      },
    ],
  };
}

export function createGuestTransientConversation(): Conversation {
  return {
    id: 'guest_search_session',
    title: 'Pesquisa Pública (Visitante)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: 'gemini-3.1-flash-lite',
    isPinned: false,
    messages: [
      {
        id: 'msg-guest-welcome',
        role: 'assistant',
        content: `### Modo Visitante — Pesquisa Pública 🔍

Estás a utilizar a **ZUNO AI** como visitante com acesso limitado à **pesquisa pública** e perguntas informativas gerais.

> [!NOTE] Funcionalidades exclusivas de conta
> Para guardar conversas, gerar imagens, usar ferramentas avançadas de IA, personalizar memórias ou ativar códigos VIP, cria uma conta gratuita ou inicia sessão.`,
        timestamp: Date.now(),
      },
    ],
  };
}

// ----------------------------------------------------
// Keep Signed In & Guest Mode Device Flags
// ----------------------------------------------------
export function getKeepSignedInPreference(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.KEEP_SIGNED_IN);
    return val === null ? true : val === '1';
  } catch {
    return true;
  }
}

export function setKeepSignedInPreference(keep: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.KEEP_SIGNED_IN, keep ? '1' : '0');
  } catch {
    // ignore
  }
}

export function loadGuestModeFlag(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.GUEST_MODE) === '1' || localStorage.getItem(STORAGE_KEYS.GUEST_MODE) === '1';
  } catch {
    return false;
  }
}

export function saveGuestModeFlag(isGuest: boolean): void {
  try {
    if (isGuest) {
      sessionStorage.setItem(STORAGE_KEYS.GUEST_MODE, '1');
      localStorage.setItem(STORAGE_KEYS.GUEST_MODE, '1');
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
      localStorage.removeItem(STORAGE_KEYS.GUEST_MODE);
    }
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// Non-sensitive Account Switcher Directory
// ----------------------------------------------------
export function loadKnownAccounts(): KnownAccountSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.KNOWN_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 6);
  } catch {
    return [];
  }
}

export function rememberAccountOnDevice(
  user: Pick<UserProfile, 'id' | 'name' | 'email' | 'avatar'>,
  provider: 'google' | 'password' | 'firebase' = 'google'
): void {
  if (!user.id || !user.email) return;
  try {
    const list = loadKnownAccounts().filter(
      (a) => a.uid !== user.id && a.email.toLowerCase() !== user.email.toLowerCase()
    );
    list.unshift({
      uid: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      avatar: user.avatar,
      provider,
      lastUsedAt: Date.now(),
    });
    localStorage.setItem(STORAGE_KEYS.KNOWN_ACCOUNTS, JSON.stringify(list.slice(0, 6)));
  } catch {
    // ignore
  }
}

export function forgetKnownAccountOnDevice(uidOrEmail: string): void {
  try {
    const lower = uidOrEmail.toLowerCase();
    const list = loadKnownAccounts().filter(
      (a) => a.uid !== uidOrEmail && a.email.toLowerCase() !== lower
    );
    localStorage.setItem(STORAGE_KEYS.KNOWN_ACCOUNTS, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// Strictly UID-Isolated Conversations Storage
// ----------------------------------------------------
export function loadConversationsForUser(uid?: string | null, userName?: string): Conversation[] {
  if (!uid) {
    return [createGuestTransientConversation()];
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.CONV_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((c) => ({
          ...c,
          model: !c.model || c.model === 'gemini-3.8-flash' ? 'gemini-3.1-flash-lite' : c.model,
        }));
      }
    }
  } catch (e) {
    console.error('Failed to load isolated user conversations', e);
  }
  return [createInitialUserConversation(userName)];
}

let saveConversationsTimer: ReturnType<typeof setTimeout> | null = null;

export function saveConversationsForUser(
  uid: string | null | undefined,
  conversations: Conversation[]
): void {
  if (!uid) return; // Guests NEVER persist conversation history
  if (saveConversationsTimer) clearTimeout(saveConversationsTimer);
  saveConversationsTimer = setTimeout(() => {
    try {
      localStorage.setItem(`${STORAGE_KEYS.CONV_PREFIX}${uid}`, JSON.stringify(conversations));
    } catch (e) {
      console.error('Failed to save isolated conversations', e);
    }
  }, 250);
}

export function saveConversationsImmediateForUser(
  uid: string | null | undefined,
  conversations: Conversation[]
): void {
  if (!uid) return;
  if (saveConversationsTimer) clearTimeout(saveConversationsTimer);
  try {
    localStorage.setItem(`${STORAGE_KEYS.CONV_PREFIX}${uid}`, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save isolated conversations', e);
  }
}

export function getActiveConversationIdForUser(uid?: string | null): string | null {
  if (!uid) return 'guest_search_session';
  try {
    return localStorage.getItem(`${STORAGE_KEYS.ACTIVE_CONV_PREFIX}${uid}`);
  } catch {
    return null;
  }
}

export function setActiveConversationIdForUser(uid: string | null | undefined, id: string | null): void {
  if (!uid) return;
  try {
    if (id) {
      localStorage.setItem(`${STORAGE_KEYS.ACTIVE_CONV_PREFIX}${uid}`, id);
    } else {
      localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_CONV_PREFIX}${uid}`);
    }
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// Strictly UID-Isolated Images Cache
// ----------------------------------------------------
export function loadLocalImagesForUser(uid?: string | null): any[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEYS.IMAGES_PREFIX}${uid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.error('Failed to load isolated user images', e);
  }
  return [];
}

export function saveLocalImagesForUser(uid: string | null | undefined, images: any[]): void {
  if (!uid) return; // Guests cannot save images
  try {
    localStorage.setItem(`${STORAGE_KEYS.IMAGES_PREFIX}${uid}`, JSON.stringify(images.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save isolated user images', e);
  }
}

// ----------------------------------------------------
// Security Cleanup on Sign-Out / Switch / Delete Account
// ----------------------------------------------------
export function clearLegacyUnscopedData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.LEGACY_USER);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_CURRENT_CONV_ID);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MEMORIES);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_GENERATED_IMAGES);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_ADMIN_TOKEN);
  } catch {
    // ignore
  }
}

export function clearDevicePrivateData(uid?: string | null, removeUidCaches = false): void {
  if (saveConversationsTimer) {
    clearTimeout(saveConversationsTimer);
    saveConversationsTimer = null;
  }
  clearLegacyUnscopedData();
  saveGuestModeFlag(false);

  try {
    // Wipe ephemeral browser session data
    sessionStorage.clear();

    if (uid && removeUidCaches) {
      localStorage.removeItem(`${STORAGE_KEYS.CONV_PREFIX}${uid}`);
      localStorage.removeItem(`${STORAGE_KEYS.ACTIVE_CONV_PREFIX}${uid}`);
      localStorage.removeItem(`${STORAGE_KEYS.IMAGES_PREFIX}${uid}`);
      forgetKnownAccountOnDevice(uid);
    }
  } catch {
    // ignore
  }
}
