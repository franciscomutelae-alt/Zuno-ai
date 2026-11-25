import React, { useState, useEffect, useCallback } from 'react';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  getCategoryMeta,
} from '../../data/feedbackCategories';
import {
  fetchAdminFeedback,
  postAdminOfficialReply,
  editAdminReply,
  deleteAdminReply,
  updateFeedbackStatusApi,
  moderateFeedbackApi,
  deleteFeedbackApi,
  downloadFeedbackReport,
  FeedbackFilterParams,
  UserIdentityHeader,
} from '../../services/api';
import {
  FeedbackAuditEntry,
  FeedbackItem,
  FeedbackReport,
  FeedbackStats,
  FeedbackStatus,
} from '../../types';
import {
  Star,
  Search,
  Download,
  ShieldCheck,
  Send,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  History,
  Flag,
  Lock,
  Globe,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Lightbulb,
  Wrench,
} from 'lucide-react';

interface AdminFeedbackPanelProps {
  adminUser: UserIdentityHeader | null;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminFeedbackPanel: React.FC<AdminFeedbackPanelProps> = ({
  adminUser,
  onShowToast,
}) => {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [auditHistory, setAuditHistory] = useState<FeedbackAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLiked, setFilterLiked] = useState<'all' | 'liked' | 'disliked'>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'public' | 'private' | 'reported'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Official Reply Composer per feedback
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyStatusTarget, setReplyStatusTarget] = useState<Record<string, FeedbackStatus>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);

  // Edit existing reply state
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [savingReplyEdit, setSavingReplyEdit] = useState(false);

  // View toggle for audit/reports
  const [subSection, setSubSection] = useState<'list' | 'history' | 'reports'>('list');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: FeedbackFilterParams = {
        category: filterCategory,
        rating: filterRating,
        status: filterStatus,
        likedFilter: filterLiked,
        dateFilter: filterDate,
        visibilityFilter: filterVisibility,
        search: searchQuery,
      };
      const data = await fetchAdminFeedback(filters, adminUser);
      setItems(data.items || []);
      setStats(data.stats || null);
      setReports(data.reports || []);
      setAuditHistory(data.auditHistory || []);
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao carregar feedback administrativo.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    filterCategory,
    filterRating,
    filterStatus,
    filterLiked,
    filterDate,
    filterVisibility,
    searchQuery,
    adminUser?.id,
    adminUser?.email,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendOfficialReply = async (feedbackId: string) => {
    const content = (replyDrafts[feedbackId] || '').trim();
    if (content.length < 2) {
      onShowToast('Escreve uma resposta oficial antes de publicar.', 'error');
      return;
    }

    setSendingReplyId(feedbackId);
    try {
      const nextStatus = replyStatusTarget[feedbackId] || 'Respondido';
      await postAdminOfficialReply(feedbackId, content, nextStatus, adminUser);
      setReplyDrafts((prev) => ({ ...prev, [feedbackId]: '' }));
      onShowToast('Resposta oficial publicada e utilizador notificado.', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao publicar resposta oficial.', 'error');
    } finally {
      setSendingReplyId(null);
    }
  };

  const handleSaveEditReply = async (replyId: string) => {
    if (editReplyContent.trim().length < 2) {
      onShowToast('O texto da resposta não pode estar vazio.', 'error');
      return;
    }
    setSavingReplyEdit(true);
    try {
      await editAdminReply(replyId, editReplyContent.trim(), adminUser);
      setEditingReplyId(null);
      setEditReplyContent('');
      onShowToast('Resposta oficial atualizada e registada no histórico.', 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao editar resposta.', 'error');
    } finally {
      setSavingReplyEdit(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteAdminReply(replyId, adminUser);
      onShowToast('Resposta oficial eliminada (registo mantido no histórico).', 'info');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao eliminar resposta.', 'error');
    }
  };

  const handleChangeStatus = async (feedbackId: string, status: FeedbackStatus) => {
    try {
      await updateFeedbackStatusApi(feedbackId, status, adminUser);
      onShowToast(`Estado atualizado para "${status}".`, 'success');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao atualizar estado.', 'error');
    }
  };

  const handleToggleHidden = async (feedbackId: string, currentlyHidden: boolean) => {
    try {
      await moderateFeedbackApi(feedbackId, !currentlyHidden, adminUser);
      onShowToast(
        !currentlyHidden ? 'Comentário ocultado do público.' : 'Comentário restaurado no público.',
        'info'
      );
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao moderar comentário.', 'error');
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      await deleteFeedbackApi(feedbackId, adminUser);
      onShowToast('Feedback removido da base de dados.', 'info');
      await loadData();
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao remover feedback.', 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await downloadFeedbackReport(
        format,
        {
          category: filterCategory,
          rating: filterRating,
          status: filterStatus,
          likedFilter: filterLiked,
          dateFilter: filterDate,
          search: searchQuery,
        },
        adminUser
      );
      onShowToast(`Relatório ${format.toUpperCase()} exportado com sucesso.`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao exportar relatório.', 'error');
    }
  };

  const actionLabel = (action: FeedbackAuditEntry['action']) => {
    switch (action) {
      case 'reply_created':
        return 'Resposta publicada';
      case 'reply_edited':
        return 'Resposta editada';
      case 'reply_deleted':
        return 'Resposta eliminada';
      case 'status_changed':
        return 'Estado alterado';
      case 'moderated':
        return 'Moderação aplicada';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-8">
      {/* Real Feedback Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total recebido</span>
            <MessageSquare className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.totalFeedbacks ?? 0}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Aprovação</span>
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            {stats ? `${stats.approvalRate}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-400">
            👍 {stats?.likedCount ?? 0} · 👎 {stats?.dislikedCount ?? 0}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Média real</span>
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {stats && stats.ratedFeedbacks > 0 ? `${stats.averageRating.toFixed(2)} ★` : '—'}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Elogios</span>
            <ThumbsUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400">{stats?.praiseCount ?? 0}</div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sugestões / Ideias</span>
            <Lightbulb className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400">
            {(stats?.improvementCount ?? 0) + (stats?.featureRequestCount ?? 0)}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Críticas & Erros</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{stats?.criticismCount ?? 0}</div>
        </div>
      </div>

      {/* Frequent Suggestions, Top Improvement Areas & Category Breakdown */}
      {stats && (stats.frequentSuggestions.length > 0 || stats.topCategories.length > 0 || (stats.topImprovementAreas?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Onde os utilizadores pedem melhorias</span>
            </h3>
            {(!stats.topImprovementAreas || stats.topImprovementAreas.length === 0) ? (
              <p className="text-xs text-slate-400">Sem áreas específicas indicadas até ao momento.</p>
            ) : (
              <div className="space-y-2">
                {stats.topImprovementAreas.slice(0, 6).map((item) => (
                  <div
                    key={item.area}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-200 font-medium">{item.area}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Sugestões e temas mais frequentes</span>
            </h3>
            {stats.frequentSuggestions.length === 0 ? (
              <p className="text-xs text-slate-400">Sem sugestões frequentes detetadas.</p>
            ) : (
              <div className="space-y-2.5">
                {stats.frequentSuggestions.map((s) => (
                  <div
                    key={s.category}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-semibold text-white">{s.topic}</div>
                      {s.sampleTitles.length > 0 && (
                        <p className="text-[11px] text-slate-400 truncate">
                          Exemplos: {s.sampleTitles.join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-purple-300 shrink-0">
                      {s.count} {s.count === 1 ? 'menção' : 'menções'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
            <h3 className="text-sm font-bold text-white">Distribuição por categoria e estrelas</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs font-bold text-amber-400">{star} ★</div>
                  <div className="text-sm font-black text-white mt-0.5">
                    {stats.ratingDistribution?.[star] ?? 0}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-2">
              {stats.topCategories.slice(0, 5).map((tc) => (
                <div key={tc.category} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{getCategoryMeta(tc.category).label}</span>
                  <span className="font-semibold text-white">{tc.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Bar: Sub-tabs + Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubSection('list')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              subSection === 'list'
                ? 'bg-blue-600/20 text-white border border-blue-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            Comentários ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSubSection('history')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              subSection === 'history'
                ? 'bg-blue-600/20 text-white border border-blue-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico de alterações ({auditHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubSection('reports')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              subSection === 'reports'
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                : 'text-slate-400 hover:text-white bg-slate-900/60'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Denúncias ({reports.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold text-emerald-300 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-semibold text-blue-300 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar JSON</span>
          </button>
        </div>
      </div>

      {/* Filters for Comment List */}
      {subSection === 'list' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar título, comentário, autor..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={filterLiked}
              onChange={(e) => setFilterLiked(e.target.value as any)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">Opinião: Todas</option>
              <option value="liked">👍 Gostaram</option>
              <option value="disliked">👎 Não gostaram</option>
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">Categoria: Todas</option>
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.number}. {c.label}
                </option>
              ))}
            </select>

            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">Classificação: Todas</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={String(r)}>
                  {r} ★
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 text-xs text-slate-200"
            >
              <option value="all">Estado: Todos</option>
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value as any)}
                className="rounded-xl bg-slate-900/70 border border-slate-800 px-2 py-2 text-xs text-slate-200"
              >
                <option value="all">Data: Todas</option>
                <option value="today">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
              </select>

              <select
                value={filterVisibility}
                onChange={(e) => setFilterVisibility(e.target.value as any)}
                className="rounded-xl bg-slate-900/70 border border-slate-800 px-2 py-2 text-xs text-slate-200"
              >
                <option value="all">Todos</option>
                <option value="public">Públicos</option>
                <option value="private">Privados</option>
                <option value="reported">Denunciados</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
              A carregar comentários dos utilizadores...
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 rounded-2xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
              Nenhum comentário encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const catMeta = getCategoryMeta(item.category);
                const typeLabel =
                  FEEDBACK_TYPES.find((ft) => ft.id === item.feedbackType)?.label || item.feedbackType;

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-5 space-y-4 ${
                      item.isHidden
                        ? 'border-rose-500/40 bg-rose-950/15'
                        : 'border-slate-800 bg-slate-900/50'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="font-bold text-amber-400">{item.rating} ★</span>
                          <span className="font-semibold text-white">{item.authorDisplayName}</span>
                          {item.likedApp === true && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-semibold">
                              <ThumbsUp className="w-3 h-3" /> Gostou
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
                          <span>{catMeta.number}. {catMeta.label}</span>
                          <span>·</span>
                          <span>{typeLabel}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            {item.isPublic ? (
                              <>
                                <Globe className="w-3 h-3 text-blue-400" /> Público
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 text-amber-400" /> Privado
                              </>
                            )}
                          </span>
                          {item.reportCount > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400 font-semibold">
                                {item.reportCount} denúncia(s)
                              </span>
                            </>
                          )}
                          {item.isHidden && (
                            <>
                              <span>·</span>
                              <span className="text-rose-400 font-bold">OCULTO</span>
                            </>
                          )}
                        </div>
                        <h4 className="text-base font-bold text-white">{item.title}</h4>
                        <p className="text-xs text-slate-400">
                          {new Date(item.createdAt).toLocaleString('pt-PT')}
                          {item.deviceInfo ? ` · ${item.deviceInfo}` : ''}
                        </p>
                      </div>

                      {/* Admin Status & Moderation Controls */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select
                          aria-label="Alterar estado do feedback"
                          value={item.status}
                          onChange={(e) => handleChangeStatus(item.id, e.target.value as FeedbackStatus)}
                          className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          {FEEDBACK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleToggleHidden(item.id, item.isHidden)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                          title={item.isHidden ? 'Tornar visível ao público' : 'Ocultar do público'}
                        >
                          {item.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{item.isHidden ? 'Restaurar' : 'Ocultar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(item.id)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 cursor-pointer"
                          title="Eliminar feedback"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {item.comment}
                    </p>

                    {(item.likedMost || item.improvementSuggestion) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {item.likedMost && (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span className="text-emerald-400 font-semibold block">O que gostou</span>
                            <span className="text-slate-300">{item.likedMost}</span>
                          </div>
                        )}
                        {item.improvementSuggestion && (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                            <span className="text-amber-400 font-semibold block">Sugestão de melhoria</span>
                            <span className="text-slate-300">{item.improvementSuggestion}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Replies Thread with Edit / Delete for Official Replies */}
                    {item.replies.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-800">
                        {item.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-xl p-3.5 space-y-2 ${
                              reply.isOfficial
                                ? 'bg-blue-950/40 border border-blue-500/40'
                                : 'bg-slate-950/70 border border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
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

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500">
                                  {new Date(reply.createdAt).toLocaleString('pt-PT')}
                                </span>
                                {reply.isOfficial && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingReplyId(reply.id);
                                        setEditReplyContent(reply.content);
                                      }}
                                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                      title="Editar resposta oficial"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                                      title="Eliminar resposta oficial"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {editingReplyId === reply.id ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  value={editReplyContent}
                                  onChange={(e) => setEditReplyContent(e.target.value)}
                                  className="w-full rounded-xl bg-slate-950 border border-blue-500 px-3 py-2 text-xs text-white"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingReplyId(null)}
                                    className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingReplyEdit}
                                    onClick={() => handleSaveEditReply(reply.id)}
                                    className="px-3 py-1 rounded-lg bg-blue-600 text-xs font-semibold text-white cursor-pointer"
                                  >
                                    Guardar edição
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs sm:text-sm text-slate-200 whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Official Reply Composer */}
                    <div className="pt-2 border-t border-slate-800/70 space-y-2">
                      <label className="text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Responder como Resposta oficial da equipa ZUNO AI</span>
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={replyDrafts[item.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          placeholder="Escreve a resposta oficial para o utilizador..."
                          className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        <select
                          aria-label="Estado ao responder"
                          value={replyStatusTarget[item.id] || 'Respondido'}
                          onChange={(e) =>
                            setReplyStatusTarget((prev) => ({
                              ...prev,
                              [item.id]: e.target.value as FeedbackStatus,
                            }))
                          }
                          className="rounded-xl bg-slate-950 border border-slate-700 px-2.5 py-2 text-xs text-slate-200"
                        >
                          {FEEDBACK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              Marcar: {s}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={sendingReplyId === item.id}
                          onClick={() => handleSendOfficialReply(item.id)}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{sendingReplyId === item.id ? 'A publicar...' : 'Publicar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Internal Audit History Log */}
      {subSection === 'history' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            <span>Registo interno de respostas, edições, eliminações e alterações de estado</span>
          </h3>
          {auditHistory.length === 0 ? (
            <p className="text-xs text-slate-400">Sem histórico de alterações registado até ao momento.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {auditHistory.map((entry) => (
                <div key={entry.id} className="py-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-300">{actionLabel(entry.action)}</span>
                      <span className="text-slate-400">por {entry.actorName}</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        ({entry.feedbackId})
                      </span>
                    </div>
                    <span className="text-slate-500">
                      {new Date(entry.createdAt).toLocaleString('pt-PT')}
                    </span>
                  </div>
                  {(entry.previousValue || entry.newValue) && (
                    <div className="text-[11px] text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {entry.previousValue && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
                          <span className="text-slate-500 block">Anterior:</span>
                          <span className="break-words">{entry.previousValue}</span>
                        </div>
                      )}
                      {entry.newValue && (
                        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2">
                          <span className="text-slate-500 block">Novo:</span>
                          <span className="break-words">{entry.newValue}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Moderation Reports Section */}
      {subSection === 'reports' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Flag className="w-4 h-4 text-amber-400" />
            <span>Denúncias submetidas pelos utilizadores</span>
          </h3>
          {reports.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma denúncia registada.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {reports.map((rep) => (
                <div key={rep.id} className="py-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-amber-300">{rep.reason}</span>
                    <span className="text-slate-500">
                      Feedback: <span className="font-mono">{rep.feedbackId}</span> ·{' '}
                      {new Date(rep.createdAt).toLocaleString('pt-PT')}
                    </span>
                  </div>
                  {rep.details && <p className="text-slate-300">{rep.details}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
