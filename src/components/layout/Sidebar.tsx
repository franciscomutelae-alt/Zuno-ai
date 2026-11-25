import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Conversation, SearchBarCodeActionType, SearchCodeExecutionResult } from '../../types';
import { Logo } from '../common/Logo';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { isCreatorRecognitionQuery } from '../../config/brand';
import { checkSearchCodeApi, executeSearchCodeApi } from '../../services/api';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Trash2, 
  Edit3, 
  Pin, 
  Check, 
  X, 
  Wrench, 
  CreditCard, 
  Settings, 
  Sparkles,
  ChevronRight,
  FolderKanban,
  PanelLeftClose,
  PanelLeft,
  MessageSquareText,
  Lock,
  UserPlus,
  LogIn,
  ShieldCheck,
  Bookmark
} from 'lucide-react';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onNavigate: (view: string) => void;
  onRequireAuth?: (featureLabel?: string) => void;
  onOpenAuth?: (mode: 'login' | 'signup' | 'switch') => void;
  onOpenFavorites?: () => void;
  onApplySearchCodeResult?: (res: SearchCodeExecutionResult) => void | Promise<void>;
  favoritesCount?: number;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  onNavigate,
  onRequireAuth,
  onOpenAuth,
  onOpenFavorites,
  onApplySearchCodeResult,
  favoritesCount = 0,
  isOpen,
  onToggle,
}) => {
  const { t } = useLanguage();
  const { user, isAuthenticated, isGuest, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [matchedCode, setMatchedCode] = useState<{
    code: string;
    purpose?: string;
    actionType?: SearchBarCodeActionType;
  } | null>(null);
  const [executingCode, setExecutingCode] = useState(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2 || isCreatorRecognitionQuery(trimmed)) {
      setMatchedCode(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSearchCodeApi(trimmed).then((res) => {
        if (!cancelled) {
          setMatchedCode(res.matched && res.code ? { code: res.code, purpose: res.purpose, actionType: res.actionType } : null);
        }
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleExecuteMatchedCode = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || executingCode) return;
    setExecutingCode(true);
    try {
      const res = await executeSearchCodeApi(trimmed);
      if (res.matched) {
        await onApplySearchCodeResult?.(res);
        if (res.executed) {
          setSearchQuery('');
          setMatchedCode(null);
        }
      }
    } finally {
      setExecutingCode(false);
    }
  };

  // Keyboard shortcut (Ctrl+B or Cmd+B) to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGuest) {
      onRequireAuth?.('Guardar e organizar histórico pessoal');
      return;
    }
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const messageProgress = user
    ? Math.min(100, Math.round((user.messageCountToday / user.maxMessagesToday) * 100))
    : 0;

  return (
    <>
      {/* Mobile backdrop overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sidebar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Floating Open Toggle Button (when sidebar is closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="sidebar-toggle-btn"
            initial={{ opacity: 0, scale: 0.85, x: -24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: -24 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggle}
            className="fixed top-20 left-3 z-30 p-2.5 rounded-xl bg-[#070b18]/95 border border-slate-700/80 text-slate-300 hover:text-white hover:border-blue-500/60 shadow-xl backdrop-blur-md cursor-pointer transition-colors group flex items-center gap-2"
            title="Abrir Barra Lateral (Ctrl + B)"
          >
            <PanelLeft className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="text-[11px] font-semibold pr-1 hidden sm:inline text-slate-300 group-hover:text-white">
              {isGuest ? 'Menu' : 'Conversas'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Animated Sidebar Drawer */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.aside
            key="sidebar-drawer"
            initial={{ width: 0, opacity: 0 }}
            animate={{ 
              width: 320, 
              opacity: 1,
              transition: { 
                width: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.22, ease: 'easeOut' }
              }
            }}
            exit={{ 
              width: 0, 
              opacity: 0,
              transition: { 
                width: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.18, ease: 'easeIn' }
              }
            }}
            className="fixed md:relative inset-y-0 left-0 md:inset-auto h-full flex flex-col bg-[#070b18] border-r border-slate-800/80 shrink-0 select-none z-40 md:z-20 overflow-hidden shadow-2xl md:shadow-none"
          >
            {/* Fixed-width internal content wrapper to prevent reflow / awkward wrapping during width animation */}
            <div className="w-80 h-full flex flex-col shrink-0">
              {/* Top Header */}
              <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={() => onNavigate('landing')}
                  className="cursor-pointer focus:outline-none"
                >
                  <Logo size="sm" />
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onToggle}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                  title="Recolher Barra Lateral (Ctrl + B)"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </motion.button>
              </div>

      {/* New Chat Button or Guest Reset */}
      <div className="p-3">
        <button
          onClick={() => {
            if (isGuest) {
              onRequireAuth?.('Criar múltiplas conversas guardadas');
            } else {
              onNewConversation();
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          {isGuest ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
          <span>{isGuest ? 'Nova conversa (Conta necessária)' : t('nav.new_chat')}</span>
        </button>
      </div>

      {/* Search Bar (authenticated only) */}
      {isAuthenticated && (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matchedCode) {
                  e.preventDefault();
                  handleExecuteMatchedCode();
                }
              }}
              placeholder={t('chat.search_history')}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {isCreatorRecognitionQuery(searchQuery) && (
            <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/40">
              <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Seja bem-vindo, Francisco Mutela Emanuel!</span>
              </p>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Criador oficial da plataforma ZUNO AI reconhecido.
              </p>
            </div>
          )}
          {matchedCode && !isCreatorRecognitionQuery(searchQuery) && (
            <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 border border-purple-500/40 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
                  <span>{matchedCode.code}</span>
                </p>
                <p className="text-[10px] text-slate-300 truncate">{matchedCode.purpose}</p>
              </div>
              <button
                type="button"
                disabled={executingCode}
                onClick={handleExecuteMatchedCode}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold shrink-0 cursor-pointer disabled:opacity-50"
              >
                {executingCode ? '...' : 'Ativar'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Conversation List or Guest Notice */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {isGuest ? (
          <div className="mx-1 mt-1 p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Modo Visitante • Pesquisa Pública</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Como visitante podes fazer pesquisas públicas, mas o histórico pessoal não é guardado na conta e ferramentas avançadas estão bloqueadas.
            </p>
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuth?.('signup')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                <span>Criar conta</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
              >
                <LogIn className="w-3 h-3" />
                <span>Iniciar sessão</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Histórico pessoal
            </div>

            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {t('chat.no_conversations')}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                const isEditing = conv.id === editingId;

                return (
                  <motion.div
                    key={conv.id}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-blue-600/20 text-white border border-blue-500/30 font-medium'
                        : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'
                        }`}
                      />
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate">{conv.title}</span>
                      )}
                    </div>

                    {/* Actions: Rename / Delete */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={(e) => saveRename(conv.id, e)}
                            className="p-1 text-emerald-400 hover:text-emerald-300"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-1 text-slate-400 hover:text-slate-300"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => startRename(conv, e)}
                            className="p-1 text-slate-400 hover:text-white"
                            title={t('chat.rename')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400"
                            title={t('chat.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Quick Nav Tools & Modules */}
      <div className="p-2 border-t border-slate-800/80 space-y-1">
        <button
          onClick={() => (isGuest ? onRequireAuth?.('Estúdio ZUNO AI IMAGE') : onNavigate('image'))}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-purple-300 hover:text-white bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">ZUNO AI IMAGE</span>
          </div>
          {isGuest ? (
            <Lock className="w-3.5 h-3.5 text-purple-300" />
          ) : (
            <span className="text-[9px] uppercase font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
              Estúdio
            </span>
          )}
        </button>

        <button
          onClick={() => onNavigate('tools')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Wrench className="w-3.5 h-3.5 text-blue-400" />
            <span>{isGuest ? 'Pesquisa Pública (Ferramentas)' : 'Ferramentas ZUNO (10)'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate('pricing')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Planos e benefícios</span>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
            {user?.plan || (isGuest ? 'Visitante' : 'Free')}
          </span>
        </button>

        <button
          onClick={() => onNavigate('feedback')}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquareText className="w-3.5 h-3.5 text-blue-400" />
            <span>Avaliações & Feedback</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <button
          onClick={() => (isGuest ? onRequireAuth?.('Favoritos sincronizados na conta') : onOpenFavorites?.())}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-400" />
            <span>Favoritos Guardados</span>
          </div>
          {isGuest ? (
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded">
              {favoritesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => (isGuest ? onRequireAuth?.('Definições privadas e memória') : onNavigate('settings'))}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span>Definições & Memória</span>
          </div>
          {isGuest ? (
            <Lock className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {isAdmin && (
          <button
            onClick={() => onNavigate('admin')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Painel Admin</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
      </div>

      {/* Plan Usage & Profile Footer (Authenticated) */}
      {isAuthenticated && user && (
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/30">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400">Quota diária:</span>
            <span className="font-semibold text-slate-300">
              {user.messageCountToday} / {user.maxMessagesToday > 9999 ? '∞' : user.maxMessagesToday}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                messageProgress > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${messageProgress}%` }}
            />
          </div>

          <div
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-white truncate">{user.name}</span>
              <span className="text-[10px] text-slate-400 truncate">{user.email}</span>
            </div>
          </div>
        </div>
      )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};
