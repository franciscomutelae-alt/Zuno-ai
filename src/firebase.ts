import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: Pass firestoreDatabaseId explicitly and use long polling to avoid WebChannel proxy transport errors
export const db = initializeFirestore(
  app,
  { experimentalForceLongPolling: true },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export { browserLocalPersistence, browserSessionPersistence, setPersistence };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isBrowserOfflineOrCreatorOffline(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('zuno_creator_offline_mode') === '1') {
      const email = auth.currentUser?.email?.trim().toLowerCase();
      if (email === 'franciscomutelae@gmail.com') return true;
    }
  } catch {
    // Ignore storage access errors
  }
  return false;
}

async function testConnection() {
  if (isBrowserOfflineOrCreatorOffline()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

// ----------------------------------------------------
// Bounded Firestore Metadata Sync (Matches firebase-blueprint.json)
// ----------------------------------------------------
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const FOUNDER_ADMIN_EMAILS = ['franciscomutelae@gmail.com', 'diegofrancisco26@gmail.com'];

function isFounderEmail(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && FOUNDER_ADMIN_EMAILS.includes(normalized));
}

export async function syncUserProfileToFirestore(params: {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'premium' | 'pro' | 'ultra';
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  language?: 'pt' | 'en' | 'es' | 'fr';
  aiTone?: 'balanced' | 'creative' | 'precise' | 'friendly' | 'academic';
  customInstructions?: string;
  memoryEnabled?: boolean;
  memories?: string[];
}): Promise<void> {
  if (isBrowserOfflineOrCreatorOffline()) return;
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.uid || !currentUser.emailVerified) {
    return;
  }
  if (!SAFE_ID_REGEX.test(params.uid)) return;

  const isFounder = isFounderEmail(currentUser.email);
  const docPath = `users/${params.uid}`;
  try {
    const existingSnap = await getDocFromServer(doc(db, 'users', params.uid)).catch(() => null);
    const boundedMemories = Array.isArray(params.memories)
      ? params.memories.slice(0, 50).map((m) => String(m).slice(0, 300))
      : [];

    if (!existingSnap || !existingSnap.exists()) {
      await setDoc(doc(db, 'users', params.uid), {
        uid: params.uid,
        name: (params.name || 'Utilizador ZUNO').slice(0, 120),
        email: (params.email || '').slice(0, 180),
        avatar: (params.avatar || '').slice(0, 1024),
        plan: isFounder ? 'ultra' : 'free',
        role: isFounder ? 'admin' : 'user',
        status: 'active',
        language: params.language || 'pt',
        aiTone: params.aiTone || 'balanced',
        customInstructions: (params.customInstructions || '').slice(0, 2000),
        memoryEnabled: params.memoryEnabled ?? true,
        memories: boundedMemories,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        doc(db, 'users', params.uid),
        {
          name: (params.name || 'Utilizador ZUNO').slice(0, 120),
          avatar: (params.avatar || '').slice(0, 1024),
          ...(isFounder ? { role: 'admin', plan: 'ultra', status: 'active' } : {}),
          language: params.language || 'pt',
          aiTone: params.aiTone || 'balanced',
          customInstructions: (params.customInstructions || '').slice(0, 2000),
          memoryEnabled: params.memoryEnabled ?? true,
          memories: boundedMemories,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }
}

export async function syncConversationMetaToFirestore(params: {
  uid: string;
  id: string;
  title: string;
  model: string;
  isPinned?: boolean;
  messageCount: number;
}): Promise<void> {
  if (isBrowserOfflineOrCreatorOffline()) return;
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== params.uid || !currentUser.emailVerified) {
    return;
  }
  if (!SAFE_ID_REGEX.test(params.uid) || !SAFE_ID_REGEX.test(params.id)) return;

  const docPath = `users/${params.uid}/conversations/${params.id}`;
  try {
    const convRef = doc(db, 'users', params.uid, 'conversations', params.id);
    const snap = await getDocFromServer(convRef).catch(() => null);
    if (!snap || !snap.exists()) {
      await setDoc(convRef, {
        id: params.id,
        userId: params.uid,
        title: (params.title || 'Nova conversa').slice(0, 200),
        model: (params.model || 'gemini-3.1-flash-lite').slice(0, 80),
        isPinned: Boolean(params.isPinned),
        messageCount: Math.max(0, Math.min(5000, Number(params.messageCount) || 0)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        convRef,
        {
          title: (params.title || 'Nova conversa').slice(0, 200),
          model: (params.model || 'gemini-3.1-flash-lite').slice(0, 80),
          isPinned: Boolean(params.isPinned),
          messageCount: Math.max(0, Math.min(5000, Number(params.messageCount) || 0)),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, docPath);
    }
  }
}

export async function deleteConversationMetaFromFirestore(uid: string, convId: string): Promise<void> {
  if (isBrowserOfflineOrCreatorOffline()) return;
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== uid || !currentUser.emailVerified) return;
  if (!SAFE_ID_REGEX.test(uid) || !SAFE_ID_REGEX.test(convId)) return;

  const docPath = `users/${uid}/conversations/${convId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'conversations', convId));
  } catch (error: any) {
    if (String(error?.message || '').toLowerCase().includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, docPath);
    }
  }
}
