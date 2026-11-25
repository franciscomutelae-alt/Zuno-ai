import React from 'react';
import { WifiOff, ShieldCheck, Wifi, MessageSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CREATOR_OFFLINE_EMAIL } from '../../config/brand';

interface OfflineIndicatorProps {
  onOpenOfflineChat?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onOpenOfflineChat }) => {
  const {
    isOnline,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    setCreatorOfflineMode,
  } = useAuth();

  if (isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)) {
    return (
      <div
        role="status"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-indigo-500/50 bg-[#080d1e]/95 backdrop-blur-md text-indigo-100 text-xs font-medium shadow-2xl"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-white">
            Versão Offline do Criador {!isOnline ? '(Sem Rede)' : '(Ativa)'}
          </span>
          <span className="text-[10px] text-indigo-300">
            Conta exclusiva: {CREATOR_OFFLINE_EMAIL}
          </span>
        </div>
        {onOpenOfflineChat && (
          <button
            type="button"
            onClick={onOpenOfflineChat}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-[10px] font-bold text-indigo-100 cursor-pointer"
            title="Conversar com o Zuno em modo offline"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Conversar</span>
          </button>
        )}
        {isOnline && (
          <button
            type="button"
            onClick={() => setCreatorOfflineMode(false)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 cursor-pointer"
            title="Voltar ao modo online em tempo real"
          >
            <Wifi className="w-3 h-3" />
            <span>Online</span>
          </button>
        )}
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl border border-amber-500/40 bg-[#080d1e]/95 backdrop-blur-md text-amber-200 text-xs font-medium shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Ligação offline — funcionalidades em tempo real pausadas.</span>
    </div>
  );
};
