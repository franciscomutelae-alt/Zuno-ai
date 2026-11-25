import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const candidates =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language || 'en'];

  for (const raw of candidates) {
    const code = String(raw || '').toLowerCase().trim();
    if (!code) continue;
    if (code.startsWith('pt')) return 'pt';
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('fr')) return 'fr';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

const translations: Record<Language, Record<string, string>> = {
  pt: {
    // Brand
    'brand.name': 'ZUNO AI',
    'brand.slogan': 'A tua inteligência. Sem limites.',
    'brand.hero_title': 'A inteligência que acompanha o teu mundo.',
    'brand.hero_subtitle':
      'Plataforma internacional de inteligência artificial em tempo real, ferramentas especializadas e estúdio visual de alta definição para qualquer país e dispositivo.',

    // Nav
    'nav.home': 'Início',
    'nav.chat': 'Chat IA',
    'nav.tools': 'Ferramentas',
    'nav.pricing': 'Planos',
    'nav.admin': 'Painel Admin',
    'nav.settings': 'Definições',
    'nav.login': 'Entrar',
    'nav.signup': 'Criar conta',
    'nav.logout': 'Terminar sessão',
    'nav.new_chat': 'Nova conversa',

    // Welcome Auth Screen
    'welcome.title': 'Bem-vindo à ZUNO AI',
    'welcome.subtitle':
      'Plataforma internacional acessível em todo o mundo. Cria conta ou inicia sessão com Google para sincronizares conversas, imagens e ferramentas em qualquer dispositivo.',
    'welcome.known_accounts': 'Contas usadas neste dispositivo (verificação Google):',
    'welcome.continue_arrow': 'Continuar →',
    'welcome.google_connecting': 'A ligar ao Google...',
    'welcome.google_continue': 'Continuar com Google',
    'welcome.create_account': 'Criar conta com Google',
    'welcome.sign_in': 'Iniciar sessão com Google',
    'welcome.keep_signed_in': 'Manter sessão iniciada neste dispositivo',
    'welcome.guest_divider': 'ou acesso público limitado',
    'welcome.guest_button': 'Continuar como visitante (apenas pesquisa pública)',
    'welcome.account_box_title': 'Com conta ZUNO AI',
    'welcome.account_box_desc':
      'Sincronização internacional entre dispositivos, ZUNO Image, 10 ferramentas, favoritos e códigos.',
    'welcome.guest_box_title': 'Modo Visitante',
    'welcome.guest_box_desc':
      'Apenas pesquisa pública e consulta de informações dentro dos limites definidos.',
    'welcome.footer_badge':
      'Plataforma oficial ZUNO AI · https://zunoai.com · Acesso Internacional',
    'welcome.international_pill': 'Disponível Mundialmente • PT · EN · ES · FR',

    // Auth Modal
    'auth.title_login': 'Iniciar sessão com Google',
    'auth.title_signup': 'Criar conta com Google',
    'auth.title_switch': 'Trocar de conta Google',
    'auth.desc_login': 'Acede ao teu histórico sincronizado, favoritos e ferramentas em qualquer país.',
    'auth.desc_signup': 'Cria a tua conta oficial ZUNO AI com Google em segundos e com máxima segurança.',
    'auth.desc_switch': 'Escolhe outra conta Google para alternar com isolamento total de dados.',
    'auth.saved_accounts': 'Contas Google guardadas neste dispositivo:',
    'auth.active_badge': 'Ativa',
    'auth.use_badge': 'Usar',
    'auth.google_btn_login': 'Iniciar sessão com Google',
    'auth.google_btn_signup': 'Criar conta com Google',
    'auth.google_btn_switch': 'Entrar com outra conta Google',
    'auth.google_note':
      'Autenticação direta via Google para criar conta e iniciar sessão com segurança e sincronização global entre telemóveis, tablets e computadores.',
    'auth.signup_disabled':
      'O registo de novas contas públicas está temporariamente suspenso pelo administrador. Se já tens conta, inicia sessão normalmente.',
    'auth.no_account': 'Ainda não tens conta?',
    'auth.has_account': 'Já tens conta?',
    'auth.switch_action': 'Trocar de conta Google',
    'auth.create_new': 'Criar nova conta com Google',
    'auth.toast_login_ok': 'Sessão iniciada com Google com sucesso!',
    'auth.toast_signup_ok': 'Conta ZUNO AI criada com Google com sucesso!',
    'auth.toast_switch_ok': 'Conta alterada com sucesso. Dados isolados carregados.',
    'auth.toast_google_err': 'Não foi possível autenticar com Google.',

    // Restriction Modal
    'restriction.badge': 'Acesso Exclusivo de Conta',
    'restriction.default_title': 'Funcionalidade Reservada',
    'restriction.guest_hint':
      'Como visitante podes continuar a utilizar a pesquisa pública em todo o mundo dentro dos limites definidos.',
    'restriction.signup_google': 'Criar conta com Google',
    'restriction.login_google': 'Iniciar sessão com Google',

    // Chat
    'chat.input_placeholder': 'Pergunta algo ao ZUNO AI... (Shift+Enter para nova linha)',
    'chat.send': 'Enviar',
    'chat.stop': 'Interromper',
    'chat.regenerate': 'Regenerar resposta',
    'chat.copy': 'Copiar resposta',
    'chat.copied': 'Copiado para a área de transferência!',
    'chat.attach': 'Anexar imagem ou documento',
    'chat.voice_start': 'Falar por voz',
    'chat.voice_stop': 'Parar gravação',
    'chat.voice_listening': 'A ouvir a tua voz...',
    'chat.search_history': 'Pesquisar conversas ou código...',
    'chat.no_conversations': 'Nenhuma conversa encontrada',
    'chat.rename': 'Renomear',
    'chat.delete': 'Eliminar',
    'chat.thinking': 'O ZUNO AI está a pensar...',
    'chat.limit_notice': 'Mensagens hoje:',
    'chat.limit_upgrade': 'Atualizar para ilimitado',

    // Landing sections
    'landing.get_started': 'Começar agora gratuitamente',
    'landing.explore_tools': 'Explorar Ferramentas',
    'landing.stats_users': 'Utilizadores Ativos',
    'landing.stats_messages': 'Mensagens Processadas',
    'landing.stats_latency': 'Latência Média',
    'landing.stats_global': 'Disponibilidade Internacional',
    'landing.tools_title': 'Ferramentas Inteligentes ZUNO AI',
    'landing.tools_subtitle':
      'Uma suite completa concebida para elevar a tua produtividade, estudo, programação e criatividade.',
    'landing.advantages_title': 'Porquê escolher o ZUNO AI?',
    'landing.faq_title': 'Perguntas Frequentes',
    'landing.cta_title': 'Pronto para ultrapassar qualquer limite?',
    'landing.cta_subtitle': 'Junta-te a utilizadores, estudantes e criadores em todo o mundo.',
    'landing.international_badge': 'Plataforma Internacional • Acesso Global Multi-Dispositivo',

    // Plans
    'plan.free': 'Plano Free',
    'plan.pro': 'Plano Pro',
    'plan.ultra': 'Plano Ultra',
    'plan.current': 'Plano Atual',
    'plan.upgrade': 'Subscrever',
    'plan.billing_monthly': 'Faturação Mensal',
    'plan.billing_yearly': 'Faturação Anual (2 meses grátis)',

    // Footer & 404
    'footer.tagline':
      'Plataforma internacional independente de inteligência artificial de alta performance com arquitetura segura e suporte multilíngue global.',
    'footer.status_ok': 'Sistemas Globais Online',
    'footer.worldwide': 'Para utilizadores em todos os países',
    'notfound.badge': 'Erro 404 • Rota não encontrada',
    'notfound.title': 'Página não encontrada na ZUNO AI',
    'notfound.home': 'Ir para a Página Inicial',
    'notfound.chat': 'Abrir Pesquisa / Chat',
    'notfound.back': 'Voltar à página anterior',

    // Common
    'common.save': 'Guardar alterações',
    'common.cancel': 'Cancelar',
    'common.close': 'Fechar',
    'common.loading': 'A carregar...',
    'common.error': 'Ocorreu um erro',
    'common.success': 'Operação concluída com sucesso',
  },
  en: {
    'brand.name': 'ZUNO AI',
    'brand.slogan': 'Your intelligence. Without limits.',
    'brand.hero_title': 'Intelligence that keeps pace with your world.',
    'brand.hero_subtitle':
      'International artificial intelligence platform with real-time chat, specialized tools, and high-definition visual studio built for every country and device.',

    'nav.home': 'Home',
    'nav.chat': 'AI Chat',
    'nav.tools': 'Tools',
    'nav.pricing': 'Pricing',
    'nav.admin': 'Admin Panel',
    'nav.settings': 'Settings',
    'nav.login': 'Sign In',
    'nav.signup': 'Sign Up',
    'nav.logout': 'Sign Out',
    'nav.new_chat': 'New chat',

    'welcome.title': 'Welcome to ZUNO AI',
    'welcome.subtitle':
      'International AI platform accessible worldwide. Sign up or sign in with Google to sync your conversations, generated images, and tools across any device.',
    'welcome.known_accounts': 'Accounts used on this device (Google verification):',
    'welcome.continue_arrow': 'Continue →',
    'welcome.google_connecting': 'Connecting to Google...',
    'welcome.google_continue': 'Continue with Google',
    'welcome.create_account': 'Sign up with Google',
    'welcome.sign_in': 'Sign in with Google',
    'welcome.keep_signed_in': 'Keep me signed in on this device',
    'welcome.guest_divider': 'or limited public access',
    'welcome.guest_button': 'Continue as guest (public search only)',
    'welcome.account_box_title': 'With a ZUNO AI Account',
    'welcome.account_box_desc':
      'Cross-device international sync, ZUNO Image studio, 10 tools, favorites, and custom codes.',
    'welcome.guest_box_title': 'Guest Mode',
    'welcome.guest_box_desc':
      'Public search and general information queries within public limits.',
    'welcome.footer_badge':
      'Official ZUNO AI Platform · https://zunoai.com · International Access',
    'welcome.international_pill': 'Available Worldwide • PT · EN · ES · FR',

    'auth.title_login': 'Sign in with Google',
    'auth.title_signup': 'Create account with Google',
    'auth.title_switch': 'Switch Google account',
    'auth.desc_login': 'Access your synced history, favorites, and tools from any country.',
    'auth.desc_signup': 'Create your official ZUNO AI account with Google in seconds.',
    'auth.desc_switch': 'Choose another Google account with strict per-user data isolation.',
    'auth.saved_accounts': 'Google accounts saved on this device:',
    'auth.active_badge': 'Active',
    'auth.use_badge': 'Use',
    'auth.google_btn_login': 'Sign in with Google',
    'auth.google_btn_signup': 'Create account with Google',
    'auth.google_btn_switch': 'Sign in with another Google account',
    'auth.google_note':
      'Direct Google authentication for sign-up and sign-in with global sync across phones, tablets, and desktops.',
    'auth.signup_disabled':
      'New public registrations are temporarily paused by the administrator. Existing accounts can sign in normally.',
    'auth.no_account': "Don't have an account yet?",
    'auth.has_account': 'Already have an account?',
    'auth.switch_action': 'Switch Google account',
    'auth.create_new': 'Create new account with Google',
    'auth.toast_login_ok': 'Signed in with Google successfully!',
    'auth.toast_signup_ok': 'ZUNO AI account created with Google!',
    'auth.toast_switch_ok': 'Account switched successfully.',
    'auth.toast_google_err': 'Could not authenticate with Google.',

    'restriction.badge': 'Account Exclusive Access',
    'restriction.default_title': 'Reserved Feature',
    'restriction.guest_hint':
      'As a guest you can keep using public search worldwide within public limits.',
    'restriction.signup_google': 'Sign up with Google',
    'restriction.login_google': 'Sign in with Google',

    'chat.input_placeholder': 'Ask ZUNO AI anything... (Shift+Enter for newline)',
    'chat.send': 'Send',
    'chat.stop': 'Stop',
    'chat.regenerate': 'Regenerate response',
    'chat.copy': 'Copy response',
    'chat.copied': 'Copied to clipboard!',
    'chat.attach': 'Attach image or doc',
    'chat.voice_start': 'Voice input',
    'chat.voice_stop': 'Stop listening',
    'chat.voice_listening': 'Listening to your voice...',
    'chat.search_history': 'Search conversations or code...',
    'chat.no_conversations': 'No conversations found',
    'chat.rename': 'Rename',
    'chat.delete': 'Delete',
    'chat.thinking': 'ZUNO AI is thinking...',
    'chat.limit_notice': 'Messages today:',
    'chat.limit_upgrade': 'Upgrade for unlimited',

    'landing.get_started': 'Get Started Free',
    'landing.explore_tools': 'Explore Tools',
    'landing.stats_users': 'Active Users',
    'landing.stats_messages': 'Messages Handled',
    'landing.stats_latency': 'Average Latency',
    'landing.stats_global': 'Global Availability',
    'landing.tools_title': 'ZUNO AI Smart Tools',
    'landing.tools_subtitle':
      'A complete suite designed to supercharge your writing, study, coding, and creative vision.',
    'landing.advantages_title': 'Why Choose ZUNO AI?',
    'landing.faq_title': 'Frequently Asked Questions',
    'landing.cta_title': 'Ready to surpass every limit?',
    'landing.cta_subtitle': 'Join thousands of professionals, researchers, and creators worldwide.',
    'landing.international_badge': 'International Platform • Global Multi-Device Access',

    'plan.free': 'Free Plan',
    'plan.pro': 'Pro Plan',
    'plan.ultra': 'Ultra Plan',
    'plan.current': 'Current Plan',
    'plan.upgrade': 'Subscribe',
    'plan.billing_monthly': 'Monthly Billing',
    'plan.billing_yearly': 'Yearly Billing (2 months free)',

    'footer.tagline':
      'Independent international artificial intelligence platform featuring secure architecture and global multilingual support.',
    'footer.status_ok': 'Global Systems Operational',
    'footer.worldwide': 'Built for users in every country',
    'notfound.badge': 'Error 404 • Route not found',
    'notfound.title': 'Page not found on ZUNO AI',
    'notfound.home': 'Go to Home Page',
    'notfound.chat': 'Open Search / Chat',
    'notfound.back': 'Go back',

    'common.save': 'Save changes',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.success': 'Operation completed successfully',
  },
  es: {
    'brand.name': 'ZUNO AI',
    'brand.slogan': 'Tu inteligencia. Sin límites.',
    'brand.hero_title': 'La inteligencia que acompaña tu mundo.',
    'brand.hero_subtitle':
      'Plataforma internacional de inteligencia artificial en tiempo real, herramientas especializadas y estudio visual para cualquier país y dispositivo.',

    'nav.home': 'Inicio',
    'nav.chat': 'Chat IA',
    'nav.tools': 'Herramientas',
    'nav.pricing': 'Planes',
    'nav.admin': 'Panel Admin',
    'nav.settings': 'Ajustes',
    'nav.login': 'Iniciar sesión',
    'nav.signup': 'Crear cuenta',
    'nav.logout': 'Cerrar sesión',
    'nav.new_chat': 'Nueva conversación',

    'welcome.title': 'Bienvenido a ZUNO AI',
    'welcome.subtitle':
      'Plataforma internacional accesible en todo el mundo. Crea una cuenta o inicia sesión con Google para sincronizar conversaciones, imágenes y herramientas en cualquier dispositivo.',
    'welcome.known_accounts': 'Cuentas usadas en este dispositivo (verificación Google):',
    'welcome.continue_arrow': 'Continuar →',
    'welcome.google_connecting': 'Conectando con Google...',
    'welcome.google_continue': 'Continuar con Google',
    'welcome.create_account': 'Crear cuenta con Google',
    'welcome.sign_in': 'Iniciar sesión con Google',
    'welcome.keep_signed_in': 'Mantener sesión iniciada en este dispositivo',
    'welcome.guest_divider': 'o acceso público limitado',
    'welcome.guest_button': 'Continuar como visitante (solo búsqueda pública)',
    'welcome.account_box_title': 'Con cuenta ZUNO AI',
    'welcome.account_box_desc':
      'Sincronización internacional entre dispositivos, ZUNO Image, 10 herramientas y códigos.',
    'welcome.guest_box_title': 'Modo Visitante',
    'welcome.guest_box_desc':
      'Solo búsqueda pública y consultas dentro de los límites establecidos.',
    'welcome.footer_badge':
      'Plataforma oficial ZUNO AI · https://zunoai.com · Acceso Internacional',
    'welcome.international_pill': 'Disponible Mundialmente • PT · EN · ES · FR',

    'auth.title_login': 'Iniciar sesión con Google',
    'auth.title_signup': 'Crear cuenta con Google',
    'auth.title_switch': 'Cambiar cuenta Google',
    'auth.desc_login': 'Accede a tu historial sincronizado, favoritos y herramientas desde cualquier país.',
    'auth.desc_signup': 'Crea tu cuenta oficial de ZUNO AI con Google en segundos.',
    'auth.desc_switch': 'Elige otra cuenta Google con aislamiento total de datos.',
    'auth.saved_accounts': 'Cuentas Google guardadas en este dispositivo:',
    'auth.active_badge': 'Activa',
    'auth.use_badge': 'Usar',
    'auth.google_btn_login': 'Iniciar sesión con Google',
    'auth.google_btn_signup': 'Crear cuenta con Google',
    'auth.google_btn_switch': 'Entrar con otra cuenta Google',
    'auth.google_note':
      'Autenticación directa con Google para crear cuenta e iniciar sesión de forma segura y sincronizada entre móviles, tablets y ordenadores.',
    'auth.signup_disabled':
      'El registro de nuevas cuentas públicas está temporalmente pausado por el administrador.',
    'auth.no_account': '¿Aún no tienes cuenta?',
    'auth.has_account': '¿Ya tienes cuenta?',
    'auth.switch_action': 'Cambiar cuenta Google',
    'auth.create_new': 'Crear nueva cuenta con Google',
    'auth.toast_login_ok': '¡Sesión iniciada con Google!',
    'auth.toast_signup_ok': '¡Cuenta ZUNO AI creada con Google!',
    'auth.toast_switch_ok': 'Cuenta cambiada correctamente.',
    'auth.toast_google_err': 'No se pudo autenticar con Google.',

    'restriction.badge': 'Acceso Exclusivo de Cuenta',
    'restriction.default_title': 'Funcionalidad Reservada',
    'restriction.guest_hint':
      'Como visitante puedes seguir usando la búsqueda pública en todo el mundo dentro de los límites.',
    'restriction.signup_google': 'Crear cuenta con Google',
    'restriction.login_google': 'Iniciar sesión con Google',

    'chat.input_placeholder': 'Pregunta lo que sea a ZUNO AI...',
    'chat.send': 'Enviar',
    'chat.stop': 'Detener',
    'chat.regenerate': 'Regenerar respuesta',
    'chat.copy': 'Copiar respuesta',
    'chat.copied': '¡Copiado al portapapeles!',
    'chat.attach': 'Adjuntar imagen o archivo',
    'chat.voice_start': 'Entrada por voz',
    'chat.voice_stop': 'Detener voz',
    'chat.voice_listening': 'Escuchando tu voz...',
    'chat.search_history': 'Buscar conversaciones o código...',
    'chat.no_conversations': 'No se encontraron conversaciones',
    'chat.rename': 'Renombrar',
    'chat.delete': 'Eliminar',
    'chat.thinking': 'ZUNO AI está pensando...',
    'chat.limit_notice': 'Mensajes hoy:',
    'chat.limit_upgrade': 'Mejorar a ilimitado',

    'landing.get_started': 'Empezar gratis',
    'landing.explore_tools': 'Explorar Herramientas',
    'landing.stats_users': 'Usuarios Activos',
    'landing.stats_messages': 'Mensajes Procesados',
    'landing.stats_latency': 'Latencia Media',
    'landing.stats_global': 'Disponibilidad Global',
    'landing.tools_title': 'Herramientas Inteligentes ZUNO AI',
    'landing.tools_subtitle':
      'Una suite completa diseñada para potenciar tu productividad, estudio y creatividad.',
    'landing.advantages_title': '¿Por qué elegir ZUNO AI?',
    'landing.faq_title': 'Preguntas Frecuentes',
    'landing.cta_title': '¿Listo para superar cualquier límite?',
    'landing.cta_subtitle': 'Únete a miles de profesionales y creadores en todo el mundo.',
    'landing.international_badge': 'Plataforma Internacional • Acceso Global Multi-Dispositivo',

    'plan.free': 'Plan Free',
    'plan.pro': 'Plan Pro',
    'plan.ultra': 'Plan Ultra',
    'plan.current': 'Plan Actual',
    'plan.upgrade': 'Suscribirme',
    'plan.billing_monthly': 'Facturación Mensual',
    'plan.billing_yearly': 'Facturación Anual (2 meses gratis)',

    'footer.tagline':
      'Plataforma internacional independiente de inteligencia artificial con arquitectura segura y soporte multilingüe global.',
    'footer.status_ok': 'Sistemas Globales Operativos',
    'footer.worldwide': 'Para usuarios en todos los países',
    'notfound.badge': 'Error 404 • Ruta no encontrada',
    'notfound.title': 'Página no encontrada en ZUNO AI',
    'notfound.home': 'Ir al Inicio',
    'notfound.chat': 'Abrir Búsqueda / Chat',
    'notfound.back': 'Volver atrás',

    'common.save': 'Guardar cambios',
    'common.cancel': 'Cancelar',
    'common.close': 'Cerrar',
    'common.loading': 'Cargando...',
    'common.error': 'Ocurrió un error',
    'common.success': 'Operación completada con éxito',
  },
  fr: {
    'brand.name': 'ZUNO AI',
    'brand.slogan': 'Votre intelligence. Sans limites.',
    'brand.hero_title': "L'intelligence qui accompagne votre monde.",
    'brand.hero_subtitle':
      "Plateforme internationale d'intelligence artificielle en temps réel, outils spécialisés et studio visuel conçus pour tous les pays et appareils.",

    'nav.home': 'Accueil',
    'nav.chat': 'Chat IA',
    'nav.tools': 'Outils',
    'nav.pricing': 'Tarifs',
    'nav.admin': 'Panneau Admin',
    'nav.settings': 'Paramètres',
    'nav.login': 'Connexion',
    'nav.signup': 'Inscription',
    'nav.logout': 'Déconnexion',
    'nav.new_chat': 'Nouvelle conversation',

    'welcome.title': 'Bienvenue sur ZUNO AI',
    'welcome.subtitle':
      'Plateforme internationale accessible dans le monde entier. Créez un compte ou connectez-vous avec Google pour synchroniser vos échanges, images et outils sur tout appareil.',
    'welcome.known_accounts': 'Comptes utilisés sur cet appareil (vérification Google) :',
    'welcome.continue_arrow': 'Continuer →',
    'welcome.google_connecting': 'Connexion à Google...',
    'welcome.google_continue': 'Continuer avec Google',
    'welcome.create_account': 'Créer un compte avec Google',
    'welcome.sign_in': 'Se connecter avec Google',
    'welcome.keep_signed_in': 'Rester connecté sur cet appareil',
    'welcome.guest_divider': 'ou accès public limité',
    'welcome.guest_button': 'Continuer en tant que visiteur (recherche publique)',
    'welcome.account_box_title': 'Avec un compte ZUNO AI',
    'welcome.account_box_desc':
      'Synchronisation internationale, ZUNO Image, 10 outils, favoris et codes personnalisés.',
    'welcome.guest_box_title': 'Mode Visiteur',
    'welcome.guest_box_desc':
      'Recherche publique et consultation dans les limites définies.',
    'welcome.footer_badge':
      'Plateforme officielle ZUNO AI · https://zunoai.com · Accès International',
    'welcome.international_pill': 'Disponible dans le monde entier • PT · EN · ES · FR',

    'auth.title_login': 'Connexion avec Google',
    'auth.title_signup': 'Créer un compte avec Google',
    'auth.title_switch': 'Changer de compte Google',
    'auth.desc_login': 'Accédez à votre historique synchronisé et vos outils depuis tout pays.',
    'auth.desc_signup': 'Créez votre compte officiel ZUNO AI avec Google en quelques secondes.',
    'auth.desc_switch': 'Choisissez un autre compte Google avec isolation complète des données.',
    'auth.saved_accounts': 'Comptes Google enregistrés sur cet appareil :',
    'auth.active_badge': 'Actif',
    'auth.use_badge': 'Utiliser',
    'auth.google_btn_login': 'Se connecter avec Google',
    'auth.google_btn_signup': 'Créer un compte avec Google',
    'auth.google_btn_switch': 'Se connecter avec un autre compte Google',
    'auth.google_note':
      'Authentification directe par Google pour créer un compte et se connecter en toute sécurité sur mobile, tablette et ordinateur.',
    'auth.signup_disabled':
      "L'inscription de nouveaux comptes publics est temporairement suspendue par l'administrateur.",
    'auth.no_account': 'Pas encore de compte ?',
    'auth.has_account': 'Vous avez déjà un compte ?',
    'auth.switch_action': 'Changer de compte Google',
    'auth.create_new': 'Créer un nouveau compte avec Google',
    'auth.toast_login_ok': 'Connexion avec Google réussie !',
    'auth.toast_signup_ok': 'Compte ZUNO AI créé avec Google !',
    'auth.toast_switch_ok': 'Compte changé avec succès.',
    'auth.toast_google_err': 'Impossible de se connecter avec Google.',

    'restriction.badge': 'Accès Réservé au Compte',
    'restriction.default_title': 'Fonctionnalité Réservée',
    'restriction.guest_hint':
      'En tant que visiteur, vous pouvez continuer à utiliser la recherche publique dans le monde entier.',
    'restriction.signup_google': 'Créer un compte avec Google',
    'restriction.login_google': 'Se connecter avec Google',

    'chat.input_placeholder': 'Posez une question à ZUNO AI...',
    'chat.send': 'Envoyer',
    'chat.stop': 'Arrêter',
    'chat.regenerate': 'Régénérer la réponse',
    'chat.copy': 'Copier la réponse',
    'chat.copied': 'Copié dans le presse-papier !',
    'chat.attach': 'Joindre une image ou un doc',
    'chat.voice_start': 'Entrée vocale',
    'chat.voice_stop': 'Arrêter le micro',
    'chat.voice_listening': 'Écoute en cours...',
    'chat.search_history': 'Rechercher conversations ou code...',
    'chat.no_conversations': 'Aucune conversation trouvée',
    'chat.rename': 'Renommer',
    'chat.delete': 'Supprimer',
    'chat.thinking': 'ZUNO AI réfléchit...',
    'chat.limit_notice': "Messages aujourd'hui :",
    'chat.limit_upgrade': 'Passer à illimité',

    'landing.get_started': 'Commencer gratuitement',
    'landing.explore_tools': 'Explorer les Outils',
    'landing.stats_users': 'Utilisateurs Actifs',
    'landing.stats_messages': 'Messages Traités',
    'landing.stats_latency': 'Latence Moyenne',
    'landing.stats_global': 'Disponibilité Mondiale',
    'landing.tools_title': 'Outils Intelligents ZUNO AI',
    'landing.tools_subtitle':
      'Une suite complète conçue pour démultiplier votre créativité et productivité.',
    'landing.advantages_title': 'Pourquoi choisir ZUNO AI ?',
    'landing.faq_title': 'Foire Aux Questions',
    'landing.cta_title': 'Prêt à repousser toutes les limites ?',
    'landing.cta_subtitle': 'Rejoignez des milliers de professionnels et créateurs à travers le monde.',
    'landing.international_badge': 'Plateforme Internationale • Accès Multi-Appareils',

    'plan.free': 'Plan Free',
    'plan.pro': 'Plan Pro',
    'plan.ultra': 'Plan Ultra',
    'plan.current': 'Plan Actuel',
    'plan.upgrade': "S'abonner",
    'plan.billing_monthly': 'Facturation Mensuelle',
    'plan.billing_yearly': 'Facturation Annuelle (2 mois offerts)',

    'footer.tagline':
      "Plateforme internationale indépendante d'intelligence artificielle avec architecture sécurisée et support multilingue mondial.",
    'footer.status_ok': 'Systèmes Mondiaux Opérationnels',
    'footer.worldwide': 'Conçu pour tous les pays',
    'notfound.badge': 'Erreur 404 • Route introuvable',
    'notfound.title': 'Page introuvable sur ZUNO AI',
    'notfound.home': "Aller à l'accueil",
    'notfound.chat': 'Ouvrir Recherche / Chat',
    'notfound.back': 'Retour',

    'common.save': 'Enregistrer les modifications',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur est survenue',
    'common.success': 'Opération réussie',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'pt',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('zuno_language');
      if (saved && ['pt', 'en', 'es', 'fr'].includes(saved)) {
        return saved as Language;
      }
    } catch {}
    return detectBrowserLanguage();
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('zuno_language', lang);
    } catch {}
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations.en[key] || translations.pt[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
