import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  getCategoryMeta,
} from '../data/feedbackCategories';
import {
  fetchPublicFeedback,
  submitFeedback,
  updateOwnFeedbackApi,
  deleteFeedbackApi,
  replyToFeedback,
  reportFeedbackApi,
  FeedbackFilterParams,
} from '../services/api';
import {
  FeedbackCategoryId,
  FeedbackItem,
  FeedbackStats,
  FeedbackType,
} from '../types';
import {
  Star,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Edit3,
  Trash2,
  Flag,
  Lock,
  Globe,
  CheckCircle2,
  Reply,
  X,
  RefreshCw,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Bug,
  Sparkles,
} from 'lucide-react';

interface FeedbackPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onOpenAuth: (mode: 'login' | 'signup' | 'switch') => void;
  focusFeedbackId?: string | null;
  onClearFocus?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Muito insatisfeito',
  2: 'Insatisfeito',
  3: 'Neutro',
  4: 'Satisfeito',
  5: 'Excelente',
};

const DEVICE_OPTIONS = [
  'Web Desktop',
  'Android',
  'iOS (iPhone / iPad)',
  'Windows',
  'macOS',
  'Linux / Outro',
];

const REPORT_REASONS = [
  'Spam ou publicidade não solicitada',
  'Linguagem ofensiva ou assédio',
  'Informação falsa ou tentativa de fraude',
  'Conteúdo inadequado',
  'Outro motivo',
];

const IMPROVEMENT_AREAS = [
  'Velocidade e Respostas',
  'Qualidade da IA',
  'Geração de Imagens',
  'Design e Usabilidade',
  'Pesquisa na Internet',
  'Ferramentas e PDF',
  'Contas e Sessões',
  'Experiência Mobile / App',
  'Outro aspeto',
];

function statusColorClass(status: string): string {
  switch (status) {
    case 'Implementado':
      return 'text-emerald-400';
    case 'Respondido':
      return 'text-blue-400';
    case 'Em análise':
      return 'text-amber-400';
    case 'Não planeado':
      return 'text-slate-400';
    default:
      return 'text-indigo-300';
  }
}

