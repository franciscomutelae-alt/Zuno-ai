import React, { useState, useEffect } from 'react';
import { ZUNO_TOOLS } from '../data/tools';
import {
  ToolDefinition,
  ToolId,
  Conversation,
  FavoriteItem,
  SearchBarCodeActionType,
  SearchCodeExecutionResult,
} from '../types';
import {
  runTool,
  searchWithGrounding,
  isAuthRequiredError,
  checkSearchCodeApi,
  executeSearchCodeApi,
} from '../services/api';
import { MarkdownRenderer } from '../components/common/MarkdownRenderer';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ZUNOImageGenerator } from '../components/image/ZUNOImageGenerator';
import { CREATOR_WELCOME_MESSAGE, isCreatorRecognitionQuery } from '../config/brand';
import {
  checkOfflineSearchCode,
  executeOfflineSearchCode,
  executeCreatorOfflineToolAsync,
  recordCreatorOfflineKnowledge,
} from '../services/offlineCreator';
import { 
  PenTool, 
  GraduationCap, 
  Code2, 
  Languages, 
  ScanEye, 
  FileText, 
  Mic, 
  Sparkles, 
  Image as ImageIcon, 
  Globe, 
  ArrowLeft, 
  ExternalLink, 
  Copy, 
  Check, 
  Loader2, 
  Send,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  Lock,
  AlertTriangle
} from 'lucide-react';

interface ToolsPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToChat: (prompt?: string) => void;
  onNavigateToImage?: () => void;
  onRequireAuth?: (featureLabel?: string) => void;
  onOpenAuth?: (mode: 'login' | 'signup' | 'switch') => void;
  initialToolId?: ToolId | null;
  onClearInitialToolId?: () => void;
  onApplySearchCodeResult?: (res: SearchCodeExecutionResult) => void | Promise<void>;
  conversations?: Conversation[];
  favorites?: FavoriteItem[];
}

