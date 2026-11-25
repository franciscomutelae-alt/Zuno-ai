import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Logo } from '../components/common/Logo';
import {
  X,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Plus,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { authModeToPath, BRAND_CONFIG } from '../config/brand';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'signup' | 'switch';
  onClose: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onModeChange?: (mode: 'login' | 'signup' | 'switch') => void;
  publicSignupEnabled?: boolean;
}

const GoogleMark: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onShowToast,
  onModeChange,
  publicSignupEnabled = true,
}) => {
  const {
    user,
    keepSignedIn,
    setKeepSignedIn,
    knownAccounts,
    loginWithGoogle,
    switchAccountWithGoogle,
  } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<'login' | 'signup' | 'switch'>(initialMode);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
    }
  }, [isOpen, initialMode]);

  const switchMode = (next: 'login' | 'signup' | 'switch') => {
    setErrorMessage(null);
    setMode(next);
    onModeChange?.(next);
  };

  if (!isOpen) return null;

  const handleGoogleAction = async (loginHint?: string) => {
    if (mode === 'signup' && !publicSignupEnabled) {
      setErrorMessage(t('auth.signup_disabled'));
      return;
    }
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      if (mode === 'switch' || user) {
        await switchAccountWithGoogle(loginHint);
        onShowToast(t('auth.toast_switch_ok'), 'success');
      } else {
        await loginWithGoogle(keepSignedIn, loginHint);
        onShowToast(
          mode === 'signup' ? t('auth.toast_signup_ok') : t('auth.toast_login_ok'),
          'success'
        );
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message || t('auth.toast_google_err');
      setErrorMessage(msg);
      onShowToast(msg, 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const canonicalAuthUrl = `${BRAND_CONFIG.primaryDomain}${authModeToPath(mode)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative max-w-md w-full rounded-3xl border border-slate-800 bg-[#070b18] p-7 sm:p-8 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-block">
            <Logo size="md" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            {mode === 'login' && t('auth.title_login')}
            {mode === 'signup' && t('auth.title_signup')}
            {mode === 'switch' && t('auth.title_switch')}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {mode === 'login' && t('auth.desc_login')}
            {mode === 'signup' && t('auth.desc_signup')}
            {mode === 'switch' && t('auth.desc_switch')}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-blue-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{canonicalAuthUrl}</span>
          </div>
        </div>

        {/* Signup Paused Notice */}
        {mode === 'signup' && !publicSignupEnabled && (
          <div className="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-950/30 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{t('auth.signup_disabled')}</span>
          </div>
        )}

        {/* Error Box */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Known Accounts Directory */}
        {knownAccounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t('auth.saved_accounts')}
            </p>
            <div className="space-y-2">
              {knownAccounts.slice(0, 4).map((acct) => {
                const isCurrent =
                  Boolean(user) &&
                  (user?.id === acct.uid || user?.email?.toLowerCase() === acct.email.toLowerCase());
                return (
                  <button
                    key={acct.uid}
                    type="button"
                    disabled={isCurrent || isGoogleLoading}
                    onClick={() => handleGoogleAction(acct.email)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isCurrent
                        ? 'border-emerald-500/40 bg-emerald-950/20 cursor-default'
                        : 'border-slate-800 bg-slate-900/70 hover:border-blue-500/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {acct.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{acct.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{acct.email}</p>
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {t('auth.active_badge')}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-blue-400">
                        {t('auth.use_badge')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Google Sign-In / Sign-Up Primary Action */}
        <div className="space-y-4">
          <button
            type="button"
            disabled={isGoogleLoading || (mode === 'signup' && !publicSignupEnabled)}
            onClick={() => handleGoogleAction()}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm shadow-lg transition-all cursor-pointer active:scale-[0.99] disabled:opacity-55 disabled:cursor-not-allowed ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-600/30'
                : 'bg-white hover:bg-slate-100 text-slate-900'
            }`}
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <GoogleMark />
            )}
            <span>
              {isGoogleLoading
                ? t('welcome.google_connecting')
                : mode === 'signup'
                ? t('auth.google_btn_signup')
                : mode === 'switch'
                ? t('auth.google_btn_switch')
                : t('auth.google_btn_login')}
            </span>
          </button>

          <label className="flex items-center justify-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
            />
            <span>{t('welcome.keep_signed_in')}</span>
          </label>

          <div className="p-3 rounded-2xl border border-slate-800/80 bg-slate-900/50 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>{t('auth.google_note')}</span>
          </div>
        </div>

        {/* Mode Switch Links */}
        <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/80 space-y-2">
          {mode === 'login' ? (
            <p className="pt-1">
              {t('auth.no_account')}{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                {t('nav.signup')}
              </button>
            </p>
          ) : (
            <p className="pt-1">
              {t('auth.has_account')}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                {t('nav.login')}
              </button>
            </p>
          )}

          {user && mode !== 'switch' && (
            <button
              type="button"
              onClick={() => switchMode('switch')}
              className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 hover:underline cursor-pointer"
            >
              <ArrowRightLeft className="w-3 h-3" />
              <span>{t('auth.switch_action')}</span>
            </button>
          )}

          {mode === 'switch' && (
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-300 hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t('auth.create_new')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