export const FeedbackPage: React.FC<FeedbackPageProps> = ({
  onShowToast,
  onOpenAuth,
  focusFeedbackId,
  onClearFocus,
}) => {
  const { user, isAuthenticated } = useAuth();

  // Data state (100% real from SQLite via API)
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [scopeTab, setScopeTab] = useState<'all' | 'mine'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLiked, setFilterLiked] = useState<'all' | 'liked' | 'disliked'>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(true);
  const [likedApp, setLikedApp] = useState<boolean | null>(true);
  const [improvementArea, setImprovementArea] = useState<string>('Velocidade e Respostas');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [category, setCategory] = useState<FeedbackCategoryId>('experiencia_geral');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('praise');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [likedMost, setLikedMost] = useState('');
  const [improvementSuggestion, setImprovementSuggestion] = useState('');
  const [deviceInfo, setDeviceInfo] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Android/i.test(ua)) return 'Android';
      if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS (iPhone / iPad)';
      if (/Mac/i.test(ua)) return 'macOS';
      if (/Win/i.test(ua)) return 'Windows';
    }
    return 'Web Desktop';
  });
  const [isPublic, setIsPublic] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionConfirmation, setSubmissionConfirmation] = useState<{
    title: string;
    categoryLabel: string;
    isPublic: boolean;
  } | null>(null);

  // Edit own feedback state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLikedApp, setEditLikedApp] = useState<boolean | null>(null);
  const [editImprovementArea, setEditImprovementArea] = useState<string>('');
  const [editRating, setEditRating] = useState<number>(5);
  const [editCategory, setEditCategory] = useState<FeedbackCategoryId>('experiencia_geral');
  const [editType, setEditType] = useState<FeedbackType>('praise');
  const [editTitle, setEditTitle] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editLikedMost, setEditLikedMost] = useState('');
  const [editImprovement, setEditImprovement] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [editIsAnonymous, setEditIsAnonymous] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation modal/inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Thread reply inputs keyed by feedbackId
  const [replyOpenMap, setReplyOpenMap] = useState<Record<string, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);

  // Report modal
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const loadFeedbacks = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: FeedbackFilterParams = {
        category: filterCategory,
        rating: filterRating,
        status: filterStatus,
        likedFilter: filterLiked,
        dateFilter: filterDate,
        search: searchQuery,
        onlyMine: scopeTab === 'mine',
      };
      const data = await fetchPublicFeedback(
        filters,
        user ? { id: user.id, email: user.email, name: user.name } : undefined
      );
      setItems(data.items || []);
      setStats(data.stats || null);
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao carregar feedback.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, filterRating, filterStatus, filterLiked, filterDate, searchQuery, scopeTab, user?.id, user?.email]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  // If navigated from notification with a focusFeedbackId, scroll & highlight
  useEffect(() => {
    if (!focusFeedbackId) return;
    const found = items.find((i) => i.id === focusFeedbackId);
    if (found) {
      setTimeout(() => {
        itemRefs.current[focusFeedbackId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } else if (!isLoading && scopeTab !== 'mine' && user) {
      setScopeTab('mine');
    }
  }, [focusFeedbackId, items, isLoading, scopeTab, user]);

  const selectedCategoryMeta = getCategoryMeta(category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (likedApp === null) {
      onShowToast('Indica primeiro se gostaste ou não da aplicação.', 'error');
      return;
    }
    const trimmedComment = comment.trim() || improvementSuggestion.trim();
    if (!trimmedComment || trimmedComment.length < 3) {
      onShowToast('Escreve um comentário com pelo menos 3 caracteres.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitFeedback(
        {
          authorName: user?.name || 'Utilizador ZUNO',
          isAnonymous,
          rating,
          likedApp,
          improvementArea: improvementArea || undefined,
          category,
          feedbackType,
          title:
            title.trim() ||
            (likedApp
              ? `Gostou da app · ${selectedCategoryMeta.label}`
              : `Sugestão de melhoria · ${improvementArea || selectedCategoryMeta.label}`),
          comment: trimmedComment,
          likedMost: likedMost.trim() || undefined,
          improvementSuggestion: improvementSuggestion.trim() || undefined,
          deviceInfo,
          isPublic,
        },
        user ? { id: user.id, email: user.email, name: user.name } : undefined
      );

      setSubmissionConfirmation({
        title: res.item.title,
        categoryLabel: getCategoryMeta(res.item.category).label,
        isPublic: res.item.isPublic,
      });

      setTitle('');
      setComment('');
      setLikedMost('');
      setImprovementSuggestion('');
      setRating(5);
      setLikedApp(true);
      onShowToast('Opinião enviada e registada com sucesso!', 'success');
      await loadFeedbacks();
    } catch (err: any) {
      onShowToast(err.message || 'Não foi possível enviar o feedback.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (item: FeedbackItem) => {
    setEditingId(item.id);
    setEditLikedApp(item.likedApp ?? null);
    setEditImprovementArea(item.improvementArea || '');
    setEditRating(item.rating);
    setEditCategory(item.category);
    setEditType(item.feedbackType);
    setEditTitle(item.title);
    setEditComment(item.comment);
    setEditLikedMost(item.likedMost || '');
    setEditImprovement(item.improvementSuggestion || '');
    setEditIsPublic(item.isPublic);
    setEditIsAnonymous(item.isAnonymous);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editComment.trim() || editComment.trim().length < 3) {
      onShowToast('O comentário deve ter pelo menos 3 caracteres.', 'error');
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateOwnFeedbackApi(
        id,
        {
          likedApp: editLikedApp,
          improvementArea: editImprovementArea.trim(),
          rating: editRating,
          category: editCategory,
          feedbackType: editType,
          title: editTitle.trim(),
          comment: editComment.trim(),
          likedMost: editLikedMost.trim(),
          improvementSuggestion: editImprovement.trim(),
          isPublic: editIsPublic,
          isAnonymous: editIsAnonymous,
        },
        user ? { id: user.id, email: user.email, name: user.name } : undefined
      );
      setEditingId(null);
      onShowToast('Comentário atualizado com sucesso.', 'success');
      await loadFeedbacks();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao editar comentário.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFeedbackApi(
        id,
        user ? { id: user.id, email: user.email, name: user.name } : undefined
      );
      setConfirmDeleteId(null);
      onShowToast('Comentário eliminado.', 'info');
      await loadFeedbacks();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao eliminar comentário.', 'error');
    }
  };

  const handleSendThreadReply = async (feedbackId: string) => {
    if (!isAuthenticated || !user) {
      onOpenAuth('login');
      return;
    }
    const content = (replyDrafts[feedbackId] || '').trim();
    if (content.length < 2) {
      onShowToast('Escreve uma resposta antes de enviar.', 'error');
      return;
    }

    setSubmittingReplyId(feedbackId);
    try {
      await replyToFeedback(feedbackId, content, {
        id: user.id,
        email: user.email,
        name: user.name,
      });
      setReplyDrafts((prev) => ({ ...prev, [feedbackId]: '' }));
      setReplyOpenMap((prev) => ({ ...prev, [feedbackId]: false }));
      onShowToast('Resposta adicionada à conversa.', 'success');
      await loadFeedbacks();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao enviar resposta.', 'error');
    } finally {
      setSubmittingReplyId(null);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingId) return;
    setIsSubmittingReport(true);
    try {
      await reportFeedbackApi(
        reportingId,
        reportReason,
        reportDetails.trim(),
        user ? { id: user.id, email: user.email, name: user.name } : undefined
      );
      setReportingId(null);
      setReportDetails('');
      onShowToast('Denúncia enviada para análise da moderação.', 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Não foi possível enviar a denúncia.', 'error');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderTypeIcon = (type: FeedbackType) => {
    switch (type) {
      case 'praise':
        return <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />;
      case 'bug':
        return <Bug className="w-3.5 h-3.5 text-rose-400" />;
      case 'feature_request':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const typeLabel = (type: FeedbackType) =>
    FEEDBACK_TYPES.find((t) => t.id === type)?.label || 'Comentário';

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page Header + Real Community Stats */}
        <div className="border-b border-slate-800/80 pb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Avaliações, Comentários e Sugestões
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Partilha a tua experiência com a ZUNO AI, avalia de 1 a 5 estrelas, reporta erros ou sugere novas funcionalidades. A nossa equipa responde diretamente por aqui.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-4">
            <div>
              <div className="text-xs font-medium text-slate-400">Média real</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-black text-white">
                  {stats && stats.ratedFeedbacks > 0 ? stats.averageRating.toFixed(1) : '—'}
                </span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        stats && stats.averageRating >= s - 0.3
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="h-9 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="text-xs font-medium text-slate-400">Aprovação</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-black text-emerald-400">
                  {stats ? `${stats.approvalRate}%` : '—'}
                </span>
                <span className="text-[11px] text-slate-400">
                  (👍 {stats?.likedCount ?? 0} · 👎 {stats?.dislikedCount ?? 0})
                </span>
              </div>
            </div>

            <div className="h-9 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="text-xs font-medium text-slate-400">Comentários</div>
              <div className="text-xl font-bold text-white mt-0.5">
                {stats ? stats.totalFeedbacks : 0}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="ml-auto sm:ml-2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>{showForm ? 'Ocultar formulário' : 'Escrever feedback'}</span>
            </button>
          </div>
        </div>

        {/* Submission Confirmation Banner */}
        {submissionConfirmation && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-emerald-300">
                  Feedback registado com sucesso!
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  O teu comentário <span className="font-semibold text-white">"{submissionConfirmation.title}"</span> foi guardado na categoria{' '}
                  <span className="font-semibold text-white">{submissionConfirmation.categoryLabel}</span>{' '}
                  como{' '}
                  <span className="font-semibold text-white">
                    {submissionConfirmation.isPublic ? 'Público' : 'Privado (visível apenas para ti e para a equipa ZUNO AI)'}
                  </span>
                  . Receberás uma notificação assim que houver resposta oficial.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmissionConfirmation(null)}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
              aria-label="Fechar confirmação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Submit Feedback Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-7 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Enviar avaliação ou sugestão</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  O teu email e dados pessoais privados nunca são exibidos publicamente.
                </p>
              </div>
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium underline text-left cursor-pointer"
                >
                  Entrar na conta para receber notificações e gerir comentários
                </button>
              )}
            </div>

            {/* 0. Quick Like / Dislike & Improvement Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90">
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-white block">
                  1. Gostaste da ZUNO AI? *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLikedApp(true);
                      if (rating < 4) setRating(5);
                      if (feedbackType === 'improvement' || feedbackType === 'bug') {
                        setFeedbackType('praise');
                      }
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      likedApp === true
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-lg shadow-emerald-950/40'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-emerald-500/40'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>Sim, gostei!</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLikedApp(false);
                      if (rating > 3) setRating(2);
                      if (feedbackType === 'praise') {
                        setFeedbackType('improvement');
                      }
                    }}
                    className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      likedApp === false
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300 shadow-lg shadow-rose-950/40'
                        : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-rose-500/40'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span>Não gostei</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="fb-improve-area"
                  className="text-xs font-bold uppercase tracking-wider text-white block"
                >
                  2. Onde podemos melhorar a app?
                </label>
                <select
                  id="fb-improve-area"
                  value={improvementArea}
                  onChange={(e) => setImprovementArea(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-3 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {IMPROVEMENT_AREAS.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 1. Star Rating */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                Classificação geral (1 a 5 estrelas)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        active
                          ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                          : 'border-slate-800 bg-slate-950/60 text-slate-600 hover:border-slate-700'
                      }`}
                      aria-label={`${star} estrelas`}
                    >
                      <Star className={`w-5 h-5 ${active ? 'fill-amber-400' : ''}`} />
                    </button>
                  );
                })}
                <span className="ml-2 text-sm font-semibold text-amber-300">
                  {rating}/5 · {RATING_LABELS[hoverRating || rating]}
                </span>
              </div>
            </div>

            {/* 2. Feedback Type + Category (All 12) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block">
                  Tipo de feedback
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((ft) => (
                    <button
                      key={ft.id}
                      type="button"
                      onClick={() => setFeedbackType(ft.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        feedbackType === ft.id
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {renderTypeIcon(ft.id)}
                        <span>{ft.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{ft.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="fb-category"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300 block"
                >
                  Categoria (12 áreas da ZUNO AI)
                </label>
                <select
                  id="fb-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategoryId)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.number}. {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 pt-0.5">
                  {selectedCategoryMeta.description}
                </p>

                <div className="pt-2">
                  <label
                    htmlFor="fb-device"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5"
                  >
                    Dispositivo / Plataforma (opcional)
                  </label>
                  <select
                    id="fb-device"
                    value={deviceInfo}
                    onChange={(e) => setDeviceInfo(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {DEVICE_OPTIONS.map((dev) => (
                      <option key={dev} value={dev}>
                        {dev}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Title & Main Comment */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="fb-title"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5"
                >
                  Título resumido
                </label>
                <input
                  id="fb-title"
                  type="text"
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Respostas rápidas no chat ou sugestão para ZUNO Image..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="fb-comment"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-1.5"
                >
                  Comentário detalhado *
                </label>
                <textarea
                  id="fb-comment"
                  rows={4}
                  maxLength={3000}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Descreve a tua experiência, erro encontrado, o que gostaste ou a funcionalidade que gostarias de ver na ZUNO AI..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Mínimo 3 caracteres · Protegido contra spam</span>
                  <span>{comment.length} / 3000</span>
                </div>
              </div>

              {/* Structured optional questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="fb-liked"
                    className="text-xs font-medium text-slate-300 block mb-1.5"
                  >
                    O que mais gostaste na aplicação? (opcional)
                  </label>
                  <input
                    id="fb-liked"
                    type="text"
                    maxLength={500}
                    value={likedMost}
                    onChange={(e) => setLikedMost(e.target.value)}
                    placeholder="Ex.: Qualidade das respostas e interface escura"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="fb-improve"
                    className="text-xs font-medium text-slate-300 block mb-1.5"
                  >
                    O que pode melhorar ou nova ideia? (opcional)
                  </label>
                  <input
                    id="fb-improve"
                    type="text"
                    maxLength={500}
                    value={improvementSuggestion}
                    onChange={(e) => setImprovementSuggestion(e.target.value)}
                    placeholder="Ex.: Exportar conversas para PDF"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 4. Privacy Options + Submit */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      isPublic
                        ? 'border-blue-500 bg-blue-600/15 text-blue-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Feedback Público</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      !isPublic
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Privado (Apenas equipa ZUNO AI)</span>
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ocultar o meu nome publicamente (publicar como Anónimo)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'A enviar...' : 'Enviar feedback'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar + Scope Switch */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 border-b border-slate-800 sm:border-b-0 pb-2 sm:pb-0">
              <button
                type="button"
                onClick={() => setScopeTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  scopeTab === 'all'
                    ? 'bg-blue-600/20 text-white border border-blue-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                Comentários da comunidade
              </button>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setScopeTab('mine')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    scopeTab === 'mine'
                      ? 'bg-blue-600/20 text-white border border-blue-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  Os meus comentários
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={loadFeedbacks}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar lista</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar comentários ou sugestões..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              aria-label="Filtrar por opinião"
              value={filterLiked}
              onChange={(e) => setFilterLiked(e.target.value as any)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Opinião: Todas</option>
              <option value="liked">👍 Gostaram da app</option>
              <option value="disliked">👎 Não gostaram</option>
            </select>

            <select
              aria-label="Filtrar por categoria"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todas as categorias (12)</option>
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number}. {c.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por classificação"
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Todas as estrelas</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={String(r)}>
                  {r} {r === 1 ? 'estrela' : 'estrelas'}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Filtrar por estado"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="rounded-xl bg-slate-900/70 border border-slate-800 px-2.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Estado</option>
                {FEEDBACK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por data"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value as any)}
                className="rounded-xl bg-slate-900/70 border border-slate-800 px-2.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Data</option>
                <option value="today">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
              </select>
            </div>
          </div>
        </div>

        {/* Feedback List */}
        {isLoading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
            A carregar avaliações e comentários...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-200">
              Ainda não existem comentários para os filtros selecionados.
            </p>
            <p className="text-xs text-slate-400">
              Envia a primeira avaliação real utilizando o formulário acima.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const catMeta = getCategoryMeta(item.category);
              const isFocused = focusFeedbackId === item.id;
              const isEditingThis = editingId === item.id;

              return (
                <article
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[item.id] = el as HTMLDivElement | null;
                  }}
                  className={`rounded-2xl border bg-slate-900/50 p-5 sm:p-6 transition-colors space-y-4 ${
                    isFocused
                      ? 'border-blue-500 ring-1 ring-blue-500/40'
                      : 'border-slate-800'
                  }`}
                >
                  {isFocused && onClearFocus && (
                    <div className="flex items-center justify-between text-xs text-blue-300 border-b border-slate-800 pb-2">
                      <span>Comentário selecionado a partir da notificação</span>
                      <button
                        type="button"
                        onClick={onClearFocus}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        Limpar destaque
                      </button>
                    </div>
                  )}

                  {isEditingThis ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Editar o meu feedback</h3>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs text-slate-400 hover:text-white cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditLikedApp(true)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                              editLikedApp === true
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                                : 'border-slate-800 bg-slate-950 text-slate-400'
                            }`}
                          >
                            👍 Gostou
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLikedApp(false)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                              editLikedApp === false
                                ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                                : 'border-slate-800 bg-slate-950 text-slate-400'
                            }`}
                          >
                            👎 Não gostou
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setEditRating(star)}
                              className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
                                editRating >= star
                                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                                  : 'border-slate-800 bg-slate-950 text-slate-600'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${editRating >= star ? 'fill-amber-400' : ''}`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select
                          value={editImprovementArea}
                          onChange={(e) => setEditImprovementArea(e.target.value)}
                          className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                        >
                          <option value="">Área de melhoria (opcional)</option>
                          {IMPROVEMENT_AREAS.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as FeedbackCategoryId)}
                          className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                        >
                          {FEEDBACK_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.number}. {c.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as FeedbackType)}
                          className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                        >
                          {FEEDBACK_TYPES.map((ft) => (
                            <option key={ft.id} value={ft.id}>
                              {ft.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
                        placeholder="Título"
                      />

                      <textarea
                        rows={3}
                        value={editComment}
                        onChange={(e) => setEditComment(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editLikedMost}
                          onChange={(e) => setEditLikedMost(e.target.value)}
                          placeholder="O que mais gostaste"
                          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={editImprovement}
                          onChange={(e) => setEditImprovement(e.target.value)}
                          placeholder="Sugestão de melhoria"
                          className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editIsPublic}
                              onChange={(e) => setEditIsPublic(e.target.checked)}
                            />
                            <span>Público</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editIsAnonymous}
                              onChange={(e) => setEditIsAnonymous(e.target.checked)}
                            />
                            <span>Anónimo</span>
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={isSavingEdit}
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {isSavingEdit ? 'A guardar...' : 'Guardar alterações'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Header line: stars + title + actions */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <div className="flex items-center gap-0.5 mr-1" aria-label={`${item.rating} de 5 estrelas`}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${
                                    item.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="font-semibold text-slate-200">
                              {item.authorDisplayName}
                            </span>
                            {item.likedApp === true && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                                <ThumbsUp className="w-3 h-3" /> Gostou da app
                              </span>
                            )}
                            {item.likedApp === false && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-semibold">
                                <ThumbsDown className="w-3 h-3" /> Não gostou
                              </span>
                            )}
                            {item.improvementArea && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-medium">
                                Melhorar: {item.improvementArea}
                              </span>
                            )}
                            <span>·</span>
                            <span className="text-slate-300">
                              {catMeta.number}. {catMeta.label}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              {renderTypeIcon(item.feedbackType)}
                              <span>{typeLabel(item.feedbackType)}</span>
                            </span>
                            <span>·</span>
                            <span className={`font-semibold ${statusColorClass(item.status)}`}>
                              {item.status}
                            </span>
                            {!item.isPublic && (
                              <>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                                  <Lock className="w-3 h-3" /> Privado
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-bold text-white break-words">
                            {item.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                          <span>
                            {new Date(item.createdAt).toLocaleDateString('pt-PT', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>

                          {item.canEdit && (
                            <button
                              type="button"
                              onClick={() => startEditing(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                              title="Editar comentário"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {item.canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                              title="Eliminar comentário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!item.canEdit && item.isPublic && (
                            <button
                              type="button"
                              onClick={() => setReportingId(item.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-slate-800 cursor-pointer"
                              title="Denunciar comentário inadequado"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Delete inline confirmation */}
                      {confirmDeleteId === item.id && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <span className="text-rose-200 font-medium">
                            Confirmas que pretendes eliminar permanentemente este comentário?
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-500 font-semibold cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comment Body */}
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                        {item.comment}
                      </p>

                      {(item.likedMost || item.improvementSuggestion || item.deviceInfo) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                          {item.likedMost && (
                            <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3">
                              <span className="text-emerald-400 font-semibold block mb-0.5">
                                O que gostou
                              </span>
                              <p className="text-slate-300">{item.likedMost}</p>
                            </div>
                          )}
                          {item.improvementSuggestion && (
                            <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3">
                              <span className="text-amber-400 font-semibold block mb-0.5">
                                Sugestão de melhoria
                              </span>
                              <p className="text-slate-300">{item.improvementSuggestion}</p>
                            </div>
                          )}
                          {item.deviceInfo && (
                            <div className="text-[11px] text-slate-500 sm:col-span-2">
                              Dispositivo indicado: {item.deviceInfo}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Conversation / Official Team Replies */}
                      {item.replies.length > 0 && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-3">
                          {item.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className={`rounded-xl p-3.5 sm:p-4 space-y-1.5 ${
                                reply.isOfficial
                                  ? 'bg-blue-950/35 border border-blue-500/40'
                                  : 'bg-slate-950/70 border border-slate-800 ml-3 sm:ml-6'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  {reply.isOfficial ? (
                                    <span className="inline-flex items-center gap-1.5 font-bold text-blue-300">
                                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                                      <span>
                                        {reply.officialBadgeLabel || 'Resposta oficial da equipa ZUNO AI'}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="font-semibold text-slate-200">
                                      {reply.authorName}
                                    </span>
                                  )}
                                  {reply.isEdited && (
                                    <span className="text-[11px] text-slate-400">(editado)</span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  {new Date(reply.createdAt).toLocaleString('pt-PT', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Thread Reply Trigger & Form */}
                      <div className="pt-1 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAuthenticated) {
                                onOpenAuth('login');
                                return;
                              }
                              setReplyOpenMap((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5" />
                            <span>
                              {item.replies.some((r) => r.isOfficial)
                                ? 'Responder à equipa ZUNO AI'
                                : 'Adicionar resposta na conversa'}
                            </span>
                          </button>
                        </div>

                        {replyOpenMap[item.id] && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={replyDrafts[item.id] || ''}
                              onChange={(e) =>
                                setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Escreve a tua resposta organizada na conversa..."
                              className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              type="button"
                              disabled={submittingReplyId === item.id}
                              onClick={() => handleSendThreadReply(item.id)}
                              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {submittingReplyId === item.id ? 'A enviar...' : 'Enviar'}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Report Inappropriate Comment Modal */}
      {reportingId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReport}
            className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#0b1120] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Denunciar comentário</span>
              </div>
              <button
                type="button"
                onClick={() => setReportingId(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Motivo</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">
                Detalhes adicionais (opcional)
              </label>
              <textarea
                rows={3}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Explica brevemente o problema..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingReport}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {isSubmittingReport ? 'A enviar...' : 'Enviar denúncia'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
