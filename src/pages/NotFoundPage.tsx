import React from 'react';
import { Logo } from '../components/common/Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, Compass, Home, Search } from 'lucide-react';

interface NotFoundPageProps {
  requestedPath?: string;
  onGoHome: () => void;
  onGoChat: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  requestedPath,
  onGoHome,
  onGoChat,
}) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-16 bg-[#050814] relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-[440px] h-[440px] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[440px] h-[440px] bg-purple-600/15 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 rounded-3xl border border-slate-800/90 bg-[#080d1e]/95 backdrop-blur-2xl p-8 sm:p-10 text-center space-y-6 shadow-2xl shadow-black/70">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('notfound.badge')}</span>
          </div>

          <p className="text-6xl sm:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
            404
          </p>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            {t('notfound.title')}
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            https://zunoai.com{requestedPath ? requestedPath : ''}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onGoHome}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>{t('notfound.home')}</span>
          </button>

          <button
            type="button"
            onClick={onGoChat}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Search className="w-4 h-4 text-blue-400" />
            <span>{t('notfound.chat')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('notfound.back')}</span>
        </button>
      </div>
    </div>
  );
};
