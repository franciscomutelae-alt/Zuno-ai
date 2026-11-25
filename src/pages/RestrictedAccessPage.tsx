import React from 'react';
import { Logo } from '../components/common/Logo';
import { Lock, LogIn, UserPlus, Home, ShieldAlert } from 'lucide-react';

interface RestrictedAccessPageProps {
  reason?: 'guest' | 'admin' | 'blocked';
  featureLabel?: string;
  onLogin?: () => void;
  onSignup?: () => void;
  onGoHome: () => void;
}

export const RestrictedAccessPage: React.FC<RestrictedAccessPageProps> = ({
  reason = 'guest',
  featureLabel,
  onLogin,
  onSignup,
  onGoHome,
}) => {
  const isBlocked = reason === 'blocked';
  const isAdminOnly = reason === 'admin';

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-16 bg-[#050814] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-[440px] h-[440px] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[440px] h-[440px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 rounded-3xl border border-purple-500/30 bg-[#080d1e]/95 backdrop-blur-2xl p-8 sm:p-10 text-center space-y-6 shadow-2xl shadow-black/70">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/25 to-purple-600/25 border border-blue-500/40 flex items-center justify-center text-blue-300">
          {isBlocked ? (
            <ShieldAlert className="w-7 h-7 text-rose-400" />
          ) : (
            <Lock className="w-7 h-7 text-purple-300" />
          )}
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-bold uppercase tracking-wider">
            {isBlocked
              ? 'Conta Suspensa'
              : isAdminOnly
              ? 'Acesso Exclusivo do Fundador / Administração'
              : 'Área Reservada ZUNO AI'}
          </span>

          <h1 className="text-2xl font-extrabold text-white">
            {isBlocked
              ? 'Acesso bloqueado temporariamente'
              : isAdminOnly
              ? 'Acesso restrito ao Painel Administrativo'
              : featureLabel
              ? `${featureLabel} exige conta`
              : 'Acesso Restrito'}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isBlocked
              ? 'Esta conta encontra-se suspensa por violação das normas da plataforma. Contacta suporte@zunoai.com para revisão.'
              : isAdminOnly
              ? 'Esta secção destina-se exclusivamente ao fundador e administradores verificados da ZUNO AI.'
              : 'Esta funcionalidade exige uma conta ZUNO AI. Cria uma conta ou inicia sessão para continuares.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {!isBlocked && !isAdminOnly && onSignup && (
            <button
              type="button"
              onClick={onSignup}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Criar conta</span>
            </button>
          )}

          {!isBlocked && !isAdminOnly && onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-blue-400" />
              <span>Iniciar sessão</span>
            </button>
          )}

          <button
            type="button"
            onClick={onGoHome}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            <Home className="w-4 h-4 text-blue-400" />
            <span>Voltar ao Início</span>
          </button>
        </div>
      </div>
    </div>
  );
};
