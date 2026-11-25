export type Language = 'pt' | 'en' | 'es' | 'fr';

export type PlanType = 'free' | 'premium' | 'pro' | 'ultra';

export type ImageStyle =
  | 'realista'
  | 'fotografico'
  | 'anime'
  | '3d'
  | 'cartoon'
  | 'paisagem'
  | 'logotipo'
  | 'produto'
  | 'futurista'
  | 'ilustracao'
  | 'cinematografico'
  | 'interiores'
  | 'fantasia'
  | 'artistico'
  | 'minimalista';

export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '4:5' | '4:3' | '3:4' | 'custom';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  quality: 'standard' | 'hd' | 'ultra';
  createdAt: number;
  model: string;
  userId?: string;
  isEdit?: boolean;
  editAction?: 'background' | 'lighting' | 'add_elements' | 'remove_elements' | 'style_transfer' | 'custom';
  parentImageId?: string;
}

export interface UserFeatures {
  imageGeneration: boolean;
  webSearch: boolean;
  visionMultimodal: boolean;
  ultraModel: boolean;
  voiceAudio: boolean;
  customMemory: boolean;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: PlanType;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  createdAt: string;
  lastActive: string;
  messageCount: number;
  imageCount: number;
  features: UserFeatures;
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: PlanType;
  role: 'user' | 'admin';
  status?: 'active' | 'blocked';
  isBlocked?: boolean;
  createdAt: string;
  language: Language;
  messageCountToday: number;
  maxMessagesToday: number;
  imageCountToday: number;
  maxImagesToday: number;
  customInstructions?: string;
  aiTone?: 'balanced' | 'creative' | 'precise' | 'friendly' | 'academic';
  memoryEnabled: boolean;
  memories: string[];
  features?: UserFeatures;
}

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 representation
}

export interface RelatedTopicImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  source: string;
  pageUrl: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: ChatAttachment[];
  generatedImages?: GeneratedImage[];
  relatedImages?: RelatedTopicImage[];
  toolUsed?: string;
  searchCitations?: Array<{ title: string; url: string }>;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  toolId?: string;
  model: string;
  isPinned?: boolean;
}

export type ToolId = 
  | 'writer'
  | 'study'
  | 'code'
  | 'translate'
  | 'vision'
  | 'pdf'
  | 'voice'
  | 'creative'
  | 'image'
  | 'search';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  shortDesc: string;
  category: 'productivity' | 'creation' | 'learning' | 'multimodal';
  icon: string;
  badge?: string;
  systemPrompt: string;
  samplePrompts: string[];
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers?: number;
  onlineUsers?: number;
  totalConversations: number;
  totalImages?: number;
  totalApiRequests: number;
  estimatedTokens: number;
  activeModel: string;
  activeImageModel?: string;
  systemStatus: 'optimal' | 'degraded' | 'maintenance';
  databaseStatus?: 'connected' | 'error';
  uptimeSeconds: number;
  memoryRssMb?: number;
  errorCountLastHour?: number;
  guestRateLimitCount?: number;
  feedbackSummary?: {
    total: number;
    likedCount: number;
    dislikedCount: number;
    approvalRate: number;
    averageRating: number;
  };
  featuresEnabled: PlatformFeatureFlags;
  announcement?: PlatformAnnouncement;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    endpoint?: string;
  }>;
}

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

export interface PricingPlan {
  id: PlanType;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  badge?: string;
  features: PlanFeature[];
  popular?: boolean;
}

export type FeedbackCategoryId =
  | 'experiencia_geral'
  | 'design_interface'
  | 'inteligencia_artificial'
  | 'velocidade_desempenho'
  | 'pesquisa_internet'
  | 'geracao_imagens'
  | 'funcionalidades'
  | 'problemas_erros'
  | 'contas_seguranca'
  | 'planos_pagamentos'
  | 'compatibilidade'
  | 'sugestao_geral';

export type FeedbackType = 'praise' | 'improvement' | 'bug' | 'feature_request';

export type FeedbackStatus =
  | 'Recebido'
  | 'Em análise'
  | 'Respondido'
  | 'Implementado'
  | 'Não planeado';

