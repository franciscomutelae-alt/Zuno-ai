import React from 'react';
import { Logo } from '../common/Logo';
import { useLanguage } from '../../contexts/LanguageContext';
import { Shield, Sparkles, Heart, Globe, Cpu } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string) => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenTerms, onOpenPrivacy }) => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-slate-800/80 bg-[#04060e] text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-1 space-y-4">
            <Logo size="md" showSlogan />
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('footer.tagline')}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t('footer.status_ok')}
              </span>
            </div>
          </div>

          {/* Navigation Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Navegação
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('landing')}
                  className="hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t('nav.home')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('chat')}
                  className="hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>{t('nav.chat')}</span>
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1 rounded">Live</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('tools')}
                  className="hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t('nav.tools')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {t('nav.pricing')}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('feedback')}
                  className="hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Avaliações & Feedback
                </button>
              </li>
              <li className="pt-1">
                <button
                  onClick={() => onNavigate('feedback')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-300 hover:bg-blue-600/25 hover:text-white transition-all cursor-pointer text-[11px] font-semibold"
                >
                  <Heart className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gostaste da app? Comentar →</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Ferramentas ZUNO Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Ferramentas ZUNO
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>ZUNO Writer (Redação & Copy)</li>
              <li>ZUNO Study (Tutor Pedagógico)</li>
              <li>ZUNO Code (Engenharia de Software)</li>
              <li>ZUNO Vision (Análise de Imagens)</li>
              <li>ZUNO Search (Google Search Grounding)</li>
              <li>ZUNO PDF & Voice (Multimodal)</li>
            </ul>
          </div>

          {/* Segurança & Legal Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Segurança & Legal
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span>Política de Privacidade</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTerms}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Termos de Utilização
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('settings')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Controlo de Dados e Memória
                </button>
              </li>
              <li className="pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-400" />
                  <span>Potenciado por Google Gemini</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} ZUNO AI — Intelligence Without Limits • https://zunoai.com</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('footer.worldwide')}</span>
              <Sparkles className="w-3 h-3 text-purple-400" />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
