import React, { useState, useRef, useEffect } from 'react';
import {
  Conversation,
  FavoriteItem,
  Message,
  ChatAttachment,
  GeneratedImage,
  ImageStyle,
  RelatedTopicImage,
  SearchCodeExecutionResult,
  SearchBarCodeActionType,
} from '../types';
import { MarkdownRenderer } from '../components/common/MarkdownRenderer';
import {
  streamChat,
  generateImage,
  checkSearchCodeApi,
  executeSearchCodeApi,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CREATOR_WELCOME_MESSAGE, isCreatorRecognitionQuery } from '../config/brand';
import {
  checkOfflineSearchCode,
  executeOfflineSearchCode,
  generateCreatorOfflineChatResponse,
  generateCreatorOfflineImage,
  recordCreatorOfflineKnowledge,
} from '../services/offlineCreator';
import { loadLocalImagesForUser, saveLocalImagesForUser } from '../services/storage';
import { 
  Send, 
  Square, 
  Paperclip, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  RotateCw, 
  Copy, 
  Check, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  X, 
  AlertTriangle,
  Cpu,
  Layers,
  ArrowDown,
  Download,
  Maximize2,
  Wand2,
  Zap,
  ExternalLink,
  Lock,
  Bookmark,
  Trash2,
} from 'lucide-react';

interface ChatPageProps {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onUpdateConversation: (updated: Conversation) => void;
  onNewConversation: () => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
  onRequireAuth?: (featureLabel?: string) => void;
  onApplySearchCodeResult?: (res: SearchCodeExecutionResult) => void | Promise<void>;
  favorites?: FavoriteItem[];
  onToggleFavorite?: (message: Message, conv?: Conversation | null) => void;
  onDeleteFavorite?: (favId: string) => void;
  showFavoritesModal?: boolean;
  onSetShowFavoritesModal?: (open: boolean) => void;
}

interface DetectedImageIntent {
  prompt: string;
  style: string;
  isEdit?: boolean;
}

