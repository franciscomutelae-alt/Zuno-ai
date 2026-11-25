import React from 'react';
import { Logo } from './Logo';
import { Loader2 } from 'lucide-react';

interface BrandSplashProps {
  message?: string;
}

export const BrandSplash: React.FC<BrandSplashProps> = ({
  message = 'A preparar o teu ambiente ZUNO AI...',
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050814] text-slate-100 px-6 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[360px] h-[360px] bg-purple-600/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center gap-5">
        <div className="p-4 rounded-3xl border border-blue-500/25 bg-[#080d1e]/90 shadow-2xl shadow-blue-950/40">
          <Logo size="lg" />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            Intelligence Without Limits
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>{message}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
