import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { BrandSplash } from './components/common/BrandSplash';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { WelcomeAuthScreen } from './components/auth/WelcomeAuthScreen';
import { AccountRestrictionModal } from './components/auth/AccountRestrictionModal';
import { LandingPage } from './pages/LandingPage';
import { ChatPage } from './pages/ChatPage';

const ToolsPage = lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((m) => ({ default: m.PricingPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const ImageStudioPage = lazy(() => import('./pages/ImageStudioPage').then((m) => ({ default: m.ImageStudioPage })));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage').then((m) => ({ default: m.FeedbackPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const RestrictedAccessPage = lazy(() => import('./pages/RestrictedAccessPage').then((m) => ({ default: m.RestrictedAccessPage })));
const AuthModal = lazy(() => import('./pages/AuthModal').then((m) => ({ default: m.AuthModal })));
const TermsPrivacyModal = lazy(() => import('./pages/TermsPrivacyModal').then((m) => ({ default: m.TermsPrivacyModal })));
import {
  pathToView,
  viewToPath,
  getPublicAppUrl,
  isAuthRoutePath,
  authModeToPath,
} from './config/brand';
import {
  Conversation,
  FavoriteItem,
  Message,
  SearchCodeExecutionResult,
  ToolId,
  UserNotification,
} from './types';
import {
  loadConversationsForUser,
  saveConversationsForUser,
  getActiveConversationIdForUser,
  setActiveConversationIdForUser,
  createGuestTransientConversation,
} from './services/storage';
import {
  fetchNotifications,
  markNotificationsRead,
  fetchAccountConversations,
  saveAccountConversation,
  deleteAccountConversation,
  fetchFavoritesApi,
  saveFavoriteApi,
  deleteFavoriteApi,
  reportClientErrorApi,
  fetchPlatformStatusApi,
  PlatformStatusResponse,
} from './services/api';
import { Megaphone, Wrench, X as CloseIcon } from 'lucide-react';
import {
  syncConversationMetaToFirestore,
  deleteConversationMetaFromFirestore,
} from './firebase';
import {
  enqueueCreatorOfflineSync,
  loadCreatorOfflineSyncQueue,
  clearCreatorOfflineSyncQueue,
} from './services/offlineCreator';

function AppContent() {
  const {
    user,
    authLoading,
    isAuthenticated,
    isGuest,
    isAdmin,
    isBlocked,
    enterGuestMode,
    refreshUserStatus,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    isOnline,
    isOfflineSession,
  } = useAuth();
  const { setLanguage } = useLanguage();

  // Navigation synchronized with clean URL routes (/, /chat, /tools, /image, /pricing, /feedback, /settings, /admin, /restricted, /404)
  const [currentView, setCurrentViewState] = useState<string>(() =>
    typeof window !== 'undefined' ? pathToView(window.location.pathname) : 'landing'
  );
  const [requestedUnknownPath, setRequestedUnknownPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [settingsTab, setSettingsTab] = useState<
    'profile' | 'personality' | 'memory' | 'security' | 'notifications'
  >('profile');
  const [pendingToolId, setPendingToolId] = useState<ToolId | null>(null);

  const syncCanonicalUrl = (targetPath: string) => {
    if (typeof document === 'undefined') return;
    const publicBase = getPublicAppUrl();
    const canonicalHref = targetPath === '/' ? `${publicBase}/` : `${publicBase}${targetPath}`;
    const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalEl) canonicalEl.href = canonicalHref;
    const ogUrlEl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
    if (ogUrlEl) ogUrlEl.content = canonicalHref;
  };

  const setCurrentView = (view: string, replace = false) => {
    setCurrentViewState(view);
    if (typeof window !== 'undefined') {
      const targetPath = viewToPath(view);
      if (view !== 'not-found' && window.location.pathname !== targetPath) {
        if (replace) {
          window.history.replaceState({}, '', targetPath);
        } else {
          window.history.pushState({}, '', targetPath);
        }
      }
      syncCanonicalUrl(targetPath);
    }
  };

  // Global Platform Status (Feature Flags & Announcement Banner)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatusResponse | null>(null);
  const [announcementDismissedAt, setAnnouncementDismissedAt] = useState<number>(0);

  useEffect(() => {
    let active = true;
    const loadPlatform = () => {
      fetchPlatformStatusApi().then((st) => {
        if (active && st) setPlatformStatus(st);
      });
    };
    loadPlatform();
    const timer = setInterval(loadPlatform, 45000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Conversations state (strictly isolated per UID; transient only for guests)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modals (auto-open when visiting /criar-conta or /iniciar-sessao)
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isAuthRoutePath(window.location.pathname) !== null : false
  );
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'switch'>(() => {
    const authRoute = typeof window !== 'undefined' ? isAuthRoutePath(window.location.pathname) : null;
    return authRoute || 'login';
  });
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsType, setTermsType] = useState<'terms' | 'privacy'>('terms');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState<{
    open: boolean;
    featureLabel?: string;
  }>({ open: false });

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authRoute = isAuthRoutePath(window.location.pathname);
      syncCanonicalUrl(authRoute ? authModeToPath(authRoute) : window.location.pathname);
    }
    const onPopState = () => {
      const path = window.location.pathname;
      const authRoute = isAuthRoutePath(path);
      if (authRoute) {
        setAuthMode(authRoute);
        setAuthModalOpen(true);
        syncCanonicalUrl(authModeToPath(authRoute));
      } else {
        setAuthModalOpen(false);
        setRequestedUnknownPath(path);
        const view = pathToView(path);
        setCurrentViewState(view);
        syncCanonicalUrl(viewToPath(view));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // If authenticated user opened an auth deep link directly, settle cleanly to app home
  useEffect(() => {
    if (isAuthenticated && typeof window !== 'undefined' && isAuthRoutePath(window.location.pathname)) {
      setAuthModalOpen(false);
      window.history.replaceState({}, '', viewToPath(currentView));
      syncCanonicalUrl(viewToPath(currentView));
    }
  }, [isAuthenticated]);

  // Keep browser document.title synced exclusively with ZUNO AI identity
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (authModalOpen) {
      document.title =
        authMode === 'signup'
          ? 'Criar conta — ZUNO AI'
          : authMode === 'switch'
          ? 'Trocar de conta — ZUNO AI'
          : 'Iniciar sessão — ZUNO AI';
      return;
    }
    const viewTitles: Record<string, string> = {
      landing: 'ZUNO AI — Intelligence Without Limits',
      chat: 'Chat IA — ZUNO AI',
      tools: 'Ferramentas — ZUNO AI',
      image: 'ZUNO AI IMAGE — Estúdio Visual',
      pricing: 'Planos — ZUNO AI',
      feedback: 'Avaliações & Feedback — ZUNO AI',
      settings: 'Definições — ZUNO AI',
      admin: 'Painel Admin — ZUNO AI',
      restricted: 'Acesso Restrito — ZUNO AI',
      'not-found': '404 — ZUNO AI',
    };
    document.title = viewTitles[currentView] || 'ZUNO AI — Intelligence Without Limits';
  }, [currentView, authModalOpen, authMode]);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Feedback Notifications & Focus
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [focusFeedbackId, setFocusFeedbackId] = useState<string | null>(null);

  // Synced Saved Favorites (Account-isolated across devices)
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);

  const remoteSyncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const clearPendingRemoteSyncs = () => {
    Object.values(remoteSyncTimersRef.current).forEach((timer) => clearTimeout(timer));
    remoteSyncTimersRef.current = {};
  };

  const scheduleRemoteConversationSync = (uid: string, conv: Conversation) => {
    if (conv.id === 'guest_search_session') return;
    if (remoteSyncTimersRef.current[conv.id]) {
      clearTimeout(remoteSyncTimersRef.current[conv.id]);
    }
    remoteSyncTimersRef.current[conv.id] = setTimeout(() => {
      delete remoteSyncTimersRef.current[conv.id];
      if (isCreatorOfflineAccount && (!navigator.onLine || creatorOfflineMode)) {
        enqueueCreatorOfflineSync(user?.email, {
          id: conv.id,
          kind: 'conversation',
          payload: conv,
        });
        return;
      }
      saveAccountConversation(conv).catch(() => {
        if (isCreatorOfflineAccount) {
          enqueueCreatorOfflineSync(user?.email, {
            id: conv.id,
            kind: 'conversation',
            payload: conv,
          });
        }
      });
      syncConversationMetaToFirestore({
        uid,
        id: conv.id,
        title: conv.title,
        model: conv.model,
        isPinned: conv.isPinned,
        messageCount: conv.messages.length,
      }).catch(() => {});
    }, 900);
  };

  // Strict UID isolation: rehydrate conversations whenever active account or guest mode changes
  useEffect(() => {
    clearPendingRemoteSyncs();

    if (!isAuthenticated || !user?.id) {
      if (isGuest) {
        const guestConv = createGuestTransientConversation();
        setConversations([guestConv]);
        setActiveConvId(guestConv.id);
        setCurrentViewState((prev) =>
          prev === 'image' || prev === 'settings' || prev === 'admin' ? 'chat' : prev
        );
      } else {
        setConversations([]);
        setActiveConvId(null);
        setSettingsTab('profile');
        setCurrentViewState((prev) =>
          prev === 'not-found' || prev === 'restricted' ? prev : 'landing'
        );
      }
      return;
    }

    const uid = user.id;
    const localConvs = loadConversationsForUser(uid, user.name);
    const savedActive = getActiveConversationIdForUser(uid);
    const initialActive =
      savedActive && localConvs.some((c) => c.id === savedActive)
        ? savedActive
        : localConvs[0]?.id || null;

    setConversations(localConvs);
    setActiveConvId(initialActive);

    let cancelled = false;
    fetchAccountConversations()
      .then((remoteConvs) => {
        if (cancelled || !remoteConvs || remoteConvs.length === 0) return;
        setConversations((prevLocal) => {
          const map = new Map<string, Conversation>();
          for (const c of prevLocal) {
            map.set(c.id, c);
          }
          for (const rc of remoteConvs) {
            const existing = map.get(rc.id);
            if (!existing || (rc.updatedAt || 0) >= (existing.updatedAt || 0)) {
              map.set(rc.id, rc);
            }
          }
          const merged = Array.from(map.values()).sort(
            (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
          );
          return merged;
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isGuest, user?.id]);

  // Persist local conversations ONLY for authenticated accounts (never for guests)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    saveConversationsForUser(user.id, conversations);
  }, [conversations, isAuthenticated, user?.id]);

  // Persist active conversation ID ONLY for authenticated accounts
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    setActiveConversationIdForUser(user.id, activeConvId);
  }, [activeConvId, isAuthenticated, user?.id]);

  // Load and poll notifications for official feedback replies (authenticated only)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setUnreadNotifCount(0);
      return;
    }

    let cancelled = false;
    const loadNotifs = async () => {
      try {
        const res = await fetchNotifications({ id: user.id, email: user.email, name: user.name });
        if (!cancelled) {
          setNotifications(res.notifications || []);
          setUnreadNotifCount(res.unreadCount || 0);
        }
      } catch {
        // silent transient
      }
    };

    loadNotifs();
    const timer = setInterval(loadNotifs, 25000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAuthenticated, user?.id, user?.email, currentView]);

  // Sync language preference from backend account when logging in on any device
  useEffect(() => {
    if (isAuthenticated && user?.language && ['pt', 'en', 'es', 'fr'].includes(user.language)) {
      setLanguage(user.language);
    }
  }, [isAuthenticated, user?.id, user?.language]);

  // Load synced favorites for verified account (with offline local cache for Creator account)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setFavorites([]);
      setShowFavoritesModal(false);
      return;
    }
    const localFavKey = `zuno_favs_${user.id}`;
    if (isCreatorOfflineAccount) {
      try {
        const cachedFavs = localStorage.getItem(localFavKey);
        if (cachedFavs) {
          const parsed = JSON.parse(cachedFavs);
          if (Array.isArray(parsed)) setFavorites(parsed);
        }
      } catch {
        // ignore
      }
    }
    if (!isOnline) return;

    let cancelled = false;
    fetchFavoritesApi()
      .then((list) => {
        if (!cancelled) {
          const pendingQueue = isCreatorOfflineAccount
            ? loadCreatorOfflineSyncQueue(user.email)
            : [];
          const pendingDeleted = new Set(
            pendingQueue.filter((q) => q.kind === 'favorite_delete').map((q) => q.id)
          );
          const pendingAdded: FavoriteItem[] = pendingQueue
            .filter((q) => q.kind === 'favorite_add' && q.payload)
            .map((q) => ({
              ...q.payload,
              uid: user.id,
              createdAt: q.createdAt || Date.now(),
            }));

          const mergedMap = new Map<string, FavoriteItem>();
          for (const item of pendingAdded) {
            mergedMap.set(item.id, item);
          }
          for (const remoteItem of list) {
            if (!pendingDeleted.has(remoteItem.id) && !mergedMap.has(remoteItem.id)) {
              mergedMap.set(remoteItem.id, remoteItem);
            }
          }
          const finalFavorites = Array.from(mergedMap.values()).sort(
            (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
          );
          setFavorites(finalFavorites);
          if (isCreatorOfflineAccount) {
            try {
              localStorage.setItem(localFavKey, JSON.stringify(finalFavorites));
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.email, isCreatorOfflineAccount, isOnline]);

  // Persist favorites locally for Creator Offline access
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !isCreatorOfflineAccount) return;
    try {
      localStorage.setItem(`zuno_favs_${user.id}`, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites, isAuthenticated, user?.id, isCreatorOfflineAccount]);

  // Auto-drain Creator Offline sync queue once back online with live verified session
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !isCreatorOfflineAccount || !isOnline || isOfflineSession || creatorOfflineMode) {
      return;
    }
    const pending = loadCreatorOfflineSyncQueue(user.email);
    if (pending.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        for (const item of pending) {
          if (cancelled) return;
          if (item.kind === 'conversation' && item.payload) {
            await saveAccountConversation(item.payload).catch(() => {});
            await syncConversationMetaToFirestore({
              uid: user.id,
              id: item.payload.id,
              title: item.payload.title,
              model: item.payload.model,
              isPinned: item.payload.isPinned,
              messageCount: Array.isArray(item.payload.messages) ? item.payload.messages.length : 0,
            }).catch(() => {});
          } else if (item.kind === 'favorite_add' && item.payload) {
            await saveFavoriteApi(item.payload).catch(() => {});
          } else if (item.kind === 'favorite_delete') {
            await deleteFavoriteApi(item.id).catch(() => {});
          }
        }
        if (!cancelled) {
          clearCreatorOfflineSyncQueue();
          showToast(`Sincronização offline concluída (${pending.length} alteração(ões)).`, 'success');
        }
      } catch {
        // retry on next online check
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.email, isCreatorOfflineAccount, isOnline, isOfflineSession, creatorOfflineMode]);

  // Non-intrusive global error & unhandled rejection telemetry (filters extension noise)
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const filename = String(event.filename || '');
      if (
        filename.startsWith('chrome-extension://') ||
        filename.startsWith('moz-extension://') ||
        filename.startsWith('safari-extension://')
      ) {
        return;
      }
      if (!event.message) return;
      reportClientErrorApi({
        message: event.message,
        source: 'window.error',
        path: window.location.pathname,
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = String((event.reason as any)?.message || event.reason || '');
      if (!reason || reason.includes('extension://') || reason.includes('AbortError')) return;
      reportClientErrorApi({
        message: reason,
        source: 'unhandledrejection',
        path: window.location.pathname,
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const handleToggleFavorite = async (message: Message, conv?: Conversation | null) => {
    if (!isAuthenticated || !user?.id) {
      openRestrictionModal('Guardar favoritos na conta');
      return;
    }
    const existing = favorites.find(
      (f) => f.messageId === message.id || f.id === `fav_${message.id}`
    );
    if (existing) {
      setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      if (isCreatorOfflineAccount && (!navigator.onLine || creatorOfflineMode)) {
        enqueueCreatorOfflineSync(user.email, { id: existing.id, kind: 'favorite_delete', payload: null });
      } else {
        await deleteFavoriteApi(existing.id).catch(() => {});
      }
      showToast('Removido dos favoritos.', 'info');
      return;
    }
    const favId = `fav_${message.id}`;
    const optimistic: FavoriteItem = {
      id: favId,
      uid: user.id,
      conversationId: conv?.id,
      conversationTitle: conv?.title || 'Conversa ZUNO AI',
      messageId: message.id,
      content: message.content,
      createdAt: Date.now(),
    };
    setFavorites((prev) => [optimistic, ...prev]);
    const favPayload = {
      id: favId,
      conversationId: conv?.id,
      conversationTitle: conv?.title || 'Conversa ZUNO AI',
      messageId: message.id,
      content: message.content,
    };
    if (isCreatorOfflineAccount && (!navigator.onLine || creatorOfflineMode)) {
      enqueueCreatorOfflineSync(user.email, { id: favId, kind: 'favorite_add', payload: favPayload });
      showToast('Guardado nos favoritos (Modo Offline — será sincronizado depois).', 'success');
      return;
    }
    try {
      const saved = await saveFavoriteApi(favPayload);
      if (saved) {
        setFavorites((prev) => prev.map((f) => (f.id === favId ? saved : f)));
      }
      showToast('Guardado nos favoritos da tua conta!', 'success');
    } catch {
      if (isCreatorOfflineAccount) {
        enqueueCreatorOfflineSync(user.email, { id: favId, kind: 'favorite_add', payload: favPayload });
        showToast('Guardado localmente para sincronizar assim que houver ligação.', 'info');
      } else {
        setFavorites((prev) => prev.filter((f) => f.id !== favId));
        showToast('Não foi possível sincronizar o favorito.', 'error');
      }
    }
  };

  const handleDeleteFavorite = async (favId: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
    if (isCreatorOfflineAccount && (!navigator.onLine || creatorOfflineMode)) {
      enqueueCreatorOfflineSync(user?.email, { id: favId, kind: 'favorite_delete', payload: null });
    } else {
      await deleteFavoriteApi(favId).catch(() => {});
    }
    showToast('Favorito removido.', 'info');
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!user?.id) return;
    const res = await markNotificationsRead(
      { id: user.id, email: user.email, name: user.name },
      undefined,
      true
    );
    setNotifications(res.notifications || []);
    setUnreadNotifCount(res.unreadCount || 0);
  };

  const handleOpenNotification = async (notif: UserNotification) => {
    if (user?.id && !notif.isRead) {
      const res = await markNotificationsRead(
        { id: user.id, email: user.email, name: user.name },
        notif.id,
        false
      );
      setNotifications(res.notifications || []);
      setUnreadNotifCount(res.unreadCount || 0);
    }
    setFocusFeedbackId(notif.feedbackId);
    setCurrentView('feedback');
  };

  const openRestrictionModal = (featureLabel?: string) => {
    setRestrictionModal({ open: true, featureLabel });
  };

  const handleOpenAuth = (mode: 'login' | 'signup' | 'switch') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
    if (typeof window !== 'undefined') {
      const authPath = authModeToPath(mode);
      if (window.location.pathname !== authPath) {
        window.history.pushState({}, '', authPath);
      }
      syncCanonicalUrl(authPath);
    }
  };

  const handleCloseAuth = () => {
    setAuthModalOpen(false);
    if (typeof window !== 'undefined' && isAuthRoutePath(window.location.pathname)) {
      const targetPath = viewToPath(currentView);
      window.history.replaceState({}, '', targetPath);
      syncCanonicalUrl(targetPath);
    }
  };

  const handleAuthModeChange = (nextMode: 'login' | 'signup' | 'switch') => {
    setAuthMode(nextMode);
    if (typeof window !== 'undefined') {
      const authPath = authModeToPath(nextMode);
      if (window.location.pathname !== authPath) {
        window.history.replaceState({}, '', authPath);
      }
      syncCanonicalUrl(authPath);
    }
  };

  const handleNavigate = (view: string) => {
    if (!isAuthenticated && (view === 'image' || view === 'settings' || view === 'admin')) {
      const label =
        view === 'image'
          ? 'Estúdio ZUNO AI IMAGE'
          : view === 'settings'
          ? 'Configurações da Conta'
          : 'Painel Administrativo';
      openRestrictionModal(label);
      return;
    }
    setCurrentView(view);
  };

  const handleApplySearchCodeResult = async (res: SearchCodeExecutionResult) => {
    if (res.requiresAuth) {
      openRestrictionModal(res.purpose || 'Ativar código na conta');
      return;
    }
    if (!res.executed) {
      showToast(res.error || 'Não foi possível executar este código.', 'error');
      return;
    }
    if (res.actionType === 'upgrade_plan' || res.actionType === 'unlock_features') {
      await refreshUserStatus().catch(() => {});
    }
    if (res.actionType === 'navigate' && res.targetView) {
      handleNavigate(res.targetView);
    } else if (res.actionType === 'open_tool' && res.targetToolId) {
      if (!isAuthenticated && res.targetToolId !== 'search') {
        openRestrictionModal(res.purpose || 'Abrir ferramenta exclusiva');
        return;
      }
      setPendingToolId(res.targetToolId);
      setCurrentView('tools');
    }

    if (res.actionType === 'creator_greeting') {
      showToast('Seja bem-vindo, Francisco Mutela Emanuel!', 'success');
    } else if (res.actionType === 'message' && res.responseText && currentView !== 'chat') {
      showToast(res.responseText.slice(0, 120), 'success');
    } else {
      showToast(res.purpose ? `Código ativado: ${res.purpose}` : 'Código ativado com sucesso!', 'success');
    }
  };

  const activeConversation =
    conversations.find((c) => c.id === activeConvId) || conversations[0] || null;

  const handleNewConversation = (initialToolId?: string, promptText?: string) => {
    if (!isAuthenticated || !user?.id) {
      if (promptText) {
        setConversations((prev) => {
          const base = prev[0] || createGuestTransientConversation();
          const next: Conversation = {
            ...base,
            updatedAt: Date.now(),
            messages: [
              ...base.messages,
              {
                id: 'msg_guest_' + Math.random().toString(36).substring(2, 8),
                role: 'user',
                content: promptText,
                timestamp: Date.now(),
              },
            ],
          };
          return [next];
        });
        setActiveConvId('guest_search_session');
        setCurrentView('chat');
      } else {
        openRestrictionModal('Histórico e Novas Conversas');
      }
      return;
    }

    const newConv: Conversation = {
      id: 'conv_' + Math.random().toString(36).substring(2, 9),
      title: promptText ? promptText.slice(0, 28) + '...' : 'Nova conversa',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      toolId: initialToolId,
      model: 'gemini-3.1-flash-lite',
      messages: promptText
        ? [
            {
              id: 'msg_init',
              role: 'user',
              content: promptText,
              timestamp: Date.now(),
            },
          ]
        : [],
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setCurrentView('chat');
    scheduleRemoteConversationSync(user.id, newConv);
  };

  const handleUpdateConversation = (updated: Conversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
    if (isAuthenticated && user?.id) {
      scheduleRemoteConversationSync(user.id, updated);
    }
  };

  const handleDeleteConversation = (id: string) => {
    if (!isAuthenticated || !user?.id) {
      openRestrictionModal('Gestão de Histórico');
      return;
    }
    if (remoteSyncTimersRef.current[id]) {
      clearTimeout(remoteSyncTimersRef.current[id]);
      delete remoteSyncTimersRef.current[id];
    }
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (activeConvId === id) {
        setActiveConvId(remaining[0]?.id || null);
      }
      return remaining;
    });
    deleteAccountConversation(id).catch(() => {});
    deleteConversationMetaFromFirestore(user.id, id).catch(() => {});
    showToast('Conversa eliminada.', 'info');
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    if (!isAuthenticated || !user?.id) {
      openRestrictionModal('Gestão de Histórico');
      return;
    }
    const uid = user.id;
    let updatedConv: Conversation | null = null;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          updatedConv = { ...c, title: newTitle, updatedAt: Date.now() };
          return updatedConv;
        }
        return c;
      })
    );
    if (updatedConv) {
      scheduleRemoteConversationSync(uid, updatedConv);
    }
    showToast('Conversa renomeada.', 'success');
  };

  if (authLoading) {
    return <BrandSplash message="A verificar sessão segura na ZUNO AI..." />;
  }

  const maintenanceActive = Boolean(platformStatus?.featuresEnabled?.maintenanceMode) && !isAdmin;
  const activeAnnouncement =
    platformStatus?.announcement?.enabled &&
    platformStatus.announcement.text &&
    platformStatus.announcement.updatedAt !== announcementDismissedAt
      ? platformStatus.announcement
      : null;

  const renderAnnouncementBanner = () => {
    if (!activeAnnouncement) return null;
    const toneClass =
      activeAnnouncement.type === 'warning'
        ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
        : activeAnnouncement.type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
        : 'bg-blue-950/90 border-blue-500/40 text-blue-200';
    return (
      <div className={`border-b px-4 py-2 text-xs flex items-center justify-center gap-3 relative z-40 ${toneClass}`}>
        <Megaphone className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium text-center">{activeAnnouncement.text}</span>
        <button
          type="button"
          onClick={() => setAnnouncementDismissedAt(activeAnnouncement.updatedAt)}
          className="p-1 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
          aria-label="Fechar comunicado"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  if (maintenanceActive) {
    return (
      <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/30 bg-slate-900/90 p-8 space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
            <Wrench className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-white">ZUNO AI em Manutenção Programada</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Estamos a aplicar melhorias de infraestrutura e desempenho. Voltaremos ao ar dentro de instantes em zunoai.com.
            </p>
          </div>
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => handleOpenAuth('login')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Acesso de Administrador
            </button>
          )}
        </div>
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModalOpen}
            initialMode={authMode}
            onClose={handleCloseAuth}
            onModeChange={handleAuthModeChange}
            publicSignupEnabled={platformStatus?.featuresEnabled?.publicSignupEnabled ?? true}
            onShowToast={showToast}
          />
        </Suspense>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // Show custom 404 or Restricted page even before entry screen if explicitly routed
  if (!isAuthenticated && !isGuest) {
    if (currentView === 'not-found') {
      return (
        <>
          {renderAnnouncementBanner()}
          <Suspense fallback={<BrandSplash message="A carregar..." />}>
            <NotFoundPage
              requestedPath={requestedUnknownPath}
              onGoHome={() => setCurrentView('landing', true)}
              onGoChat={() => {
                enterGuestMode();
                setCurrentView('chat');
              }}
            />
          </Suspense>
          <OfflineIndicator />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
      );
    }

    if (currentView === 'restricted') {
      return (
        <>
          {renderAnnouncementBanner()}
          <Suspense fallback={<BrandSplash message="A carregar..." />}>
            <RestrictedAccessPage
              reason="guest"
              onSignup={() => handleOpenAuth('signup')}
              onLogin={() => handleOpenAuth('login')}
              onGoHome={() => setCurrentView('landing', true)}
            />
            <AuthModal
              isOpen={authModalOpen}
              initialMode={authMode}
              onClose={handleCloseAuth}
              onModeChange={handleAuthModeChange}
              publicSignupEnabled={platformStatus?.featuresEnabled?.publicSignupEnabled ?? true}
              onShowToast={showToast}
            />
          </Suspense>
          <OfflineIndicator />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
      );
    }

    return (
      <>
        {renderAnnouncementBanner()}
        <WelcomeAuthScreen
          onOpenAuthModal={(mode) => handleOpenAuth(mode)}
          publicSignupEnabled={platformStatus?.featuresEnabled?.publicSignupEnabled ?? true}
          guestAccessEnabled={platformStatus?.featuresEnabled?.guestAccessEnabled ?? true}
          onEnterGuest={() => {
            enterGuestMode();
            setCurrentView('chat');
          }}
          onShowToast={showToast}
        />

        {authModalOpen && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={authModalOpen}
              initialMode={authMode}
              onClose={handleCloseAuth}
              onModeChange={handleAuthModeChange}
              publicSignupEnabled={platformStatus?.featuresEnabled?.publicSignupEnabled ?? true}
              onShowToast={showToast}
            />
          </Suspense>
        )}

        <OfflineIndicator />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (isBlocked) {
    return (
      <>
        <Suspense fallback={<BrandSplash message="A verificar conta..." />}>
          <RestrictedAccessPage
            reason="blocked"
            onGoHome={() => setCurrentView('landing', true)}
          />
        </Suspense>
        <OfflineIndicator />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050814] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {renderAnnouncementBanner()}
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={handleOpenAuth}
        onNavigateSettingsTab={(tab) => {
          if (!isAuthenticated) {
            openRestrictionModal('Configurações da Conta');
            return;
          }
          setSettingsTab(tab);
          setCurrentView('settings');
        }}
        onRequireAuth={openRestrictionModal}
        notifications={notifications}
        unreadCount={unreadNotifCount}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onOpenNotification={handleOpenNotification}
        onOpenGlobalSearch={() => setGlobalSearchOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col relative">
        {currentView === 'landing' && (
          <LandingPage
            onNavigateToChat={() => setCurrentView('chat')}
            onNavigateToTools={() => setCurrentView('tools')}
            onNavigateToImage={() => handleNavigate('image')}
            onNavigateToPricing={() => setCurrentView('pricing')}
            onOpenAuth={handleOpenAuth}
          />
        )}

        {currentView === 'chat' && (
          <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)] relative">
            <Sidebar
              conversations={conversations}
              activeConversationId={activeConvId}
              onSelectConversation={(id) => setActiveConvId(id)}
              onNewConversation={() => handleNewConversation()}
              onDeleteConversation={handleDeleteConversation}
              onRenameConversation={handleRenameConversation}
              onNavigate={handleNavigate}
              onRequireAuth={openRestrictionModal}
              onOpenAuth={handleOpenAuth}
              onOpenFavorites={() => setShowFavoritesModal(true)}
              onApplySearchCodeResult={handleApplySearchCodeResult}
              favoritesCount={favorites.length}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
            />
            <ChatPage
              conversations={conversations}
              activeConversation={activeConversation}
              onUpdateConversation={handleUpdateConversation}
              onNewConversation={() => handleNewConversation()}
              onShowToast={showToast}
              onNavigate={handleNavigate}
              onRequireAuth={openRestrictionModal}
              onApplySearchCodeResult={handleApplySearchCodeResult}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onDeleteFavorite={handleDeleteFavorite}
              showFavoritesModal={showFavoritesModal}
              onSetShowFavoritesModal={setShowFavoritesModal}
            />
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-xs">
              A carregar...
            </div>
          }
        >
          {currentView === 'tools' && (
            <ToolsPage
              onShowToast={showToast}
              onNavigateToChat={(prompt) => handleNewConversation(undefined, prompt)}
              onNavigateToImage={() => handleNavigate('image')}
              onRequireAuth={openRestrictionModal}
              onOpenAuth={handleOpenAuth}
              initialToolId={pendingToolId}
              onClearInitialToolId={() => setPendingToolId(null)}
              onApplySearchCodeResult={handleApplySearchCodeResult}
              conversations={conversations}
              favorites={favorites}
            />
          )}

          {currentView === 'image' && (
            <ImageStudioPage
              onShowToast={showToast}
              onNavigateToPricing={() => setCurrentView('pricing')}
              onRequireAuth={openRestrictionModal}
              onOpenAuth={handleOpenAuth}
            />
          )}

          {currentView === 'pricing' && (
            <PricingPage
              onShowToast={showToast}
              onNavigateToChat={() => setCurrentView('chat')}
              onRequireAuth={openRestrictionModal}
            />
          )}

          {currentView === 'settings' && (
            <SettingsPage
              onShowToast={showToast}
              onNavigateToPricing={() => setCurrentView('pricing')}
              initialTab={settingsTab}
              onOpenAuth={handleOpenAuth}
              onNavigateToChat={() => setCurrentView('chat')}
            />
          )}

          {currentView === 'feedback' && (
            <FeedbackPage
              onShowToast={showToast}
              onOpenAuth={handleOpenAuth}
              focusFeedbackId={focusFeedbackId}
              onClearFocus={() => setFocusFeedbackId(null)}
            />
          )}

          {currentView === 'admin' && (
            isAdmin ? (
              <AdminPage onShowToast={showToast} />
            ) : (
              <RestrictedAccessPage
                reason="admin"
                onGoHome={() => setCurrentView('landing')}
              />
            )
          )}

          {currentView === 'restricted' && (
            <RestrictedAccessPage
              reason={isAuthenticated ? 'admin' : 'guest'}
              onSignup={() => handleOpenAuth('signup')}
              onLogin={() => handleOpenAuth('login')}
              onGoHome={() => setCurrentView('landing')}
            />
          )}

          {currentView === 'not-found' && (
            <NotFoundPage
              requestedPath={requestedUnknownPath}
              onGoHome={() => setCurrentView('landing')}
              onGoChat={() => setCurrentView('chat')}
            />
          )}
        </Suspense>
      </main>

      {/* Footer (rendered on non-chat views for full height on chat) */}
      {currentView !== 'chat' && (
        <Footer
          onNavigate={handleNavigate}
          onOpenTerms={() => {
            setTermsType('terms');
            setTermsModalOpen(true);
          }}
          onOpenPrivacy={() => {
            setTermsType('privacy');
            setTermsModalOpen(true);
          }}
        />
      )}

      {/* Modals & Toasts */}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModalOpen}
            initialMode={authMode}
            onClose={handleCloseAuth}
            onModeChange={handleAuthModeChange}
            publicSignupEnabled={platformStatus?.featuresEnabled?.publicSignupEnabled ?? true}
            onShowToast={showToast}
          />
        </Suspense>
      )}

      <AccountRestrictionModal
        isOpen={restrictionModal.open}
        featureLabel={restrictionModal.featureLabel}
        onClose={() => setRestrictionModal({ open: false })}
        onSignup={() => handleOpenAuth('signup')}
        onLogin={() => handleOpenAuth('login')}
        onShowToast={showToast}
      />

      {termsModalOpen && (
        <Suspense fallback={null}>
          <TermsPrivacyModal
            isOpen={termsModalOpen}
            type={termsType}
            onClose={() => setTermsModalOpen(false)}
          />
        </Suspense>
      )}

      <GlobalSearchModal
        isOpen={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        conversations={conversations}
        favorites={favorites}
        onNavigate={handleNavigate}
        onSelectConversation={(convId) => {
          setActiveConvId(convId);
          setCurrentView('chat');
        }}
        onOpenTool={(toolId) => {
          if (!isAuthenticated && toolId !== 'search') {
            openRestrictionModal('Ferramenta exclusiva ZUNO AI');
            return;
          }
          setPendingToolId(toolId);
          setCurrentView('tools');
        }}
        onAskInChat={(promptText) => handleNewConversation(undefined, promptText)}
        onShowToast={showToast}
        onApplySearchCodeResult={handleApplySearchCodeResult}
      />

      <OfflineIndicator onOpenOfflineChat={() => setCurrentView('chat')} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
