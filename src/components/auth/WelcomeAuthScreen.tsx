import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Language } from '../../types';
import { Logo } from '../common/Logo';
import {
  UserPlus,
  LogIn,
  Globe,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';

interface WelcomeAuthScreenProps {
  onOpenAuthModal: (mode: 'login' | 'signup') => void;
  onEnterGuest: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  publicSignupEnabled?: boolean;
  guestAccessEnabled?: boolean;
}

const LANGUAGE_OPTIONS: Array<{ code: Language; label: string }> = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

export const WelcomeAuthScreen: React.FC<WelcomeAuthScreenProps> = ({
  onOpenAuthModal,
  onEnterGuest,
  onShowToast,
  publicSignupEnabled = true,
  guestAccessEnabled = true,
}) => {
  const {
    loginWithGoogle,
    keepSignedIn,
    setKeepSignedIn,
    knownAccounts,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async (loginHint?: string) => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      await loginWithGoogle(keepSignedIn, loginHint);
      onShowToast(t('auth.toast_login_ok'), 'success');
    } catch (err: any) {
      const msg = err?.message || t('auth.toast_google_err');
      setErrorMsg(msg);
      onShowToast(msg, 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Electric Blue & Purple Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-[520px] h-[520px] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[520px] h-[520px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 space-y-6">
        {/* Card */}
        <div className="rounded-3xl border border-slate-800/90 bg-[#080d1e]/95 backdrop-blur-2xl p-6 sm:p-9 shadow-2xl shadow-black/70 space-y-6">
          {/* Top International Language Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-800/70">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-300">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('welcome.international_pill')}</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLanguage(opt.code)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                    language === opt.code
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Header & Brand */}
          <div className="text-center space-y-3">
            <div className="inline-flex justify-center">
              <Logo size="lg" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 text-[11px] font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Intelligence Without Limits</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t('welcome.title')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {t('welcome.subtitle')}
            </p>
          </div>

          {/* Inline Error Alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/30 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Remembered Accounts Quick Re-Auth */}
          {knownAccounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t('welcome.known_accounts')}
              </p>
              <div className="space-y-2">
                {knownAccounts.slice(0, 3).map((acct) => (
                  <button
                    key={acct.uid}
                    type="button"
                    disabled={isGoogleLoading}
                    onClick={() => handleGoogleSignIn(acct.email)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-blue-500/50 hover:bg-slate-900 transition-all cursor-pointer text-left"
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
                    <span className="text-[11px] font-semibold text-blue-400 shrink-0">
                      {t('welcome.continue_arrow')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Primary Welcome Options (All Google-powered Sign Up & Sign In + Guest) */}
          <div className="space-y-3">
            {/* 1. Continuar com Google */}
            <button
              type="button"
              disabled={isGoogleLoading}
              onClick={() => handleGoogleSignIn()}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg transition-all cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
              )}
              <span>
                {isGoogleLoading ? t('welcome.google_connecting') : t('welcome.google_continue')}
              </span>
            </button>

            {/* 2 & 3: Criar conta com Google & Iniciar sessão com Google */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!publicSignupEnabled}
                onClick={() => onOpenAuthModal('signup')}
                title={!publicSignupEnabled ? t('auth.signup_disabled') : undefined}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-600/25 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>{t('welcome.create_account')}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAuthModal('login')}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 hover:border-blue-500/50 text-white font-bold text-xs tracking-wide transition-all cursor-pointer active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{t('welcome.sign_in')}</span>
              </button>
            </div>

            {/* Keep Signed In Toggle */}
            <label className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              <span>{t('welcome.keep_signed_in')}</span>
            </label>

            {guestAccessEnabled && (
              <>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase">
                    <span className="bg-[#080d1e] px-3 text-slate-500 font-semibold">
                      {t('welcome.guest_divider')}
                    </span>
                  </div>
                </div>

                {/* 4. Continuar como visitante */}
                <button
                  type="button"
                  onClick={onEnterGuest}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span>{t('welcome.guest_button')}</span>
                </button>
              </>
            )}
          </div>

          {/* Transparent Permissions Comparison */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <p className="font-bold text-blue-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('welcome.account_box_title')}</span>
              </p>
              <p className="text-slate-400 leading-relaxed">
                {t('welcome.account_box_desc')}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
              <p className="font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('welcome.guest_box_title')}</span>
              </p>
              <p className="text-slate-400 leading-relaxed">
                {t('welcome.guest_box_desc')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{t('welcome.footer_badge')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
