import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  signOut,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { UserProfile, PlanType, KnownAccountSummary } from '../types';
import {
  auth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  syncUserProfileToFirestore,
} from '../firebase';
import {
  clearDevicePrivateData,
  clearLegacyUnscopedData,
  getKeepSignedInPreference,
  setKeepSignedInPreference as persistKeepSignedIn,
  loadGuestModeFlag,
  saveGuestModeFlag,
  loadKnownAccounts,
  rememberAccountOnDevice,
} from '../services/storage';
import {
  verifyBackendSession,
  logoutBackendSession,
  updateBackendProfile,
  deleteBackendAccount,
  selectPlanApi,
  redeemVipCodeApi,
  syncUserActivity,
  rotateDeviceId,
} from '../services/api';
import { isCreatorOfflineAccount as checkCreatorOfflineAccount, getPublicAppUrl } from '../config/brand';
import {
  saveCreatorOfflineVault,
  loadCreatorOfflineVault,
  clearCreatorOfflineVault,
  getCreatorOfflineModePref,
  setCreatorOfflineModePref,
  prepareCreatorOfflineAssets,
} from '../services/offlineCreator';

function mapFirebaseAuthError(err: any): string {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');

  if (code === 'auth/operation-not-allowed') {
    return 'O acesso com e-mail e palavra-passe está temporariamente indisponível. Utiliza "Continuar com Google" ou contacta suporte@zunoai.com.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este endereço de e-mail já está registado. Tenta iniciar sessão.';
  }
  if (code === 'auth/invalid-email') {
    return 'O endereço de e-mail inserido não é válido.';
  }
  if (code === 'auth/weak-password') {
    return 'A palavra-passe deve ter pelo menos 6 caracteres.';
  }
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'E-mail ou palavra-passe incorretos.';
  }
  if (code === 'auth/user-not-found') {
    return 'Não existe nenhuma conta registada com este e-mail.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'A janela de autenticação foi fechada antes de concluir.';
  }
  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela de login Google. Permite pop-ups neste site e tenta novamente.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'O acesso a partir deste endereço ainda não está autorizado. Acede através do domínio oficial https://zunoai.com ou contacta suporte@zunoai.com.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Demasiadas tentativas seguidas. Aguarda alguns minutos e tenta novamente.';
  }
  return msg || 'Não foi possível concluir a autenticação.';
}

interface AuthContextType {
  user: UserProfile | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  keepSignedIn: boolean;
  knownAccounts: KnownAccountSummary[];
  authProvider: string | null;
  setKeepSignedIn: (keep: boolean) => void;
  enterGuestMode: () => void;
  exitGuestModeToWelcome: () => void;
  loginWithGoogle: (keep?: boolean, loginHint?: string) => Promise<boolean>;
  switchAccountWithGoogle: (loginHint?: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string, keep?: boolean) => Promise<boolean>;
  signupWithEmail: (name: string, email: string, password: string, keep?: boolean) => Promise<boolean>;
  resetPasswordEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updatePlan: (plan: PlanType) => Promise<void>;
  redeemVipCode: (code: string) => Promise<{ success: boolean; plan?: PlanType }>;
  incrementMessageCount: () => boolean;
  incrementImageCount: () => boolean;
  addMemory: (memory: string) => void;
  removeMemory: (index: number) => void;
  clearMemories: () => void;
  deleteAccount: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
  isOnline: boolean;
  isCreatorOfflineAccount: boolean;
  isOfflineSession: boolean;
  creatorOfflineMode: boolean;
  setCreatorOfflineMode: (enabled: boolean) => void;
  prepareCreatorOffline: () => Promise<{ cachedAssets: number; kbCount: number }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authLoading: true,
  isAuthenticated: false,
  isGuest: false,
  isAdmin: false,
  isBlocked: false,
  keepSignedIn: true,
  knownAccounts: [],
  authProvider: null,
  setKeepSignedIn: () => {},
  enterGuestMode: () => {},
  exitGuestModeToWelcome: () => {},
  loginWithGoogle: async () => false,
  switchAccountWithGoogle: async () => false,
  loginWithEmail: async () => false,
  signupWithEmail: async () => false,
  resetPasswordEmail: async () => {},
  logout: async () => {},
  updateProfile: async () => {},
  updatePlan: async () => {},
  redeemVipCode: async () => ({ success: false }),
  incrementMessageCount: () => true,
  incrementImageCount: () => true,
  addMemory: () => {},
  removeMemory: () => {},
  clearMemories: () => {},
  deleteAccount: async () => {},
  refreshUserStatus: async () => {},
  isOnline: true,
  isCreatorOfflineAccount: false,
  isOfflineSession: false,
  creatorOfflineMode: false,
  setCreatorOfflineMode: () => {},
  prepareCreatorOffline: async () => ({ cachedAssets: 0, kbCount: 0 }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [keepSignedIn, setKeepSignedInState] = useState<boolean>(() => getKeepSignedInPreference());
  const [knownAccounts, setKnownAccounts] = useState<KnownAccountSummary[]>(() => loadKnownAccounts());
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isOfflineSession, setIsOfflineSession] = useState<boolean>(false);
  const [creatorOfflinePref, setCreatorOfflinePref] = useState<boolean>(() => getCreatorOfflineModePref());

