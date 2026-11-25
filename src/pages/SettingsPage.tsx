import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, DeviceSessionInfo, GUEST_RESTRICTION_MESSAGE } from '../types';
import {
  fetchDeviceSessionsApi,
  revokeOtherSessionsApi,
  revokeSingleSessionApi,
} from '../services/api';
import { 
  User, 
  Brain, 
  Sparkles, 
  Globe, 
  Shield, 
  Bell, 
  CreditCard, 
  Trash2, 
  Plus, 
  Check, 
  Save, 
  AlertTriangle,
  Lock,
  Layers,
  RefreshCw,
  LogOut,
  UserPlus,
  LogIn,
  Laptop,
  Smartphone,
  WifiOff,
  HardDriveDownload,
  MessageSquare
} from 'lucide-react';
import { CREATOR_OFFLINE_EMAIL } from '../config/brand';
import { loadConversationsForUser } from '../services/storage';
import {
  loadCreatorOfflineKnowledge,
  loadCreatorOfflineSyncQueue,
} from '../services/offlineCreator';

interface SettingsPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToPricing: () => void;
  initialTab?: 'profile' | 'personality' | 'memory' | 'security' | 'notifications';
  onOpenAuth?: (mode: 'login' | 'signup' | 'switch') => void;
  onNavigateToChat?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onShowToast,
  onNavigateToPricing,
  initialTab = 'profile',
  onOpenAuth,
  onNavigateToChat,
}) => {
  const {
    user,
    isAuthenticated,
    authProvider,
    logout,
    updateProfile,
    addMemory,
    removeMemory,
    clearMemories,
    deleteAccount,
    isCreatorOfflineAccount,
    creatorOfflineMode,
    setCreatorOfflineMode,
    prepareCreatorOffline,
    isOnline,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [preparingOffline, setPreparingOffline] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'personality' | 'memory' | 'security' | 'notifications'>(initialTab);

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [customInstructions, setCustomInstructions] = useState(user?.customInstructions || '');
  const [aiTone, setAiTone] = useState(user?.aiTone || 'balanced');
  const [memoryEnabled, setMemoryEnabled] = useState(user?.memoryEnabled ?? true);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceSessions, setDeviceSessions] = useState<DeviceSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setCustomInstructions(user.customInstructions || '');
      setAiTone(user.aiTone || 'balanced');
      setMemoryEnabled(user.memoryEnabled ?? true);
    }
  }, [user?.id, user?.name, user?.customInstructions, user?.aiTone, user?.memoryEnabled]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || activeTab !== 'security') return;
    let cancelled = false;
    setLoadingSessions(true);
    fetchDeviceSessionsApi()
      .then((sessions) => {
        if (!cancelled) setDeviceSessions(sessions);
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, activeTab]);

  const handleSaveProfile = async () => {
    await updateProfile({
      name,
      language,
      customInstructions,
      aiTone,
      memoryEnabled,
    });
    onShowToast('Definições guardadas e sincronizadas com a tua conta!', 'success');
  };

  const handleRevokeOtherDevices = async () => {
    setRevokingSessions(true);
    try {
      const res = await revokeOtherSessionsApi();
      setDeviceSessions(res.sessions);
      onShowToast(
        res.revokedCount > 0
          ? `Sessão terminada em ${res.revokedCount} outro(s) dispositivo(s).`
          : 'Não existem sessões ativas noutros dispositivos neste momento.',
        'success'
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao terminar sessões noutros dispositivos.', 'error');
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleRevokeSingleDevice = async (sessionId: string) => {
    try {
      const updated = await revokeSingleSessionApi(sessionId);
      setDeviceSessions(updated);
      onShowToast('Sessão do dispositivo encerrada remotamente.', 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao encerrar dispositivo.', 'error');
    }
  };

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    addMemory(newMemoryText);
    setNewMemoryText('');
    onShowToast('Informação memorizada pelo ZUNO AI.', 'success');
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#050814] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full rounded-3xl border border-blue-500/30 bg-[#080d1e]/95 p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">Configurações & Conta Pessoal</h2>
            <p className="text-sm text-slate-200 leading-relaxed">{GUEST_RESTRICTION_MESSAGE}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenAuth?.('signup')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Criar conta</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-blue-400" />
              <span>Iniciar sessão</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Definições da Plataforma</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gere a tua conta, personalidade da inteligência artificial, memória persistente e segurança.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Tabs Navigation */}
          <div className="space-y-1">
            {[
              { id: 'profile', label: 'Conta & Perfil', icon: User },
              { id: 'personality', label: 'Personalidade da IA', icon: Sparkles },
              { id: 'memory', label: 'Memória & Contexto', icon: Brain },
              { id: 'security', label: 'Segurança & Privacidade', icon: Shield },
              { id: 'notifications', label: 'Notificações', icon: Bell },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-blue-600/20 text-white border border-blue-500/30'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="md:col-span-3 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 space-y-6">
            {/* 1. Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                  Informações Pessoais
                </h3>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-black text-2xl text-white shadow-lg">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{name}</h4>
                    <p className="text-xs text-slate-400">{user?.email}</p>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                      Plano {user?.plan}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Nome de Utilizador:
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Endereço de E-mail:
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Idioma da Interface:
                  </label>
                  <select
                    value={language}
                    onChange={(e) => {
                      const nextLang = e.target.value as Language;
                      setLanguage(nextLang);
                      updateProfile({ language: nextLang });
                    }}
                    className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="pt">Português (Portugal / Brasil)</option>
                    <option value="en">English (International)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                  </select>
                </div>

                {isCreatorOfflineAccount && (
                  <div className="p-5 rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-purple-950/40 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <WifiOff className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-sm font-bold text-white">
                            Versão Offline Exclusiva do Criador
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                            {CREATOR_OFFLINE_EMAIL}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          Permite conversar com o Zuno em múltiplos turnos, responder a perguntas sobre tecnologia, ciência, história, geografia, cálculos e consultar conversas ou favoritos mesmo sem ligação à internet. Disponível exclusivamente para a conta oficial do criador.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isOnline && creatorOfflineMode) {
                            onShowToast('Sem internet: o Modo Offline do Criador permanece ativo automaticamente.', 'info');
                            return;
                          }
                          const next = !creatorOfflineMode;
                          setCreatorOfflineMode(next);
                          onShowToast(
                            next
                              ? 'Versão Offline do Criador ativada!'
                              : 'Modo Online em tempo real restaurado.',
                            'success'
                          );
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                          creatorOfflineMode
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                            : 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/40 text-white'
                        }`}
                      >
                        {creatorOfflineMode ? 'Modo Offline: ATIVO' : 'Ativar Modo Offline'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <p className="text-base font-extrabold text-white">
                          {loadConversationsForUser(user.id, user.name).length}
                        </p>
                        <p className="text-[10px] text-slate-400">Conversas em Cache</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <p className="text-base font-extrabold text-blue-300">
                          {loadCreatorOfflineKnowledge(user.email).length}
                        </p>
                        <p className="text-[10px] text-slate-400">Base Offline</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <p className="text-base font-extrabold text-amber-300">
                          {loadCreatorOfflineSyncQueue(user.email).length}
                        </p>
                        <p className="text-[10px] text-slate-400">Por Sincronizar</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                      {onNavigateToChat && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!creatorOfflineMode) {
                              setCreatorOfflineMode(true);
                            }
                            onNavigateToChat();
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 text-xs font-bold text-white cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Conversar com o Zuno Offline</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={preparingOffline}
                        onClick={async () => {
                          setPreparingOffline(true);
                          try {
                            const stats = await prepareCreatorOffline();
                            onShowToast(
                              `Cache offline atualizado (${stats.cachedAssets} recursos da app e ${stats.kbCount} entradas de conhecimento).`,
                              'success'
                            );
                          } finally {
                            setPreparingOffline(false);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        <HardDriveDownload className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {preparingOffline ? 'A preparar cache offline...' : 'Atualizar Cache Offline Agora'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Alterações</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. Personality Tab */}
            {activeTab === 'personality' && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                  Personalização da Inteligência Artificial
                </h3>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Tom e Estilo das Respostas:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'balanced', label: 'Equilibrado', desc: 'Respostas naturais, diretas e abrangentes' },
                      { id: 'precise', label: 'Ultra Conciso', desc: 'Respostas cirúrgicas sem introduções longas' },
                      { id: 'creative', label: 'Criativo & Visionário', desc: 'Ideias ricas, metáforas e inovação' },
                      { id: 'academic', label: 'Académico & Rigoroso', desc: 'Fundamentação profunda e terminologia exata' },
                      { id: 'friendly', label: 'Amigável & Empático', desc: 'Comunicação calorosa e encorajadora' },
                    ].map((tone) => (
                      <div
                        key={tone.id}
                        onClick={() => setAiTone(tone.id as any)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          aiTone === tone.id
                            ? 'border-blue-500 bg-blue-600/10 text-white'
                            : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <p className="font-semibold text-xs text-white">{tone.label}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{tone.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Instruções Personalizadas Permanentes:
                  </label>
                  <p className="text-[11px] text-slate-400 mb-2">
                    O que gostarias que o ZUNO AI soubesse sobre ti ao responder? (ex: "Sou arquiteto de software, prefiro exemplos em TypeScript com testes unitários.")
                  </p>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                    placeholder="Escreve aqui as tuas instruções personalizadas..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Personalidade</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Memory Tab */}
            {activeTab === 'memory' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">Memória Persistente do ZUNO AI</h3>
                    <p className="text-xs text-slate-400">
                      O ZUNO AI recorda factos e preferências partilhadas para tornar as respostas mais úteis.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setMemoryEnabled(!memoryEnabled);
                      updateProfile({ memoryEnabled: !memoryEnabled });
                      onShowToast(
                        !memoryEnabled ? 'Memória ativada.' : 'Memória desativada. As novas conversas não usarão contexto passado.',
                        'info'
                      );
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer p-0.5 ${
                      memoryEnabled ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        memoryEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Add new memory form */}
                <form onSubmit={handleAddMemory} className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Adicionar um facto para o ZUNO AI lembrar..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </form>

                {/* Memory items list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Informações Memorizadas ({user?.memories?.length || 0}):
                    </span>
                    {(user?.memories?.length || 0) > 0 && (
                      <button
                        onClick={clearMemories}
                        className="text-xs text-rose-400 hover:underline cursor-pointer"
                      >
                        Limpar toda a memória
                      </button>
                    )}
                  </div>

                  {user?.memories && user.memories.length > 0 ? (
                    <div className="divide-y divide-slate-800/80 rounded-2xl border border-slate-800 bg-slate-950/40 overflow-hidden">
                      {user.memories.map((mem, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                          <span className="text-slate-300">{mem}</span>
                          <button
                            onClick={() => removeMemory(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remover facto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 text-xs text-slate-500">
                      Nenhuma memória guardada até ao momento.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                  Privacidade, Segurança & Sessão
                </h3>

                {/* Verified Session Card */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      Sessão Verificada ({authProvider === 'google' ? 'Google' : 'E-mail e Palavra-passe'})
                    </span>
                    <p className="text-sm font-bold text-white">{user.email}</p>
                    <p className="text-[11px] text-slate-400">
                      Identificador isolado: <span className="font-mono text-slate-300">{user.id}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenAuth?.('switch')}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                      <span>Trocar de conta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Terminar sessão</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-emerald-400">
                      <Shield className="w-4 h-4" />
                      <span>Isolamento Total de Conta & Chaves Seguras</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Todas as conversas, imagens geradas, memórias e histórico são estritamente isolados por identificador único (UID) e validados por token criptográfico seguro no servidor da ZUNO AI.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center gap-2 font-semibold text-blue-400">
                      <Lock className="w-4 h-4" />
                      <span>Encriptação de Sessão & Proteção contra Acesso Visitante</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Ao terminar sessão, os dados privados em cache local do dispositivo são limpos imediatamente, mantendo a tua conta protegida na nuvem.
                    </p>
                  </div>
                </div>

                {/* Multi-Device Active Sessions & Remote Sign-out */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Dispositivos & Sessões Ativas
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Gere os dispositivos onde iniciaste sessão com esta conta e termina acessos remotos quando necessário.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={revokingSessions}
                      onClick={handleRevokeOtherDevices}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>
                        {revokingSessions ? 'A encerrar...' : 'Terminar sessões noutros dispositivos'}
                      </span>
                    </button>
                  </div>

                  {loadingSessions ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      A carregar sessões ativas...
                    </div>
                  ) : deviceSessions.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      Apenas este dispositivo está registado nesta sessão.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                      {deviceSessions.map((sess) => {
                        const isMobile = /android|iphone|ipad/i.test(sess.osName);
                        return (
                          <div
                            key={sess.id}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                                {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-white truncate">
                                    {sess.deviceLabel}
                                  </span>
                                  {sess.isCurrent && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                                      Este dispositivo
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 truncate">
                                  Última atividade: {new Date(sess.lastActiveAt).toLocaleString('pt-PT')} · {sess.ipAddress}
                                </p>
                              </div>
                            </div>
                            {!sess.isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSingleDevice(sess.id)}
                                className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold cursor-pointer shrink-0"
                              >
                                Terminar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Account Deletion */}
                <div className="pt-6 border-t border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Zona de Perigo
                  </h4>
                  <p className="text-xs text-slate-400">
                    A eliminação de conta remove permanentemente o teu perfil, todo o histórico de conversas e as memórias guardadas.
                  </p>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Eliminar Conta & Dados
                  </button>
                </div>
              </div>
            )}

            {/* 5. Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-in fade-in">
                <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                  Preferências de Notificações
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <p className="text-xs font-semibold text-white">Alertas de Atualizações de Ferramentas</p>
                      <p className="text-[11px] text-slate-400">Receber novidades sobre novos modelos Gemini e ferramentas ZUNO.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailNotifications}
                      onChange={(e) => setEmailNotifications(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#090e1c] p-6 space-y-4 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Eliminar conta definitivamente?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Esta ação é irreversível. Todas as tuas conversas, ficheiros gerados e memórias serão permanentemente eliminados.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await deleteAccount();
                    setShowDeleteModal(false);
                    onShowToast('Conta e dados eliminados com sucesso.', 'info');
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Sim, Eliminar Tudo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
