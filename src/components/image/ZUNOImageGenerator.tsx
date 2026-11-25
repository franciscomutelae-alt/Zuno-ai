import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { ImageStyle, ImageAspectRatio, GeneratedImage, PlanType, GUEST_RESTRICTION_MESSAGE } from '../../types';
import { 
  generateImage, 
  fetchImageHistory, 
  deleteImage, 
  fetchAdminImageConfig, 
  updateAdminImageConfig 
} from '../../services/api';
import { loadLocalImagesForUser, saveLocalImagesForUser } from '../../services/storage';
import { generateCreatorOfflineImage } from '../../services/offlineCreator';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Download, 
  RotateCw, 
  Maximize2, 
  X, 
  Check, 
  Copy, 
  Wand2, 
  AlertCircle, 
  Palette,
  Layers,
  ArrowRight,
  Upload,
  Trash2,
  Sliders,
  Sun,
  Shield,
  SlidersHorizontal,
  StopCircle,
  Crop,
  Edit3,
  RefreshCw,
  Eye,
  Lock,
  UserPlus,
  LogIn
} from 'lucide-react';

export interface ZUNOImageGeneratorProps {
  onShowToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToPricing?: () => void;
  onRequireAuth?: (featureLabel?: string) => void;
  onOpenAuth?: (mode: 'login' | 'signup' | 'switch') => void;
  compact?: boolean;
  initialPrompt?: string;
}