export function isUserRequestingCode(text: string): boolean {
  if (!text) return false;
  return /\b(c[oó]digo|codigos|code|codes|script|scripts|fun[cç][aã]o|fun[cç][oõ]es|function|functions|programar|programa[cç][aã]o|program|developer|desenvolver|implementar|implementa|typescript|javascript|python|react|html|css|sql|api|backend|frontend|classe|class|classes|algoritmo|algoritmos|syntax|sintaxe|compil|debug|endpoint|componente|componentes|component|components|snippet|snippets|json|regex|bash|shell|terminal|docker|git|c\+\+|c\#|java|rust|golang|php|swift|kotlin)\b/i.test(text);
}

export function cleanAiResponse(text: string, isCodeRequested: boolean): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove clichéd AI opening statements (e.g., "Como um modelo de inteligência artificial...", "Como uma IA focada em texto...")
  cleaned = cleaned.replace(
    /^(?:Como\s+(?:um\s+)?modelo\s+de\s+(?:linguagem|IA|inteligência\s+artificial)[^.\n]*[.\n]+|Como\s+uma\s+(?:IA|inteligência\s+artificial)[^.\n]*[.\n]+|Sou\s+(?:apenas\s+)?um\s+modelo\s+de\s+texto[^.\n]*[.\n]+|Como\s+uma\s+inteligência\s+artificial\s+focada\s+em[^.\n]*[.\n]+)/i,
    ''
  ).trim();

  // 2. If user did NOT request code, strip unrequested code blocks (TypeScript, JavaScript, React, interfaces, imports)
  if (!isCodeRequested) {
    cleaned = cleaned.replace(/```(?:typescript|ts|javascript|js|tsx|jsx|react|code|json|bash|sh)?\n[\s\S]*?(?:```|$)/gi, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  return cleaned;
}

function inferImageStyleFromText(t: string): string {
  if (/log[oó]tipo|logo|emblema|marca/i.test(t)) return 'logotipo';
  if (/anime|mang[aá]|otaku|naruto|goku|luffy|sasuke|dragon ball/i.test(t)) return 'anime';
  if (/3d|tridimensional|render|octane|personagem 3d/i.test(t)) return '3d';
  if (/cartoon|desenho animado|pixar|disney|gatinho fofo/i.test(t)) return 'cartoon';
  if (/futurista|cyberpunk|neon|sci-fi|espacial|metr[oó]pole/i.test(t)) return 'futurista';
  if (/paisagem|natureza|montanha|lago|floresta|praia|alpino/i.test(t)) return 'paisagem';
  if (/interior|interiores|decora[cç][aã]o|sala|quarto|cozinha|apartamento/i.test(t)) return 'interiores';
  if (/fantasia|drag[aã]o|m[aá]gic|criatura|imagina[cç][aã]o|encantad/i.test(t)) return 'fantasia';
  if (/fotogr[aá]fic[oa]|fotografia|foto real|retrato/i.test(t)) return 'fotografico';
  if (/cinematogr[aá]fic[oa]|filme|movie/i.test(t)) return 'cinematografico';
  if (/minimalista|minimalismo|clean|simples/i.test(t)) return 'minimalista';
  if (/ilustra[cç][aã]o|vetor|editorial|bot[aâ]nic/i.test(t)) return 'ilustracao';
  if (/art[ií]stic[oa]|pintura|[oó]leo/i.test(t)) return 'artistico';
  if (/produto|comercial|publicidade|auscultadores|embalagem/i.test(t)) return 'produto';
  return 'realista';
}

function detectImageIntent(text: string, hasEditingImage: boolean): DetectedImageIntent | null {
  if (!text) return null;
  const t = text.trim().replace(/[\.\!\?]+$/g, '').trim();

  // 1. Explicit /image command
  if (t.toLowerCase().startsWith('/image ')) {
    return { prompt: t.slice(7).trim() || 'Composição artística de alta definição', style: 'realista' };
  }

  // 2. Direct edit intent if user has an active reference image or mentions "altera/modifica esta imagem"
  if (hasEditingImage || /^(?:altera|modifica|muda|troca|transforma|adiciona\s+a|remove\s+da)\s+(?:esta\s+|a\s+)?imagem/i.test(t)) {
    const cleanPrompt = t.replace(/^(?:altera|modifica|muda|troca|transforma)\s+(?:esta\s+|a\s+)?imagem(?:\s+para|\s+de)?\s*/i, '');
    return {
      prompt: cleanPrompt || t,
      style: 'realista',
      isEdit: true,
    };
  }

  // 3. Negative checks: never treat informational, learning, coding, or text-creation requests as image generation
  if (
    /^(como|explique|explica|qual|quais|quando|onde|quanto|quem|o\s+que|porque|por\s+que|ajuda|saber|aprender|entender|compreender)\b/i.test(t) ||
    /^(?:eu\s+)?(?:quero|gostaria\s+de|queria|preciso\s+de|podes)\s+(?:saber|aprender|entender|compreender|conhecer|pesquisar|perguntar|explicar|ajuda|falar|conversar|escrever|resumir)\b/i.test(t) ||
    /\b(?:c[oó]digo|script|fun[cç][aã]o|texto|reda[cç][aã]o|artigo|resumo|lista|tabela|plano|hist[oó]ria|poema|e-mail|email)\b/i.test(t)
  ) {
    return null;
  }

  // Visual asset nouns (REQUIRED for generic verbs like criar/gerar/fazer/querer)
  const visualNounPattern = '(?:imagem|imagens|foto|fotos|fotografia|fotografias|ilustra[cç][aã]o|ilustra[cç][oõ]es|desenho|desenhos|arte|quadro|pintura|log[oó]tipo|logo|wallpaper|avatar|retrato|cartaz|poster|banner|cen[aá]rio|capa|miniatura|thumbnail|render)';

  // 4. Exact standalone matches: "Cria uma imagem", "Gera uma imagem", "Desenha uma paisagem", "Cria um logótipo"
  const standaloneMatch = t.match(
    new RegExp(`^(?:por\\s+favor\\s*,?\\s*|podes\\s+)?(?:cria|criar|gera|gerar|desenha|desenhar|faz|fazer|pinta|pintar|produz|produzir|imagina|imaginar)\\s+(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?(${visualNounPattern}|paisagem|personagem)$`, 'i')
  );
  if (standaloneMatch) {
    const type = standaloneMatch[1].toLowerCase();
    if (/log[oó]tipo|logo/.test(type)) return { prompt: 'Logótipo moderno minimalista, elegante e futurista com linhas limpas', style: 'logotipo' };
    if (/paisagem/.test(type)) return { prompt: 'Paisagem natural majestosa com montanhas, céu crepuscular e iluminação cinematográfica', style: 'cinematografico' };
    if (/personagem/.test(type)) return { prompt: 'Personagem heroica detalhada com vestes estilizadas e iluminação épica', style: 'realista' };
    if (/ilustra/.test(type)) return { prompt: 'Ilustração artística e conceitual rica em cores e detalhes estilizados', style: 'ilustracao' };
    return { prompt: 'Composição visual espetacular de arte digital com iluminação cinematográfica e cores vívidas', style: 'realista' };
  }

  // 5a. Strictly visual action verbs (desenha, pinta, renderiza, ilustra) can omit the noun (e.g. "Desenha o Naruto")
  const visualVerbRegex = /^(?:por\s+favor\s*,?\s*|podes\s+)?(?:desenha|desenhar|pinta|pintar|renderiza|renderizar|ilustra|ilustrar|draw|paint|render)\s+(?:para\s+mim\s+)?(.+)$/i;
  const mVisualVerb = t.match(visualVerbRegex);
  if (mVisualVerb) {
    let target = mVisualVerb[1]
      .replace(/^(?:uma?\s+|an?\s+|o\s+|a\s+|os\s+|as\s+)?(?:imagem|foto|fotografia|ilustra[cç][aã]o|desenho|arte|quadro|log[oó]tipo|logo|wallpaper|avatar|retrato)?\s*(?:de\s+|do\s+|da\s+|dos\s+|das\s+|sobre\s+|com\s+|em\s+|for\s+|of\s+|with\s+|o\s+|a\s+|os\s+|as\s+|um\s+|uma\s+)?/i, '')
      .trim() || t;
    let style = inferImageStyleFromText(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  // 5b. Generic action verbs (cria, gera, faz, produz, imagina) ONLY when paired with a REQUIRED visual asset noun
  const genericVerbWithNounRegex = new RegExp(
    `^(?:por\\s+favor\\s*,?\\s*|podes\\s+)?(?:cria|criar|gera|gerar|faz|fazer|produz|produzir|imagina|imaginar|generate|create|make)\\s+(?:para\\s+mim\\s+)?(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?${visualNounPattern}(?:\\s+(?:em\\s+estilo\\s+|no\\s+estilo\\s+|estilo\\s+|de\\s+|do\\s+|da\\s+|dos\\s+|das\\s+|sobre\\s+|com\\s+|para\\s+|for\\s+|of\\s+|with\\s+)?(.+))?$`,
    'i'
  );
  const mGeneric = t.match(genericVerbWithNounRegex);
  if (mGeneric) {
    let target = (mGeneric[1] || t).trim();
    let style = inferImageStyleFromText(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  // 6. "Quero / Gostaria de / Preciso de" ONLY when paired with a REQUIRED visual asset noun
  const wantWithNounRegex = new RegExp(
    `^(?:eu\\s+)?(?:quero|preciso\\s+de|gostaria\\s+de|queria|want|need|would\\s+like)\\s+(?:uma?\\s+|uns?\\s+|umas\\s+|an?\\s+)?${visualNounPattern}(?:\\s+(?:em\\s+estilo\\s+|no\\s+estilo\\s+|estilo\\s+|de\\s+|do\\s+|da\\s+|dos\\s+|das\\s+|sobre\\s+|com\\s+|para\\s+|for\\s+|of\\s+|with\\s+)?(.+))?$`,
    'i'
  );
  const mWant = t.match(wantWithNounRegex);
  if (mWant) {
    let target = (mWant[1] || t).trim();
    let style = inferImageStyleFromText(t);
    if (/naruto/i.test(t)) {
      target = 'Naruto Uzumaki heroico com chakra ativo, modo sábio, iluminação dramática e cores vibrantes';
      style = 'anime';
    }
    return { prompt: target, style };
  }

  return null;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  conversations,
  activeConversation,
  onUpdateConversation,
  onNewConversation,
  onShowToast,
  onNavigate,
  onRequireAuth,
  onApplySearchCodeResult,
  favorites = [],
  onToggleFavorite,
  onDeleteFavorite,
  showFavoritesModal = false,
  onSetShowFavoritesModal,
}) => {
  const {
    user,
    isAuthenticated,
    isGuest,
    incrementMessageCount,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    isOnline,
  } = useAuth();
  const { t, language } = useLanguage();

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  // Selected model: gemini-3.1-flash-lite (ultra-low latency)
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite');
  const [streamingMsg, setStreamingMsg] = useState<{
    convId: string;
    msgId: string;
    content: string;
    relatedImages?: RelatedTopicImage[];
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<GeneratedImage | null>(null);
  const [activeLightboxRelatedImage, setActiveLightboxRelatedImage] = useState<RelatedTopicImage | null>(null);
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const [matchedCodeHint, setMatchedCodeHint] = useState<{
    code: string;
    purpose?: string;
    actionType?: SearchBarCodeActionType;
  } | null>(null);

  const isUsingCreatorOffline = Boolean(
    isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)
  );

  useEffect(() => {
    const trimmed = input.trim();
    if (
      !trimmed ||
      /\s/.test(trimmed) ||
      trimmed.length < 2 ||
      trimmed.startsWith('/') ||
      isCreatorRecognitionQuery(trimmed)
    ) {
      setMatchedCodeHint(null);
      return;
    }
    if (isUsingCreatorOffline) {
      const res = checkOfflineSearchCode(trimmed);
      setMatchedCodeHint(
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
          setMatchedCodeHint(
            res.matched && res.code
              ? { code: res.code, purpose: res.purpose, actionType: res.actionType }
              : null
          );
        }
      });
    }, 240);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, isUsingCreatorOffline]);

  const handleRequestImageEdit = (image: GeneratedImage) => {
    if (!isAuthenticated) {
      onRequireAuth?.('Edição de imagens com IA');
      return;
    }
    setEditingImage(image);
    setInput(`Altera esta imagem para: `);
    onShowToast(`Modo de alteração ativo para: "${image.prompt.slice(0, 30)}..."`, 'info');
  };

  const handleRegenerateImage = async (image: GeneratedImage) => {
    if (!isAuthenticated) {
      onRequireAuth?.('Geração e regeneração de imagens');
      return;
    }
    if (!activeConversation || isGenerating) return;
    setIsGenerating(true);
    onShowToast(`A gerar nova variação para: "${image.prompt.slice(0, 30)}..."`, 'info');

    try {
      const useCreatorOffline =
        isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline);
      const res = useCreatorOffline
        ? {
            success: true,
            image: await generateCreatorOfflineImage({
              prompt: image.prompt,
              style: image.style,
              aspectRatio: image.aspectRatio,
              userId: user.id,
            }),
          }
        : await generateImage({
            prompt: image.prompt,
            style: image.style,
            aspectRatio: image.aspectRatio,
            userId: user?.id,
            plan: user?.plan,
          });

      if (useCreatorOffline && res.image && user?.id) {
        const existingImgs = loadLocalImagesForUser(user.id);
        saveLocalImagesForUser(user.id, [res.image, ...existingImgs]);
      }

      if (res.requiresAuth) {
        onRequireAuth?.('Geração de imagens com IA');
        return;
      }

      if (res.success && res.image) {
        const assistantMsgId = `img-regen-${Date.now()}`;
        onUpdateConversation({
          ...activeConversation,
          messages: [
            ...activeConversation.messages,
            {
              id: assistantMsgId,
              role: 'assistant',
              content: `Aqui está uma nova variação criada pelo **ZUNO AI IMAGE**:\n\n> **Prompt:** "${image.prompt}"\n> **Estilo:** ${image.style.toUpperCase()}\n> **Motor de IA:** ${res.image.model || 'ZUNO Diffusion Engine'}`,
              generatedImages: [res.image],
              timestamp: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        });
        onShowToast('Nova imagem gerada com sucesso!', 'success');
      } else {
        onShowToast(`Não foi possível gerar nova imagem: ${res.error || 'Erro'}`, 'error');
      }
    } catch (err: any) {
      onShowToast('Erro ao regenerar imagem.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (activeConversation?.model) {
      setSelectedModel(
        activeConversation.model === 'gemini-3.8-flash' ? 'gemini-3.1-flash-lite' : activeConversation.model
      );
    } else {
      setSelectedModel('gemini-3.1-flash-lite');
    }
  }, [activeConversation?.id, activeConversation?.model]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, isGenerating]);

  // Speech Recognition Setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      onShowToast('Reconhecimento de fala não suportado neste navegador.', 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        onShowToast(t('chat.voice_listening'), 'info');
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  // Text-to-Speech (Web Speech API)
  const speakText = (text: string, messageId: string) => {
    if (!('speechSynthesis' in window)) {
      onShowToast('Síntese de voz não suportada.', 'error');
      return;
    }

    if (isSpeakingId === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for cleaner voice speech
    const cleanText = text.replace(/[*_#`[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : 'en-US';
    
    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);

    setIsSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Handle file & image attachments
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRequireAuth?.('Anexar ficheiros e documentos');
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 8 * 1024 * 1024) {
        onShowToast(`O ficheiro ${file.name} excede o limite de 8MB.`, 'error');
        continue;
      }

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onShowToast(t('chat.copied'), 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Core Send Message function
  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend !== undefined ? textToSend : input).trim();
    if (!messageContent && attachments.length === 0) return;
    if (isGenerating) return;

    if (!isAuthenticated && attachments.length > 0) {
      onRequireAuth?.('Analisar anexos e ficheiros');
      return;
    }

    const detectedIntentBeforeSend = detectImageIntent(messageContent, Boolean(editingImage));
    if (!isAuthenticated && detectedIntentBeforeSend) {
      onRequireAuth?.('Criar e gerar imagens com IA');
      return;
    }

    if (isAuthenticated && !incrementMessageCount()) {
      onShowToast('Limite diário atingido no plano Free! Faz upgrade para continuar.', 'error');
      onNavigate('pricing');
      return;
    }

    if (!activeConversation) {
      onNewConversation();
      return;
    }

    const userMessage: Message = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const assistantPlaceholderId = 'msg_' + Math.random().toString(36).substring(2, 9);
    const assistantMessage: Message = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    const updatedMessages = [...activeConversation.messages, userMessage, assistantMessage];
    
    // Auto-update conversation title if it's the first message
    const shouldRenameTitle =
      activeConversation.messages.length <= 1 && messageContent.length > 0;
    const newTitle = shouldRenameTitle
      ? messageContent.slice(0, 32) + (messageContent.length > 32 ? '...' : '')
      : activeConversation.title;

    onUpdateConversation({
      ...activeConversation,
      title: newTitle,
      messages: updatedMessages,
      updatedAt: Date.now(),
    });

    setInput('');
    setAttachments([]);
    setIsGenerating(true);

    // 0. Creator Recognition Secret Code Check (Adonai20010)
    if (isCreatorRecognitionQuery(messageContent)) {
      onShowToast('Seja bem-vindo, Francisco Mutela Emanuel!', 'success');
      onUpdateConversation({
        ...activeConversation,
        title: newTitle,
        messages: [
          ...activeConversation.messages,
          userMessage,
          {
            id: assistantPlaceholderId,
            role: 'assistant',
            content: CREATOR_WELCOME_MESSAGE,
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });
      setIsGenerating(false);
      return;
    }

    // 0.5. Custom Admin Search Bar Code Execution Check
    if (userMessage.attachments === undefined && !/\s/.test(messageContent) && messageContent.length >= 2) {
      const codeRes = isUsingCreatorOffline
        ? executeOfflineSearchCode(messageContent)
        : await executeSearchCodeApi(messageContent);
      if (codeRes.matched) {
        if (codeRes.requiresAuth) {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: [
              ...activeConversation.messages,
              userMessage,
              {
                id: assistantPlaceholderId,
                role: 'assistant',
                content: `🔒 ${codeRes.error || 'Inicia sessão com Google para ativares este código na tua conta.'}`,
                isError: true,
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          });
          onRequireAuth?.(codeRes.purpose || 'Executar código na conta');
          setIsGenerating(false);
          return;
        }
        if (!codeRes.executed) {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: [
              ...activeConversation.messages,
              userMessage,
              {
                id: assistantPlaceholderId,
                role: 'assistant',
                content: `⚠️ ${codeRes.error || 'Este código não pôde ser executado.'}`,
                isError: true,
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          });
          onShowToast(codeRes.error || 'Código indisponível.', 'error');
          setIsGenerating(false);
          return;
        }
        const replyBody =
          codeRes.responseText ||
          `✅ Código **${codeRes.code}** ativado: **${codeRes.purpose || 'Operação concluída'}**.`;
        onUpdateConversation({
          ...activeConversation,
          title: newTitle,
          messages: [
            ...activeConversation.messages,
            userMessage,
            {
              id: assistantPlaceholderId,
              role: 'assistant',
              content: replyBody,
              timestamp: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        });
        await onApplySearchCodeResult?.(codeRes);
        setIsGenerating(false);
        return;
      }
    }

    // 1. Direct Founder Question Check
    const mentionsZunoPlatform = /\b(?:zuno(?:\s*(?:ai|ia))?|(?:esta|essa|a)\s+plataforma)\b/i.test(messageContent);
    const asksAuthorship = /\b(?:quem|criador|criadora|criou|fundador|fundadora|fundou|desenvolveu|desenvolvedor|fez|construiu|programou|inventou|idealizou|lan[çc]ou|dono|propriet[áa]rio|respons[áa]vel|autor|autoria|por\s+tr[áa]s|de\s+quem\s+[eé]|who|creator|created|founder|founded|developed|developer|made|built|owner|behind|qui|cr[ée]ateur|cr[ée][ée]|fondateur|fond[ée]|qui[ée]n|creador|cre[óo]|fund[óo])\b/i.test(messageContent);
    const asksDirectSelfCreator = /\b(?:quem\s+(?:te\s+(?:criou|fez|desenvolveu|fundou|programou|construiu)|(?:[eé]\s+(?:o\s+)?)?(?:teu|seu)\s*(?:criador|fundador|desenvolvedor|dono))|who\s+(?:created|made|built|developed|founded)\s+(?:you|this)|who\s+is\s+(?:your|the)\s+(?:creator|founder|developer|owner)|qui\s+t'a\s+(?:cr[ée][ée]|fond[ée])|qui[ée]n\s+te\s+(?:cre[óo]|fund[óo]))\b|\bquem\s+[eé]\s+o\s+(?:criador|fundador)\s*\??$/i.test(messageContent.trim());
    const isFounderQuestion = (mentionsZunoPlatform && asksAuthorship) || asksDirectSelfCreator;
    if (isFounderQuestion) {
      let founderAnswer = 'A ZUNO AI foi idealizada e criada por Francisco Mutela Emanuel.';
      if (language === 'en' || /\b(who|created|founder|developer|owner|made|built)\b/i.test(messageContent)) {
        founderAnswer = 'ZUNO AI was conceived and created by Francisco Mutela Emanuel.';
      } else if (language === 'es' || /\b(quién|creó|fundó|creador)\b/i.test(messageContent)) {
        founderAnswer = 'ZUNO AI fue concebida y creada por Francisco Mutela Emanuel.';
      } else if (language === 'fr' || /\b(qui|créé|fondé|créateur)\b/i.test(messageContent)) {
        founderAnswer = 'ZUNO AI a été conçue et créée par Francisco Mutela Emanuel.';
      }

      onUpdateConversation({
        ...activeConversation,
        title: newTitle,
        messages: [
          ...activeConversation.messages,
          userMessage,
          {
            id: assistantPlaceholderId,
            role: 'assistant',
            content: founderAnswer,
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });
      setIsGenerating(false);
      return;
    }

    // 1.5. Creator-Only Offline Mode (franciscomutelae@gmail.com) — Full parity with online
    if (isAuthenticated && user && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline)) {
      const imageIntentOffline = detectImageIntent(messageContent, Boolean(editingImage));
      if (imageIntentOffline) {
        const targetPrompt = imageIntentOffline.prompt;
        const targetStyle = (imageIntentOffline.style || 'realista') as ImageStyle;
        const referenceImg = editingImage?.url;
        const isImageEdit = Boolean(editingImage || imageIntentOffline.isEdit);

        onUpdateConversation({
          ...activeConversation,
          title: newTitle,
          messages: [
            ...activeConversation.messages,
            userMessage,
            {
              id: assistantPlaceholderId,
              role: 'assistant',
              content: `🎨 **ZUNO AI IMAGE**: A sintetizar imagem em alta definição para "*${targetPrompt}*" (${targetStyle})...\n\n> ⏳ *A inicializar o motor generativo multimodal... Aguarda alguns instantes.*`,
              timestamp: Date.now(),
            },
          ],
          updatedAt: Date.now(),
        });

        try {
          const generatedImg = await generateCreatorOfflineImage({
            prompt: targetPrompt,
            style: targetStyle,
            aspectRatio: '1:1',
            quality: 'hd',
            referenceImage: referenceImg,
            isEdit: isImageEdit,
            userId: user.id,
          });
          const existingImgs = loadLocalImagesForUser(user.id);
          saveLocalImagesForUser(user.id, [generatedImg, ...existingImgs]);

          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: [
              ...activeConversation.messages,
              userMessage,
              {
                id: assistantPlaceholderId,
                role: 'assistant',
                content: `Aqui está a tua imagem criada pelo **ZUNO AI IMAGE**:\n\n> **Prompt:** "${targetPrompt}"\n> **Estilo:** ${targetStyle.toUpperCase()}\n> **Motor de IA:** ${generatedImg.model || 'ZUNO Diffusion Engine'}`,
                generatedImages: [generatedImg],
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          });
          setEditingImage(null);
          onShowToast('Imagem gerada no chat com sucesso!', 'success');
        } catch {
          onShowToast('Erro ao processar imagem no chat.', 'error');
        } finally {
          setIsGenerating(false);
        }
        return;
      }

      const offlineReply = generateCreatorOfflineChatResponse({
        prompt: messageContent,
        user,
        conversations,
        favorites,
        activeConversation,
      });

      recordCreatorOfflineKnowledge(user.email, messageContent, offlineReply);

      const pendingMessages = [
        ...activeConversation.messages,
        userMessage,
        {
          id: assistantPlaceholderId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        },
      ];

      onUpdateConversation({
        ...activeConversation,
        title: newTitle,
        messages: pendingMessages,
        updatedAt: Date.now(),
      });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      let cursor = 0;
      const chunkSteps = offlineReply.length <= 220 ? 2 : 5;
      const chunkSize = Math.max(48, Math.ceil(offlineReply.length / chunkSteps));

      const pushChunk = () => {
        if (abortController.signal.aborted) {
          const partial = offlineReply.slice(0, cursor);
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: pendingMessages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: partial || offlineReply.slice(0, chunkSize), timestamp: Date.now() }
                : m
            ),
            updatedAt: Date.now(),
          });
          setStreamingMsg(null);
          setIsGenerating(false);
          return;
        }

        cursor = Math.min(offlineReply.length, cursor + chunkSize);
        const slice = offlineReply.slice(0, cursor);
        setStreamingMsg({
          convId: activeConversation.id,
          msgId: assistantPlaceholderId,
          content: slice,
        });

        if (cursor < offlineReply.length) {
          window.setTimeout(pushChunk, 8);
        } else {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: pendingMessages.map((m) =>
              m.id === assistantPlaceholderId
                ? { ...m, content: offlineReply, timestamp: Date.now() }
                : m
            ),
            updatedAt: Date.now(),
          });
          setStreamingMsg(null);
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      };

      setStreamingMsg({
        convId: activeConversation.id,
        msgId: assistantPlaceholderId,
        content: '',
      });
      window.setTimeout(pushChunk, 8);
      return;
    }

    // 2. Comprehensive In-Chat Image Generation Check
    const imageIntent = detectImageIntent(messageContent, Boolean(editingImage));

    if (imageIntent) {
      const targetPrompt = imageIntent.prompt;
      const targetStyle = imageIntent.style;
      const referenceImg = editingImage?.url;
      const isImageEdit = Boolean(editingImage || imageIntent.isEdit);

      onUpdateConversation({
        ...activeConversation,
        title: newTitle,
        messages: [
          ...activeConversation.messages,
          userMessage,
          {
            id: assistantPlaceholderId,
            role: 'assistant',
            content: `🎨 **ZUNO AI IMAGE**: A sintetizar imagem em alta definição para "*${targetPrompt}*" (${targetStyle})...\n\n> ⏳ *A inicializar o motor generativo multimodal... Aguarda alguns instantes.*`,
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      });

      try {
        const res = await generateImage({
          prompt: targetPrompt,
          style: targetStyle,
          aspectRatio: '1:1',
          quality: 'hd',
          userId: user?.id,
          plan: user?.plan,
          referenceImage: referenceImg,
          isEdit: isImageEdit,
        });

        if (res.requiresAuth) {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: activeConversation.messages,
            updatedAt: Date.now(),
          });
          onRequireAuth?.('Geração e edição de imagens');
          return;
        }

        if (res.success && res.image) {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: [
              ...activeConversation.messages,
              userMessage,
              {
                id: assistantPlaceholderId,
                role: 'assistant',
                content: `Aqui está a tua imagem criada pelo **ZUNO AI IMAGE**:\n\n> **Prompt:** "${targetPrompt}"\n> **Estilo:** ${targetStyle.toUpperCase()}\n> **Motor de IA:** ${res.image.model || 'ZUNO Diffusion Engine'}`,
                generatedImages: [res.image],
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          });
          setEditingImage(null);
          onShowToast('Imagem gerada no chat com sucesso!', 'success');
        } else {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: [
              ...activeConversation.messages,
              userMessage,
              {
                id: assistantPlaceholderId,
                role: 'assistant',
                content: `⚠️ ${res.error || 'Não foi possível gerar a imagem no momento.'}\n\nPodes também aceder ao estúdio completo no menu **ZUNO AI IMAGE** ou tentar descrever a imagem com outros termos.`,
                isError: true,
                timestamp: Date.now(),
              },
            ],
            updatedAt: Date.now(),
          });
        }
      } catch (err: any) {
        onShowToast('Erro ao processar imagem no chat.', 'error');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Determine if the user explicitly requested code
    const isCodeRequested = isUserRequestingCode(messageContent);
    const codePolicy = isCodeRequested
      ? 'O utilizador solicitou código/programação. Apresenta código limpo, robusto e moderno com destaque de sintaxe adequado.'
      : 'ATENÇÃO: O utilizador NÃO pediu código. É TERMINANTEMENTE PROIBIDO incluir blocos de código (```typescript, ```javascript, ```python, etc.), interfaces, imports, funções ou exemplos de código nesta resposta. Responde EXCLUSIVAMENTE em linguagem natural, clara, elegante, estruturada e visual com títulos, negrito, listas e tabelas comparativas GFM. Nunca mostres detalhes internos, componentes ou código.';

    // Build compact user personalization instructions (core rules are enforced server-side)
    let systemInstruction = '';
    if (user?.memoryEnabled && user.memories.length > 0) {
      systemInstruction += `Memória do utilizador:\n${user.memories.map((m) => `- ${m}`).join('\n')}\n\n`;
    }
    if (user?.customInstructions) {
      systemInstruction += `Instruções personalizadas: ${user.customInstructions}\n\n`;
    }
    if (user?.aiTone) {
      systemInstruction += `Tom preferido: ${user.aiTone}.`;
    }
    systemInstruction = systemInstruction.trim();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const convId = activeConversation.id;
    let accumulatedResponse = '';
    let rafPending = false;
    let currentRelatedImages: RelatedTopicImage[] | undefined = undefined;

    setStreamingMsg({
      convId,
      msgId: assistantPlaceholderId,
      content: '',
    });

    const flushStreamingToUi = () => {
      rafPending = false;
      const displayResponse = cleanAiResponse(accumulatedResponse, isCodeRequested);
      setStreamingMsg({
        convId,
        msgId: assistantPlaceholderId,
        content: displayResponse,
        relatedImages: currentRelatedImages,
      });
    };

    await streamChat({
      messages: updatedMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      })),
      systemInstruction,
      model: selectedModel,
      attachments: userMessage.attachments,
      signal: abortController.signal,
      onChunk: (chunk) => {
        accumulatedResponse += chunk;
        if (!rafPending) {
          rafPending = true;
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(flushStreamingToUi);
          } else {
            flushStreamingToUi();
          }
        }
      },
      onRelatedImages: (images) => {
        currentRelatedImages = images;
        setStreamingMsg((prev) =>
          prev && prev.msgId === assistantPlaceholderId
            ? { ...prev, relatedImages: images }
            : prev
        );
      },
      onDone: () => {
        setIsGenerating(false);
        setStreamingMsg(null);
        abortControllerRef.current = null;
        const finalResponse = cleanAiResponse(accumulatedResponse, isCodeRequested);
        if (isCreatorOfflineAccount && user?.email && finalResponse) {
          recordCreatorOfflineKnowledge(user.email, messageContent, finalResponse);
        }
        // Final commit to persistent conversation state
        onUpdateConversation({
          ...activeConversation,
          title: newTitle,
          model: selectedModel,
          messages: updatedMessages.map((m) =>
            m.id === assistantPlaceholderId
              ? { ...m, content: finalResponse, relatedImages: currentRelatedImages }
              : m
          ),
          updatedAt: Date.now(),
        });
      },
      onError: (err, requiresAuth) => {
        setIsGenerating(false);
        setStreamingMsg(null);
        abortControllerRef.current = null;
        if (requiresAuth) {
          onUpdateConversation({
            ...activeConversation,
            title: newTitle,
            messages: updatedMessages.map((m) =>
              m.id === assistantPlaceholderId
                ? {
                    ...m,
                    content: `🔒 ${err}`,
                    isError: true,
                  }
                : m
            ),
            updatedAt: Date.now(),
          });
          onRequireAuth?.('Funcionalidade exclusiva de conta');
          return;
        }
        let friendlyError = err;
        try {
          if (typeof err === 'string') {
            if (err.includes('503') || err.includes('high demand') || err.includes('UNAVAILABLE')) {
              friendlyError = 'Os servidores da Google estão com alta procura momentânea neste modelo. Podes clicar em "Tentar novamente" em instantes.';
            } else if (err.includes('429') || err.includes('RESOURCE_EXHAUSTED') || err.toLowerCase().includes('quota')) {
              friendlyError = 'Limite temporário de requisições da API atingido. Por favor aguarda alguns segundos e tenta novamente.';
            } else if (err.includes('404') || err.includes('NOT_FOUND')) {
              friendlyError = 'O modelo anterior foi atualizado. O sistema utiliza agora o Gemini 4 Flash.';
            } else {
              try {
                const parsed = JSON.parse(err);
                if (parsed.error?.message) {
                  let sub = parsed.error.message;
                  try {
                    const subParsed = JSON.parse(sub);
                    if (subParsed.error?.message) sub = subParsed.error.message;
                  } catch (e2) {}
                  if (sub.includes('503') || sub.includes('high demand')) {
                    friendlyError = 'Os servidores da Google estão com alta procura momentânea. Podes tentar novamente em instantes.';
                  } else {
                    friendlyError = sub;
                  }
                }
              } catch (e) {}
            }
          }
        } catch (e) {}

        onUpdateConversation({
          ...activeConversation,
          title: newTitle,
          messages: updatedMessages.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content:
                    accumulatedResponse ||
                    `⚠️ Não foi possível obter uma resposta do modelo neste momento (${friendlyError}). Por favor tenta novamente em instantes.`,
                  isError: true,
                }
              : m
          ),
          updatedAt: Date.now(),
        });
        onShowToast(`${friendlyError}`, 'error');
      },
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setStreamingMsg(null);
      onShowToast('Geração interrompida.', 'info');
    }
  };

  const handleRegenerate = () => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    const lastUserMessage = [...activeConversation.messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      // Remove last assistant message
      const trimmed = activeConversation.messages.filter(
        (m, i) => !(i === activeConversation.messages.length - 1 && m.role === 'assistant')
      );
      onUpdateConversation({
        ...activeConversation,
        messages: trimmed,
      });
      handleSendMessage(lastUserMessage.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickPrompts = [
    { title: '⚡ Criar Script de Automação', prompt: 'Escreve um script completo em Node.js TypeScript para processar ficheiros e gerar estatísticas.' },
    { title: '🔍 Análise Estratégica', prompt: 'Quais são as principais tendências de Inteligência Artificial para este ano no mercado internacional?' },
    { title: '📝 Redigir Artigo Técnico', prompt: 'Escreve um artigo estruturado sobre arquitetura de microsserviços modernos com exemplos práticos.' },
    { title: '💡 Ideias para Startup', prompt: 'Gera 3 ideias inovadoras de produtos digitais combinando IA multimodal com produtividade diária.' },
  ];

  return (
    <div className="flex-1 h-full flex flex-col bg-[#050814] relative overflow-hidden">
      {/* Subtle background ambient gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Chat Bar: Model selector & Conversation info */}
      <div className="h-14 border-b border-slate-800/80 bg-[#070b18]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-xs sm:text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
            {isGuest ? 'Pesquisa Pública ZUNO AI' : (activeConversation?.title || 'ZUNO AI Chat')}
          </h2>
          {isGuest && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-semibold text-amber-300">
              <Lock className="w-2.5 h-2.5" />
              <span>Visitante • Limite público</span>
            </span>
          )}
          {isAuthenticated && isCreatorOfflineAccount && (creatorOfflineMode || !isOnline) && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-[10px] font-bold text-indigo-200">
              <span>Versão Offline do Criador</span>
            </span>
          )}
        </div>

        {/* Model Switcher & Speed Indicator */}
        <div className="flex items-center gap-2">
          {isAuthenticated && onSetShowFavoritesModal && (
            <button
              type="button"
              onClick={() => onSetShowFavoritesModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-amber-300 cursor-pointer transition-colors"
              title="Abrir favoritos guardados e sincronizados"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium">Favoritos</span>
              <span className="text-[10px] font-bold bg-amber-500/20 px-1.5 rounded text-amber-200">
                {favorites.length}
              </span>
            </button>
          )}

          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Resposta Ultrarrápida</span>
          </span>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={selectedModel}
              onChange={(e) => {
                if (!isAuthenticated) {
                  onRequireAuth?.('Selecionar outros modelos de IA');
                  return;
                }
                setSelectedModel(e.target.value);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="gemini-3.1-flash-lite" className="bg-slate-900 text-white">
                ⚡ Gemini 3.1 Flash Lite (Ultra Rápido • Padrão)
              </option>
              <option value="gemini-4-hydrogen" className="bg-slate-900 text-white">
                🧠 Gemini 4 Flash (Raciocínio Avançado)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {(!activeConversation || activeConversation.messages.length === 0) && (
          <div className="max-w-3xl mx-auto py-12 text-center space-y-8 animate-in fade-in duration-500">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/20 border border-blue-500/30 shadow-2xl">
              <Sparkles className="w-10 h-10 text-blue-400" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Como posso acelerar o teu trabalho hoje?
              </h1>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                {t('brand.slogan')}
              </p>
            </div>

            {/* Quick Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto pt-4 text-left">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.prompt)}
                  className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-blue-500/40 transition-all text-xs group cursor-pointer"
                >
                  <p className="font-semibold text-slate-200 group-hover:text-blue-300 mb-1">
                    {q.title}
                  </p>
                  <p className="text-slate-400 line-clamp-2">{q.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {activeConversation?.messages.map((message, msgIdx) => {
          const isUser = message.role === 'user';
          const isStreamingTarget =
            streamingMsg !== null &&
            streamingMsg.convId === activeConversation.id &&
            streamingMsg.msgId === message.id;
          const displayContent = isStreamingTarget ? streamingMsg.content : message.content;
          const displayRelatedImages =
            isStreamingTarget && streamingMsg.relatedImages
              ? streamingMsg.relatedImages
              : message.relatedImages;

          return (
            <div
              key={message.id}
              className={`max-w-3xl mx-auto flex gap-3 sm:gap-4 ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 p-[1.5px] shrink-0 mt-1 shadow-md shadow-indigo-600/20">
                  <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center font-black text-xs text-blue-400">
                    Z
                  </div>
                </div>
              )}

              <div className={`flex flex-col gap-1.5 max-w-[85%] sm:max-w-[78%]`}>
                {/* Image Attachments if present */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {message.attachments.map((att, attIdx) => (
                      <div
                        key={attIdx}
                        className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900/90 max-w-[200px]"
                      >
                        {att.type.startsWith('image/') ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="max-h-48 object-cover rounded-t"
                          />
                        ) : (
                          <div className="p-3 flex items-center gap-2 text-xs text-slate-300">
                            <Paperclip className="w-4 h-4 text-blue-400" />
                            <span className="truncate">{att.name}</span>
                          </div>
                        )}
                        <div className="px-2 py-1 text-[10px] text-slate-400 truncate bg-slate-950/80">
                          {att.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Bubble Body */}
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/20 font-medium'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-100 rounded-bl-sm shadow-xl'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{displayContent}</p>
                  ) : (
                    <div className="space-y-3">
                      {displayContent && (
                        <MarkdownRenderer
                          content={displayContent}
                          allowCodeBlocks={(() => {
                            if (msgIdx > 0) {
                              for (let k = msgIdx - 1; k >= 0; k--) {
                                if (activeConversation.messages[k].role === 'user') {
                                  return isUserRequestingCode(activeConversation.messages[k].content);
                                }
                              }
                            }
                            return false;
                          })()}
                        />
                      )}

                      {/* Related Topic Images Gallery (Below Text Response) */}
                      {displayRelatedImages && displayRelatedImages.length > 0 && (
                        <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-md bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                                <ImageIcon className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-semibold text-slate-200">
                                Imagens Relacionadas
                              </span>
                              <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded-full">
                                {displayRelatedImages.length}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Fonte: Wikipédia / Wikimedia
                            </span>
                          </div>

                          {/* Responsive Gallery Grid: 2 columns mobile, 3 columns tablet, 4 columns desktop */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {displayRelatedImages.map((img) => (
                              <div
                                key={img.id}
                                onClick={() => setActiveLightboxRelatedImage(img)}
                                className="group/item relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950/70 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all cursor-pointer flex flex-col"
                              >
                                <div className="aspect-[4/3] w-full bg-slate-900/90 overflow-hidden relative">
                                  <img
                                    src={img.thumbnailUrl || img.url}
                                    alt={img.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      if (target.src !== img.url) {
                                        target.src = img.url;
                                      }
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="p-1.5 px-2 rounded-lg bg-slate-900/95 text-white text-[10px] font-semibold flex items-center gap-1 shadow-md backdrop-blur-sm border border-slate-700">
                                      <Maximize2 className="w-3 h-3 text-blue-400" />
                                      <span>Ampliar</span>
                                    </span>
                                  </div>
                                </div>
                                <div className="p-2 flex flex-col justify-between flex-1 bg-slate-900/40 border-t border-slate-800/60">
                                  <p className="text-[11px] font-medium text-slate-200 line-clamp-1 group-hover/item:text-blue-300 transition-colors" title={img.title}>
                                    {img.title}
                                  </p>
                                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="truncate max-w-[85px]">{img.source.split('/')[0].trim()}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-500 group-hover/item:text-blue-400 transition-colors" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Generated Images Showcase in Chat */}
                      {message.generatedImages && message.generatedImages.length > 0 && (
                        <div className="flex flex-col gap-4 pt-3 max-w-xl">
                          {message.generatedImages.map((genImg) => (
                            <div
                              key={genImg.id}
                              className="w-full rounded-2xl border border-indigo-500/30 bg-[#070b19] overflow-hidden shadow-2xl group/img"
                            >
                              <div
                                onClick={() => setActiveLightboxImage(genImg)}
                                className="relative aspect-square sm:aspect-[4/3] bg-slate-900 cursor-pointer overflow-hidden"
                              >
                                <img
                                  src={genImg.url}
                                  alt={genImg.prompt}
                                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <span className="p-2.5 rounded-xl bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                                    <Maximize2 className="w-4 h-4" />
                                    <span>Ampliar</span>
                                  </span>
                                </div>
                              </div>

                              <div className="p-3.5 flex flex-wrap items-center justify-between bg-[#080d1e] text-xs border-t border-slate-800/80 gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                                    {genImg.style}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {genImg.aspectRatio}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateImage(genImg)}
                                    disabled={isGenerating}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition-colors cursor-pointer text-xs disabled:opacity-50"
                                    title="Gerar uma nova variação desta imagem"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>Gerar Novamente</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestImageEdit(genImg)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium transition-colors cursor-pointer text-xs"
                                    title="Pedir alteração a esta imagem"
                                  >
                                    <Wand2 className="w-3.5 h-3.5" />
                                    <span>Alterar</span>
                                  </button>
                                  <a
                                    href={genImg.url}
                                    download={`zuno-ai-${genImg.id}.png`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium transition-colors cursor-pointer text-xs"
                                    title="Guardar imagem"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Guardar</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!displayContent && !message.generatedImages && (
                        <div className="flex items-center gap-2 text-slate-400 py-1 text-xs">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                          <span>{t('chat.thinking')}</span>
                        </div>
                      )}

                      {message.isError && (
                        <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-red-300">A ligação está disponível. Podes tentar de imediato:</span>
                          <button
                            type="button"
                            onClick={handleRegenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-200 border border-red-500/30 text-xs font-semibold transition-all cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Tentar novamente</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assistant Message Actions Toolbar */}
                {!isUser && displayContent && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs pl-1">
                    <button
                      onClick={() => copyMessage(displayContent, message.id)}
                      className="p-1 rounded hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                      title={t('chat.copy')}
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => speakText(displayContent, message.id)}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                        isSpeakingId === message.id ? 'text-blue-400' : 'hover:text-white'
                      }`}
                      title={isSpeakingId === message.id ? 'Parar leitura' : 'Ouvir resposta por voz'}
                    >
                      {isSpeakingId === message.id ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {onToggleFavorite && (() => {
                      const isSaved = favorites.some(
                        (f) => f.messageId === message.id || f.id === `fav_${message.id}`
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthenticated) {
                              onRequireAuth?.('Guardar favoritos na conta');
                              return;
                            }
                            onToggleFavorite(message, activeConversation);
                          }}
                          className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                            isSaved ? 'text-amber-400' : 'hover:text-white'
                          }`}
                          title={isSaved ? 'Remover dos favoritos' : 'Guardar nos favoritos'}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-400' : ''}`} />
                        </button>
                      );
                    })()}

                    <span className="text-[10px] text-slate-400">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                )}
              </div>

              {isUser && user && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white shrink-0 mt-1">
                  {user.name.charAt(0)}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Action Buttons: Stop / Regenerate */}
      <div className="flex justify-center mb-2 z-10">
        {isGenerating ? (
          <button
            onClick={handleStopGeneration}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-medium shadow-xl cursor-pointer active:scale-95 transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-rose-400" />
            <span>{t('chat.stop')}</span>
          </button>
        ) : (
          activeConversation &&
          activeConversation.messages.length > 0 && (
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-[11px] shadow-sm cursor-pointer transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              <span>{t('chat.regenerate')}</span>
            </button>
          )
        )}
      </div>

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-2 flex items-center gap-2 overflow-x-auto">
          {attachments.map((att, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-blue-500/30 text-xs text-white shrink-0"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[140px]">{att.name}</span>
              <button
                onClick={() => removeAttachment(idx)}
                className="text-slate-400 hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active Image Revision Reference Banner */}
      {editingImage && (
        <div className="max-w-3xl mx-auto w-full px-4 mb-2">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-purple-950/80 border border-purple-500/50 text-xs text-purple-200 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-purple-400/50 shadow-md">
                <img src={editingImage.url} alt="Referência" className="w-full h-full object-cover" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
                  <Wand2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>A alterar imagem anterior</span>
                </div>
                <span className="text-[11px] text-purple-300 truncate block">
                  "{editingImage.prompt}"
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingImage(null)}
              className="p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/50 cursor-pointer transition-colors"
              title="Cancelar modo de alteração"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Message Input Box */}
      <div className="p-4 sm:p-6 bg-[#070b18]/90 border-t border-slate-800/80 shrink-0 z-10 backdrop-blur-md">
        <div className="max-w-3xl mx-auto relative">
          <div className="flex items-end gap-2 p-2 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-2xl transition-all">
            {/* Hidden File Input for Image/Doc */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*,.pdf,.txt,.md"
              className="hidden"
            />

            {/* Attach Button */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.('Anexar ficheiros e documentos');
                  return;
                }
                fileInputRef.current?.click();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title={isGuest ? 'Anexar ficheiros requer conta ZUNO AI' : t('chat.attach')}
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Image Generator Shortcut Button */}
            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  onRequireAuth?.('Gerar imagens com ZUNO AI IMAGE');
                  return;
                }
                if (!input.startsWith('/image ')) {
                  setInput('/image ');
                }
                onShowToast('Modo de imagem ativado. Escreve a tua descrição a seguir a /image', 'info');
              }}
              className="p-2 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors cursor-pointer shrink-0"
              title={isGuest ? 'Gerar imagens requer conta ZUNO AI' : 'Pedir imagem com ZUNO AI Image (/image)'}
            >
              <Wand2 className="w-4 h-4" />
            </button>

            {/* Speech to text Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 animate-pulse'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isListening ? t('chat.voice_stop') : t('chat.voice_start')}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isGuest ? 'Pesquisa pública na ZUNO AI (ex: O que é a computação quântica?)' : t('chat.input_placeholder')}
              rows={1}
              className="flex-1 max-h-36 min-h-[40px] py-2 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none leading-relaxed"
            />

            {isCreatorRecognitionQuery(input) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 shrink-0">
                <Sparkles className="w-3 h-3" />
                Seja bem-vindo, Francisco Mutela Emanuel!
              </span>
            )}
            {matchedCodeHint && !isCreatorRecognitionQuery(input) && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/35 text-[11px] font-semibold text-purple-200 shrink-0 max-w-[240px] truncate">
                <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
                <span className="truncate">Código: {matchedCodeHint.purpose || matchedCodeHint.code}</span>
              </span>
            )}

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={(!input.trim() && attachments.length === 0) || isGenerating}
              className={`p-2.5 rounded-xl font-semibold transition-all shrink-0 cursor-pointer ${
                (!input.trim() && attachments.length === 0) || isGenerating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 active:scale-95'
              }`}
              title={t('chat.send')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Quota & Info footnote */}
          <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
            {isGuest ? (
              <span>
                Modo Visitante · Pesquisa pública limitada (conversas não guardadas na conta)
              </span>
            ) : (
              <span>
                {t('chat.limit_notice')}{' '}
                <strong className="text-slate-400">
                  {user?.messageCountToday || 0} / {user?.maxMessagesToday || 25}
                </strong>
              </span>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => (isGuest ? onRequireAuth?.('Estúdio ZUNO AI IMAGE') : onNavigate('image'))}
                className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>ZUNO AI IMAGE</span>
              </button>
              <button
                onClick={() => onNavigate('tools')}
                className="text-purple-400 hover:underline cursor-pointer"
              >
                {isGuest ? 'Pesquisa Pública' : 'Ferramentas ZUNO'}
              </button>
              {isGuest ? (
                <button
                  onClick={() => onRequireAuth?.('Criar conta ZUNO AI')}
                  className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                >
                  Criar conta gratuita
                </button>
              ) : (
                user?.plan === 'free' && (
                  <button
                    onClick={() => onNavigate('pricing')}
                    className="text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    {t('chat.limit_upgrade')}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal in Chat */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-4xl w-full rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white uppercase">{activeLightboxImage.style}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{activeLightboxImage.aspectRatio}</span>
              </div>
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={activeLightboxImage.url}
                alt={activeLightboxImage.prompt}
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs font-semibold text-slate-200 max-w-xl">
                {activeLightboxImage.prompt}
              </p>

              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const img = activeLightboxImage;
                    setActiveLightboxImage(null);
                    handleRegenerateImage(img);
                  }}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                  title="Gerar uma nova variação desta imagem"
                >
                  <RotateCw className="w-4 h-4 text-emerald-400" />
                  <span>Gerar Novamente</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const img = activeLightboxImage;
                    setActiveLightboxImage(null);
                    handleRequestImageEdit(img);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  <span>Pedir Alteração</span>
                </button>
                <a
                  href={activeLightboxImage.url}
                  download={`zuno-ai-${activeLightboxImage.id}.png`}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Guardar Imagem</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Related Topic Images */}
      {activeLightboxRelatedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="relative max-w-4xl w-full rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-white uppercase tracking-wider">Imagem Relacionada</span>
                <span className="text-slate-500">•</span>
                <span className="text-blue-400 font-medium">{activeLightboxRelatedImage.source}</span>
              </div>
              <button
                onClick={() => setActiveLightboxRelatedImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={activeLightboxRelatedImage.url}
                alt={activeLightboxRelatedImage.title}
                className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-2xl"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (activeLightboxRelatedImage.thumbnailUrl && target.src !== activeLightboxRelatedImage.thumbnailUrl) {
                    target.src = activeLightboxRelatedImage.thumbnailUrl;
                  }
                }}
              />
            </div>

            <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <h3 className="text-sm font-bold text-white">
                  {activeLightboxRelatedImage.title}
                </h3>
                {activeLightboxRelatedImage.caption && activeLightboxRelatedImage.caption !== activeLightboxRelatedImage.title && (
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {activeLightboxRelatedImage.caption}
                  </p>
                )}
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                  <span>Origem:</span>
                  <span className="text-slate-300 font-medium">{activeLightboxRelatedImage.source}</span>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-end">
                {activeLightboxRelatedImage.pageUrl && (
                  <a
                    href={activeLightboxRelatedImage.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-md"
                    title="Visitar página de origem na Wikipédia"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span>Ver Página Original</span>
                  </a>
                )}
                <a
                  href={activeLightboxRelatedImage.url}
                  target="_blank"
                  download={`${activeLightboxRelatedImage.title.replace(/[^a-z0-9]/gi, '_')}.jpg`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Guardar Imagem</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Synced Favorites Drawer/Modal */}
      {showFavoritesModal && onSetShowFavoritesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-2xl w-full rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bookmark className="w-4 h-4 fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Favoritos Guardados</h3>
                  <p className="text-[11px] text-slate-400">
                    Sincronizados automaticamente com a tua conta em todos os dispositivos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSetShowFavoritesModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Fechar favoritos"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {favorites.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-800 rounded-2xl">
                  <Bookmark className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">Ainda não tens favoritos guardados.</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Clica no ícone de marcador abaixo de qualquer resposta da ZUNO AI para a guardar aqui e aceder a partir de qualquer dispositivo.
                  </p>
                </div>
              ) : (
                favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-blue-300 truncate">
                          {fav.conversationTitle || 'Resposta guardada'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(fav.createdAt).toLocaleString('pt-PT')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => copyMessage(fav.content, fav.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title="Copiar conteúdo"
                        >
                          {copiedId === fav.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {onDeleteFavorite && (
                          <button
                            type="button"
                            onClick={() => onDeleteFavorite(fav.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Remover dos favoritos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {fav.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