export interface FeedbackReply {
  id: string;
  feedbackId: string;
  userId: string;
  authorName: string;
  authorRole: 'official_team' | 'user';
  isOfficial: boolean;
  officialBadgeLabel?: string;
  content: string;
  isEdited: boolean;
  isDeleted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  authorDisplayName: string;
  isAnonymous: boolean;
  rating: number;
  likedApp?: boolean | null;
  improvementArea?: string;
  category: FeedbackCategoryId;
  feedbackType: FeedbackType;
  title: string;
  comment: string;
  likedMost?: string;
  improvementSuggestion?: string;
  deviceInfo?: string;
  isPublic: boolean;
  status: FeedbackStatus;
  isHidden: boolean;
  reportCount: number;
  createdAt: number;
  updatedAt: number;
  replies: FeedbackReply[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface FeedbackAuditEntry {
  id: string;
  feedbackId: string;
  replyId?: string;
  action: 'reply_created' | 'reply_edited' | 'reply_deleted' | 'status_changed' | 'moderated';
  actorName: string;
  actorRole: string;
  previousValue?: string;
  newValue?: string;
  createdAt: number;
}

export interface FeedbackReport {
  id: string;
  feedbackId: string;
  reporterUserId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: number;
}

export interface UserNotification {
  id: string;
  userId: string;
  feedbackId: string;
  type: 'official_reply' | 'status_update';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: number;
}

export interface FeedbackStats {
  totalFeedbacks: number;
  ratedFeedbacks: number;
  averageRating: number;
  likedCount: number;
  dislikedCount: number;
  approvalRate: number;
  ratingDistribution: Record<number, number>;
  praiseCount: number;
  criticismCount: number;
  improvementCount: number;
  featureRequestCount: number;
  statusCounts: Record<FeedbackStatus, number>;
  topCategories: Array<{ category: FeedbackCategoryId; count: number }>;
  topImprovementAreas: Array<{ area: string; count: number }>;
  frequentSuggestions: Array<{
    topic: string;
    category: FeedbackCategoryId;
    count: number;
    sampleTitles: string[];
  }>;
}

export interface PlatformAnnouncement {
  enabled: boolean;
  text: string;
  type: 'info' | 'warning' | 'success';
  updatedAt: number;
}

export interface PlatformFeatureFlags {
  searchGrounding: boolean;
  imageAnalysis: boolean;
  voiceDictation: boolean;
  imageGeneration: boolean;
  publicSignupEnabled: boolean;
  guestAccessEnabled: boolean;
  maintenanceMode: boolean;
}

export interface KnownAccountSummary {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'password' | 'firebase';
  lastUsedAt: number;
}

export interface VipCodeRecord {
  code: string;
  plan: PlanType;
  maxUses: number;
  usedCount: number;
  createdBy: string;
  active: boolean;
  createdAt: number;
}

export interface FavoriteItem {
  id: string;
  uid?: string;
  conversationId?: string;
  conversationTitle?: string;
  messageId?: string;
  content: string;
  note?: string;
  createdAt: number;
}

export interface DeviceSessionInfo {
  id: string;
  deviceLabel: string;
  osName: string;
  browserName: string;
  ipAddress: string;
  createdAt: number;
  lastActiveAt: number;
  isRevoked: boolean;
  isCurrent: boolean;
}

export type SearchBarCodeActionType =
  | 'message'
  | 'upgrade_plan'
  | 'unlock_features'
  | 'navigate'
  | 'open_tool'
  | 'creator_greeting';

export interface SearchBarCodeRecord {
  code: string;
  purpose: string;
  description: string;
  actionType: SearchBarCodeActionType;
  targetPlan?: PlanType;
  targetView?: string;
  targetToolId?: ToolId;
  targetFeatures?: Partial<UserFeatures>;
  responseText: string;
  maxUses: number;
  usedCount: number;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface SearchCodeExecutionResult {
  matched: boolean;
  executed: boolean;
  requiresAuth?: boolean;
  error?: string;
  code?: string;
  purpose?: string;
  description?: string;
  actionType?: SearchBarCodeActionType;
  targetPlan?: PlanType;
  targetView?: string;
  targetToolId?: ToolId;
  responseText?: string;
  user?: UserProfile;
}

export const GUEST_RESTRICTION_MESSAGE =
  'Esta funcionalidade exige uma conta ZUNO AI. Cria uma conta ou inicia sessão para continuares.';