export const ZUNOImageGenerator: React.FC<ZUNOImageGeneratorProps> = ({
  onShowToast,
  onNavigateToPricing,
  onRequireAuth,
  onOpenAuth,
  compact = false,
  initialPrompt = '',
}) => {
  const {
    user,
    isAuthenticated,
    isAdmin,
    incrementImageCount,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    isOnline,
  } = useAuth();
  const { t } = useLanguage();

  // Mode: Create new vs Edit existing image
  const [activeTab, setActiveTab] = useState<'create' | 'edit'>('create');

  // Input & Settings State
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('realista');
  const [selectedRatio, setSelectedRatio] = useState<ImageAspectRatio>('1:1');
  const [selectedQuality, setSelectedQuality] = useState<'standard' | 'hd' | 'ultra'>('hd');
  const [imageCount, setImageCount] = useState<number>(1);

  // Edit Mode Specific State
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageName, setReferenceImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generation Lifecycle State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number>(0);

  // Gallery & Lightbox State (strictly isolated per UID)
  const [gallery, setGallery] = useState<GeneratedImage[]>(() =>
    user?.id ? loadLocalImagesForUser(user.id) : []
  );
  const [activeLightboxImage, setActiveLightboxImage] = useState<GeneratedImage | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStyleShowcase, setShowStyleShowcase] = useState<boolean>(!compact);

  // Admin/Founder Config Modal
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminLimits, setAdminLimits] = useState({
    free: 3,
    premium: 20,
    pro: 50,
    ultra: 500,
  });

  // Reset and reload gallery strictly on UID changes
  useEffect(() => {
    if (!user?.id) {
      setGallery([]);
      return;
    }
    setGallery(loadLocalImagesForUser(user.id));
  }, [user?.id]);

  // Sync with UID-scoped local storage
  useEffect(() => {
    if (user?.id) {
      saveLocalImagesForUser(user.id, gallery);
    }
  }, [gallery, user?.id]);

  // Load image history and admin limits for verified accounts
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !isOnline || creatorOfflineMode) return;

    fetchImageHistory()
      .then((data) => {
        if (data.images && data.images.length > 0) {
          setGallery((prev) => {
            const existingIds = new Set(prev.map((i) => i.id));
            const newOnes = data.images.filter((img) => !existingIds.has(img.id));
            return [...newOnes, ...prev];
          });
        }
      })
      .catch(() => {});

    if (isAdmin) {
      fetchAdminImageConfig()
        .then((cfg) => {
          if (cfg.imageLimitsPerPlan) {
            setAdminLimits({
              free: cfg.imageLimitsPerPlan.free ?? 3,
              premium: cfg.imageLimitsPerPlan.premium ?? 20,
              pro: cfg.imageLimitsPerPlan.pro ?? 50,
              ultra: cfg.imageLimitsPerPlan.ultra ?? 500,
            });
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, isAdmin, user?.id, isOnline, creatorOfflineMode]);

  // All 12 signature ZUNO AI styles from showcase + core creative modes
  const styles: Array<{ id: ImageStyle; label: string; desc: string; icon: string }> = [
    { id: 'realista', label: 'Realistas & Foto', desc: 'Luz natural dourada, foco nítido e bokeh', icon: '📸' },
    { id: 'anime', label: 'Anime & Manga', desc: 'Estilo vibrante Makoto Shinkai e céu luminoso', icon: '⛩️' },
    { id: '3d', label: '3D & Personagens', desc: 'Render 3D vibrante estilo cinema e jogos', icon: '🧊' },
    { id: 'cartoon', label: 'Desenhos & Cartoon', desc: 'Traço limpo, expressivo e cores alegres', icon: '🎨' },
    { id: 'paisagem', label: 'Paisagens & Natureza', desc: 'Lagos espelhados, montanhas e luz épica', icon: '🏔️' },
    { id: 'logotipo', label: 'Logótipos & Marcas', desc: 'Emblemas néon azul elétrico e roxo', icon: '🏆' },
    { id: 'produto', label: 'Produtos & Publicidade', desc: 'Estúdio escuro com iluminação néon premium', icon: '🛒' },
    { id: 'futurista', label: 'Arte Futurista', desc: 'Metrópoles sci-fi, néon e naves espaciais', icon: '🚀' },
    { id: 'ilustracao', label: 'Ilustrações', desc: 'Arte editorial detalhada e harmonia de cor', icon: '✒️' },
    { id: 'cinematografico', label: 'Cinematográficas', desc: 'Enquadramento IMAX épico ao crepúsculo', icon: '🎬' },
    { id: 'interiores', label: 'Interiores & Decoração', desc: 'Ambientes modernos com luz natural quente', icon: '🏠' },
    { id: 'fantasia', label: 'Imaginação Livre', desc: 'Criaturas mágicas e mundos encantados', icon: '⭐' },
    { id: 'fotografico', label: 'Retrato Pro', desc: 'Fotografia editorial 50mm f/1.4 natural', icon: '📷' },
    { id: 'artistico', label: 'Belas Artes', desc: 'Pintura a óleo expressiva de galeria', icon: '🖌️' },
    { id: 'minimalista', label: 'Minimalista', desc: 'Espaço negativo e geometria pura', icon: '✨' },
  ];

  const showcasePresets: Array<{ style: ImageStyle; label: string; prompt: string }> = [
    { style: 'realista', label: 'Realistas', prompt: 'Retrato de um golden retriever sorridente num jardim ensolarado com relva desfocada em bokeh dourado' },
    { style: 'anime', label: 'Anime', prompt: 'Jovem herói de anime com casaco azul a olhar o horizonte sob nuvens douradas ao pôr do sol' },
    { style: '3d', label: '3D', prompt: 'Personagem divertida em 3D estilo aventura colorida em frente a um castelo de fantasia sob céu azul' },
    { style: 'cartoon', label: 'Cartoon', prompt: 'Gatinho laranja fofo em estilo cartoon 2D com corações flutuantes e fundo amarelo pastel luminoso' },
    { style: 'paisagem', label: 'Paisagens', prompt: 'Lago alpino cristalino a refletir montanhas nevadas e pinheiros verdes sob luz vibrante do amanhecer' },
    { style: 'logotipo', label: 'Logótipos', prompt: 'Logótipo futurista brilhante em néon azul elétrico e roxo sobre fundo escuro tecnológico' },
    { style: 'produto', label: 'Produtos', prompt: 'Auscultadores modernos de estúdio ao lado de embalagem preta elegante com iluminação néon azul e roxa' },
    { style: 'futurista', label: 'Futurista', prompt: 'Metrópole futurista cyberpunk com arranha-céus luminosos, naves voadoras e luzes néon azuis e roxas' },
    { style: 'ilustracao', label: 'Ilustrações', prompt: 'Retrato editorial de fantasia botânica com flores coloridas, cabelos azuis e traços artísticos refinados' },
    { style: 'cinematografico', label: 'Cinema', prompt: 'Viajante de capa num penhasco rochoso a contemplar uma lua gigante entre nuvens douradas ao pôr do sol' },
    { style: 'interiores', label: 'Interiores', prompt: 'Sala de estar moderna e acolhedora com sofá bege, plantas verdes e luz solar quente pela janela' },
    { style: 'fantasia', label: 'Imaginação', prompt: 'Pequeno dragão azul adorável com olhos brilhantes numa floresta encantada com partículas luminosas' },
  ];

  // All core aspect ratios requested by user
  const aspectRatios: Array<{ id: ImageAspectRatio; label: string; ratio: string; iconClass: string }> = [
    { id: '1:1', label: 'Quadrado', ratio: '1:1 (1024×1024)', iconClass: 'w-4 h-4 border-2 rounded' },
    { id: '9:16', label: 'Retrato', ratio: '9:16 (720×1280)', iconClass: 'w-3 h-5 border-2 rounded' },
    { id: '16:9', label: 'Paisagem', ratio: '16:9 (1280×720)', iconClass: 'w-5 h-3 border-2 rounded' },
    { id: '4:3', label: 'Clássico', ratio: '4:3 (1024×768)', iconClass: 'w-4 h-3 border-2 rounded' },
    { id: '3:4', label: 'Poster', ratio: '3:4 (768×1024)', iconClass: 'w-3 h-4 border-2 rounded' },
  ];

  // Creative suggestions aligned with the 12-style ZUNO AI aesthetic
  const samplePrompts = showcasePresets.map((p) => p.prompt);

  // Quick edit presets for Section 3
  const editPresets = [
    {
      id: 'background',
      label: 'Substituir Fundo',
      icon: '🌄',
      template: 'Substitui o fundo desta imagem por um cenário cinematográfico com montanhas e céu estrelado ao crepúsculo.',
    },
    {
      id: 'lighting',
      label: 'Alterar Cores & Luz',
      icon: '💡',
      template: 'Ajusta a iluminação para uma hora dourada com tons quentes e sombras dramáticas de chiaroscuro.',
    },
    {
      id: 'add_elements',
      label: 'Adicionar Elemento',
      icon: '➕',
      template: 'Adiciona à imagem detalhes brilhantes de partículas douradas e reflexos luminosos suaves.',
    },
    {
      id: 'remove_elements',
      label: 'Remover Elemento',
      icon: '➖',
      template: 'Remove qualquer elemento distrativo do fundo, mantendo o sujeito principal com foco nítido e limpo.',
    },
    {
      id: 'style_transfer',
      label: 'Transformar Estilo',
      icon: '🔄',
      template: 'Transforma esta imagem para o estilo de pintura artística a óleo com textura visível e pinceladas dinâmicas.',
    },
  ];

  const handleSurpriseMe = () => {
    const random = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    setPrompt(random);
    onShowToast?.('Ideia criativa adicionada ao prompt!', 'info');
  };

  const handleApplyEditPreset = (template: string) => {
    setPrompt(template);
    onShowToast?.('Ação de edição aplicada! Podes personalizar o texto.', 'info');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast?.('Por favor seleciona um ficheiro de imagem válido (PNG, JPG, WebP).', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      onShowToast?.('A imagem não deve exceder 15MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setReferenceImage(dataUrl);
      setReferenceImageName(file.name);
      setActiveTab('edit');
      onShowToast?.('Imagem pronta para edição!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleClearReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onShowToast?.('Imagem de referência removida.', 'info');
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setGenerationStep('');
      setGenerationProgress(0);
      onShowToast?.('Geração cancelada pelo utilizador.', 'info');
    }
  };

  const handleGenerate = async (overridePrompt?: string) => {
    const query = (overridePrompt || prompt).trim();
    if (!query) {
      onShowToast?.('Por favor descreve a imagem que pretendes criar.', 'error');
      return;
    }

    const useCreatorOffline = Boolean(
      isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)
    );

    // Debounce to prevent accidental duplicate requests
    const now = Date.now();
    if (now - lastGeneratedAt < (useCreatorOffline ? 250 : 2500)) {
      onShowToast?.('Por favor aguarda um instante antes de novo pedido.', 'info');
      return;
    }
    setLastGeneratedAt(now);

    // Check user quota
    if (!incrementImageCount()) {
      onShowToast?.(`Limite diário de imagens atingido para o plano ${user?.plan?.toUpperCase()}!`, 'error');
      onNavigateToPricing?.();
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationProgress(useCreatorOffline ? 45 : 10);
    setGenerationStep(
      useCreatorOffline
        ? 'A sintetizar imagem localmente com ZUNO Diffusion Engine...'
        : 'A analisar prompt e calibrar parâmetros visuais...'
    );

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Simulated authentic progress milestones (online API only)
    const progressTimer1 = useCreatorOffline
      ? null
      : setTimeout(() => {
          setGenerationProgress(35);
          setGenerationStep('A contactar motor neural de difusão ZUNO...');
        }, 600);

    const progressTimer2 = useCreatorOffline
      ? null
      : setTimeout(() => {
          setGenerationProgress(65);
          setGenerationStep('A sintetizar geometria, volumetria e iluminação...');
        }, 1600);

    const progressTimer3 = useCreatorOffline
      ? null
      : setTimeout(() => {
          setGenerationProgress(85);
          setGenerationStep('A renderizar detalhes e texturas em alta definição...');
        }, 2800);

    try {
      const isEditMode = activeTab === 'edit' && Boolean(referenceImage);

      if (useCreatorOffline && user) {
        const countToMake = Math.max(1, Math.min(4, imageCount));
        const generatedBatch: GeneratedImage[] = [];
        for (let idx = 0; idx < countToMake; idx++) {
          if (abortController.signal.aborted) break;
          const img = await generateCreatorOfflineImage({
            prompt: query,
            style: selectedStyle,
            aspectRatio: selectedRatio,
            quality: selectedQuality,
            referenceImage: isEditMode ? referenceImage! : undefined,
            isEdit: isEditMode,
            userId: user.id,
            variationIndex: idx,
          });
          generatedBatch.push(img);
        }

        if (abortController.signal.aborted) return;

        setGenerationProgress(100);
        setGenerationStep('Concluído com sucesso!');
        setGallery((prev) => [...generatedBatch, ...prev]);
        onShowToast?.(isEditMode ? 'Imagem editada com sucesso!' : 'Imagem criada com sucesso!', 'success');
        return;
      }

      const result = await generateImage({
        prompt: query,
        style: selectedStyle,
        aspectRatio: selectedRatio,
        quality: selectedQuality,
        count: imageCount,
        userId: user?.id || 'guest',
        plan: user?.plan || 'free',
        referenceImage: isEditMode ? referenceImage! : undefined,
        isEdit: isEditMode,
        signal: abortController.signal,
      });

      if (progressTimer1) clearTimeout(progressTimer1);
      if (progressTimer2) clearTimeout(progressTimer2);
      if (progressTimer3) clearTimeout(progressTimer3);

      if (abortController.signal.aborted) {
        return;
      }

      if (result.requiresAuth) {
        onRequireAuth?.('Estúdio ZUNO AI IMAGE');
        setErrorMessage(GUEST_RESTRICTION_MESSAGE);
        return;
      }

      if (result.success && result.image) {
        setGenerationProgress(100);
        setGenerationStep('Concluído com sucesso!');
        setGallery((prev) => [result.image!, ...prev]);
        onShowToast?.(isEditMode ? 'Imagem editada com sucesso!' : 'Imagem criada com sucesso!', 'success');
      } else {
        const err = result.error || 'Não foi possível gerar a imagem no momento.';
        setErrorMessage(err);
        onShowToast?.(err, 'error');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Erro inesperado na geração de imagem.';
        setErrorMessage(msg);
        onShowToast?.(msg, 'error');
      }
    } finally {
      if (progressTimer1) clearTimeout(progressTimer1);
      if (progressTimer2) clearTimeout(progressTimer2);
      if (progressTimer3) clearTimeout(progressTimer3);
      setIsGenerating(false);
      abortControllerRef.current = null;
      setTimeout(() => {
        setGenerationStep('');
        setGenerationProgress(0);
      }, useCreatorOffline ? 250 : 800);
    }
  };

  const handleDownload = (img: GeneratedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const a = document.createElement('a');
    a.href = img.url;
    a.download = `zuno-image-${img.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onShowToast?.('Download iniciado com sucesso!', 'success');
  };

  const handleCopyPrompt = (text: string, id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    onShowToast?.('Prompt copiado para a área de transferência!', 'info');
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleDeleteImage = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const remaining = gallery.filter((img) => img.id !== id);
    setGallery(remaining);
    if (user?.id) saveLocalImagesForUser(user.id, remaining);
    if (activeLightboxImage?.id === id) {
      setActiveLightboxImage(null);
    }
    await deleteImage(id);
    onShowToast?.('Imagem eliminada com sucesso.', 'info');
  };

  const handleLoadIntoEditor = (img: GeneratedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReferenceImage(img.url);
    setReferenceImageName(`Variação de ${new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    setPrompt(img.prompt);
    setSelectedStyle(img.style);
    setSelectedRatio(img.aspectRatio);
    setActiveTab('edit');
    if (activeLightboxImage) setActiveLightboxImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onShowToast?.('Imagem carregada no Modo Edição!', 'info');
  };

  const handleReroll = (img: GeneratedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPrompt(img.prompt);
    setSelectedStyle(img.style);
    setSelectedRatio(img.aspectRatio);
    if (activeLightboxImage) setActiveLightboxImage(null);
    handleGenerate(img.prompt);
  };

  const handleSaveAdminConfig = async () => {
    try {
      await updateAdminImageConfig(adminLimits);
      onShowToast?.('Limites dos planos atualizados com sucesso pelo Fundador!', 'success');
      setIsAdminModalOpen(false);
    } catch (e: any) {
      onShowToast?.(`Erro ao atualizar: ${e.message}`, 'error');
    }
  };

  const isFounder = isAdmin;

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto my-8 rounded-3xl border border-blue-500/30 bg-[#080d1e]/95 p-8 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">ZUNO AI IMAGE</h2>
          <p className="text-sm text-slate-200 leading-relaxed">{GUEST_RESTRICTION_MESSAGE}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth('signup') : onRequireAuth?.('Estúdio ZUNO AI IMAGE'))}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Criar conta</span>
          </button>
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth('login') : onRequireAuth?.('Estúdio ZUNO AI IMAGE'))}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-blue-400" />
            <span>Iniciar sessão</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 select-none">
      {/* ----------------- CONTROL STUDIO PANEL (GLASSMORPHISM) ----------------- */}
      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-7 border border-blue-500/20 shadow-2xl relative overflow-hidden bg-[#070b19]/90 backdrop-blur-xl">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-gradient-to-br from-blue-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar: Title, Plan Quota, Founder Control */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  ZUNO AI IMAGE Studio
                </h2>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  v2.5 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Criação e edição fotorealista com controlo milimétrico de estilo e proporção
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {isFounder && (
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                title="Configurar limites e quotas dos planos (Fundador)"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                <span>Painel do Fundador</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-400">Quota diária:</span>
              <span className="font-bold text-white">
                {user?.imageCountToday || 0} / {user?.plan === 'ultra' ? '∞' : (user?.maxImagesToday || 3)}
              </span>
              <button
                onClick={onNavigateToPricing}
                className="text-[10px] uppercase font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded cursor-pointer"
                title="Alterar plano"
              >
                {user?.plan?.toUpperCase() || 'FREE'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Switcher: Criar Nova Imagem vs Editar Imagem */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 w-fit relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>Criar Nova Imagem</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'edit'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>Editar Imagem & Variações</span>
            {referenceImage && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Reference Image Uploader (Active in Edit Mode) */}
        {activeTab === 'edit' && (
          <div className="p-4 sm:p-5 rounded-2xl border border-purple-500/30 bg-purple-950/15 space-y-4 animate-in fade-in relative z-10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Imagem Base para Alterações:</span>
              </label>

              {referenceImage && (
                <button
                  type="button"
                  onClick={handleClearReferenceImage}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remover imagem</span>
                </button>
              )}
            </div>

            {referenceImage ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-purple-500/40 shrink-0">
                  <img
                    src={referenceImage}
                    alt="Imagem base"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 pointer-events-none" />
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {referenceImageName || 'Imagem de Referência Ativa'}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    A ZUNO AI usará esta imagem como guia visual para aplicar as alterações, mantendo a coerência e os elementos desejados.
                  </p>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-500/40 hover:border-purple-500/70 rounded-2xl p-6 text-center cursor-pointer transition-all bg-purple-950/10 hover:bg-purple-950/20 group"
              >
                <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold text-white">
                  Clica para carregar uma imagem ou arrasta um ficheiro
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Formatos suportados: PNG, JPG, WebP até 15MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Quick Action Presets (Section 3 of User Prompt) */}
            <div className="space-y-2 pt-2 border-t border-purple-500/20">
              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                Ações Rápidas de Edição:
              </span>
              <div className="flex flex-wrap gap-2">
                {editPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyEditPreset(preset.template)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prompt Input Box */}
        <div className="space-y-2.5 relative z-10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-400" />
              <span>
                {activeTab === 'edit'
                  ? 'Descreve as alterações que pretendes na imagem:'
                  : 'Descreve a tua ideia visual:'}
              </span>
            </label>

            {activeTab === 'create' && (
              <button
                type="button"
                onClick={handleSurpriseMe}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs text-blue-400 font-medium cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ideia Aleatória</span>
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                activeTab === 'edit'
                  ? 'Exemplo: Substitui o fundo por uma praia paradisíaca ao pôr do sol, mantendo o sujeito principal com iluminação dourada e reflexos suaves...'
                  : 'Exemplo: Um palácio futurista flutuante envolvido por auroras boreais violetas e lagos espelhados de cristal, iluminação cinematográfica...'
              }
              rows={compact ? 2 : 3}
              className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Section 1: Estilos Visuais (12 Estilos Assinatura ZUNO AI) */}
        <div className="space-y-3 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              <span>1. Estilo Visual (Padrão ZUNO Neon & Studio):</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStyleShowcase((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-[11px] font-semibold text-blue-300 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showStyleShowcase ? 'Ocultar Guia de Estilos' : 'Ver Guia Visual (12 Estilos)'}</span>
              </button>
              <span className="text-[11px] font-semibold text-purple-300">
                {styles.find((s) => s.id === selectedStyle)?.label}
              </span>
            </div>
          </div>

          {showStyleShowcase && (
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#060b1c] via-[#09122b] to-[#120b29] p-3.5 sm:p-4 space-y-3 shadow-lg shadow-blue-950/40">
              <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="w-full lg:w-72 shrink-0 rounded-xl overflow-hidden border border-purple-500/40 shadow-md shadow-purple-900/30 bg-slate-950">
                  <img
                    src="/assets/zuno/galeria-neon-zuno-ai.png"
                    alt="Galeria de Estilos Visuais ZUNO AI"
                    className="w-full h-auto object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2.5 w-full">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Estilos Oficiais ZUNO AI — Aplica em 1 Clique</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Clica num dos 12 exemplos abaixo para ativar imediatamente a direção de arte luminosa e detalhada correspondente:
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {showcasePresets.map((preset) => (
                      <button
                        key={preset.style}
                        type="button"
                        onClick={() => {
                          setSelectedStyle(preset.style);
                          setPrompt(preset.prompt);
                          setActiveTab('create');
                          onShowToast?.(`Estilo "${preset.label}" aplicado!`, 'info');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          selectedStyle === preset.style
                            ? 'bg-gradient-to-r from-cyan-500/30 to-purple-600/30 border-cyan-400 text-white shadow-sm shadow-cyan-500/20'
                            : 'bg-slate-950/70 hover:bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {styles.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStyle(st.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedStyle === st.id
                    ? 'border-cyan-400/80 bg-gradient-to-tr from-blue-600/25 via-indigo-600/20 to-purple-600/25 shadow-lg shadow-blue-600/20 ring-1 ring-purple-500/40'
                    : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{st.icon}</span>
                  {selectedStyle === st.id && (
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </div>
                <p className="text-xs font-bold text-white">{st.label}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{st.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Formatos & Qualidade */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-slate-800/80 relative z-10">
          {/* Formatos (Proporções) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Crop className="w-3.5 h-3.5 text-blue-400" />
              <span>2. Formato:</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setSelectedRatio(ar.id)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedRatio === ar.id
                      ? 'border-blue-500 bg-blue-600/20 text-white shadow-md'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className={`${ar.iconClass} border-current shrink-0`} />
                  <div className="text-left flex-1 flex items-center justify-between">
                    <span className="leading-tight text-[11px]">{ar.label}</span>
                    <span className="text-[10px] opacity-70 font-mono">{ar.ratio.split(' ')[0]}</span>
                  </div>
                  {selectedRatio === ar.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Qualidade e Definição */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Definição & Qualidade:</span>
            </label>
            <div className="space-y-2">
              {[
                { id: 'standard', label: 'Standard (Rápido)', desc: 'Ideal para testes rápidos e ideias' },
                { id: 'hd', label: 'HD 1080p (Recomendado)', desc: 'Excelente balanço de detalhe e textura' },
                { id: 'ultra', label: 'Ultra 4K (Máximo Detalhe)', desc: 'Máxima definição para impressões e arte final' },
              ].map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedQuality(q.id as any)}
                  className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedQuality === q.id
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{q.label}</span>
                    {selectedQuality === q.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{q.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quantidade e Ação Principal */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Quantidade de Variações:
              </label>
              <div className="flex gap-2">
                {[1, 2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setImageCount(num)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      imageCount === num
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {num} {num === 1 ? 'Imagem' : 'Imagens'}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Generate & Cancel */}
            <div className="space-y-2">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 transition-all cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  <StopCircle className="w-4 h-4 text-rose-400" />
                  <span>Cancelar Pedido</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={!prompt.trim()}
                  className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                    !prompt.trim()
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-indigo-600/30 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeTab === 'edit' ? 'Aplicar Alterações com IA' : 'Gerar Imagem com ZUNO'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Progress Indicator & Message */}
        {isGenerating && (
          <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-950/40 space-y-3.5 animate-in fade-in relative z-10">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-200">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span>{generationStep || 'A sintetizar imagem...'}</span>
              </span>
              <span className="font-mono text-[11px] text-blue-400 font-bold">{generationProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Clear Error Message with Retry */}
        {errorMessage && !isGenerating && (
          <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 flex items-center justify-between gap-3 animate-in fade-in relative z-10">
            <div className="flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => handleGenerate()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-200 text-xs font-semibold transition-all cursor-pointer border border-rose-500/40 shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}
      </div>

      {/* ----------------- SECTION 4: HISTÓRICO DE IMAGENS ----------------- */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">
              Histórico de Imagens Geradas ({gallery.length})
            </h3>
          </div>

          {gallery.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Tens a certeza que desejas limpar o histórico de imagens?')) {
                  setGallery([]);
                  if (user?.id) saveLocalImagesForUser(user.id, []);
                  onShowToast?.('Histórico limpo.', 'info');
                }
              }}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Limpar todo o histórico
            </button>
          )}
        </div>

        {gallery.length === 0 ? (
          <div className="text-center py-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/20 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <ImageIcon className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">Nenhuma imagem gerada ainda</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Descreve o teu conceito no estúdio acima ou escolhe uma das sugestões para veres a tua primeira criação visual com o motor ZUNO.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((img) => (
              <div
                key={img.id}
                className="group rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-xl hover:shadow-2xl hover:border-blue-500/40 transition-all flex flex-col"
              >
                {/* Image Viewport */}
                <div
                  onClick={() => setActiveLightboxImage(img)}
                  className="relative aspect-square bg-slate-950 overflow-hidden cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <div className="w-full flex items-center justify-between text-xs text-white">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Ver em ecrã inteiro</span>
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-600/80">
                        {img.aspectRatio}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadata and Actions */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-[#070c1d]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                        {img.style}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(img.createdAt).toLocaleDateString()} • {new Date(img.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                      {img.prompt}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                    <button
                      onClick={(e) => handleCopyPrompt(img.prompt, img.id, e)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Copiar prompt"
                    >
                      {copiedPromptId === img.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleLoadIntoEditor(img, e)}
                      className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                      title="Editar esta imagem no estúdio"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    <button
                      onClick={(e) => handleReroll(img, e)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                      title="Criar nova variação"
                    >
                      <RotateCw className="w-3 h-3 text-purple-400" />
                      <span>Gerar de novo</span>
                    </button>

                    <button
                      onClick={(e) => handleDownload(img, e)}
                      className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                      title="Guardar imagem"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleDeleteImage(img.id, e)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Eliminar imagem do histórico"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------- LIGHTBOX MODAL ----------------- */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-4xl w-full rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Top Modal Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white uppercase">{activeLightboxImage.style}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{activeLightboxImage.aspectRatio}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{new Date(activeLightboxImage.createdAt).toLocaleString()}</span>
              </div>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Image View */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={activeLightboxImage.url}
                alt={activeLightboxImage.prompt}
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>

            {/* Bottom Info & Download Bar */}
            <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <p className="text-xs font-semibold text-slate-200">
                  {activeLightboxImage.prompt}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Motor: {activeLightboxImage.model}
                </p>
              </div>

              <div className="flex items-center flex-wrap gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleLoadIntoEditor(activeLightboxImage)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/40 text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Editar no Estúdio</span>
                </button>

                <button
                  onClick={() => handleReroll(activeLightboxImage)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gerar Novamente</span>
                </button>

                <button
                  onClick={() => handleDownload(activeLightboxImage)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Guardar Imagem</span>
                </button>

                <button
                  onClick={() => handleDeleteImage(activeLightboxImage.id)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 cursor-pointer"
                  title="Eliminar do histórico"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 6: FOUNDER/ADMIN CONFIG MODAL ----------------- */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-lg w-full rounded-3xl border border-purple-500/30 bg-[#070c1d] overflow-hidden shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Configuração de Planos (Fundador)</h3>
              </div>
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Configura o limite diário de geração de imagens permitido para cada categoria de plano:
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Plano Free (imagens/dia):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={adminLimits.free}
                  onChange={(e) => setAdminLimits({ ...adminLimits, free: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Plano Premium (imagens/dia):</label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={adminLimits.premium}
                  onChange={(e) => setAdminLimits({ ...adminLimits, premium: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Plano Pro (imagens/dia):</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={adminLimits.pro}
                  onChange={(e) => setAdminLimits({ ...adminLimits, pro: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Plano Ultra (imagens/dia):</label>
                <input
                  type="number"
                  min="50"
                  max="9999"
                  value={adminLimits.ultra}
                  onChange={(e) => setAdminLimits({ ...adminLimits, ultra: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAdminConfig}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
              >
                Guardar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
