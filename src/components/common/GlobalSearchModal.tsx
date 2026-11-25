import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  MessageSquare,
  Wrench,
  Sparkles,
  Bookmark,
  Compass,
  ArrowRight,
  Globe,
  ShieldCheck,
  CreditCard,
  Settings,
  MessageSquareText,
  Home,
  KeyRound,
  CornerDownLeft,
} from 'lucide-react';
import {
  Conversation,
  FavoriteItem,
  SearchBarCodeActionType,
  SearchCodeExecutionResult,
  ToolId,
} from '../../types';
import { ZUNO_TOOLS } from '../../data/tools';
import { useAuth } from '../../contexts/AuthContext';
import { isCreatorRecognitionQuery } from '../../config/brand';
import { checkSearchCodeApi, executeSearchCodeApi } from '../../services/api';
import { checkOfflineSearchCode, executeOfflineSearchCode } from '../../services/offlineCreator';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  favorites: FavoriteItem[];
  onNavigate: (view: string) => void;
  onSelectConversation: (convId: string) => void;
  onOpenTool: (toolId: ToolId) => void;
  onAskInChat: (prompt: string) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onApplySearchCodeResult: (res: SearchCodeExecutionResult) => void | Promise<void>;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  conversations,
  favorites,
  onNavigate,
  onSelectConversation,
  onOpenTool,
  onAskInChat,
  onShowToast,
  onApplySearchCodeResult,
}) => {
  const { user, isAuthenticated, isAdmin, isCreatorOfflineAccount, creatorOfflineMode, isOnline } = useAuth();
  const [query, setQuery] = useState('');
  const [matchedCode, setMatchedCode] = useState<{
    code: string;
    purpose?: string;
    actionType?: SearchBarCodeActionType;
  } | null>(null);
  const [executingCode, setExecutingCode] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isUsingCreatorOffline = Boolean(
    isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setMatchedCode(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2 || isCreatorRecognitionQuery(trimmed)) {
      setMatchedCode(null);
      return;
    }
    if (isUsingCreatorOffline) {
      const res = checkOfflineSearchCode(trimmed);
      setMatchedCode(
        res.matched && res.code
          ? { code: res.code, purpose: res.purpose, actionType: res.actionType }
          : null
      );
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSearchCodeApi(trimmed).then((res) => {
        if (!cancelled) {
          setMatchedCode(
            res.matched && res.code
              ? { code: res.code, purpose: res.purpose, actionType: res.actionType }
              : null
          );
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen, isUsingCreatorOffline]);

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const isCreatorCode = isCreatorRecognitionQuery(trimmed);

  const pages = useMemo(() => {
    const base = [
      { id: 'landing', label: 'Início', desc: 'Página principal da plataforma ZUNO AI', icon: Home },
      { id: 'chat', label: 'Chat ZUNO AI', desc: 'Conversar com a IA em tempo real ou offline', icon: MessageSquare },
      { id: 'image', label: 'ZUNO AI IMAGE', desc: 'Criar e editar imagens em alta definição', icon: Sparkles },
      { id: 'tools', label: 'Ferramentas', desc: 'Suite com 10 ferramentas especializadas', icon: Wrench },
      { id: 'pricing', label: 'Planos & VIP', desc: 'Comparar planos Free, Premium, Pro e Ultra', icon: CreditCard },
      { id: 'feedback', label: 'Avaliações & Feedback', desc: 'Enviar comentários e sugestões de melhoria', icon: MessageSquareText },
      { id: 'settings', label: 'Definições da Conta', desc: 'Perfil, memória, segurança e modo offline', icon: Settings },
    ];
    if (isAdmin) {
      base.push({
        id: 'admin',
        label: 'Painel Admin',
        desc: 'Gestão de utilizadores, códigos e métricas',
        icon: ShieldCheck,
      });
    }
    if (!lower) return base.slice(0, 6);
    return base.filter(
      (p) => p.label.toLowerCase().includes(lower) || p.desc.toLowerCase().includes(lower)
    );
  }, [isAdmin, lower]);

  const matchedTools = useMemo(() => {
    if (!lower) return ZUNO_TOOLS.slice(0, 4);
    return ZUNO_TOOLS.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lower) ||
        tool.shortDesc.toLowerCase().includes(lower) ||
        tool.category.toLowerCase().includes(lower)
    ).slice(0, 5);
  }, [lower]);

  const matchedConversations = useMemo(() => {
    if (!conversations.length) return [];
    if (!lower) return conversations.slice(0, 4);
    return conversations
      .filter((conv) => {
        if (conv.title.toLowerCase().includes(lower)) return true;
        return conv.messages.some((m) => m.content.toLowerCase().includes(lower));
      })
      .slice(0, 5);
  }, [conversations, lower]);

  const matchedFavorites = useMemo(() => {
    if (!favorites.length || !lower) return [];
    return favorites
      .filter(
        (fav) =>
          fav.content.toLowerCase().includes(lower) ||
          (fav.conversationTitle || '').toLowerCase().includes(lower)
      )
      .slice(0, 4);
  }, [favorites, lower]);

  if (!isOpen) return null;

  const handleRunCustomCode = async () => {
    if (!trimmed || executingCode) return;
    setExecutingCode(true);
    try {
      const res = isUsingCreatorOffline
        ? executeOfflineSearchCode(trimmed)
        : await executeSearchCodeApi(trimmed);
      if (res.matched) {
        await onApplySearchCodeResult(res);
        onClose();
      }
    } finally {
      setExecutingCode(false);
    }
  };

  const handleSubmitPrimary = () => {
    if (!trimmed) return;
    if (isCreatorCode) {
      onShowToast('Seja bem-vindo, Francisco Mutela Emanuel!', 'success');
      onAskInChat(trimmed);
      onClose();
      return;
    }
    if (matchedCode) {
      handleRunCustomCode();
      return;
    }
    onAskInChat(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#080d1e]/98 shadow-2xl shadow-blue-950/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
          <Search className="w-5 h-5 text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmitPrimary();
              }
            }}
            placeholder="Busca global: conversas, ferramentas, páginas, favoritos ou códigos..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-md border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[65vh] overflow-y-auto p-3 space-y-4">
          {/* Creator Recognition Banner */}
          {isCreatorCode && (
            <button
              type="button"
              onClick={handleSubmitPrimary}
              className="w-full p-3.5 rounded-xl bg-gradient-to-r from-blue-600/25 via-indigo-600/25 to-purple-600/25 border border-blue-500/40 flex items-center justify-between gap-3 text-left cursor-pointer hover:border-blue-400"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-300 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Seja bem-vindo, Francisco Mutela Emanuel!</p>
                  <p className="text-[11px] text-slate-300">Identidade de criador da plataforma ZUNO AI reconhecida.</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-blue-300 shrink-0" />
            </button>
          )}

          {/* Custom Admin Search Code Match */}
          {matchedCode && !isCreatorCode && (
            <button
              type="button"
              disabled={executingCode}
              onClick={handleRunCustomCode}
              className="w-full p-3.5 rounded-xl bg-gradient-to-r from-purple-600/25 to-indigo-600/25 border border-purple-500/40 flex items-center justify-between gap-3 text-left cursor-pointer hover:border-purple-400 disabled:opacity-60"
            >
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="w-5 h-5 text-purple-300 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    Executar código {matchedCode.code}
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">{matchedCode.purpose}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[11px] font-bold shrink-0">
                {executingCode ? 'A executar...' : 'Ativar'}
              </span>
            </button>
          )}

          {/* Direct Ask ZUNO AI Action */}
          {trimmed && !isCreatorCode && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleSubmitPrimary}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-white truncate">
                    Perguntar ao ZUNO AI: "{trimmed}"
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 font-medium shrink-0">
                  <CornerDownLeft className="w-3 h-3" />
                  Enter
                </span>
              </button>
            </div>
          )}

          {/* Conversations */}
          {matchedConversations.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" />
                Conversas
              </p>
              <div className="space-y-1">
                {matchedConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-100 truncate">{conv.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {conv.messages[conv.messages.length - 1]?.content?.slice(0, 90) || 'Conversa sem mensagens'}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {matchedTools.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Wrench className="w-3 h-3" />
                Ferramentas ZUNO AI
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {matchedTools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      onOpenTool(tool.id);
                      onClose();
                    }}
                    className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/80 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{tool.name}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{tool.shortDesc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          {matchedFavorites.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Bookmark className="w-3 h-3" />
                Favoritos Guardados
              </p>
              <div className="space-y-1">
                {matchedFavorites.map((fav) => (
                  <button
                    key={fav.id}
                    type="button"
                    onClick={() => {
                      if (fav.conversationId) {
                        onSelectConversation(fav.conversationId);
                      } else {
                        onNavigate('chat');
                      }
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-300 truncate">
                        {fav.conversationTitle || 'Favorito'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{fav.content.slice(0, 100)}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pages / Navigation */}
          {pages.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Compass className="w-3 h-3" />
                Navegação Rápida
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {pages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onNavigate(p.id);
                        onClose();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate">{p.label}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-500">
          <span>Busca Global ZUNO AI</span>
          <span className="hidden sm:inline">Atalho: Ctrl+K / ⌘K</span>
        </div>
      </div>
    </div>
  );
};
