import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getAdminStats,
  updateAdminConfig,
  fetchAdminImageConfig,
  updateAdminImageConfig,
  fetchAdminUsers,
  toggleBlockUser,
  updateUserPlanByAdmin,
  updateUserFeaturesByAdmin,
  updateUserRoleByAdmin,
  resetUserQuotaByAdmin,
  createAdminUser,
  deleteAdminUser,
  fetchVipCodesAdmin,
  createVipCodeAdmin,
  toggleVipCodeActiveAdmin,
  deleteVipCodeAdmin,
  fetchAdminSecuritySessions,
  revokeAdminDeviceSession,
  clearGuestRateLimitsAdmin,
  clearAdminLogs,
  fetchSearchCodesAdmin,
  saveSearchCodeAdmin,
  toggleSearchCodeActiveAdmin,
  deleteSearchCodeAdmin,
  AdminSecuritySessionRecord,
} from '../services/api';
import {
  AdminStats,
  ManagedUser,
  PlanType,
  PlatformAnnouncement,
  PlatformFeatureFlags,
  SearchBarCodeActionType,
  SearchBarCodeRecord,
  ToolId,
  UserFeatures,
  VipCodeRecord,
} from '../types';
import { AdminFeedbackPanel } from '../components/admin/AdminFeedbackPanel';
import { CREATOR_OFFLINE_EMAIL, CREATOR_RECOGNITION_CODE } from '../config/brand';
import { ZUNO_TOOLS } from '../data/tools';
import {
  ShieldCheck,
  Users,
  Activity,
  Cpu,
  Clock,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Database,
  Lock,
  Sparkles,
  Image as ImageIcon,
  MessageSquareText,
  KeyRound,
  Copy,
  Check,
  Plus,
  Search,
  Download,
  Trash2,
  Sliders,
  Megaphone,
  MonitorSmartphone,
  RotateCcw,
  UserPlus,
  ThumbsUp,
  X,
  Power,
  Shield,
  Terminal,
  Edit3,
} from 'lucide-react';

interface AdminPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'overview' | 'users' | 'vip' | 'search_codes' | 'feedback' | 'security';

const DEFAULT_FLAGS: PlatformFeatureFlags = {
  searchGrounding: true,
  imageAnalysis: true,
  voiceDictation: true,
  imageGeneration: true,
  publicSignupEnabled: true,
  guestAccessEnabled: true,
  maintenanceMode: false,
};

const FEATURE_LABELS: Array<{ key: keyof UserFeatures; label: string; desc: string }> = [
  { key: 'imageGeneration', label: 'Geração de Imagens (ZUNO Image)', desc: 'Permite criar e editar imagens no estúdio e chat.' },
  { key: 'webSearch', label: 'Pesquisa Web em Tempo Real', desc: 'Acesso ao módulo ZUNO Search com fontes.' },
  { key: 'visionMultimodal', label: 'Visão Multimodal', desc: 'Análise de imagens, capturas e documentos.' },
  { key: 'ultraModel', label: 'Motor Avançado (Hydrogen)', desc: 'Acesso a raciocínio aprofundado nos pedidos.' },
  { key: 'voiceAudio', label: 'Reconhecimento & Voz', desc: 'Ditado e síntese de respostas em áudio.' },
  { key: 'customMemory', label: 'Memória Personalizada', desc: 'Guardar instruções e memórias entre sessões.' },
];

