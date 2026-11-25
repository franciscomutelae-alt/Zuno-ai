export const BRAND_CONFIG = {
  name: 'ZUNO AI',
  shortName: 'ZUNO AI',
  sloganEn: 'Intelligence Without Limits',
  sloganPt: 'A tua inteligência. Sem limites.',
  primaryDomain: 'https://zunoai.com',
  wwwDomain: 'https://www.zunoai.com',
  primaryHost: 'zunoai.com',
  supportEmail: 'suporte@zunoai.com',
  founderName: 'Francisco Mutela Emanuel',
} as const;

export const CREATOR_OFFLINE_EMAIL = 'franciscomutelae@gmail.com';
export const CREATOR_RECOGNITION_CODE = 'Adonai20010';
export const CREATOR_WELCOME_MESSAGE =
  'Seja bem-vindo, Francisco Mutela Emanuel! Identidade de criador da plataforma ZUNO AI reconhecida com sucesso.';

export function isCreatorOfflineAccount(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  return email.trim().toLowerCase() === CREATOR_OFFLINE_EMAIL;
}

export function isCreatorRecognitionQuery(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.trim().toLowerCase() === CREATOR_RECOGNITION_CODE.toLowerCase();
}

export function getPublicAppUrl(): string {
  const configured = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL;
  if (typeof configured === 'string' && configured.trim()) {
    return configured.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname.toLowerCase();
    if (host === 'zunoai.com' || host === 'www.zunoai.com') {
      return BRAND_CONFIG.primaryDomain;
    }
    const isPreviewOrDevHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.run.app') ||
      host.includes('ais-dev') ||
      host.includes('ais-pre');
    if (!isPreviewOrDevHost) {
      return window.location.origin.replace(/\/+$/, '');
    }
  }
  return BRAND_CONFIG.primaryDomain;
}

export function buildPublicUrl(path = '/'): string {
  const base = getPublicAppUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export const KNOWN_APP_ROUTES = [
  '/',
  '/landing',
  '/chat',
  '/tools',
  '/image',
  '/pricing',
  '/settings',
  '/feedback',
  '/admin',
  '/criar-conta',
  '/signup',
  '/registar',
  '/iniciar-sessao',
  '/login',
  '/entrar',
  '/restricted',
  '/404',
] as const;

export function isAuthRoutePath(pathname: string): 'signup' | 'login' | null {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();
  if (clean === '/criar-conta' || clean === '/signup' || clean === '/registar') return 'signup';
  if (clean === '/iniciar-sessao' || clean === '/login' || clean === '/entrar') return 'login';
  return null;
}

export function authModeToPath(mode: 'login' | 'signup' | 'switch'): string {
  return mode === 'signup' ? '/criar-conta' : '/iniciar-sessao';
}

export function viewToPath(view: string): string {
  switch (view) {
    case 'landing':
      return '/';
    case 'chat':
      return '/chat';
    case 'tools':
      return '/tools';
    case 'image':
      return '/image';
    case 'pricing':
      return '/pricing';
    case 'settings':
      return '/settings';
    case 'feedback':
      return '/feedback';
    case 'admin':
      return '/admin';
    case 'restricted':
      return '/restricted';
    case 'not-found':
      return '/404';
    default:
      return '/';
  }
}

export function pathToView(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  switch (clean) {
    case '/':
    case '/landing':
    case '/criar-conta':
    case '/signup':
    case '/registar':
    case '/iniciar-sessao':
    case '/login':
    case '/entrar':
      return 'landing';
    case '/chat':
      return 'chat';
    case '/tools':
      return 'tools';
    case '/image':
      return 'image';
    case '/pricing':
      return 'pricing';
    case '/settings':
      return 'settings';
    case '/feedback':
      return 'feedback';
    case '/admin':
      return 'admin';
    case '/restricted':
      return 'restricted';
    case '/404':
      return 'not-found';
    default:
      return 'not-found';
  }
}