export const ToolsPage: React.FC<ToolsPageProps> = ({
  onShowToast,
  onNavigateToChat,
  onRequireAuth,
  onOpenAuth,
  initialToolId,
  onClearInitialToolId,
  onApplySearchCodeResult,
  conversations = [],
  favorites = [],
}) => {
  const { t } = useLanguage();
  const { user, isAuthenticated, isGuest, isCreatorOfflineAccount, creatorOfflineMode, isOnline } = useAuth();
  const [selectedToolId, setSelectedToolId] = useState<ToolId | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [matchedSearchCode, setMatchedSearchCode] = useState<{
    code: string;
    purpose?: string;
    actionType?: SearchBarCodeActionType;
  } | null>(null);
  const [executingSearchCode, setExecutingSearchCode] = useState(false);

  useEffect(() => {
    if (initialToolId) {
      setSelectedToolId(initialToolId);
      setToolInput('');
      setToolResult(null);
      setToolError(null);
      onClearInitialToolId?.();
    }
  }, [initialToolId]);

  const isUsingCreatorOffline = Boolean(
    isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)
  );

  useEffect(() => {
    const trimmed = searchFilter.trim();
    if (!trimmed || /\s/.test(trimmed) || trimmed.length < 2 || isCreatorRecognitionQuery(trimmed)) {
      setMatchedSearchCode(null);
      return;
    }
    if (isUsingCreatorOffline) {
      const res = checkOfflineSearchCode(trimmed);
      setMatchedSearchCode(
        res.matched && res.code
          ? { code: res.code, purpose: res.purpose, actionType: res.actionType }
          : null
      );
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkSearchCodeApi(trimmed).then((res) => {
        if (!cancelled) {
          setMatchedSearchCode(
            res.matched && res.code
              ? { code: res.code, purpose: res.purpose, actionType: res.actionType }
              : null
          );
        }
      });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchFilter, isUsingCreatorOffline]);

  const handleRunGallerySearchCode = async () => {
    const trimmed = searchFilter.trim();
    if (!trimmed || executingSearchCode) return;
    setExecutingSearchCode(true);
    try {
      const res = isUsingCreatorOffline
        ? executeOfflineSearchCode(trimmed)
        : await executeSearchCodeApi(trimmed);
      if (res.matched) {
        await onApplySearchCodeResult?.(res);
        if (res.executed) {
          setSearchFilter('');
          setMatchedSearchCode(null);
        }
      }
    } finally {
      setExecutingSearchCode(false);
    }
  };

  // Tool Workspace State
  const [toolInput, setToolInput] = useState('');
  const [toolResult, setToolResult] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);

  // Tool specific options
  const [writerTone, setWriterTone] = useState('profissional');
  const [writerFormat, setWriterFormat] = useState('artigo');
  const [targetLang, setTargetLang] = useState('Inglês');
  const [codeAction, setCodeAction] = useState('debug');
  const [searchCitations, setSearchCitations] = useState<Array<{ title: string; url: string }>>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const selectedTool = ZUNO_TOOLS.find((t) => t.id === selectedToolId);

  const getToolIcon = (iconName: string, className = 'w-5 h-5') => {
    switch (iconName) {
      case 'PenTool': return <PenTool className={className} />;
      case 'GraduationCap': return <GraduationCap className={className} />;
      case 'Code2': return <Code2 className={className} />;
      case 'Languages': return <Languages className={className} />;
      case 'ScanEye': return <ScanEye className={className} />;
      case 'FileText': return <FileText className={className} />;
      case 'Mic': return <Mic className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Image': return <ImageIcon className={className} />;
      case 'Globe': return <Globe className={className} />;
      default: return <Sparkles className={className} />;
    }
  };

  const handleSelectTool = (id: ToolId) => {
    if (!isAuthenticated && id !== 'search') {
      const targetTool = ZUNO_TOOLS.find((tool) => tool.id === id);
      onRequireAuth?.(targetTool?.name || 'Ferramenta exclusiva ZUNO AI');
      return;
    }
    setSelectedToolId(id);
    setToolInput('');
    setToolResult(null);
    setToolError(null);
    setSearchCitations([]);
    setUploadedImage(null);
    setUploadedFileName(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteTool = async (promptOverride?: string) => {
    const query = promptOverride || toolInput;
    if (!query.trim() && !uploadedImage) {
      onShowToast('Por favor insere um texto ou anexa um ficheiro.', 'error');
      return;
    }

    setIsLoading(true);
    setToolResult(null);
    setToolError(null);
    setSearchCitations([]);

    try {
      if (isCreatorRecognitionQuery(query)) {
        setToolResult(CREATOR_WELCOME_MESSAGE);
        setSearchCitations([]);
        onShowToast('Seja bem-vindo, Francisco Mutela Emanuel!', 'success');
        return;
      }
      if (!uploadedImage && !/\s/.test(query.trim()) && query.trim().length >= 2) {
        const codeRes = isUsingCreatorOffline
          ? executeOfflineSearchCode(query.trim())
          : await executeSearchCodeApi(query.trim());
        if (codeRes.matched) {
          if (codeRes.requiresAuth) {
            onRequireAuth?.(codeRes.purpose || 'Executar código na conta');
            return;
          }
          if (!codeRes.executed) {
            setToolError(codeRes.error || 'Este código não pôde ser executado.');
            onShowToast(codeRes.error || 'Código indisponível.', 'error');
            return;
          }
          setToolResult(
            codeRes.responseText ||
              `✅ Código **${codeRes.code}** ativado: **${codeRes.purpose || 'Operação concluída'}**.`
          );
          await onApplySearchCodeResult?.(codeRes);
          return;
        }
      }
      if (isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)) {
        const offlineOut = await executeCreatorOfflineToolAsync({
          toolId: selectedToolId || 'writer',
          query,
          user,
          conversations,
          favorites,
          uploadedImage,
          options: {
            tone: writerTone,
            format: writerFormat,
            targetLang,
            codeAction,
          },
        });
        setToolResult(offlineOut.result);
        setSearchCitations(offlineOut.citations);
        recordCreatorOfflineKnowledge(user.email, query, offlineOut.result);
        return;
      }
      if (selectedToolId === 'search') {
        // Special Google Search Grounding flow
        const data = await searchWithGrounding(query);
        setToolResult(data.answer);
        setSearchCitations(data.citations || []);
        if (isCreatorOfflineAccount && user?.email && data.answer) {
          recordCreatorOfflineKnowledge(user.email, query, data.answer);
        }
      } else {
        if (!isAuthenticated) {
          onRequireAuth?.(selectedTool?.name || 'Ferramentas exclusivas ZUNO AI');
          return;
        }
        // Standard or Vision tool
        const attachments = uploadedImage
          ? [
              {
                name: uploadedFileName || 'uploaded-file',
                type: 'image/jpeg',
                size: 1024,
                dataUrl: uploadedImage,
              },
            ]
          : undefined;

        const options = {
          tone: writerTone,
          format: writerFormat,
          targetLang,
          codeAction,
        };

        const res = await runTool(selectedToolId || 'writer', query, options, attachments);
        setToolResult(res.result);
        if (isCreatorOfflineAccount && user?.email && res.result) {
          recordCreatorOfflineKnowledge(user.email, query, res.result);
        }
      }
    } catch (err: any) {
      if (isAuthRequiredError(err)) {
        onRequireAuth?.(selectedTool?.name || 'Ferramentas exclusivas ZUNO AI');
      } else {
        const cleanMsg = err?.message || 'Erro ao executar ferramenta.';
        setToolError(cleanMsg);
        onShowToast(cleanMsg, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyResult = () => {
    if (!toolResult) return;
    navigator.clipboard.writeText(toolResult);
    setCopiedResult(true);
    onShowToast('Resultado copiado com sucesso!', 'success');
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const filteredTools = ZUNO_TOOLS.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      tool.shortDesc.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* If no tool is selected: Show Tools Gallery */}
        {!selectedTool ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Suite de Alta Performance
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Ferramentas ZUNO AI
              </h1>
              <p className="text-sm sm:text-base text-slate-400">
                10 ferramentas inteligentes dedicadas com interfaces específicas e integração direta ao motor Gemini.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'productivity', label: 'Produtividade' },
                  { id: 'learning', label: 'Educação' },
                  { id: 'multimodal', label: 'Multimodal' },
                  { id: 'creation', label: 'Criatividade' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchFilter(val);
                    if (isCreatorRecognitionQuery(val)) {
                      onShowToast('Seja bem-vindo, Francisco Mutela Emanuel!', 'success');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && matchedSearchCode) {
                      e.preventDefault();
                      handleRunGallerySearchCode();
                    }
                  }}
                  placeholder="Pesquisar ferramenta ou código..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {isCreatorRecognitionQuery(searchFilter) && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Seja bem-vindo, Francisco Mutela Emanuel!</p>
                  <p className="text-xs text-slate-300">Identidade de criador da plataforma ZUNO AI reconhecida com sucesso.</p>
                </div>
              </div>
            )}
            {matchedSearchCode && !isCreatorRecognitionQuery(searchFilter) && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-blue-600/20 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      Código {matchedSearchCode.code} detetado
                    </p>
                    <p className="text-xs text-slate-300 truncate">{matchedSearchCode.purpose}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={executingSearchCode}
                  onClick={handleRunGallerySearchCode}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {executingSearchCode ? 'A executar...' : 'Executar código'}
                </button>
              </div>
            )}

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTools.map((tool) => {
                const lockedForGuest = !isAuthenticated && tool.id !== 'search';
                return (
                  <div
                    key={tool.id}
                    onClick={() => handleSelectTool(tool.id)}
                    className={`group relative rounded-2xl border p-6 shadow-xl transition-all cursor-pointer flex flex-col justify-between ${
                      lockedForGuest
                        ? 'border-slate-800/70 bg-slate-900/25 hover:border-purple-500/40'
                        : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:shadow-2xl hover:border-blue-500/40'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:text-blue-300 transition-all">
                          {getToolIcon(tool.icon, 'w-6 h-6')}
                        </div>
                        {lockedForGuest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700">
                            <Lock className="w-3 h-3 text-purple-400" />
                            Conta
                          </span>
                        ) : (
                          tool.badge && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {tool.badge}
                            </span>
                          )
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                          {tool.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          {tool.shortDesc}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-blue-400 font-medium">
                      <span>{lockedForGuest ? 'Requer conta ZUNO AI' : 'Abrir ferramenta'}</span>
                      {lockedForGuest ? (
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Dedicated Tool Workspace View */
          <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
            {/* Top Back Nav */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                onClick={() => setSelectedToolId(null)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar a todas as ferramentas</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {selectedTool.badge || 'Integrado'}
                </span>
              </div>
            </div>

            {/* Special Integrated Studio View for ZUNO Image */}
            {selectedToolId === 'image' ? (
              <div className="space-y-6">
                <ZUNOImageGenerator
                  compact
                  onShowToast={onShowToast}
                  onNavigateToPricing={() => onNavigateToChat('/pricing')}
                  onRequireAuth={onRequireAuth}
                  onOpenAuth={onOpenAuth}
                />
              </div>
            ) : (
              <>
                {/* Tool Banner */}
                <div className="flex items-start gap-4 p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/20">
                    {getToolIcon(selectedTool.icon, 'w-7 h-7')}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white">{selectedTool.name}</h2>
                    <p className="text-sm text-slate-400">{selectedTool.shortDesc}</p>
                  </div>
                </div>

            {/* Tool Specific Configurations */}
            {selectedToolId === 'writer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Tom de Escrita:
                  </label>
                  <select
                    value={writerTone}
                    onChange={(e) => setWriterTone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="profissional">Profissional & Executivo</option>
                    <option value="persuasivo">Persuasivo & Vendas (Copy)</option>
                    <option value="academico">Académico & Formal</option>
                    <option value="descontraido">Descontraído & Criativo</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    Formato:
                  </label>
                  <select
                    value={writerFormat}
                    onChange={(e) => setWriterFormat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="artigo">Artigo de Blog / Notícia</option>
                    <option value="email">E-mail Comercial</option>
                    <option value="proposta">Proposta Comercial B2B</option>
                    <option value="redes_sociais">Post para LinkedIn / Redes</option>
                  </select>
                </div>
              </div>
            )}

            {selectedToolId === 'translate' && (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Idioma de Destino:
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                >
                  <option value="Inglês (US)">Inglês (Estados Unidos)</option>
                  <option value="Inglês (UK)">Inglês (Reino Unido)</option>
                  <option value="Francês">Francês</option>
                  <option value="Espanhol">Espanhol</option>
                  <option value="Alemão">Alemão</option>
                  <option value="Italiano">Italiano</option>
                  <option value="Japonês">Japonês</option>
                  <option value="Mandarim">Mandarim</option>
                  <option value="Português (Portugal)">Português (Portugal)</option>
                </select>
              </div>
            )}

            {selectedToolId === 'code' && (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                  Objetivo Técnico:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'debug', label: 'Encontrar & Corrigir Erros' },
                    { id: 'refactor', label: 'Refatorar & Otimizar Performance' },
                    { id: 'explain', label: 'Explicar Código Passo a Passo' },
                    { id: 'tests', label: 'Gerar Testes Unitários' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      onClick={() => setCodeAction(act.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                        codeAction === act.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(selectedToolId === 'vision' || selectedToolId === 'pdf') && (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">
                  Anexar Ficheiro ou Imagem:
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-white font-medium cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-blue-400" />
                    <span>{uploadedFileName || 'Escolher ficheiro do computador'}</span>
                    <input
                      type="file"
                      accept={selectedToolId === 'vision' ? 'image/*' : '.pdf,.txt,.md,.doc'}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedImage && (
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setUploadedFileName(null);
                      }}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Remover ficheiro
                    </button>
                  )}
                </div>

                {uploadedImage && selectedToolId === 'vision' && (
                  <div className="mt-2">
                    <img
                      src={uploadedImage}
                      alt="Preview"
                      className="max-h-48 rounded-xl border border-slate-700"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Sample Prompts Pills */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400">Sugestões rápidas:</span>
              <div className="flex flex-wrap gap-2">
                {selectedTool.samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setToolInput(p);
                      handleExecuteTool(p);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-xs text-slate-300 hover:text-white hover:border-blue-500/50 transition-colors cursor-pointer text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input & Execution Form */}
            <div className="space-y-3">
              <textarea
                value={toolInput}
                onChange={(e) => setToolInput(e.target.value)}
                placeholder={`Instruções ou conteúdo para o ${selectedTool.name}...`}
                rows={4}
                className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />

              <div className="flex justify-between items-center">
                <button
                  onClick={() => onNavigateToChat(toolInput)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Abrir no Chat Principal
                </button>

                <button
                  onClick={() => handleExecuteTool()}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>A processar com Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Executar {selectedTool.name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Friendly Inline Error Banner */}
            {toolError && !isLoading && (
              <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Aviso do Sistema
                    </p>
                    <p className="text-xs sm:text-sm text-slate-200">{toolError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleExecuteTool()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            )}

            {/* Result Box */}
            {toolResult && (
              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Resultado Gerado
                    </span>
                  </div>

                  <button
                    onClick={handleCopyResult}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    {copiedResult ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Resultado</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-sm leading-relaxed text-slate-200">
                  <MarkdownRenderer content={toolResult} />
                </div>

                {/* Google Search Citations if present */}
                {searchCitations.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      Fontes Verificadas (Google Search Grounding):
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {searchCitations.map((cit, citIdx) => (
                        <a
                          key={citIdx}
                          href={cit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/60 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 text-xs text-blue-300 transition-all"
                        >
                          <span className="truncate max-w-[200px]">{cit.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
