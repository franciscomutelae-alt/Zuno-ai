import React, { useState } from 'react';
import { ZUNO_PLANS } from '../data/plans';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PlanType } from '../types';
import { isAuthRequiredError } from '../services/api';
import { 
  Check, 
  X, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  FileText, 
  Download, 
  AlertCircle,
  Zap,
  ArrowRight,
  KeyRound,
  Lock,
  Loader2
} from 'lucide-react';

interface PricingPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToChat: () => void;
  onRequireAuth?: (featureLabel?: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({
  onShowToast,
  onNavigateToChat,
  onRequireAuth,
}) => {
  const { user, isAuthenticated, updatePlan, redeemVipCode } = useAuth();
  const { t } = useLanguage();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [vipCodeInput, setVipCodeInput] = useState('');
  const [redeemingVip, setRedeemingVip] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState<PlanType | null>(null);

  const invoices = [
    {
      id: 'INV-2026-004',
      date: '01 Fev 2026',
      amount: user?.plan === 'ultra' ? '49,00 €' : '19,00 €',
      plan: user?.plan?.toUpperCase() || 'PRO',
      status: 'Pago',
    },
    {
      id: 'INV-2026-001',
      date: '01 Jan 2026',
      amount: '19,00 €',
      plan: 'PRO',
      status: 'Pago',
    },
  ];

  const handleSelectPlan = async (planId: PlanType) => {
    if (!isAuthenticated) {
      onRequireAuth?.('Planos Premium, Pro e Ultra');
      return;
    }
    if (user?.plan === planId) {
      onShowToast(`Já estás no ${planId.toUpperCase()}!`, 'info');
      return;
    }

    setUpdatingPlan(planId);
    try {
      await updatePlan(planId);
      onShowToast(`Plano atualizado com sucesso para ${planId.toUpperCase()}! Quota renovada.`, 'success');
    } catch (err: any) {
      if (isAuthRequiredError(err)) {
        onRequireAuth?.('Alterar plano da conta');
      } else {
        onShowToast(err?.message || 'Não foi possível atualizar o plano.', 'error');
      }
    } finally {
      setUpdatingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!isAuthenticated) {
      onRequireAuth?.('Gerir subscrição');
      return;
    }
    try {
      await updatePlan('free');
      setShowCancelModal(false);
      onShowToast('Subscrição cancelada. A tua conta foi revertida para o plano Free.', 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao cancelar subscrição.', 'error');
    }
  };

  const handleRedeemVip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth?.('Resgatar Códigos VIP');
      return;
    }
    const cleanCode = vipCodeInput.trim();
    if (!cleanCode) {
      onShowToast('Insere um código VIP válido.', 'error');
      return;
    }
    setRedeemingVip(true);
    try {
      const res = await redeemVipCode(cleanCode);
      if (res.success) {
        setVipCodeInput('');
        onShowToast(
          `Código VIP ativado! Plano atualizado para ${(res.plan || 'pro').toUpperCase()}.`,
          'success'
        );
      }
    } catch (err: any) {
      if (isAuthRequiredError(err)) {
        onRequireAuth?.('Utilizar códigos VIP');
      } else {
        onShowToast(err?.message || 'Código VIP inválido ou expirado.', 'error');
      }
    } finally {
      setRedeemingVip(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            Transparência Sem Compromisso
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Planos à medida da tua ambição.
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Começa gratuitamente e escala para modelos de alta capacidade quando precisares de mais potência e recursos avançados.
          </p>

          {/* Billing Switcher */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-400'}`}>
              Mensal
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className="relative w-12 h-6 rounded-full bg-slate-800 border border-slate-700 p-0.5 cursor-pointer transition-colors"
            >
              <div
                className={`w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-md transform transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${billingCycle === 'yearly' ? 'text-white' : 'text-slate-400'}`}>
                Anual
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                2 Meses Grátis
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid (Free, Premium, Pro, Ultra) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {ZUNO_PLANS.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            const price = billingCycle === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12);

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? 'border-2 border-indigo-500 bg-slate-900/80 shadow-2xl shadow-indigo-600/20 ring-1 ring-indigo-500/50 scale-105'
                    : 'border border-slate-800 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                    {plan.badge}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{plan.tagline}</p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-black text-white">{price}€</span>
                    <span className="text-xs text-slate-400">/mês</span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 pt-4 border-t border-slate-800/80">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Incluído no plano:
                    </span>
                    <ul className="space-y-2.5">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2.5 text-xs">
                          {feat.included ? (
                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${feat.highlight ? 'text-blue-400 font-bold' : 'text-emerald-400'}`} />
                          ) : (
                            <X className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                          )}
                          <span className={feat.included ? (feat.highlight ? 'text-white font-medium' : 'text-slate-300') : 'text-slate-600'}>
                            {feat.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800">
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={updatingPlan === plan.id}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isCurrent
                        ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default'
                        : plan.popular
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {!isAuthenticated && plan.id !== 'free' && <Lock className="w-3.5 h-3.5" />}
                    <span>
                      {updatingPlan === plan.id
                        ? 'A atualizar...'
                        : isCurrent
                        ? 'Plano Atual'
                        : `Escolher ${plan.name}`}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* VIP Code Redemption Card */}
        <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-slate-900/70 via-[#0c1124]/80 to-purple-950/25 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Códigos VIP ZUNO AI</span>
            </div>
            <h3 className="text-xl font-bold text-white">Tens um código VIP ou de acesso especial?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isAuthenticated
                ? 'Introduz o teu código abaixo para ativar imediatamente os benefícios Premium, Pro ou Ultra na tua conta.'
                : 'A criação e utilização de códigos VIP é exclusiva para contas ZUNO AI autenticadas.'}
            </p>
          </div>

          <form onSubmit={handleRedeemVip} className="w-full md:w-auto flex flex-col sm:flex-row gap-2.5 min-w-0 sm:min-w-[360px]">
            <input
              type="text"
              value={vipCodeInput}
              onChange={(e) => setVipCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex.: ZUNO-PRO-2026"
              disabled={!isAuthenticated}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={redeemingVip}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-purple-600/20 cursor-pointer flex items-center justify-center gap-2 shrink-0"
            >
              {redeemingVip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !isAuthenticated ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{redeemingVip ? 'A validar...' : 'Ativar Código VIP'}</span>
            </button>
          </form>
        </div>

        {/* Current Subscription Management Section */}
        {user && user.plan !== 'free' && (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Gestão da Subscrição ZUNO</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ativa desde {new Date(user.createdAt).toLocaleDateString()} • Renovação automática
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar Subscrição
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Histórico de Faturas & Recibos:
              </h4>
              <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <div>
                        <p className="font-semibold text-white">{inv.id}</p>
                        <p className="text-slate-400 text-[11px]">{inv.date} • {inv.plan}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-white">{inv.amount}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        {inv.status}
                      </span>
                      <button
                        onClick={() => onShowToast(`Recibo ${inv.id} descarregado em PDF.`, 'success')}
                        className="p-1.5 text-slate-400 hover:text-white"
                        title="Descarregar Fatura PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#090e1c] p-6 space-y-4 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirmar cancelamento?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ao cancelar a subscrição, a tua conta voltará ao plano Free no fim do ciclo atual. Perderás acesso a mensagens ilimitadas, ferramentas multimodais e pesquisa em tempo real.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  Manter Plano
                </button>
                <button
                  onClick={handleCancelSubscription}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
