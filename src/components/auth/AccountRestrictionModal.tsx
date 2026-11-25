import React, { useState } from 'react';
import { Lock, UserPlus, LogIn, X, Globe, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { GUEST_RESTRICTION_MESSAGE } from '../../types';

interface AccountRestrictionModalProps {
  isOpen: boolean;
  featureLabel?: string;
  onClose: () => void;
  onSignup: () => void;
  onLogin: () => void;
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const AccountRestrictionModal: React.FC<AccountRestrictionModalProps> = ({
  isOpen,
  featureLabel,
  onClose,
  onSignup,
  onLogin,
  onShowToast,
}) => {
  const { loginWithGoogle, keepSignedIn } = useAuth();
  const { t } = useLanguage();
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await loginWithGoogle(keepSignedIn);
      onShowToast?.(t('auth.toast_login_ok'), 'success');
      onClose();
    } catch (err: any) {
      onShowToast?.(err?.message || t('auth.toast_google_err'), 'error');
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative max-w-md w-full rounded-3xl border border-blue-500/30 bg-[#080d1e] p-7 shadow-2xl space-y-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
              {t('restriction.badge')}
            </span>
            <h3 className="text-lg font-bold text-white leading-tight">
              {featureLabel ? featureLabel : t('restriction.default_title')}
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-sm text-slate-100 leading-relaxed">
          {GUEST_RESTRICTION_MESSAGE}
        </div>

        <div className="text-xs text-slate-400 flex items-start gap-2">
          <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>{t('restriction.guest_hint')}</span>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignup();
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 shrink-0" />
              <span>{t('restriction.signup_google')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogin();
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wide cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{t('restriction.login_google')}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loadingGoogle}
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs cursor-pointer disabled:opacity-60"
          >
            {loadingGoogle ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{t('welcome.google_continue')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
