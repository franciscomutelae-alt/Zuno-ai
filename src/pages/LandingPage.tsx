import React, { useState } from 'react';
import { Logo } from '../components/common/Logo';
import { useLanguage } from '../contexts/LanguageContext';
import { ZUNO_TOOLS } from '../data/tools';
import { ZUNO_PLANS } from '../data/plans';
import { 
  Sparkles, 
  ArrowRight, 
  Zap, 
  ShieldCheck, 
  Globe, 
  Code2, 
  MessageSquare, 
  Cpu, 
  CheckCircle2, 
  ChevronDown,
  Layers,
  Terminal,
  ExternalLink,
  Lock,
  Mic,
  Eye
} from 'lucide-react';

interface LandingPageProps {
  onNavigateToChat: () => void;
  onNavigateToTools: () => void;
  onNavigateToImage?: () => void;
  onNavigateToPricing: () => void;
  onOpenAuth: (mode: 'login' | 'signup' | 'switch') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigateToChat,
  onNavigateToTools,
  onNavigateToImage,
  onNavigateToPricing,
  onOpenAuth,
}) => {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [interactiveInput, setInteractiveInput] = useState('Como podes otimizar o fluxo de trabalho da minha equipa com IA?');
  const [demoAnswer, setDemoAnswer] = useState(
    'O **ZUNO AI** acelera a tua equipa através de 3 pilares:\n\n1. **Automação de Código & Debug**: Resolução instantânea de erros e refatoração com ZUNO Code.\n2. **Redação & Comunicação**: Criação de propostas, relatórios e e-mails executivos em segundos com ZUNO Writer.\n3. **Pesquisa em Tempo Real**: Consulta contínua à web através de Google Search Grounding verificado.'
  );

  const faqs = [
    {
      q: 'O que diferencia o ZUNO AI de outros assistentes?',
      a: 'O ZUNO AI combina o motor Gemini 3.1 Flash Lite mais moderno com 10 ferramentas dedicadas, pesquisa na internet com fontes em tempo real, memória de contexto personalizada com consentimento total e suporte multilíngue nativo.',
    },
    {
      q: 'O plano gratuito tem limitações?',
      a: 'O plano Free dá acesso completo ao chat inteligente e às ferramentas essenciais com até 25 mensagens diárias, perfeito para explorar a plataforma e realizar tarefas diárias sem qualquer custo.',
    },
    {
      q: 'Os meus dados e códigos são confidenciais?',
      a: 'Sim, totalmente. Não usamos as tuas conversas, códigos ou documentos para treinar modelos públicos. Toda a comunicação ocorre através de ligações encriptadas TLS 1.3 de nível empresarial.',
    },
    {
      q: 'Posso utilizar o ZUNO AI no smartphone?',
      a: 'Sim, a aplicação é 100% responsiva e otimizada com interface adaptada ao teclado tátil, reconhecimento de voz e modo escuro de baixo consumo em Android, iOS e computadores.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 overflow-hidden">
      {/* ----------------- HERO SECTION ----------------- */}
      <section className="relative pt-16 pb-24 md:pt-28 md:pb-36 px-4 sm:px-6 lg:px-8">
        {/* Futuristic glowing orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-purple-600/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          {/* International Badge */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-lg">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{t('landing.international_badge')}</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            {t('brand.hero_title')}
          </h1>

          {/* Subtitle & Slogan */}
          <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            <span className="font-semibold text-gradient">{t('brand.slogan')}</span>{' '}
            {t('brand.hero_subtitle')}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onNavigateToChat}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('landing.get_started')}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={onNavigateToTools}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white font-semibold text-sm transition-all cursor-pointer"
            >
              <span>{t('landing.explore_tools')}</span>
            </button>
          </div>

          {/* Trust stats pill */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sem cartão de crédito obrigatório</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
              <span>Respostas em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>10 Ferramentas inteligentes</span>
            </div>
          </div>
        </div>

        {/* ----------------- INTERACTIVE CHAT DEMO PREVIEW ----------------- */}
        <div className="max-w-4xl mx-auto mt-16 rounded-3xl border border-slate-800/80 bg-[#070c1b]/80 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-black relative z-10">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="font-mono text-slate-400 ml-2">https://zunoai.com/chat</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ZUNO Engine Online (&lt;300ms)</span>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl rounded-br-sm bg-blue-600 text-white font-medium shadow-md">
                {interactiveInput}
              </div>
            </div>

            {/* AI Assistant response */}
            <div className="flex items-start gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-black text-xs text-white shrink-0 mt-1">
                Z
              </div>
              <div className="max-w-[85%] sm:max-w-[80%] p-4 rounded-2xl rounded-bl-sm bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed shadow-lg whitespace-pre-line">
                {demoAnswer}
              </div>
            </div>
          </div>

          {/* Interactive Input trigger */}
          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value="Escreve uma questão para experimentar o ZUNO AI..."
              onClick={onNavigateToChat}
              className="flex-1 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 cursor-pointer focus:outline-none"
            />
            <button
              onClick={onNavigateToChat}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-blue-600/30"
            >
              Testar Agora
            </button>
          </div>
        </div>
      </section>

      {/* ----------------- STATS METRICS ----------------- */}
      <section className="py-12 border-y border-slate-800/80 bg-[#070b18]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-white">1.4M+</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{t('landing.stats_users')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-white">45M+</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{t('landing.stats_messages')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-white">&lt; 350ms</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{t('landing.stats_latency')}</p>
          </div>
          <div className="space-y-1">
            <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400">99.98%</p>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{t('landing.stats_global')}</p>
          </div>
        </div>
      </section>

      {/* ----------------- TOOLS SHOWCASE ----------------- */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t('landing.tools_title')}
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            {t('landing.tools_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ZUNO_TOOLS.slice(0, 6).map((tool) => (
            <div
              key={tool.id}
              onClick={onNavigateToTools}
              className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-850 hover:border-blue-500/40 transition-all cursor-pointer space-y-4 group shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5" />
                </div>
                {tool.badge && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {tool.badge}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{tool.shortDesc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <button
            onClick={onNavigateToTools}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <span>Ver todas as 10 Ferramentas ZUNO</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* ZUNO AI IMAGE Highlight Banner */}
        <div className="mt-12 rounded-3xl border border-purple-500/30 bg-gradient-to-r from-blue-950/60 via-purple-950/40 to-slate-900/80 p-8 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Novo Módulo Generativo</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              ZUNO AI IMAGE: Da imaginação à imagem em segundos
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Cria imagens originais de alta fidelidade com estilos como fotorealista, anime, 3D, cinematográfico e design de produto. Controla proporções (1:1, 16:9, 9:16, 4:5) e resolução com o motor Gemini Image.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={onNavigateToImage || onNavigateToTools}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Abrir Estúdio ZUNO Image</span>
            </button>
          </div>
        </div>
      </section>

      {/* ----------------- ADVANTAGES ----------------- */}
      <section className="py-24 bg-[#070b18]/40 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t('landing.advantages_title')}
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Concebido para quem exige precisão, rigor técnico e máxima eficiência.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/50 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Streaming em Tempo Real</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                As respostas começam a surgir no primeiro segundo através do protocolo Server-Sent Events, garantindo uma fluidez sem pausas.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/50 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Google Search Grounding</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A ferramenta ZUNO Search liga-se diretamente à web para recolher notícias, factos atualizados e citações transparentes de fontes.
              </p>
            </div>

            <div className="p-8 rounded-3xl border border-slate-800 bg-slate-900/50 space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Privacidade & Memória Soberana</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A memória é personalizada e consentida. Podes visualizar, adicionar ou eliminar qualquer recordação persistente da IA com um só clique.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- OFFICIAL FOUNDER & IDENTITY SECTION ----------------- */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="glass-panel-elevated rounded-3xl p-8 sm:p-12 border border-blue-500/30 bg-gradient-to-br from-[#0a1026]/90 via-[#0d1430]/80 to-[#120f2e]/90 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Founder Avatar / Monogram */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[2px] shadow-2xl shadow-indigo-600/30">
              <div className="w-full h-full rounded-[22px] bg-[#070c1d] flex flex-col items-center justify-center text-white">
                <span className="text-2xl sm:text-3xl font-black tracking-wider bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  FE
                </span>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 mt-1 font-semibold">
                  Fundador
                </span>
              </div>
            </div>
          </div>

          {/* Founder Narrative */}
          <div className="space-y-3 text-center md:text-left flex-1 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Identidade Oficial & Liderança</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              A ZUNO AI foi idealizada e criada por Francisco Mutela Emanuel.
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              O ZUNO AI nasceu da visão de criar uma plataforma internacional de inteligência artificial soberana, intuitiva e sem limites de criatividade. Combinando o estado da arte em modelos generativos multimodais com respeito absoluto pela privacidade dos utilizadores.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-slate-400">
              <span className="text-blue-400">• Visão Internacional</span>
              <span className="text-purple-400">• Tecnologia Generativa Ética</span>
              <span className="text-emerald-400">• Sem Limites</span>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- PRICING PREVIEW ----------------- */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Planos simples, transparentes e escaláveis.
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            Escolhe o nível ideal para as tuas necessidades e melhora quando quiseres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ZUNO_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-8 rounded-3xl border flex flex-col justify-between ${
                plan.popular
                  ? 'border-indigo-500 bg-slate-900/80 shadow-2xl shadow-indigo-600/20'
                  : 'border-slate-800 bg-slate-900/40'
              }`}
            >
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-slate-400">{plan.tagline}</p>
                <div className="flex items-baseline gap-1 py-2">
                  <span className="text-4xl font-extrabold text-white">{plan.priceMonthly}€</span>
                  <span className="text-xs text-slate-400">/mês</span>
                </div>
                <ul className="space-y-2 text-xs pt-4 border-t border-slate-800">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={onNavigateToPricing}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Ver Detalhes do Plano
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------- FAQ SECTION ----------------- */}
      <section className="py-24 bg-[#070b18]/60 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {t('landing.faq_title')}
            </h2>
            <p className="text-sm text-slate-400">
              Respostas claras às dúvidas mais frequentes sobre o ZUNO AI.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 flex items-center justify-between text-left text-sm font-semibold text-white hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------- FINAL CTA ----------------- */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto rounded-3xl p-10 sm:p-16 text-center space-y-6 relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-purple-900/40 border border-blue-500/30 shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {t('landing.cta_title')}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            {t('landing.cta_subtitle')}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onOpenAuth('signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 cursor-pointer"
            >
              Criar Conta Gratuita
            </button>
            <button
              onClick={onNavigateToChat}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/90 border border-slate-700 text-white font-semibold text-sm cursor-pointer hover:bg-slate-800"
            >
              Abrir Chat Imediato
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
