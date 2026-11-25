import React, { useState } from 'react';
import { Download, Smartphone, Monitor, TabletSmartphone, X, Share, MoreVertical, Info } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const {
    canInstall,
    isInstalled,
    platform,
    browser,
    platformLabel,
    browserLabel,
    promptInstall,
  } = usePWAInstall();

  const [showGuide, setShowGuide] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios' | 'desktop'>(() => {
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
    return 'desktop';
  });

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canInstall) {
      const accepted = await promptInstall();
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setSelectedTab(platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop');
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/35 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 hover:text-white text-xs font-semibold transition-all cursor-pointer'
            : 'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-500/40 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-200 hover:text-white text-xs font-semibold transition-all cursor-pointer'
        }
        title="Instalar ZUNO AI como aplicação web (PWA)"
      >
        {platform === 'ios' || platform === 'android' ? (
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <Download className="w-3.5 h-3.5 text-cyan-400" />
        )}
        <span>Instalar App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-2xl border border-blue-500/30 bg-[#080d1e] p-5 shadow-2xl space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="ZUNO AI"
                  className="w-10 h-10 rounded-xl border border-blue-500/40 bg-[#050814]"
                />
                <div>
                  <h4 className="text-sm font-bold text-white">Instalar ZUNO AI (PWA)</h4>
                  <p className="text-[11px] text-slate-400">
                    Detetado: <span className="text-blue-300 font-semibold">{platformLabel}</span> · {browserLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTab('android')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedTab === 'android'
                    ? 'bg-blue-600/25 text-white border border-blue-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TabletSmartphone className="w-3.5 h-3.5" />
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('ios')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedTab === 'ios'
                    ? 'bg-blue-600/25 text-white border border-blue-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('desktop')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedTab === 'desktop'
                    ? 'bg-blue-600/25 text-white border border-blue-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Computador</span>
              </button>
            </div>

            {/* Instructions per Platform */}
            {selectedTab === 'android' && (
              <div className="space-y-2.5 rounded-xl bg-slate-900/60 border border-slate-800 p-3.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-white">Android (Telemóvel e Tablet):</p>
                {browser === 'samsung' ? (
                  <p>
                    No <strong className="text-blue-300">Samsung Internet</strong>, toca no ícone de menu (≡) e seleciona{' '}
                    <strong className="text-white">Adicionar página a → Ecrã principal</strong> ou toca no ícone de transferência na barra de endereço.
                  </p>
                ) : browser === 'firefox' ? (
                  <p>
                    No <strong className="text-blue-300">Firefox Android</strong>, toca nos 3 pontos (⋮) e seleciona{' '}
                    <strong className="text-white">Instalar</strong> para criar o atalho em ecrã inteiro.
                  </p>
                ) : (
                  <p className="flex items-start gap-2">
                    <MoreVertical className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      No <strong className="text-blue-300">Google Chrome / Edge</strong>, toca no menu (⋮) no canto superior direito e escolhe{' '}
                      <strong className="text-white">Instalar aplicação</strong> ou <strong className="text-white">Adicionar ao ecrã principal</strong>.
                    </span>
                  </p>
                )}
              </div>
            )}

            {selectedTab === 'ios' && (
              <div className="space-y-2.5 rounded-xl bg-slate-900/60 border border-slate-800 p-3.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-white">iPhone e iPad (iOS / iPadOS):</p>
                <p className="flex items-start gap-2">
                  <Share className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>
                    Abre a ZUNO AI no <strong className="text-blue-300">Safari</strong>, toca no botão{' '}
                    <strong className="text-white">Partilhar</strong> e seleciona{' '}
                    <strong className="text-blue-300">Adicionar ao Ecrã Principal</strong>. No iOS 16.4+, outros navegadores também oferecem "Adicionar ao Ecrã Principal" no menu Partilhar.
                  </span>
                </p>
              </div>
            )}

            {selectedTab === 'desktop' && (
              <div className="space-y-2.5 rounded-xl bg-slate-900/60 border border-slate-800 p-3.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-semibold text-white">Windows, macOS, Linux e Chromebook:</p>
                {browser === 'safari' ? (
                  <p>
                    No <strong className="text-blue-300">Safari (macOS Sonoma+)</strong>, abre o menu{' '}
                    <strong className="text-white">Ficheiro → Adicionar à Dock</strong> para abrir a ZUNO AI como aplicação independente.
                  </p>
                ) : browser === 'firefox' ? (
                  <p>
                    O <strong className="text-blue-300">Firefox desktop</strong> não suporta instalação direta de PWA sem extensão; para instalar no ambiente de trabalho, abre este endereço no <strong className="text-white">Chrome</strong> ou <strong className="text-white">Edge</strong>.
                  </p>
                ) : (
                  <p>
                    No <strong className="text-blue-300">Google Chrome</strong> ou <strong className="text-blue-300">Microsoft Edge</strong>, clica no ícone de instalação{' '}
                    <strong className="text-white">(⊕ / ecrã com seta)</strong> na barra de endereço ou vai a{' '}
                    <strong className="text-white">Menu → Guardar e partilhar → Instalar ZUNO AI</strong>.
                  </p>
                )}
              </div>
            )}

            {canInstall && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await promptInstall();
                  if (ok) setShowGuide(false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                Instalar ZUNO AI Agora
              </button>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 text-[11px] text-slate-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>
                A ZUNO AI instala-se como <strong className="text-slate-300">Aplicação Web Progressiva (PWA)</strong> diretamente pelo navegador, com nome e ícone oficiais. Ainda não existe aplicação nativa publicada na Google Play Store ou Apple App Store.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