export const AdminPage: React.FC<AdminPageProps> = ({ onShowToast }) => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // ZUNO AI IMAGE Engine & Quota state
  const [imageLimits, setImageLimits] = useState({ free: 3, premium: 20, pro: 50, ultra: 500 });
  const [selectedImageModel, setSelectedImageModel] = useState('gemini-3.1-flash-lite-image');
  const [totalImages, setTotalImages] = useState(0);
  const [isUpdatingImageConfig, setIsUpdatingImageConfig] = useState(false);

  // Persistent Platform Feature Flags
  const [platformFeatures, setPlatformFeatures] = useState<PlatformFeatureFlags>(DEFAULT_FLAGS);

  // Global Platform Announcement Banner
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement>({
    enabled: false,
    text: '',
    type: 'info',
    updatedAt: 0,
  });

  // Real managed users from server
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<'all' | PlanType>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Create User Drawer / Form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPlan, setNewUserPlan] = useState<PlanType>('free');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Per-User Features Modal
  const [editingFeaturesUser, setEditingFeaturesUser] = useState<ManagedUser | null>(null);
  const [savingUserFeatures, setSavingUserFeatures] = useState(false);

  // VIP Codes state
  const [vipCodes, setVipCodes] = useState<VipCodeRecord[]>([]);
  const [newVipCode, setNewVipCode] = useState('');
  const [newVipPlan, setNewVipPlan] = useState<'premium' | 'pro' | 'ultra'>('pro');
  const [newVipMaxUses, setNewVipMaxUses] = useState(5);
  const [creatingVip, setCreatingVip] = useState(false);
  const [copiedVip, setCopiedVip] = useState<string | null>(null);

  // Security Sessions & Logs
  const [securitySessions, setSecuritySessions] = useState<AdminSecuritySessionRecord[]>([]);
  const [guestRateLimitCount, setGuestRateLimitCount] = useState(0);
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  // Custom Search Bar Codes State
  const [searchCodes, setSearchCodes] = useState<SearchBarCodeRecord[]>([]);
  const [scCode, setScCode] = useState('');
  const [scPurpose, setScPurpose] = useState('');
  const [scDescription, setScDescription] = useState('');
  const [scActionType, setScActionType] = useState<SearchBarCodeActionType>('message');
  const [scTargetPlan, setScTargetPlan] = useState<PlanType>('pro');
  const [scTargetView, setScTargetView] = useState('image');
  const [scTargetToolId, setScTargetToolId] = useState<ToolId>('writer');
  const [scTargetFeatures, setScTargetFeatures] = useState<Partial<UserFeatures>>({
    imageGeneration: true,
    webSearch: true,
    visionMultimodal: true,
    ultraModel: false,
    voiceAudio: true,
    customMemory: true,
  });
  const [scResponseText, setScResponseText] = useState('');
  const [scMaxUses, setScMaxUses] = useState(0);
  const [savingSearchCode, setSavingSearchCode] = useState(false);
  const [copiedSearchCode, setCopiedSearchCode] = useState<string | null>(null);

  const fetchAllAdminData = async () => {
    setIsLoading(true);
    try {
      const [data, usersRes, imgConfig, vipRes, secRes, scRes] = await Promise.all([
        getAdminStats(),
        fetchAdminUsers().catch(() => null),
        fetchAdminImageConfig().catch(() => null),
        fetchVipCodesAdmin().catch(() => null),
        fetchAdminSecuritySessions().catch(() => null),
        fetchSearchCodesAdmin().catch(() => null),
      ]);
      setStats(data);
      setSelectedModel(data.activeModel);
      if (data.featuresEnabled) {
        setPlatformFeatures({ ...DEFAULT_FLAGS, ...data.featuresEnabled });
      }
      if (data.announcement) {
        setAnnouncement(data.announcement);
      }

      if (usersRes && Array.isArray(usersRes.users)) {
        setManagedUsers(usersRes.users);
      }

      if (vipRes && Array.isArray(vipRes.codes)) {
        setVipCodes(vipRes.codes);
      }

      if (scRes && Array.isArray(scRes.codes)) {
        setSearchCodes(scRes.codes);
      }

      if (imgConfig) {
        if (imgConfig.imageLimitsPerPlan) {
          setImageLimits({
            free: Number(imgConfig.imageLimitsPerPlan.free ?? 3),
            premium: Number(imgConfig.imageLimitsPerPlan.premium ?? 20),
            pro: Number(imgConfig.imageLimitsPerPlan.pro ?? 50),
            ultra: Number(imgConfig.imageLimitsPerPlan.ultra ?? 500),
          });
        }
        if (imgConfig.activeImageModel) setSelectedImageModel(imgConfig.activeImageModel);
        if (typeof imgConfig.totalImagesGenerated === 'number') setTotalImages(imgConfig.totalImagesGenerated);
      }

      if (secRes) {
        setSecuritySessions(secRes.sessions);
        setGuestRateLimitCount(secRes.guestRateLimitCount);
      }
    } catch {
      onShowToast('Falha ao carregar métricas administrativas.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllAdminData();
    }
  }, [isAdmin]);

  const handleUpdateModel = async (newModel: string) => {
    setIsUpdatingConfig(true);
    try {
      await updateAdminConfig({ model: newModel });
      setSelectedModel(newModel);
      setStats((prev) => (prev ? { ...prev, activeModel: newModel } : prev));
      onShowToast(`Motor padrão atualizado para ${newModel}.`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao atualizar motor.', 'error');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleTogglePlatformFeature = async (key: keyof PlatformFeatureFlags, label: string) => {
    const nextVal = !platformFeatures[key];
    const nextFlags = { ...platformFeatures, [key]: nextVal };
    setPlatformFeatures(nextFlags);
    try {
      await updateAdminConfig({ features: { [key]: nextVal } });
      onShowToast(`${label} ${nextVal ? 'ativado' : 'desativado'} na plataforma.`, nextVal ? 'success' : 'info');
    } catch (err: any) {
      setPlatformFeatures(platformFeatures);
      onShowToast(err?.message || 'Falha ao guardar configuração.', 'error');
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingConfig(true);
    try {
      const res = await updateAdminConfig({ announcement });
      if (res.announcement) setAnnouncement(res.announcement);
      onShowToast(
        announcement.enabled ? 'Comunicado global publicado no topo da ZUNO AI!' : 'Comunicado global desativado.',
        'success'
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao guardar comunicado.', 'error');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleUpdateImageModel = async (newModel: string) => {
    setIsUpdatingImageConfig(true);
    try {
      await updateAdminImageConfig(undefined, newModel);
      setSelectedImageModel(newModel);
      onShowToast(`Motor de imagens atualizado para ${newModel}.`, 'success');
    } catch {
      onShowToast('Erro ao atualizar motor de imagens.', 'error');
    } finally {
      setIsUpdatingImageConfig(false);
    }
  };

  const handleSaveImageLimits = async () => {
    setIsUpdatingImageConfig(true);
    try {
      await updateAdminImageConfig(imageLimits);
      onShowToast('Limites diários de imagem atualizados e guardados!', 'success');
    } catch {
      onShowToast('Erro ao atualizar quotas de imagem.', 'error');
    } finally {
      setIsUpdatingImageConfig(false);
    }
  };

  const handleChangeUserPlan = async (userId: string, nextPlan: PlanType) => {
    try {
      const res = await updateUserPlanByAdmin(userId, nextPlan);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: nextPlan, features: res.user?.features || u.features } : u))
      );
      onShowToast(`Plano atualizado para ${nextPlan.toUpperCase()}.`, 'success');
    } catch {
      onShowToast('Erro ao alterar plano do utilizador.', 'error');
    }
  };

  const handleToggleUserRole = async (target: ManagedUser) => {
    if (target.email.toLowerCase() === CREATOR_OFFLINE_EMAIL) {
      onShowToast('A conta do fundador mantém sempre o estatuto de Administrador.', 'info');
      return;
    }
    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRoleByAdmin(target.id, nextRole);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u))
      );
      onShowToast(`Função de ${target.name} alterada para ${nextRole.toUpperCase()}.`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao alterar função do utilizador.', 'error');
    }
  };

  const handleResetUserQuota = async (target: ManagedUser) => {
    try {
      const res = await resetUserQuotaByAdmin(target.id);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === target.id ? res.user : u))
      );
      onShowToast(`Quota diária de ${target.name} reiniciada para 0.`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao reiniciar quota.', 'error');
    }
  };

  const handleToggleBlock = async (target: ManagedUser) => {
    const nextBlocked = target.status !== 'blocked';
    try {
      await toggleBlockUser(target.id, nextBlocked);
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === target.id ? { ...u, status: nextBlocked ? 'blocked' : 'active' } : u
        )
      );
      onShowToast(
        `${target.name} ${nextBlocked ? 'bloqueado' : 'desbloqueado'}.`,
        nextBlocked ? 'info' : 'success'
      );
    } catch {
      onShowToast('Erro ao alterar estado do utilizador.', 'error');
    }
  };

  const handleDeleteUser = async (target: ManagedUser) => {
    if (target.email.toLowerCase() === CREATOR_OFFLINE_EMAIL) {
      onShowToast('Não é possível eliminar a conta do fundador.', 'error');
      return;
    }
    try {
      await deleteAdminUser(target.id);
      setManagedUsers((prev) => prev.filter((u) => u.id !== target.id));
      onShowToast(`Conta de ${target.name} removida.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Falha ao eliminar utilizador.', 'error');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      onShowToast('Preenche o nome e o e-mail do utilizador.', 'error');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await createAdminUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        plan: newUserPlan,
        role: newUserRole,
        notes: newUserNotes.trim() || undefined,
      });
      setManagedUsers((prev) => [res.user, ...prev]);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserNotes('');
      setShowCreateUser(false);
      onShowToast(`Utilizador ${res.user.name} provisionado na base de dados!`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao criar utilizador.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveUserFeatures = async () => {
    if (!editingFeaturesUser) return;
    setSavingUserFeatures(true);
    try {
      const res = await updateUserFeaturesByAdmin(editingFeaturesUser.id, editingFeaturesUser.features);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === editingFeaturesUser.id ? res.user : u))
      );
      setEditingFeaturesUser(null);
      onShowToast(`Permissões de ${editingFeaturesUser.name} atualizadas!`, 'success');
    } catch {
      onShowToast('Erro ao guardar permissões individuais.', 'error');
    } finally {
      setSavingUserFeatures(false);
    }
  };

  const handleExportUsersCsv = () => {
    const header = ['ID', 'Nome', 'Email', 'Plano', 'Função', 'Estado', 'Mensagens Hoje', 'Imagens Hoje', 'Última Atividade'];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      u.email,
      u.plan,
      u.role,
      u.status,
      u.messageCount,
      u.imageCount,
      u.lastActive,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zuno-utilizadores.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('Lista de utilizadores exportada em CSV.', 'success');
  };

  const handleCreateVipCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingVip(true);
    try {
      const res = await createVipCodeAdmin({
        code: newVipCode.trim() || undefined,
        plan: newVipPlan,
        maxUses: Number(newVipMaxUses) || 1,
      });
      if (res.code) {
        setVipCodes((prev) => [res.code, ...prev]);
        setNewVipCode('');
        onShowToast(`Código VIP ${res.code.code} criado (${res.code.plan.toUpperCase()})!`, 'success');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao criar código VIP.', 'error');
    } finally {
      setCreatingVip(false);
    }
  };

  const handleToggleVipCode = async (vc: VipCodeRecord) => {
    try {
      const res = await toggleVipCodeActiveAdmin(vc.code, !vc.active);
      setVipCodes((prev) =>
        prev.map((item) => (item.code === vc.code ? res.code || { ...item, active: !vc.active } : item))
      );
      onShowToast(`Código ${vc.code} ${!vc.active ? 'ativado' : 'pausado'}.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao alterar estado do código VIP.', 'error');
    }
  };

  const handleDeleteVipCode = async (code: string) => {
    try {
      await deleteVipCodeAdmin(code);
      setVipCodes((prev) => prev.filter((item) => item.code !== code));
      onShowToast(`Código VIP ${code} eliminado.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao eliminar código VIP.', 'error');
    }
  };

  const resetSearchCodeForm = () => {
    setScCode('');
    setScPurpose('');
    setScDescription('');
    setScActionType('message');
    setScTargetPlan('pro');
    setScTargetView('image');
    setScTargetToolId('writer');
    setScResponseText('');
    setScMaxUses(0);
  };

  const handleSaveSearchCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scCode.trim() || !scPurpose.trim()) {
      onShowToast('Preenche o código e para que serve.', 'error');
      return;
    }
    setSavingSearchCode(true);
    try {
      const res = await saveSearchCodeAdmin({
        code: scCode.trim(),
        purpose: scPurpose.trim(),
        description: scDescription.trim(),
        actionType: scActionType,
        targetPlan: scActionType === 'upgrade_plan' ? scTargetPlan : undefined,
        targetView: scActionType === 'navigate' ? scTargetView : undefined,
        targetToolId: scActionType === 'open_tool' ? scTargetToolId : undefined,
        targetFeatures: scActionType === 'unlock_features' ? scTargetFeatures : undefined,
        responseText:
          scResponseText.trim() ||
          `Código ${scCode.trim().toUpperCase()} ativado: ${scPurpose.trim()}.`,
        maxUses: Number(scMaxUses) || 0,
        active: true,
      });
      if (res.code) {
        setSearchCodes((prev) => [
          res.code,
          ...prev.filter((item) => item.code !== res.code.code),
        ]);
        onShowToast(
          `Código da barra "${res.code.code}" guardado com sucesso! Já pode ser usado na pesquisa.`,
          'success'
        );
        resetSearchCodeForm();
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao guardar código da barra de pesquisa.', 'error');
    } finally {
      setSavingSearchCode(false);
    }
  };

  const handleEditSearchCode = (sc: SearchBarCodeRecord) => {
    setScCode(sc.code);
    setScPurpose(sc.purpose);
    setScDescription(sc.description || '');
    setScActionType(sc.actionType);
    if (sc.targetPlan) setScTargetPlan(sc.targetPlan);
    if (sc.targetView) setScTargetView(sc.targetView);
    if (sc.targetToolId) setScTargetToolId(sc.targetToolId);
    if (sc.targetFeatures) {
      setScTargetFeatures((prev) => ({ ...prev, ...sc.targetFeatures }));
    }
    setScResponseText(sc.responseText || '');
    setScMaxUses(sc.maxUses || 0);
  };

  const handleToggleSearchCode = async (sc: SearchBarCodeRecord) => {
    try {
      const res = await toggleSearchCodeActiveAdmin(sc.code, !sc.active);
      setSearchCodes((prev) =>
        prev.map((item) => (item.code === sc.code ? res.code || { ...item, active: !sc.active } : item))
      );
      onShowToast(`Código ${sc.code} ${!sc.active ? 'ativado' : 'pausado'}.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao atualizar estado do código.', 'error');
    }
  };

  const handleDeleteSearchCode = async (code: string) => {
    try {
      await deleteSearchCodeAdmin(code);
      setSearchCodes((prev) => prev.filter((item) => item.code !== code));
      onShowToast(`Código ${code} eliminado.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao eliminar código.', 'error');
    }
  };

  const handleRevokeDeviceSession = async (sess: AdminSecuritySessionRecord) => {
    try {
      const res = await revokeAdminDeviceSession(sess.uid, sess.deviceId);
      setSecuritySessions(res.sessions);
      onShowToast(`Sessão de ${sess.userName} (${sess.deviceLabel}) encerrada.`, 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao encerrar sessão.', 'error');
    }
  };

  const handleClearGuestLimits = async () => {
    try {
      const res = await clearGuestRateLimitsAdmin();
      setGuestRateLimitCount(0);
      onShowToast(`Limites de visitantes limpos (${res.cleared} registo(s)).`, 'success');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao limpar limites.', 'error');
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearAdminLogs();
      await fetchAllAdminData();
      onShowToast('Registos do servidor reiniciados.', 'info');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao limpar registos.', 'error');
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(stats?.recentLogs || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zuno-server-logs.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredUsers = useMemo(() => {
    return managedUsers.filter((u) => {
      if (userPlanFilter !== 'all' && u.plan !== userPlanFilter) return false;
      if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false;
      if (userSearch.trim()) {
        const q = userSearch.trim().toLowerCase();
        const hit =
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.notes || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [managedUsers, userSearch, userPlanFilter, userStatusFilter]);

  const filteredLogs = useMemo(() => {
    const all = stats?.recentLogs || [];
    if (logLevelFilter === 'all') return all;
    return all.filter((l) => l.level === logLevelFilter);
  }, [stats?.recentLogs, logLevelFilter]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050814] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900/90 p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Acesso Restrito ao Administrador</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Esta área é protegida e requer credenciais com permissão de administrador no servidor da ZUNO AI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-7">
        {/* Header & Multi-Tab Navigation */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-amber-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Consola de Administração ZUNO AI
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Controlo total de motores de IA, módulos globais, comunicados, utilizadores, VIP, feedback e segurança.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center rounded-xl border border-slate-800 bg-slate-900/80 p-1 gap-1">
              {[
                { id: 'overview', label: 'Visão Geral & IA', icon: Cpu },
                { id: 'users', label: `Utilizadores (${managedUsers.length})`, icon: Users },
                { id: 'vip', label: `VIP (${vipCodes.length})`, icon: KeyRound },
                { id: 'search_codes', label: `Códigos da Barra (${searchCodes.length})`, icon: Terminal },
                { id: 'feedback', label: 'Feedback & Melhorias', icon: MessageSquareText },
                { id: 'security', label: 'Segurança & Registos', icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as AdminTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-600/25 text-white border border-blue-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={fetchAllAdminData}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* TAB 1: VISÃO GERAL & IA */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Real-time KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Utilizadores Reais</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-white">
                    {stats?.totalUsers ?? managedUsers.length}
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">
                    {stats?.onlineUsers ?? 0} online agora
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {stats?.activeUsers ?? 0} ativos · {stats?.blockedUsers ?? 0} bloqueado(s)
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Atividade & Conteúdo</span>
                  <Activity className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-white">{stats?.totalApiRequests ?? 0}</span>
                  <span className="text-xs text-blue-400 font-semibold">pedidos API</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {stats?.totalConversations ?? 0} conversas · {stats?.totalImages ?? totalImages} imagens
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Aprovação da App</span>
                  <ThumbsUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-emerald-400">
                    {stats?.feedbackSummary ? `${stats.feedbackSummary.approvalRate}%` : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('feedback')}
                    className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Ver comentários →
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  👍 {stats?.feedbackSummary?.likedCount ?? 0} gostaram · 👎 {stats?.feedbackSummary?.dislikedCount ?? 0} não gostaram
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Infraestrutura</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                        platformFeatures.maintenanceMode ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span
                      className={`text-lg font-bold ${
                        platformFeatures.maintenanceMode ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {platformFeatures.maintenanceMode ? 'Manutenção' : 'Operacional'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {stats ? `${Math.floor(stats.uptimeSeconds / 60)}m` : 'Ativo'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  SQLite: {stats?.databaseStatus === 'connected' ? 'Ligado' : 'Verificar'} · RAM: {stats?.memoryRssMb ?? '—'} MB · {stats?.errorCountLastHour ?? 0} erros/1h
                </p>
              </div>
            </div>

            {/* Motor Configuration & Persistent Feature Toggles */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Model Config Card */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>Motor Principal de Inteligência Artificial</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {(stats?.estimatedTokens ?? 0).toLocaleString()} tokens
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Define o motor ativo em SQLite utilizado pelo ZUNO Chat e ferramentas especializadas.
                </p>

                <div className="space-y-3 pt-1">
                  {[
                    {
                      id: 'gemini-3.1-flash-lite',
                      name: 'ZUNO Flash Lite (gemini-3.1-flash-lite)',
                      desc: 'Velocidade máxima com respostas quase instantâneas e latência mínima.',
                    },
                    {
                      id: 'gemini-4-hydrogen',
                      name: 'ZUNO Hydrogen Pro (gemini-4-hydrogen)',
                      desc: 'Raciocínio aprofundado para análise complexa, investigação e engenharia.',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={isUpdatingConfig}
                      onClick={() => handleUpdateModel(m.id)}
                      className={`w-full text-left p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selectedModel === m.id
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{m.name}</span>
                        {selectedModel === m.id && (
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Persistent Platform Feature Toggles */}
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Controlo Global de Módulos (Persistido no Servidor)</span>
                </div>
                <p className="text-xs text-slate-400">
                  Qualquer alteração é gravada imediatamente na base de dados e aplicada a toda a plataforma.
                </p>

                <div className="space-y-2.5 pt-1 divide-y divide-slate-800/80">
                  {[
                    { key: 'searchGrounding' as const, label: 'Pesquisa Web em Tempo Real (ZUNO Search)', desc: 'Ativa pesquisa factual e fontes verificadas.' },
                    { key: 'imageGeneration' as const, label: 'Estúdio de Imagens (ZUNO Image)', desc: 'Permite gerar e editar imagens no chat e estúdio.' },
                    { key: 'imageAnalysis' as const, label: 'Visão Multimodal (ZUNO Vision)', desc: 'Análise de imagens e documentos enviados.' },
                    { key: 'voiceDictation' as const, label: 'Reconhecimento e Síntese de Voz', desc: 'Microfone e leitura de respostas em áudio.' },
                    { key: 'publicSignupEnabled' as const, label: 'Permitir Novos Registos Públicos (/criar-conta)', desc: 'Bloqueia temporariamente a criação de novas contas se desativado.' },
                    { key: 'guestAccessEnabled' as const, label: 'Modo Visitante (Pesquisa Pública)', desc: 'Permite explorar pesquisa pública sem criar conta.' },
                    { key: 'maintenanceMode' as const, label: 'Modo de Manutenção Programada', desc: 'Restringe a app para manutenção (administradores mantêm acesso).' },
                  ].map((item) => {
                    const enabled = Boolean(platformFeatures[item.key]);
                    const isMaint = item.key === 'maintenanceMode';
                    return (
                      <div key={item.key} className="pt-2.5 flex items-center justify-between gap-4">
                        <div>
                          <p className={`text-xs font-semibold ${isMaint && enabled ? 'text-amber-300' : 'text-white'}`}>
                            {item.label}
                          </p>
                          <p className="text-[11px] text-slate-400">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePlatformFeature(item.key, item.label)}
                          className="cursor-pointer shrink-0"
                          aria-label={item.label}
                        >
                          {enabled ? (
                            <ToggleRight className={`w-7 h-7 ${isMaint ? 'text-amber-400' : 'text-blue-500'}`} />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-slate-600" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Global Platform Announcement Composer */}
            <form
              onSubmit={handleSaveAnnouncement}
              className="p-6 rounded-2xl border border-blue-500/30 bg-slate-900/50 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Megaphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Comunicado Global da Plataforma</h3>
                    <p className="text-xs text-slate-400">
                      Mostra um aviso oficial no topo da ZUNO AI para todos os utilizadores e visitantes.
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={announcement.enabled}
                    onChange={(e) => setAnnouncement((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-slate-700 bg-slate-950 text-blue-600"
                  />
                  <span>Exibir comunicado ativo</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={announcement.type}
                  onChange={(e) =>
                    setAnnouncement((prev) => ({
                      ...prev,
                      type: e.target.value as PlatformAnnouncement['type'],
                    }))
                  }
                  className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-white"
                >
                  <option value="info">Informativo (Azul)</option>
                  <option value="success">Novidade / Lançamento (Verde)</option>
                  <option value="warning">Aviso Importante (Âmbar)</option>
                </select>
                <input
                  type="text"
                  maxLength={280}
                  value={announcement.text}
                  onChange={(e) => setAnnouncement((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder="Ex.: Nova atualização ZUNO AI v2.5 disponível em zunoai.com!"
                  className="sm:col-span-2 rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={isUpdatingConfig}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Guardar Comunicado
                </button>
              </div>
            </form>

            {/* ZUNO AI IMAGE Engine & Quota Management Card */}
            <div className="p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-slate-900/80 via-[#0e1126]/70 to-purple-950/20 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>ZUNO AI IMAGE — Gestão de Quotas & Motor de Imagem</span>
                      <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                        Ativo
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Controla os limites diários por plano (Free, Premium, Pro e Ultra) e o motor visual ativo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <span>Total Gerado:</span>
                  <span className="font-bold text-white">{stats?.totalImages ?? totalImages}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    Limites Diários de Imagens por Plano:
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { key: 'free' as const, label: 'Free', color: 'text-slate-400' },
                      { key: 'premium' as const, label: 'Premium', color: 'text-emerald-400' },
                      { key: 'pro' as const, label: 'Pro', color: 'text-blue-400' },
                      { key: 'ultra' as const, label: 'Ultra', color: 'text-purple-400' },
                    ].map((pl) => (
                      <div key={pl.key} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                        <span className={`text-[10px] font-bold uppercase ${pl.color}`}>{pl.label}</span>
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={imageLimits[pl.key]}
                          onChange={(e) =>
                            setImageLimits((prev) => ({ ...prev, [pl.key]: Number(e.target.value) }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white text-center font-bold"
                        />
                        <span className="text-[9px] text-slate-500 block text-center">img/dia</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveImageLimits}
                    disabled={isUpdatingImageConfig}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    Gravar Quotas de Imagem
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    Motor Visual ZUNO Image:
                  </label>

                  {[
                    {
                      id: 'gemini-3.1-flash-lite-image',
                      name: 'ZUNO Image Flash (gemini-3.1-flash-lite-image)',
                      desc: 'Síntese rápida e consistente para fotografia, neon, anime, 3D e logótipos.',
                    },
                    {
                      id: 'gemini-nano-banana-2.1',
                      name: 'ZUNO Image HD (gemini-nano-banana-2.1)',
                      desc: 'Motor alternativo com suporte a saídas de alta definição 1K e 2K.',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleUpdateImageModel(m.id)}
                      className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedImageModel === m.id
                          ? 'border-purple-500 bg-purple-600/15'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white font-mono">{m.name}</span>
                        {selectedImageModel === m.id && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UTILIZADORES & QUOTAS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">Gestão Avançada de Utilizadores</h3>
                  <p className="text-xs text-slate-400">
                    Pesquisa contas, altera planos, edita funcionalidades individuais, reinicia quotas ou exporta CSV.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateUser((v) => !v)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{showCreateUser ? 'Fechar Formulário' : 'Provisionar Conta'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportUsersCsv}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold text-emerald-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              {showCreateUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="p-4 rounded-xl border border-blue-500/30 bg-slate-950/70 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                >
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Nome</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Nome completo"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">E-mail</label>
                    <input
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="utilizador@dominio.com"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Plano</label>
                    <select
                      value={newUserPlan}
                      onChange={(e) => setNewUserPlan(e.target.value as PlanType)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="pro">Pro</option>
                      <option value="ultra">Ultra</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Função & Notas</label>
                    <div className="flex gap-2">
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                        className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <input
                        type="text"
                        value={newUserNotes}
                        onChange={(e) => setNewUserNotes(e.target.value)}
                        placeholder="Nota..."
                        className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                  >
                    {creatingUser ? 'A guardar...' : 'Criar Conta'}
                  </button>
                </form>
              )}

              {/* Search & Filter Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative sm:col-span-2">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Pesquisar por nome, e-mail ou nota..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value as any)}
                  className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="all">Todos os planos</option>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="pro">Pro</option>
                  <option value="ultra">Ultra</option>
                </select>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value as any)}
                  className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200"
                >
                  <option value="all">Todos os estados</option>
                  <option value="active">Ativos</option>
                  <option value="blocked">Bloqueados</option>
                </select>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-3 font-semibold">Utilizador</th>
                      <th className="py-3 px-3 font-semibold">Função</th>
                      <th className="py-3 px-3 font-semibold">Plano</th>
                      <th className="py-3 px-3 font-semibold">Uso Hoje</th>
                      <th className="py-3 px-3 font-semibold">Estado</th>
                      <th className="py-3 px-3 font-semibold text-right">Controlos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => {
                      const isFounder = u.email.toLowerCase() === CREATOR_OFFLINE_EMAIL;
                      return (
                        <tr key={u.id} className="hover:bg-slate-850/40">
                          <td className="py-3 px-3">
                            <p className="font-semibold text-white">
                              {u.name} {isFounder && <span className="text-[10px] text-amber-400">(Fundador)</span>}
                            </p>
                            <p className="text-slate-400 text-[11px]">{u.email}</p>
                            {u.notes && <p className="text-slate-500 text-[10px] mt-0.5">{u.notes}</p>}
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              disabled={isFounder}
                              onClick={() => handleToggleUserRole(u)}
                              title={isFounder ? 'Fundador protegido' : 'Alternar entre User e Admin'}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer disabled:cursor-default ${
                                u.role === 'admin'
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {u.role.toUpperCase()}
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              aria-label={`Plano de ${u.name}`}
                              value={u.plan}
                              onChange={(e) => handleChangeUserPlan(u.id, e.target.value as PlanType)}
                              className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] font-bold text-blue-300 uppercase"
                            >
                              <option value="free">FREE</option>
                              <option value="premium">PREMIUM</option>
                              <option value="pro">PRO</option>
                              <option value="ultra">ULTRA</option>
                            </select>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <div className="flex items-center gap-2">
                              <span>{u.messageCount} msgs · {u.imageCount} imgs</span>
                              <button
                                type="button"
                                onClick={() => handleResetUserQuota(u)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                                title="Reiniciar quota diária para 0"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`font-semibold ${u.status === 'blocked' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {u.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingFeaturesUser({ ...u, features: { ...u.features } })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                                title="Editar funções permitidas"
                              >
                                <Sliders className="w-3 h-3 text-blue-400" />
                                <span>Funções</span>
                              </button>
                              {!isFounder && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBlock(u)}
                                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                                      u.status === 'blocked'
                                        ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30'
                                        : 'bg-rose-600/20 text-rose-300 hover:bg-rose-600/30'
                                    }`}
                                  >
                                    {u.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 cursor-pointer"
                                    title="Eliminar conta"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CÓDIGOS VIP */}
        {activeTab === 'vip' && (
          <div className="p-6 rounded-2xl border border-purple-500/30 bg-slate-900/50 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Códigos VIP & Acesso Especial</h3>
                  <p className="text-xs text-slate-400">
                    Gera, ativa, pausa ou elimina códigos promocionais para atribuir planos Premium, Pro ou Ultra.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateVipCode} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Código (opcional, automático se vazio):
                </label>
                <input
                  type="text"
                  value={newVipCode}
                  onChange={(e) => setNewVipCode(e.target.value.toUpperCase())}
                  placeholder="ZUNO-PRO-2026"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Plano atribuído:</label>
                <select
                  value={newVipPlan}
                  onChange={(e) => setNewVipPlan(e.target.value as 'premium' | 'pro' | 'ultra')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="premium">Premium</option>
                  <option value="pro">Pro</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Máx. utilizações:</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={newVipMaxUses}
                  onChange={(e) => setNewVipMaxUses(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={creatingVip}
                className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creatingVip ? 'A criar...' : 'Gerar Código VIP'}</span>
              </button>
            </form>

            {vipCodes.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum código VIP criado até ao momento.</p>
            ) : (
              <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                {vipCodes.map((vc) => (
                  <div key={vc.code} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-purple-300">{vc.code}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold uppercase">
                        {vc.plan}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          vc.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {vc.active ? 'ATIVO' : 'PAUSADO'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>
                        Usos: <strong className="text-white">{vc.usedCount} / {vc.maxUses}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(vc.code);
                          setCopiedVip(vc.code);
                          setTimeout(() => setCopiedVip(null), 1500);
                        }}
                        className="flex items-center gap-1 text-xs text-slate-300 hover:text-white cursor-pointer"
                      >
                        {copiedVip === vc.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleVipCode(vc)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        {vc.active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVipCode(vc.code)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 cursor-pointer"
                        title="Eliminar código VIP"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3B: CÓDIGOS PERSONALIZADOS DA BARRA DE PESQUISA */}
        {activeTab === 'search_codes' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-blue-500/30 bg-slate-900/50 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Criador de Códigos da Barra de Pesquisa
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cria códigos personalizados para usar na barra de pesquisa do Chat, Histórico ou Ferramentas. Tu escolhes para que serve cada código e o que ele faz.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-300 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Código do Criador protegido: {CREATOR_RECOGNITION_CODE}</span>
                </span>
              </div>

              <form onSubmit={handleSaveSearchCode} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Código a digitar na barra de pesquisa *
                    </label>
                    <input
                      type="text"
                      value={scCode}
                      onChange={(e) => setScCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="Ex.: ZUNO2026 ou PARCEIRO10"
                      required
                      maxLength={48}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Para que serve este código? *
                    </label>
                    <input
                      type="text"
                      value={scPurpose}
                      onChange={(e) => setScPurpose(e.target.value)}
                      placeholder="Ex.: Desbloquear Plano Pro para equipa internacional"
                      required
                      maxLength={140}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      O que faz quando digitado? *
                    </label>
                    <select
                      value={scActionType}
                      onChange={(e) => setScActionType(e.target.value as SearchBarCodeActionType)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="message">Mostrar Mensagem / Resposta Personalizada</option>
                      <option value="upgrade_plan">Ativar Plano da Conta (Free / Premium / Pro / Ultra)</option>
                      <option value="unlock_features">Desbloquear Funcionalidades Específicas</option>
                      <option value="navigate">Abrir Página da Aplicação</option>
                      <option value="open_tool">Abrir Ferramenta ZUNO Específica</option>
                      <option value="creator_greeting">Saudação Especial / Reconhecimento VIP</option>
                    </select>
                  </div>
                </div>

                {/* Action-specific parameters */}
                {scActionType === 'upgrade_plan' && (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-blue-500/25 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-[11px] font-semibold text-blue-300 block mb-1">
                        Plano atribuído ao utilizador que usar o código:
                      </label>
                      <select
                        value={scTargetPlan}
                        onChange={(e) => setScTargetPlan(e.target.value as PlanType)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="free">Plano Free</option>
                        <option value="premium">Plano Premium</option>
                        <option value="pro">Plano Pro</option>
                        <option value="ultra">Plano Ultra</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Quando alguém com sessão iniciada digitar <strong className="text-white">{scCode || 'ESTE_CODIGO'}</strong> na barra de pesquisa, o plano será atualizado automaticamente na base de dados.
                    </p>
                  </div>
                )}

                {scActionType === 'navigate' && (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-purple-500/25 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-[11px] font-semibold text-purple-300 block mb-1">
                        Página que será aberta ao digitar o código:
                      </label>
                      <select
                        value={scTargetView}
                        onChange={(e) => setScTargetView(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="chat">Chat IA (/chat)</option>
                        <option value="image">Estúdio ZUNO Image (/image)</option>
                        <option value="tools">Ferramentas ZUNO (/tools)</option>
                        <option value="pricing">Planos & Preços (/pricing)</option>
                        <option value="feedback">Avaliações & Feedback (/feedback)</option>
                        <option value="settings">Configurações da Conta (/settings)</option>
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Atalho instantâneo na barra de pesquisa para levar o utilizador diretamente à secção escolhida.
                    </p>
                  </div>
                )}

                {scActionType === 'open_tool' && (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-purple-500/25 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <label className="text-[11px] font-semibold text-purple-300 block mb-1">
                        Ferramenta ZUNO aberta ao usar o código:
                      </label>
                      <select
                        value={scTargetToolId}
                        onChange={(e) => setScTargetToolId(e.target.value as ToolId)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        {ZUNO_TOOLS.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.name} ({tool.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Direciona o utilizador para a ferramenta selecionada com a mensagem configurada.
                    </p>
                  </div>
                )}

                {scActionType === 'unlock_features' && (
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/25 space-y-3">
                    <label className="text-[11px] font-semibold text-emerald-300 block">
                      Seleciona as funcionalidades a desbloquear na conta:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {FEATURE_LABELS.map((feat) => (
                        <label
                          key={feat.key}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(scTargetFeatures[feat.key])}
                            onChange={(e) =>
                              setScTargetFeatures((prev) => ({
                                ...prev,
                                [feat.key]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                          />
                          <span>{feat.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Mensagem / Resposta exibida ao utilizador quando o código for usado *
                    </label>
                    <textarea
                      rows={2}
                      value={scResponseText}
                      onChange={(e) => setScResponseText(e.target.value)}
                      placeholder="Ex.: Seja bem-vindo! O acesso especial ZUNO AI foi ativado na sua conta."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Descrição interna (O que faz)
                      </label>
                      <input
                        type="text"
                        value={scDescription}
                        onChange={(e) => setScDescription(e.target.value)}
                        placeholder="Nota para saberes o que este código faz"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        Limite de usos (0 = Ilimitado)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={scMaxUses}
                        onChange={(e) => setScMaxUses(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {scCode && (
                    <button
                      type="button"
                      onClick={resetSearchCodeForm}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      Limpar Formulário
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingSearchCode}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{savingSearchCode ? 'A guardar...' : 'Guardar Código da Barra'}</span>
                  </button>
                </div>
              </form>

              {/* Saved Search Codes List */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Códigos Criados ({searchCodes.length})
                </h4>

                {searchCodes.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Ainda não criaste códigos personalizados. Usa o formulário acima para criar códigos com a finalidade e ação que escolheres.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                    {searchCodes.map((sc) => {
                      const actionSummary =
                        sc.actionType === 'upgrade_plan'
                          ? `Ativa Plano ${String(sc.targetPlan || 'pro').toUpperCase()}`
                          : sc.actionType === 'unlock_features'
                          ? 'Desbloqueia Funcionalidades'
                          : sc.actionType === 'navigate'
                          ? `Abre /${sc.targetView || 'chat'}`
                          : sc.actionType === 'open_tool'
                          ? `Abre Ferramenta (${sc.targetToolId || 'writer'})`
                          : sc.actionType === 'creator_greeting'
                          ? 'Saudação Especial / VIP'
                          : 'Mensagem Personalizada';

                      return (
                        <div key={sc.code} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-sm text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-0.5 rounded-lg">
                                {sc.code}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-[10px] font-bold">
                                {actionSummary}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sc.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {sc.active ? 'ATIVO' : 'PAUSADO'}
                              </span>
                            </div>
                            <p className="text-white font-semibold">
                              Serve para: <span className="text-slate-200 font-normal">{sc.purpose}</span>
                            </p>
                            {sc.description && (
                              <p className="text-[11px] text-slate-400">O que faz: {sc.description}</p>
                            )}
                            <p className="text-[11px] text-slate-400 truncate">
                              Resposta: <span className="text-slate-300 italic">"{sc.responseText}"</span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0 text-slate-400">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                              Usos:{' '}
                              <strong className="text-white">
                                {sc.usedCount} / {sc.maxUses === 0 ? '∞' : sc.maxUses}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(sc.code);
                                setCopiedSearchCode(sc.code);
                                setTimeout(() => setCopiedSearchCode(null), 1500);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 cursor-pointer"
                            >
                              {copiedSearchCode === sc.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>Copiar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditSearchCode(sc)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSearchCode(sc)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                            >
                              {sc.active ? 'Pausar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSearchCode(sc.code)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-300 cursor-pointer"
                              title="Eliminar código"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FEEDBACK & MELHORIAS */}
        {activeTab === 'feedback' && (
          <AdminFeedbackPanel
            adminUser={user ? { id: user.id, email: user.email, name: user.name } : null}
            onShowToast={onShowToast}
          />
        )}

        {/* TAB 5: SEGURANÇA & REGISTOS */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Active Device Sessions & Rate Limiting */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <MonitorSmartphone className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">Sessões Ativas de Dispositivos</h3>
                    <p className="text-xs text-slate-400">
                      Supervisiona todos os dispositivos ligados e encerra sessões remotamente quando necessário.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                    Visitantes em rate-limit: <strong className="text-white">{guestRateLimitCount}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearGuestLimits}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-xs font-semibold text-amber-300 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar Limites Visitantes</span>
                  </button>
                </div>
              </div>

              {securitySessions.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhuma sessão ativa de dispositivo registada no momento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Utilizador</th>
                        <th className="py-2.5 px-3">Dispositivo & Navegador</th>
                        <th className="py-2.5 px-3">IP</th>
                        <th className="py-2.5 px-3">Última Atividade</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {securitySessions.map((sess) => (
                        <tr key={`${sess.uid}_${sess.deviceId}`}>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-white">{sess.userName}</p>
                            <p className="text-[11px] text-slate-400">{sess.email}</p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {sess.deviceLabel} · {sess.osName} / {sess.browserName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{sess.ipAddress}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(sess.lastActiveAt).toLocaleString('pt-PT')}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRevokeDeviceSession(sess)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-semibold cursor-pointer"
                            >
                              <Power className="w-3 h-3" />
                              <span>Encerrar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Real-time System Logs */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Registo de Eventos e Auditoria do Servidor</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={logLevelFilter}
                    onChange={(e) => setLogLevelFilter(e.target.value as any)}
                    className="rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="all">Nível: Todos</option>
                    <option value="info">Info</option>
                    <option value="warn">Avisos</option>
                    <option value="error">Erros</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleExportLogs}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-xs text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpar Registos</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs space-y-2 max-h-80 overflow-y-auto">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-slate-300">
                      <span className="text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 ${
                          log.level === 'error'
                            ? 'bg-rose-500/20 text-rose-400'
                            : log.level === 'warn'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-400 shrink-0 font-semibold">[{log.endpoint || '/api'}]</span>
                      <span className="text-slate-200 break-words">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">Sem registos para este filtro.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-User Features Modal */}
      {editingFeaturesUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-[#0b1120] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Permissões de {editingFeaturesUser.name}</h3>
                <p className="text-[11px] text-slate-400">{editingFeaturesUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFeaturesUser(null)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {FEATURE_LABELS.map((feat) => {
                const checked = Boolean(editingFeaturesUser.features[feat.key]);
                return (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white">{feat.label}</p>
                      <p className="text-[11px] text-slate-400">{feat.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingFeaturesUser((prev) =>
                          prev
                            ? {
                                ...prev,
                                features: { ...prev.features, [feat.key]: !prev.features[feat.key] },
                              }
                            : null
                        )
                      }
                      className="cursor-pointer"
                    >
                      {checked ? (
                        <ToggleRight className="w-7 h-7 text-blue-500" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-slate-600" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingFeaturesUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingUserFeatures}
                onClick={handleSaveUserFeatures}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {savingUserFeatures ? 'A guardar...' : 'Guardar Permissões'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
