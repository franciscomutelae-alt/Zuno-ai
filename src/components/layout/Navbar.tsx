import React, { useState } from 'react';
import { Logo } from '../common/Logo';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { Language, UserNotification } from '../../types';
import { 
  Globe, 
  Menu, 
  X, 
  Sparkles, 
  MessageSquare, 
  Wrench, 
  CreditCard, 
  ShieldCheck, 
  Settings, 
  User as UserIcon,
  LogOut,
  ChevronDown,
  Bell,
  MessageSquareText,
  CheckCheck,
  RefreshCw,
  Lock,
  Wifi,
  WifiOff,
  Search
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenAuth: (mode: 'login' | 'signup' | 'switch') => void;
  onNavigateSettingsTab?: (tab: 'profile' | 'personality' | 'memory' | 'security' | 'notifications') => void;
  onRequireAuth?: (featureLabel?: string) => void;
  notifications?: UserNotification[];
  unreadCount?: number;
  onMarkAllRead?: () => void;
  onOpenNotification?: (notif: UserNotification) => void;
  onOpenGlobalSearch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenAuth,
  onNavigateSettingsTab,
  onRequireAuth,
  notifications = [],
  unreadCount = 0,
  onMarkAllRead,
  onOpenNotification,
  onOpenGlobalSearch,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const {
    user,
    isAuthenticated,
    isGuest,
    logout,
    exitGuestModeToWelcome,
    isAdmin,
    updateProfile,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    setCreatorOfflineMode,
    isOnline,
  } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const languages: Array<{ code: Language; label: string; flag: string }> = [
    { code: 'pt', label: 'Português', flag: '🇵🇹' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
  ];

  const handleNavClick = (view: string) => {
    if (isGuest && view === 'image') {
      setMobileMenuOpen(false);
      onRequireAuth?.('Estúdio ZUNO AI IMAGE');
      return;
    }
    if (isGuest && view === 'settings') {
      setMobileMenuOpen(false);
      onRequireAuth?.('Configurações da Conta');
      return;
    }
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const openSettingsSection = (tab: 'profile' | 'personality' | 'memory' | 'security' | 'notifications') => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    if (onNavigateSettingsTab) {
      onNavigateSettingsTab(tab);
    } else {
      onNavigate('settings');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#050814]/90 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 lg:px-6 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <button 
          onClick={() => handleNavClick('landing')}
          className="flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer focus:outline-none"
        >
          <Logo size="md" />
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 text-[13px] font-medium whitespace-nowrap shrink-0">
          <button
            onClick={() => handleNavClick('landing')}
            className={`px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'landing'
                ? 'text-white bg-slate-800/60 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-850/40'
            }`}
          >
            {t('nav.home')}
          </button>

          <button
            onClick={() => handleNavClick('chat')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'chat'
                ? 'text-white bg-blue-600/20 border border-blue-500/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{isGuest ? 'Pesquisa Pública' : t('nav.chat')}</span>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </button>

          <button
            onClick={() => handleNavClick('image')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'image'
                ? 'text-white bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-purple-500/40 font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
            <span>ZUNO Image</span>
            {isGuest ? (
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
            ) : (
              <span className="text-[10px] bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
                NOVO
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavClick('tools')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'tools'
                ? 'text-white bg-purple-600/20 border border-purple-500/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Wrench className="w-4 h-4 text-purple-400 shrink-0" />
            <span>{t('nav.tools')}</span>
          </button>

          <button
            onClick={() => handleNavClick('pricing')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'pricing'
                ? 'text-white bg-slate-800/60 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t('nav.pricing')}</span>
          </button>

          <button
            onClick={() => handleNavClick('feedback')}
            className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === 'feedback'
                ? 'text-white bg-blue-600/20 border border-blue-500/30 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <MessageSquareText className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Feedback</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => handleNavClick('admin')}
              className={`flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'admin'
                  ? 'text-amber-300 bg-amber-500/20 border border-amber-500/30 font-semibold'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden xl:inline">{t('nav.admin')}</span>
              <span className="xl:hidden">Admin</span>
            </button>
          )}
        </nav>

        {/* Right Section: Global Search + Creator Offline Toggle + PWA Install + Language + Auth / Profile */}
        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 shrink-0 whitespace-nowrap">
          {onOpenGlobalSearch && (
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 hover:bg-slate-800/80 hover:border-blue-500/40 text-slate-300 hover:text-white text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer"
              title="Busca Global (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="hidden 2xl:inline text-slate-400">Buscar...</span>
              <kbd className="hidden xl:inline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
                ⌘K
              </kbd>
            </button>
          )}
          {isAuthenticated && isCreatorOfflineAccount && (
            <button
              type="button"
              onClick={() => {
                if (!isOnline && creatorOfflineMode) return;
                setCreatorOfflineMode(!creatorOfflineMode);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                creatorOfflineMode
                  ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-900/70 border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-600'
              }`}
              title="Versão Offline exclusiva da conta do criador (franciscomutelae@gmail.com)"
            >
              {creatorOfflineMode ? (
                <WifiOff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Wifi className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              <span className="hidden xl:inline">{creatorOfflineMode ? 'Offline Criador' : 'Modo Offline'}</span>
              <span className="xl:hidden">{creatorOfflineMode ? 'Offline' : 'Online'}</span>
            </button>
          )}
          <PWAInstallButton compact />

          {/* Language Selector Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-600 transition-colors text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="uppercase">{language}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-800 bg-[#0b1120] p-1.5 shadow-2xl shadow-black z-50 animate-in fade-in zoom-in-95">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLanguage(l.code);
                      if (isAuthenticated) {
                        updateProfile({ language: l.code });
                      }
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      language === l.code
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <span>{l.label}</span>
                    <span>{l.flag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Bell (Authenticated Users) */}
          {isAuthenticated && user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifDropdownOpen(!notifDropdownOpen);
                  setLangDropdownOpen(false);
                  setUserDropdownOpen(false);
                }}
                className="relative p-2 rounded-lg border border-slate-700/60 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-600 transition-colors cursor-pointer"
                aria-label="Notificações"
                title="Notificações de respostas oficiais"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-800 bg-[#0b1120] p-2 shadow-2xl shadow-black z-50 space-y-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800">
                    <span className="text-xs font-bold text-white">Notificações</span>
                    {unreadCount > 0 && onMarkAllRead && (
                      <button
                        type="button"
                        onClick={() => onMarkAllRead()}
                        className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        <span>Marcar lidas</span>
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                      Sem notificações de respostas neste momento.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/70">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            onOpenNotification?.(n);
                            setNotifDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer ${
                            !n.isRead ? 'bg-blue-600/10' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-blue-300 truncate">
                              {n.title}
                            </span>
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Profile or Guest / Login/Signup */}
          {isAuthenticated && user ? (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setUserDropdownOpen(!userDropdownOpen);
                  setLangDropdownOpen(false);
                  setNotifDropdownOpen(false);
                }}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-slate-700/60 bg-slate-900/70 hover:border-blue-500/40 transition-colors cursor-pointer group shrink-0"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="hidden xl:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white max-w-[90px] truncate">
                    {user.name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 leading-none">
                    {user.plan}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-800 bg-[#0b1120] p-1.5 shadow-2xl shadow-black z-50">
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  </div>

                  <button
                    onClick={() => openSettingsSection('profile')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Minha conta</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenAuth('switch');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                    <span>Trocar de conta</span>
                  </button>

                  <button
                    onClick={() => openSettingsSection('personality')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Configurações</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onNavigate('pricing');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Plano e benefícios</span>
                  </button>

                  <button
                    onClick={() => openSettingsSection('security')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Privacidade e segurança</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        onNavigate('admin');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('nav.admin')}</span>
                    </button>
                  )}

                  <div className="h-px bg-slate-800 my-1" />

                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>Terminar sessão</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isGuest && (
                <button
                  type="button"
                  onClick={() => exitGuestModeToWelcome()}
                  className="px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/90 text-[11px] font-medium text-slate-300 hover:text-white hover:border-blue-500/40 transition-colors cursor-pointer"
                  title="Voltar ao ecrã de autenticação"
                >
                  Visitante
                </button>
              )}
              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                Iniciar sessão
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-md shadow-indigo-600/25 transition-all cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Criar conta</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Search + Bell + Hamburger */}
        <div className="flex items-center gap-1.5 lg:hidden">
          {onOpenGlobalSearch && (
            <button
              type="button"
              onClick={onOpenGlobalSearch}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Busca Global"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          {isAuthenticated && user && (
            <button
              type="button"
              onClick={() => handleNavClick('feedback')}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              aria-label="Notificações e Feedback"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-slate-800 bg-[#070c1a] px-4 pt-2 pb-6 space-y-3">
          <div className="space-y-1">
            <button
              onClick={() => handleNavClick('landing')}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              {t('nav.home')}
            </button>
            <button
              onClick={() => handleNavClick('chat')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white bg-blue-600/20 border border-blue-500/30 font-medium"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                {isGuest ? 'Pesquisa Pública' : t('nav.chat')}
              </span>
              <span className="text-[10px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded-full">
                LIVE
              </span>
            </button>
            <button
              onClick={() => handleNavClick('image')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-purple-300 bg-purple-600/15 border border-purple-500/30 font-medium"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                ZUNO AI IMAGE (Estúdio)
              </span>
              {isGuest ? (
                <Lock className="w-3.5 h-3.5 text-slate-300" />
              ) : (
                <span className="text-[10px] bg-purple-500 text-white font-bold px-2 py-0.5 rounded-full">
                  NOVO
                </span>
              )}
            </button>
            <button
              onClick={() => handleNavClick('tools')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              <Wrench className="w-4 h-4 text-purple-400" />
              {t('nav.tools')}
            </button>
            <button
              onClick={() => handleNavClick('pricing')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Plano e benefícios
            </button>
            <button
              onClick={() => handleNavClick('feedback')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-slate-800"
            >
              <MessageSquareText className="w-4 h-4 text-blue-400" />
              Avaliações & Feedback
            </button>
            {isAdmin && (
              <button
                onClick={() => handleNavClick('admin')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-400 bg-amber-500/10"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                {t('nav.admin')}
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">Idioma:</span>
            <div className="flex gap-1">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    if (isAuthenticated) {
                      updateProfile({ language: l.code });
                    }
                  }}
                  className={`px-2 py-1 text-xs rounded ${
                    language === l.code ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {isAuthenticated && isCreatorOfflineAccount && (
            <button
              type="button"
              onClick={() => {
                if (!isOnline && creatorOfflineMode) return;
                setCreatorOfflineMode(!creatorOfflineMode);
              }}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                creatorOfflineMode
                  ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-200'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
              }`}
            >
              {creatorOfflineMode ? (
                <WifiOff className="w-4 h-4 text-emerald-400" />
              ) : (
                <Wifi className="w-4 h-4 text-blue-400" />
              )}
              <span>
                {creatorOfflineMode ? 'Versão Offline do Criador: ATIVA' : 'Ativar Versão Offline do Criador'}
              </span>
            </button>
          )}

          <div className="flex justify-center pt-1">
            <PWAInstallButton />
          </div>

          {isAuthenticated && user ? (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs overflow-hidden">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-blue-400 uppercase font-bold">{user.plan}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => openSettingsSection('profile')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-200"
                >
                  <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Minha conta</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('switch');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-200"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Trocar de conta</span>
                </button>
                <button
                  onClick={() => openSettingsSection('personality')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-200"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Configurações</span>
                </button>
                <button
                  onClick={() => handleNavClick('pricing')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-200"
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Plano e benefícios</span>
                </button>
                <button
                  onClick={() => openSettingsSection('security')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-xs text-slate-200"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Privacidade e segurança</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 text-xs text-rose-400 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Terminar sessão</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 space-y-2">
              {isGuest && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    exitGuestModeToWelcome();
                  }}
                  className="w-full py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 text-center"
                >
                  Ecrã inicial de autenticação (Visitante)
                </button>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onOpenAuth('login');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 text-center"
                >
                  Iniciar sessão
                </button>
                <button
                  onClick={() => {
                    onOpenAuth('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 text-center"
                >
                  Criar conta
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