  const authFlowBusyRef = useRef(false);

  const setKeepSignedIn = useCallback((keep: boolean) => {
    setKeepSignedInState(keep);
    persistKeepSignedIn(keep);
  }, []);

  const syncVerifiedFirebaseUser = useCallback(async (fbUser: FirebaseUser | null) => {
    const currentlyOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    if (!fbUser) {
      if (!currentlyOnline) {
        const offlineVault = loadCreatorOfflineVault();
        if (offlineVault && checkCreatorOfflineAccount(offlineVault.email)) {
          setUser(offlineVault.user);
          setAuthProvider(offlineVault.authProvider);
          setIsGuest(false);
          setIsOfflineSession(true);
          setAuthLoading(false);
          return;
        }
      }
      setUser(null);
      setAuthProvider(null);
      setIsOfflineSession(false);
      const guestFlag = loadGuestModeFlag();
      setIsGuest(guestFlag);
      setAuthLoading(false);
      return;
    }

    if (!currentlyOnline && checkCreatorOfflineAccount(fbUser.email)) {
      const offlineVault = loadCreatorOfflineVault();
      if (offlineVault) {
        setUser(offlineVault.user);
        setAuthProvider(offlineVault.authProvider);
        setIsGuest(false);
        setIsOfflineSession(true);
        setAuthLoading(false);
        return;
      }
    }

    try {
      const sessionRes = await verifyBackendSession(false);
      if (!sessionRes.authenticated || !sessionRes.user) {
        // Invalid, revoked, or rejected server session -> sign out cleanly
        await signOut(auth).catch(() => {});
        clearDevicePrivateData(undefined, false);
        clearCreatorOfflineVault();
        if (sessionRes.revokedRemotely) {
          rotateDeviceId();
        }
        setUser(null);
        setAuthProvider(null);
        setIsGuest(false);
        setIsOfflineSession(false);
        setAuthLoading(false);
        return;
      }

      const verifiedUser = sessionRes.user;
      const providerId =
        sessionRes.providerId ||
        fbUser.providerData?.[0]?.providerId ||
        'firebase';
      const normalizedProvider: 'google' | 'password' | 'firebase' =
        providerId.includes('google') ? 'google' : providerId.includes('password') ? 'password' : 'firebase';

      setUser(verifiedUser);
      setIsGuest(false);
      setIsOfflineSession(false);
      saveGuestModeFlag(false);
      setAuthProvider(normalizedProvider);
      rememberAccountOnDevice(verifiedUser, normalizedProvider);
      setKnownAccounts(loadKnownAccounts());

      if (checkCreatorOfflineAccount(verifiedUser.email)) {
        saveCreatorOfflineVault(verifiedUser, normalizedProvider);
        prepareCreatorOfflineAssets(verifiedUser.email).catch(() => {});
      } else {
        clearCreatorOfflineVault();
        setCreatorOfflinePref(false);
      }

      setAuthLoading(false);

      // Sync non-privileged Firestore profile metadata cleanly
      syncUserProfileToFirestore({
        uid: verifiedUser.id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        avatar: verifiedUser.avatar,
        plan: verifiedUser.plan,
        role: verifiedUser.role,
        status: verifiedUser.status || 'active',
        language: verifiedUser.language,
        aiTone: verifiedUser.aiTone,
        customInstructions: verifiedUser.customInstructions,
        memoryEnabled: verifiedUser.memoryEnabled,
        memories: verifiedUser.memories,
      }).catch(() => {});
    } catch {
      if (!currentlyOnline && checkCreatorOfflineAccount(fbUser.email)) {
        const offlineVault = loadCreatorOfflineVault();
        if (offlineVault) {
          setUser(offlineVault.user);
          setAuthProvider(offlineVault.authProvider);
          setIsGuest(false);
          setIsOfflineSession(true);
          setAuthLoading(false);
          return;
        }
      }
      setUser(null);
      setAuthProvider(null);
      setIsOfflineSession(false);
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isOfflineSession && auth.currentUser) {
        syncVerifiedFirebaseUser(auth.currentUser).catch(() => {});
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOfflineSession, syncVerifiedFirebaseUser]);

  useEffect(() => {
    // Remove legacy unscoped keys (including previous fake DEFAULT_USER cache)
    clearLegacyUnscopedData();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (authFlowBusyRef.current) return;
      await syncVerifiedFirebaseUser(fbUser);
    });

    return () => unsubscribe();
  }, [syncVerifiedFirebaseUser]);

  const refreshUserStatus = useCallback(async () => {
    if (!auth.currentUser) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (getCreatorOfflineModePref() && checkCreatorOfflineAccount(auth.currentUser.email)) return;
    const currentUid = auth.currentUser.uid;
    try {
      const res = await syncUserActivity();
      if (res && res.revokedRemotely) {
        await signOut(auth).catch(() => {});
        clearDevicePrivateData(currentUid, false);
        rotateDeviceId();
        setUser(null);
        setAuthProvider(null);
        setIsGuest(false);
        return;
      }
      if (res && res.success) {
        setUser((prev) => {
          if (!prev) return null;
          const isBlocked = Boolean(res.isBlocked || res.status === 'blocked');
          const serverPlan: PlanType = res.plan || prev.plan;
          const maxMessages =
            serverPlan === 'ultra' ? 99999 : serverPlan === 'pro' ? 250 : serverPlan === 'premium' ? 100 : 25;
          const maxImages =
            serverPlan === 'ultra' ? 99999 : serverPlan === 'pro' ? 50 : serverPlan === 'premium' ? 20 : 3;

          return {
            ...prev,
            name: res.user?.name || prev.name,
            language: res.user?.language || prev.language,
            role: res.user?.role || prev.role,
            status: isBlocked ? 'blocked' : 'active',
            isBlocked,
            plan: serverPlan,
            features: res.features || prev.features,
            maxMessagesToday: maxMessages,
            maxImagesToday: maxImages,
          };
        });
      }
    } catch {
      // transient network failure
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUserStatus, 30000);
    const onFocus = () => {
      refreshUserStatus();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshUserStatus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id, refreshUserStatus]);

  const enterGuestMode = useCallback(() => {
    saveGuestModeFlag(true);
    setIsGuest(true);
  }, []);

  const exitGuestModeToWelcome = useCallback(() => {
    saveGuestModeFlag(false);
    setIsGuest(false);
  }, []);

  const applyFirebasePersistence = async (keep?: boolean) => {
    const shouldKeep = keep !== undefined ? keep : keepSignedIn;
    setKeepSignedIn(shouldKeep);
    await setPersistence(
      auth,
      shouldKeep ? browserLocalPersistence : browserSessionPersistence
    );
  };

  const loginWithGoogle = async (keep?: boolean, loginHint?: string): Promise<boolean> => {
    authFlowBusyRef.current = true;
    try {
      await applyFirebasePersistence(keep);
      const provider = new GoogleAuthProvider();
      const customParams: Record<string, string> = { prompt: 'select_account' };
      if (loginHint) customParams.login_hint = loginHint;
      provider.setCustomParameters(customParams);

      const cred = await signInWithPopup(auth, provider);
      await syncVerifiedFirebaseUser(cred.user);
      return true;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const switchAccountWithGoogle = async (loginHint?: string): Promise<boolean> => {
    authFlowBusyRef.current = true;
    const prevToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    try {
      await applyFirebasePersistence(keepSignedIn);
      const provider = new GoogleAuthProvider();
      const customParams: Record<string, string> = { prompt: 'select_account' };
      if (loginHint) customParams.login_hint = loginHint;
      provider.setCustomParameters(customParams);

      const cred = await signInWithPopup(auth, provider);
      // If user picked a different account, clear sessionStorage from previous account cleanly
      if (prevToken && cred.user.uid !== user?.id) {
        sessionStorage.clear();
      }
      await syncVerifiedFirebaseUser(cred.user);
      return true;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const loginWithEmail = async (email: string, password: string, keep?: boolean): Promise<boolean> => {
    authFlowBusyRef.current = true;
    try {
      await applyFirebasePersistence(keep);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncVerifiedFirebaseUser(cred.user);
      return true;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const signupWithEmail = async (
    name: string,
    email: string,
    password: string,
    keep?: boolean
  ): Promise<boolean> => {
    authFlowBusyRef.current = true;
    try {
      await applyFirebasePersistence(keep);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) {
        await firebaseUpdateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
      }
      await syncVerifiedFirebaseUser(cred.user);
      return true;
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const resetPasswordEmail = async (email: string): Promise<void> => {
    try {
      const continueUrl = `${getPublicAppUrl()}/iniciar-sessao`;
      await sendPasswordResetEmail(auth, email.trim(), { url: continueUrl });
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const logout = async () => {
    authFlowBusyRef.current = true;
    const currentUid = user?.id;
    try {
      await logoutBackendSession().catch(() => {});
      rotateDeviceId();
      clearDevicePrivateData(currentUid, false);
      clearCreatorOfflineVault();
      setCreatorOfflinePref(false);
      setIsOfflineSession(false);
      await signOut(auth).catch(() => {});
      setUser(null);
      setAuthProvider(null);
      setIsGuest(false);
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const nextUser = { ...user, ...updates };
    setUser(nextUser);
    rememberAccountOnDevice(
      nextUser,
      (authProvider as 'google' | 'password' | 'firebase') || 'google'
    );
    setKnownAccounts(loadKnownAccounts());
    if (checkCreatorOfflineAccount(nextUser.email)) {
      saveCreatorOfflineVault(
        nextUser,
        (authProvider as 'google' | 'password' | 'firebase') || 'firebase'
      );
    }

    try {
      const updated = await updateBackendProfile(updates);
      if (updated) {
        setUser(updated);
      }
      await syncUserProfileToFirestore({
        uid: nextUser.id,
        name: nextUser.name,
        email: nextUser.email,
        avatar: nextUser.avatar,
        plan: nextUser.plan,
        role: nextUser.role,
        status: nextUser.status || 'active',
        language: nextUser.language,
        aiTone: nextUser.aiTone,
        customInstructions: nextUser.customInstructions,
        memoryEnabled: nextUser.memoryEnabled,
        memories: nextUser.memories,
      });
    } catch {
      // keep optimistic update synced cleanly on next refresh
    }
  };

  const updatePlan = async (plan: PlanType) => {
    if (!user) return;
    const res = await selectPlanApi(plan);
    if (res.user) {
      setUser(res.user);
    } else {
      const maxMessages = plan === 'ultra' ? 99999 : plan === 'pro' ? 250 : plan === 'premium' ? 100 : 25;
      const maxImages = plan === 'ultra' ? 99999 : plan === 'pro' ? 50 : plan === 'premium' ? 20 : 3;
      setUser({
        ...user,
        plan,
        maxMessagesToday: maxMessages,
        maxImagesToday: maxImages,
      });
    }
  };

  const redeemVipCode = async (code: string) => {
    const res = await redeemVipCodeApi(code);
    if (res.user) {
      setUser(res.user);
    }
    return { success: Boolean(res.success), plan: res.plan };
  };

  const incrementMessageCount = (): boolean => {
    if (!user) return true;
    if (user.isBlocked || user.status === 'blocked') {
      return false;
    }
    if (user.messageCountToday >= user.maxMessagesToday && user.plan === 'free') {
      return false;
    }
    setUser({
      ...user,
      messageCountToday: user.messageCountToday + 1,
    });
    return true;
  };

  const incrementImageCount = (): boolean => {
    if (!user) return false;
    if (user.isBlocked || user.status === 'blocked') {
      return false;
    }
    if (user.imageCountToday >= user.maxImagesToday && user.plan !== 'ultra') {
      return false;
    }
    setUser({
      ...user,
      imageCountToday: user.imageCountToday + 1,
    });
    return true;
  };

  const addMemory = (memory: string) => {
    if (!user || !memory.trim()) return;
    const nextMemories = [...user.memories, memory.trim()].slice(0, 50);
    updateProfile({ memories: nextMemories });
  };

  const removeMemory = (index: number) => {
    if (!user) return;
    const newMemories = [...user.memories];
    newMemories.splice(index, 1);
    updateProfile({ memories: newMemories });
  };

  const clearMemories = () => {
    if (!user) return;
    updateProfile({ memories: [] });
  };

  const deleteAccount = async () => {
    authFlowBusyRef.current = true;
    const currentUid = user?.id;
    try {
      await deleteBackendAccount().catch(() => {});
      clearDevicePrivateData(currentUid, true);
      clearCreatorOfflineVault();
      setCreatorOfflinePref(false);
      setIsOfflineSession(false);
      if (auth.currentUser) {
        await auth.currentUser.delete().catch(async () => {
          await signOut(auth).catch(() => {});
        });
      }
      setKnownAccounts(loadKnownAccounts());
      setUser(null);
      setAuthProvider(null);
      setIsGuest(false);
    } finally {
      authFlowBusyRef.current = false;
    }
  };

  const isCreatorOfflineEligible = checkCreatorOfflineAccount(user?.email);
  const creatorOfflineMode = isCreatorOfflineEligible && (!isOnline || creatorOfflinePref);

  const setCreatorOfflineMode = useCallback(
    (enabled: boolean) => {
      if (!isCreatorOfflineEligible) return;
      setCreatorOfflinePref(enabled);
      setCreatorOfflineModePref(enabled);
      if (enabled && user) {
        saveCreatorOfflineVault(
          user,
          (authProvider as 'google' | 'password' | 'firebase') || 'firebase'
        );
        prepareCreatorOfflineAssets(user.email).catch(() => {});
      }
    },
    [isCreatorOfflineEligible, user, authProvider]
  );

  const prepareCreatorOffline = useCallback(async () => {
    if (!isCreatorOfflineEligible || !user) {
      return { cachedAssets: 0, kbCount: 0 };
    }
    saveCreatorOfflineVault(
      user,
      (authProvider as 'google' | 'password' | 'firebase') || 'firebase'
    );
    return prepareCreatorOfflineAssets(user.email);
  }, [isCreatorOfflineEligible, user, authProvider]);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        isAuthenticated: Boolean(user),
        isGuest: !user && isGuest,
        isAdmin: user?.role === 'admin',
        isBlocked: Boolean(user?.isBlocked || user?.status === 'blocked'),
        keepSignedIn,
        knownAccounts,
        authProvider,
        setKeepSignedIn,
        enterGuestMode,
        exitGuestModeToWelcome,
        loginWithGoogle,
        switchAccountWithGoogle,
        loginWithEmail,
        signupWithEmail,
        resetPasswordEmail,
        logout,
        updateProfile,
        updatePlan,
        redeemVipCode,
        incrementMessageCount,
        incrementImageCount,
        addMemory,
        removeMemory,
        clearMemories,
        deleteAccount,
        refreshUserStatus,
        isOnline,
        isCreatorOfflineAccount: isCreatorOfflineEligible,
        isOfflineSession,
        creatorOfflineMode,
        setCreatorOfflineMode,
        prepareCreatorOffline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
