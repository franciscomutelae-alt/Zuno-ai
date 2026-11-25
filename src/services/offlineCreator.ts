import {
  Conversation,
  FavoriteItem,
  GeneratedImage,
  ImageAspectRatio,
  ImageStyle,
  SearchBarCodeActionType,
  SearchBarCodeRecord,
  SearchCodeExecutionResult,
  ToolId,
  UserProfile,
} from '../types';
import {
  CREATOR_OFFLINE_EMAIL,
  CREATOR_WELCOME_MESSAGE,
  isCreatorOfflineAccount,
  isCreatorRecognitionQuery,
} from '../config/brand';

const OFFLINE_KEYS = {
  VAULT: 'zuno_creator_offline_vault_v1',
  MODE_FLAG: 'zuno_creator_offline_mode_v1',
  KB: 'zuno_creator_offline_kb_v1',
  SYNC_QUEUE: 'zuno_creator_offline_sync_v1',
  SEARCH_CODES: 'zuno_creator_offline_search_codes_v1',
};

export interface CreatorOfflineVault {
  email: string;
  user: UserProfile;
  authProvider: 'google' | 'password' | 'firebase';
  savedAt: number;
}

export interface OfflineKnowledgeEntry {
  id: string;
  query: string;
  answer: string;
  updatedAt: number;
}

export interface OfflineSyncQueueItem {
  id: string;
  kind: 'conversation' | 'favorite_add' | 'favorite_delete';
  payload: any;
  createdAt: number;
}

// ----------------------------------------------------
// 1. Creator Offline Vault (STRICTLY franciscomutelae@gmail.com)
// ----------------------------------------------------
export function saveCreatorOfflineVault(
  user: UserProfile,
  authProvider: 'google' | 'password' | 'firebase' = 'firebase'
): void {
  if (!isCreatorOfflineAccount(user?.email)) return;
  try {
    const vault: CreatorOfflineVault = {
      email: CREATOR_OFFLINE_EMAIL,
      user: {
        ...user,
        email: CREATOR_OFFLINE_EMAIL,
        role: 'admin',
        plan: 'ultra',
      },
      authProvider,
      savedAt: Date.now(),
    };
    localStorage.setItem(OFFLINE_KEYS.VAULT, JSON.stringify(vault));
  } catch {
    // ignore storage quota failures
  }
}

export function loadCreatorOfflineVault(): CreatorOfflineVault | null {
  try {
    const raw = localStorage.getItem(OFFLINE_KEYS.VAULT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreatorOfflineVault;
    if (!parsed?.user || !isCreatorOfflineAccount(parsed.email) || !isCreatorOfflineAccount(parsed.user.email)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCreatorOfflineVault(): void {
  try {
    localStorage.removeItem(OFFLINE_KEYS.VAULT);
    localStorage.removeItem(OFFLINE_KEYS.MODE_FLAG);
  } catch {
    // ignore
  }
}

export function getCreatorOfflineModePref(): boolean {
  try {
    return localStorage.getItem(OFFLINE_KEYS.MODE_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setCreatorOfflineModePref(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(OFFLINE_KEYS.MODE_FLAG, '1');
    } else {
      localStorage.removeItem(OFFLINE_KEYS.MODE_FLAG);
    }
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// 2. Local Offline Knowledge Base & Search Codes Cache
// ----------------------------------------------------
export function loadCreatorOfflineKnowledge(email?: string | null): OfflineKnowledgeEntry[] {
  if (!isCreatorOfflineAccount(email)) return [];
  try {
    const raw = localStorage.getItem(OFFLINE_KEYS.KB);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordCreatorOfflineKnowledge(
  email: string | null | undefined,
  query: string,
  answer: string
): void {
  if (!isCreatorOfflineAccount(email)) return;
  const cleanQ = query.trim();
  const cleanA = answer.trim();
  if (cleanQ.length < 3 || cleanA.length < 15) return;

  try {
    const current = loadCreatorOfflineKnowledge(email).filter(
      (entry) => entry.query.toLowerCase() !== cleanQ.toLowerCase()
    );
    current.unshift({
      id: 'kb_' + Date.now().toString(36),
      query: cleanQ.slice(0, 400),
      answer: cleanA.slice(0, 6000),
      updatedAt: Date.now(),
    });
    localStorage.setItem(OFFLINE_KEYS.KB, JSON.stringify(current.slice(0, 200)));
  } catch {
    // ignore
  }
}

export function cacheOfflineSearchCodes(codes: SearchBarCodeRecord[]): void {
  if (typeof window === 'undefined' || !Array.isArray(codes)) return;
  try {
    localStorage.setItem(OFFLINE_KEYS.SEARCH_CODES, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

export function upsertOfflineSearchCode(record: SearchBarCodeRecord): void {
  if (typeof window === 'undefined' || !record?.code) return;
  try {
    const current = loadOfflineSearchCodes().filter(
      (c) => c.code.toLowerCase() !== record.code.toLowerCase()
    );
    current.unshift(record);
    localStorage.setItem(OFFLINE_KEYS.SEARCH_CODES, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function loadOfflineSearchCodes(): SearchBarCodeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_KEYS.SEARCH_CODES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function checkOfflineSearchCode(code: string): {
  matched: boolean;
  code?: string;
  purpose?: string;
  actionType?: SearchBarCodeActionType;
} {
  const clean = code.trim().toLowerCase();
  const found = loadOfflineSearchCodes().find(
    (c) => c.active && c.code.trim().toLowerCase() === clean
  );
  if (!found) return { matched: false };
  return {
    matched: true,
    code: found.code,
    purpose: found.purpose,
    actionType: found.actionType,
  };
}

export function executeOfflineSearchCode(code: string): SearchCodeExecutionResult {
  const clean = code.trim().toLowerCase();
  const found = loadOfflineSearchCodes().find(
    (c) => c.code.trim().toLowerCase() === clean
  );
  if (!found) return { matched: false, executed: false };
  if (!found.active) {
    return {
      matched: true,
      executed: false,
      code: found.code,
      purpose: found.purpose,
      actionType: found.actionType,
      error: 'Este código está temporariamente desativado.',
    };
  }
  return {
    matched: true,
    executed: true,
    code: found.code,
    purpose: found.purpose,
    actionType: found.actionType,
    targetPlan: found.targetPlan,
    targetView: found.targetView,
    targetToolId: found.targetToolId,
    responseText: found.responseText,
  };
}

// ----------------------------------------------------
// 3. Offline Sync Queue (Conversations & Favorites)
// ----------------------------------------------------
export function loadCreatorOfflineSyncQueue(email?: string | null): OfflineSyncQueueItem[] {
  if (!isCreatorOfflineAccount(email)) return [];
  try {
    const raw = localStorage.getItem(OFFLINE_KEYS.SYNC_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueCreatorOfflineSync(
  email: string | null | undefined,
  item: Omit<OfflineSyncQueueItem, 'createdAt'>
): void {
  if (!isCreatorOfflineAccount(email)) return;
  try {
    const queue = loadCreatorOfflineSyncQueue(email).filter(
      (q) => !(q.kind === item.kind && q.id === item.id)
    );
    queue.push({
      ...item,
      createdAt: Date.now(),
    });
    localStorage.setItem(OFFLINE_KEYS.SYNC_QUEUE, JSON.stringify(queue.slice(-150)));
  } catch {
    // ignore
  }
}

export function clearCreatorOfflineSyncQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_KEYS.SYNC_QUEUE);
  } catch {
    // ignore
  }
}

// ----------------------------------------------------
// 4. App Shell Precaching Helper
// ----------------------------------------------------
export async function prepareCreatorOfflineAssets(
  email?: string | null
): Promise<{ cachedAssets: number; kbCount: number }> {
  if (!isCreatorOfflineAccount(email)) {
    return { cachedAssets: 0, kbCount: 0 };
  }

  let cachedAssets = 0;
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cache = await caches.open('zuno-creator-offline-shell-v1');
      const urls = [
        '/',
        '/chat',
        '/tools',
        '/image',
        '/settings',
        '/pricing',
        '/feedback',
        '/pwa-192x192.png',
        '/pwa-512x512.png',
        '/apple-touch-icon.png',
        '/icon.svg',
        '/assets/zuno/galeria-neon-zuno-ai.png',
      ];
      await Promise.all(
        urls.map(async (u) => {
          try {
            const resp = await fetch(u, { cache: 'reload' });
            if (resp.ok) {
              await cache.put(u, resp);
              cachedAssets++;
            }
          } catch {
            // ignore offline individual URL misses
          }
        })
      );
    }
  } catch {
    // ignore
  }

  return {
    cachedAssets,
    kbCount: loadCreatorOfflineKnowledge(email).length,
  };
}

// ----------------------------------------------------
// 5. Safe Math, Percentage & Unit Evaluator (No eval)
// ----------------------------------------------------
function tryEvaluateMathExpression(input: string): string | null {
  const normalized = input.trim().replace(/,/g, '.');

  const pctMatch = normalized.match(
    /(?:quanto\s+[eé]\s+|calcula\s+|what\s+is\s+)?(-?\d+(?:\.\d+)?)\s*%\s*(?:de|of)\s*(-?\d+(?:\.\d+)?)/i
  );
  if (pctMatch) {
    const pct = Number(pctMatch[1]);
    const base = Number(pctMatch[2]);
    if (Number.isFinite(pct) && Number.isFinite(base)) {
      const res = (pct / 100) * base;
      const fmt = Number.isInteger(res) ? String(res) : Number(res.toFixed(4)).toString();
      return `**${pct}% de ${base}** é igual a **${fmt}**.\n\n*Cálculo:* \`(${pct} ÷ 100) × ${base} = ${fmt}\``;
    }
  }

  const sqrtMatch = normalized.match(/(?:raiz\s*(?:quadrada)?\s*(?:de)?|sqrt\s*(?:of)?)\s*(-?\d+(?:\.\d+)?)/i);
  if (sqrtMatch) {
    const val = Number(sqrtMatch[1]);
    if (Number.isFinite(val)) {
      if (val < 0) return `Nos números reais, não existe raiz quadrada real de um número negativo (${val}).`;
      const res = Math.sqrt(val);
      const fmt = Number.isInteger(res) ? String(res) : Number(res.toFixed(6)).toString();
      return `A **raiz quadrada de ${val}** é **${fmt}** (\`√${val} = ${fmt}\`).`;
    }
  }

  const convMatch = normalized.match(
    /(?:converte|converter|transforma|quanto\s+[eé])\s*(-?\d+(?:\.\d+)?)\s*(celsius|c|fahrenheit|f|kelvin|k|km|quilometros|m|metros|cm|kg|g|gb|mb|horas?|h|minutos?|min)\s*(?:para|em|to|in)\s*(celsius|c|fahrenheit|f|kelvin|k|km|quilometros|m|metros|cm|kg|g|gb|mb|horas?|h|minutos?|min|segundos?|s)/i
  );
  if (convMatch) {
    const val = Number(convMatch[1]);
    const from = convMatch[2].toLowerCase();
    const to = convMatch[3].toLowerCase();
    const normUnit = (u: string) => {
      if (u === 'c' || u === 'celsius') return 'c';
      if (u === 'f' || u === 'fahrenheit') return 'f';
      if (u === 'k' || u === 'kelvin') return 'k';
      if (u === 'km' || u === 'quilometros') return 'km';
      if (u === 'm' || u === 'metros') return 'm';
      if (u === 'cm') return 'cm';
      if (u === 'kg') return 'kg';
      if (u === 'g') return 'g';
      if (u === 'gb') return 'gb';
      if (u === 'mb') return 'mb';
      if (u.startsWith('h')) return 'h';
      if (u.startsWith('min')) return 'min';
      if (u.startsWith('s')) return 's';
      return u;
    };
    const u1 = normUnit(from);
    const u2 = normUnit(to);
    const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : Number(n.toFixed(4)).toString());
    if (u1 === 'c' && u2 === 'f') return `**${val} °C** equivale a **${fmtNum((val * 9) / 5 + 32)} °F**.`;
    if (u1 === 'f' && u2 === 'c') return `**${val} °F** equivale a **${fmtNum(((val - 32) * 5) / 9)} °C**.`;
    if (u1 === 'c' && u2 === 'k') return `**${val} °C** equivale a **${fmtNum(val + 273.15)} K**.`;
    if (u1 === 'km' && u2 === 'm') return `**${val} km** equivale a **${fmtNum(val * 1000)} metros**.`;
    if (u1 === 'm' && u2 === 'km') return `**${val} m** equivale a **${fmtNum(val / 1000)} km**.`;
    if (u1 === 'm' && u2 === 'cm') return `**${val} m** equivale a **${fmtNum(val * 100)} cm**.`;
    if (u1 === 'kg' && u2 === 'g') return `**${val} kg** equivale a **${fmtNum(val * 1000)} gramas**.`;
    if (u1 === 'g' && u2 === 'kg') return `**${val} g** equivale a **${fmtNum(val / 1000)} kg**.`;
    if (u1 === 'gb' && u2 === 'mb') return `**${val} GB** equivale a **${fmtNum(val * 1024)} MB** (binário) ou **${fmtNum(val * 1000)} MB** (decimal).`;
    if (u1 === 'mb' && u2 === 'gb') return `**${val} MB** equivale a **${fmtNum(val / 1024)} GB**.`;
    if (u1 === 'h' && u2 === 'min') return `**${val} hora(s)** equivale a **${fmtNum(val * 60)} minutos**.`;
    if (u1 === 'h' && u2 === 's') return `**${val} hora(s)** equivale a **${fmtNum(val * 3600)} segundos**.`;
    if (u1 === 'min' && u2 === 's') return `**${val} minuto(s)** equivale a **${fmtNum(val * 60)} segundos**.`;
  }

  const cleaned = normalized
    .replace(/^(?:quanto\s+[eé]|calcula|calcule|resultado\s+de|qual\s+[eé]\s+o\s+resultado\s+de)\s+/i, '')
    .replace(/\bvezes\b|\bx\b/gi, '*')
    .replace(/\bdividido\s+por\b/gi, '/')
    .replace(/\bmais\b/gi, '+')
    .replace(/\bmenos\b/gi, '-')
    .replace(/\belevado\s+a\b/gi, '^')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\?+$/, '')
    .trim();

  if (!/^[0-9+\-*/().%\s^]+$/.test(cleaned) || !/\d/.test(cleaned) || !/[+\-*/%^]/.test(cleaned)) {
    return null;
  }

  try {
    let pos = 0;
    const str = cleaned.replace(/\s+/g, '');

    const parseExpression = (): number => {
      let left = parseTerm();
      while (pos < str.length && (str[pos] === '+' || str[pos] === '-')) {
        const op = str[pos++];
        const right = parseTerm();
        left = op === '+' ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = (): number => {
      let left = parsePower();
      while (pos < str.length && (str[pos] === '*' || str[pos] === '/' || str[pos] === '%')) {
        const op = str[pos++];
        const right = parsePower();
        if (op === '*') left *= right;
        else if (op === '/') {
          if (right === 0) throw new Error('Divisão por zero');
          left /= right;
        } else {
          left %= right;
        }
      }
      return left;
    };

    const parsePower = (): number => {
      let base = parseFactor();
      if (pos < str.length && str[pos] === '^') {
        pos++;
        const exp = parsePower();
        base = Math.pow(base, exp);
      }
      return base;
    };

    const parseFactor = (): number => {
      if (str[pos] === '+') {
        pos++;
        return parseFactor();
      }
      if (str[pos] === '-') {
        pos++;
        return -parseFactor();
      }
      if (str[pos] === '(') {
        pos++;
        const val = parseExpression();
        if (str[pos] !== ')') throw new Error('Parênteses inválidos');
        pos++;
        return val;
      }
      const start = pos;
      while (pos < str.length && /[0-9.]/.test(str[pos])) pos++;
      if (start === pos) throw new Error('Número esperado');
      const num = Number(str.slice(start, pos));
      if (!Number.isFinite(num)) throw new Error('Número inválido');
      return num;
    };

    const result = parseExpression();
    if (pos !== str.length || !Number.isFinite(result)) return null;
    const formatted = Number.isInteger(result) ? String(result) : Number(result.toFixed(6)).toString();
    return `O resultado de \`${cleaned}\` é **${formatted}**.`;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// 6. Built-in Curated Q&A Knowledge Base
// ----------------------------------------------------
interface CuratedOfflineTopic {
  id: string;
  patterns: RegExp[];
  keywords: string[];
  title: string;
  answer: string;
  followUpExample?: string;
}

const CAPITALS_MAP: Array<{ country: string; aliases: string[]; capital: string; continent: string }> = [
  { country: 'Angola', aliases: ['angola'], capital: 'Luanda', continent: 'África' },
  { country: 'Portugal', aliases: ['portugal'], capital: 'Lisboa', continent: 'Europa' },
  { country: 'Brasil', aliases: ['brasil', 'brazil'], capital: 'Brasília', continent: 'América do Sul' },
  { country: 'Moçambique', aliases: ['mocambique', 'mozambique'], capital: 'Maputo', continent: 'África' },
  { country: 'Cabo Verde', aliases: ['cabo verde', 'cape verde'], capital: 'Praia', continent: 'África' },
  { country: 'Guiné-Bissau', aliases: ['guine bissau', 'guine-bissau'], capital: 'Bissau', continent: 'África' },
  { country: 'São Tomé e Príncipe', aliases: ['sao tome'], capital: 'São Tomé', continent: 'África' },
  { country: 'França', aliases: ['franca', 'france'], capital: 'Paris', continent: 'Europa' },
  { country: 'Espanha', aliases: ['espanha', 'spain'], capital: 'Madrid', continent: 'Europa' },
  { country: 'Reino Unido', aliases: ['reino unido', 'inglaterra', 'uk', 'england'], capital: 'Londres', continent: 'Europa' },
  { country: 'Alemanha', aliases: ['alemanha', 'germany'], capital: 'Berlim', continent: 'Europa' },
  { country: 'Itália', aliases: ['italia', 'italy'], capital: 'Roma', continent: 'Europa' },
  { country: 'Estados Unidos (EUA)', aliases: ['estados unidos', 'eua', 'usa', 'america'], capital: 'Washington, D.C.', continent: 'América do Norte' },
  { country: 'Canadá', aliases: ['canada'], capital: 'Ottawa', continent: 'América do Norte' },
  { country: 'Japão', aliases: ['japao', 'japan'], capital: 'Tóquio', continent: 'Ásia' },
  { country: 'China', aliases: ['china'], capital: 'Pequim (Beijing)', continent: 'Ásia' },
  { country: 'África do Sul', aliases: ['africa do sul', 'south africa'], capital: 'Pretória (executiva), Cidade do Cabo (legislativa) e Bloemfontein (judiciária)', continent: 'África' },
  { country: 'Nigéria', aliases: ['nigeria'], capital: 'Abuja', continent: 'África' },
  { country: 'Egito', aliases: ['egito', 'egypt'], capital: 'Cairo', continent: 'África' },
  { country: 'Marrocos', aliases: ['marrocos', 'morocco'], capital: 'Rabat', continent: 'África' },
  { country: 'Argentina', aliases: ['argentina'], capital: 'Buenos Aires', continent: 'América do Sul' },
  { country: 'México', aliases: ['mexico'], capital: 'Cidade do México', continent: 'América do Norte' },
  { country: 'Índia', aliases: ['india'], capital: 'Nova Deli', continent: 'Ásia' },
  { country: 'Rússia', aliases: ['russia'], capital: 'Moscovo', continent: 'Europa/Ásia' },
  { country: 'Austrália', aliases: ['australia'], capital: 'Camberra', continent: 'Oceania' },
];

const CURATED_TOPICS: CuratedOfflineTopic[] = [
  {
    id: 'zuno_identity',
    patterns: [/\b(o que [eé] (?:a |o )?zuno|sobre (?:a |o )?zuno|quem criou (?:a |o )?zuno|criador da zuno|fundador da zuno)\b/i],
    keywords: ['zuno', 'criador', 'fundador', 'plataforma', 'francisco'],
    title: 'Sobre a Plataforma ZUNO AI',
    answer:
      'A **ZUNO AI** (*Intelligence Without Limits*) foi idealizada e criada por **Francisco Mutela Emanuel**.\n\nÉ uma plataforma internacional de inteligência artificial com:\n- **Chat Inteligente em Tempo Real & Local** com streaming instantâneo\n- **ZUNO AI IMAGE** para criação e edição visual multimodal\n- **10 Ferramentas Especializadas** (Writer, Study, Code, Translate, Vision, PDF, Voice, Creative, Image e Search)\n- **Códigos Personalizados na Barra** e Painel Admin completo.',
  },
  {
    id: 'nodejs_file_script',
    patterns: [/\b(script.*node\.?js|processar ficheiros.*estat[íi]sticas|automação.*ficheiros)\b/i],
    keywords: ['script', 'automacao', 'node', 'ficheiros', 'estatisticas'],
    title: 'Script em Node.js TypeScript para Ficheiros e Estatísticas',
    answer:
      'Aqui tens um script completo, modular e tipado em **Node.js + TypeScript** para ler ficheiros de uma pasta e gerar estatísticas:\n\n```typescript\nimport { promises as fs } from \'fs\';\nimport path from \'path\';\n\ninterface FileStatsReport {\n  totalFiles: number;\n  totalBytes: number;\n  totalLines: number;\n  byExtension: Record<string, number>;\n}\n\nexport async function analyzeDirectory(dirPath: string): Promise<FileStatsReport> {\n  const entries = await fs.readdir(dirPath, { withFileTypes: true });\n  const report: FileStatsReport = {\n    totalFiles: 0,\n    totalBytes: 0,\n    totalLines: 0,\n    byExtension: {},\n  };\n\n  for (const entry of entries) {\n    if (!entry.isFile()) continue;\n    const fullPath = path.join(dirPath, entry.name);\n    const stat = await fs.stat(fullPath);\n    const content = await fs.readFile(fullPath, \'utf-8\');\n    const ext = path.extname(entry.name) || \'sem-extensao\';\n\n    report.totalFiles += 1;\n    report.totalBytes += stat.size;\n    report.totalLines += content.split(\'\\n\').length;\n    report.byExtension[ext] = (report.byExtension[ext] || 0) + 1;\n  }\n\n  return report;\n}\n\nanalyzeDirectory(\'./dados\').then(console.log).catch(console.error);\n```',
    followUpExample: 'Podes executá-lo diretamente com `npx tsx script.ts` e adaptar o filtro por extensão conforme o projeto.',
  },
  {
    id: 'ai_trends_international',
    patterns: [/\b(tend[êe]ncias de intelig[êe]ncia artificial|mercado internacional.*ia|futuro da ia)\b/i],
    keywords: ['tendencias', 'analise estrategica', 'mercado internacional', 'futuro ia'],
    title: 'Principais Tendências Globais de Inteligência Artificial',
    answer:
      '### 5 Pilares Estratégicos da IA no Mercado Internacional\n\n1. **Agentes Autónomos Multimodais:** Sistemas capazes de planear tarefas completas entre texto, imagem, áudio e execução de ferramentas.\n2. **IA Híbrida (Nuvem + Edge/Local):** Execução combinada de modelos ultrarrápidos na nuvem com processamento local para latência zero e continuidade.\n3. **Especialização Vertical:** Soluções focadas em educação, saúde, engenharia de software, finanças e gestão empresarial.\n4. **Geração Visual & Vídeo Controlável:** Direção de arte consistente com edição de referência e fidelidade fotorealista.\n5. **Governança, Privacidade & Soberania de Dados:** Controlo rigoroso de acessos, encriptação e separação de sessões por utilizador.',
    followUpExample: 'Um exemplo prático dessa convergência é combinar assistentes conversacionais, geração visual e ferramentas especializadas num único fluxo unificado como a ZUNO AI.',
  },
  {
    id: 'microservices_article',
    patterns: [/\b(microsservi[çc]os|arquitetura de microsservi[çc]os)\b/i],
    keywords: ['microsservicos', 'arquitetura', 'artigo tecnico', 'escalabilidade'],
    title: 'Arquitetura de Microsserviços Modernos',
    answer:
      '### O que define uma arquitetura de microsserviços robusta?\n\nAo contrário de um monólito rígido, os **microsserviços** dividem a aplicação em domínios independentes (ex.: Autenticação, Chat IA, Pagamentos, Notificações).\n\n| Pilar | Responsabilidade | Benefício |\n|---|---|---|\n| **API Gateway** | Ponto único de entrada, autenticação JWT e rate limiting | Segurança e roteamento centralizado |\n| **Comunicação Assíncrona** | Filas e eventos (Kafka, RabbitMQ, Redis) | Desacoplamento e tolerância a falhas |\n| **Base de Dados por Serviço** | Cada serviço gere os seus dados | Escalabilidade independente |\n| **Observabilidade** | Logs estruturados, métricas e tracing distribuído | Deteção rápida de gargalos |\n\n### Boas práticas antes de dividir:\nComeça com um **Monólito Modular** bem organizado e extrai serviços apenas quando o volume ou a equipa justificarem.',
    followUpExample: 'Num e-commerce, por exemplo, o serviço de Pedidos publica o evento `OrderCreated`, e os serviços de Faturação e Notificações reagem de forma independente sem bloquear o cliente.',
  },
  {
    id: 'multimodal_startup_ideas',
    patterns: [/\b(ideias?.*startup|produtos digitais.*ia multimodal|3 ideias inovadoras)\b/i],
    keywords: ['startup', 'ideias', 'produtos digitais', 'multimodal', 'produtividade'],
    title: '3 Ideias de Produtos Digitais com IA Multimodal',
    answer:
      '### 1. Estúdio de Conteúdo para Criadores & PMEs\n- **Proposta:** Transforma uma nota de voz de 30 segundos num pacote completo (post, imagem promocional e guião de vídeo curto).\n- **Público:** Lojas locais, empreendedores e equipas de marketing.\n\n### 2. Tutor Visual de Estudo & Manutenção Técnica\n- **Proposta:** O utilizador tira foto a um exercício, circuito ou equipamento e recebe explicação passo a passo por voz e texto.\n- **Público:** Estudantes, técnicos de campo e formação profissional.\n\n### 3. Copiloto Executivo de Documentos & Reuniões\n- **Proposta:** Analisa PDFs, extrai prazos, gera atas automáticas e prepara respostas comerciais prontas a enviar.\n- **Modelo:** Subscrição mensal por equipas (SaaS).',
  },
  {
    id: 'what_is_ai',
    patterns: [/\b(o que [eé] (?:a )?intelig[êe]ncia artificial|como funciona (?:a )?(?:ia|intelig[êe]ncia artificial)|machine learning|deep learning|llm)\b/i],
    keywords: ['inteligencia artificial', 'machine learning', 'deep learning', 'modelo', 'neural', 'llm'],
    title: 'Inteligência Artificial & Como Funciona',
    answer:
      '**Inteligência Artificial (IA)** é o ramo da ciência da computação que cria sistemas capazes de realizar tarefas que normalmente exigem inteligência humana — como compreender linguagem, reconhecer padrões, tomar decisões e gerar conteúdo.\n\n### Principais camadas:\n1. **Machine Learning (Aprendizagem Automática):** Algoritmos que aprendem padrões a partir de dados em vez de seguirem apenas regras fixas.\n2. **Deep Learning (Redes Neuronais):** Redes com múltiplas camadas inspiradas no cérebro humano, excelentes para texto, voz e imagem.\n3. **LLMs (Large Language Models):** Modelos treinados em grandes volumes de texto que preveem e constroem respostas coerentes token a token.',
    followUpExample: 'Por exemplo, quando escreves uma pergunta no ZUNO, o modelo analisa todo o contexto através de mecanismos de atenção (*Transformers*) e constrói a resposta coerente palavra por palavra.',
  },
  {
    id: 'web_dev_site',
    patterns: [/\b(como fazer um site|criar (?:um )?site|desenvolvimento web|html|css|frontend|backend)\b/i],
    keywords: ['site', 'website', 'web', 'html', 'css', 'frontend', 'backend', 'criar pagina'],
    title: 'Como Criar um Site ou Aplicação Web',
    answer:
      'Para criar um site ou aplicação web moderna, segue estes 4 passos essenciais:\n\n1. **Estrutura (HTML):** Define títulos, parágrafos, botões e formulários.\n2. **Estilo Visual (CSS / Tailwind):** Controla cores, fontes, espaçamento e responsividade para telemóvel e computador.\n3. **Interatividade (JavaScript / TypeScript + React):** Dá vida à página, valida dados e liga interfaces dinâmicas.\n4. **Servidor & Base de Dados (Backend):** Guarda contas, conversas e lógica segura (ex.: Node.js/Express + SQL ou Firestore) e publica com domínio próprio + HTTPS.',
    followUpExample: 'Exemplo mínimo em HTML:\n```html\n<!doctype html>\n<html>\n  <head><title>Meu Site</title></head>\n  <body><h1>Olá Mundo!</h1></body>\n</html>\n```',
  },
  {
    id: 'js_vs_ts',
    patterns: [/\b(javascript|typescript|diferen[çc]a entre js e ts|react|node\.?js)\b/i],
    keywords: ['javascript', 'typescript', 'react', 'nodejs', 'programacao', 'variavel', 'funcao'],
    title: 'JavaScript, TypeScript, React e Node.js',
    answer:
      '- **JavaScript (JS):** A linguagem universal da web. Executa no navegador e no servidor, com tipagem dinâmica.\n- **TypeScript (TS):** Um superconjunto do JavaScript que adiciona **tipos estáticos** (ex.: `string`, `number`, interfaces), apanhando erros antes mesmo de o código correr.\n- **React:** Biblioteca para construir interfaces reativas através de componentes reutilizáveis e estado (`useState`, `useEffect`).\n- **Node.js:** Ambiente que permite executar JavaScript/TypeScript no servidor para criar APIs e serviços backend.',
    followUpExample: 'Exemplo prático em TypeScript:\n```ts\nfunction saudar(nome: string): string {\n  return `Olá, ${nome}!`;\n}\n```',
  },
  {
    id: 'python_basics',
    patterns: [/\b(python|o que [eé] python|aprender python)\b/i],
    keywords: ['python', 'script', 'dados', 'automacao'],
    title: 'Linguagem Python',
    answer:
      '**Python** é uma linguagem de programação famosa pela sua sintaxe simples e legível, muito usada em:\n- Inteligência Artificial e Ciência de Dados\n- Automação de tarefas e scripts\n- Desenvolvimento Backend (FastAPI, Django, Flask)\n\nÉ excelente para iniciantes porque foca na lógica sem excesso de pontuação.',
    followUpExample: 'Exemplo em Python:\n```python\ndef saudacao(nome):\n    return f"Bem-vindo, {nome}!"\n\nprint(saudacao("Francisco"))\n```',
  },
  {
    id: 'api_http_dns',
    patterns: [/\b(o que [eé] (?:uma )?api|rest|http|https|dns|dom[íi]nio|ssl)\b/i],
    keywords: ['api', 'rest', 'http', 'https', 'dns', 'dominio', 'ssl', 'servidor'],
    title: 'APIs, HTTP/HTTPS e DNS',
    answer:
      '- **API (Interface de Programação de Aplicações):** É a ponte que permite que duas aplicações comuniquem (por exemplo, o frontend da ZUNO a pedir uma resposta ao servidor).\n- **HTTP / HTTPS:** O protocolo da web. O **HTTPS** adiciona encriptação **SSL/TLS**, protegendo os dados em trânsito.\n- **DNS (Sistema de Nomes de Domínio):** Funciona como a lista telefónica da internet — traduz nomes fáceis como `zunoai.com` para o endereço IP do servidor real.',
  },
  {
    id: 'databases',
    patterns: [/\b(base de dados|banco de dados|sql|sqlite|postgres|firestore|nosql)\b/i],
    keywords: ['base de dados', 'banco de dados', 'sql', 'sqlite', 'nosql', 'firestore'],
    title: 'Bases de Dados: SQL vs NoSQL',
    answer:
      '- **SQL (Relacional — ex.: SQLite, PostgreSQL, MySQL):** Organiza dados em **tabelas com linhas e colunas** e relações bem definidas. Ótimo para contas, faturas, códigos e consistência rigorosa.\n- **NoSQL (Documentos/Chave-Valor — ex.: Firestore, MongoDB):** Guarda dados em **documentos JSON flexíveis**, facilitando sincronização em tempo real e escala rápida.',
  },
  {
    id: 'cybersecurity',
    patterns: [/\b(seguran[çc]a digital|palavra-?passe|senha forte|2fa|autentica[çc][aã]o|phishing)\b/i],
    keywords: ['seguranca', 'senha', 'palavra passe', 'phishing', '2fa', 'privacidade', 'hack'],
    title: 'Boas Práticas de Segurança Digital',
    answer:
      'Para proteger contas e projetos digitais:\n1. **Palavras-passe únicas** ou autenticação federada (como Google OAuth com verificação).\n2. **Autenticação de Dois Fatores (2FA):** Impede acesso mesmo se alguém descobrir a senha.\n3. **Nunca expor chaves secretas** no código do navegador — mantê-las sempre no backend.\n4. **Verificar o URL** antes de iniciar sessão para evitar páginas falsas (*phishing*).',
  },
  {
    id: 'solar_system',
    patterns: [/\b(sistema solar|planetas|quantos planetas|maior planeta|planeta mais pr[óo]ximo)\b/i],
    keywords: ['sistema solar', 'planetas', 'terra', 'marte', 'jupiter', 'saturno', 'sol', 'lua'],
    title: 'O Sistema Solar',
    answer:
      'O **Sistema Solar** tem **8 planetas principais** que orbitam o Sol (por ordem de proximidade):\n1. **Mercúrio** (o menor e mais próximo do Sol)\n2. **Vénus** (o mais quente devido ao efeito de estufa)\n3. **Terra** (o único conhecido com vida e água líquida abundante)\n4. **Marte** (o planeta vermelho)\n5. **Júpiter** (o maior planeta)\n6. **Saturno** (famoso pelos seus anéis)\n7. **Úrano** (roda quase deitado)\n8. **Neptuno** (o mais distante, de ventos fortíssimos)',
  },
  {
    id: 'water_science',
    patterns: [/\b(o que [eé] (?:a )?[áa]gua|h2o|estados da [áa]gua|ponto de ebuli[çc][aã]o|fotoss[íi]ntese)\b/i],
    keywords: ['agua', 'h2o', 'ebulicao', 'fusao', 'fotossintese', 'oxigenio', 'ciencia'],
    title: 'Água (H₂O) e Ciências Naturais',
    answer:
      '- **Água (`H₂O`):** Composta por 2 átomos de hidrogénio e 1 de oxigénio. Ao nível do mar, congela a **0 °C** e ferve a **100 °C**. Existe nos estados **sólido, líquido e gasoso**.\n- **Fotossíntese:** Processo pelo qual plantas, algas e certas bactérias usam **luz solar + água + CO₂** para produzir glicose (energia) e libertar **oxigénio (`O₂`)**.',
  },
  {
    id: 'newton_physics',
    patterns: [/\b(leis de newton|gravidade|velocidade da luz|relatividade|pit[áa]goras|bhaskara|regra de tr[êe]s)\b/i],
    keywords: ['newton', 'gravidade', 'velocidade da luz', 'fisica', 'pitagoras', 'bhaskara', 'relatividade', 'einstein'],
    title: 'Física, Relatividade e Fórmulas Essenciais',
    answer:
      '- **Velocidade média:** `v = d / t` (distância dividida pelo tempo).\n- **Teorema de Pitágoras:** `a² = b² + c²` (num triângulo retângulo).\n- **Fórmula Resolvente (Bhaskara):** `x = (-b ± √(b² - 4ac)) / (2a)`.\n- **3 Leis de Newton:** (1) Inércia, (2) `F = m × a`, (3) Ação e Reação.\n- **Relatividade de Einstein:** Objetos com massa curvam o espaço-tempo (como uma bola pesada num colchão), e a gravidade é o efeito dessa curvatura.\n- **Velocidade da luz no vácuo:** ~**299.792 km/s**.',
  },
  {
    id: 'biology_history',
    patterns: [/\b(mitose|meiose|revolu[çc][aã]o industrial|c[ée]lula|dna)\b/i],
    keywords: ['mitose', 'meiose', 'revolucao industrial', 'dna', 'celula', 'historia', 'biologia'],
    title: 'Biologia & História Essencial',
    answer:
      '### Biologia Celular:\n- **Mitose:** Uma célula divide-se em **2 células idênticas** (crescimento e regeneração).\n- **Meiose:** Forma **4 células reprodutivas (gâmetas)** com metade dos cromossomas.\n- **DNA:** Molécula em dupla hélice que guarda o código genético.\n\n### Revolução Industrial:\nIniciada no século XVIII em Inglaterra, substituiu o trabalho manual pela **máquina a vapor e fábricas**, acelerando a urbanização, os transportes e a economia moderna.',
  },
  {
    id: 'portuguese_tips',
    patterns: [/\b(ortografia|diferen[çc]a entre (?:mas|mais|ha|a|mal|mau|porque)|como escrever|reda[çc][aã]o)\b/i],
    keywords: ['ortografia', 'portugues', 'redacao', 'mas', 'mais', 'porque', 'escrever', 'gramatica'],
    title: 'Dicas Rápidas de Português & Redação',
    answer:
      '### Dúvidas comuns:\n- **Mas vs Mais:** *Mas* = porém/contudo; *Mais* = quantidade/adição.\n- **Há vs A:** *Há* (verbo haver) indica tempo passado ou existência (*"há dois anos"*); *A* indica futuro ou distância (*"daqui a dois dias"*).\n- **Mal vs Mau:** *Mal* opõe-se a *bem*; *Mau* opõe-se a *bom*.\n\n### Estrutura de uma boa redação:\n1. **Introdução:** Apresenta o tema e a tese principal.\n2. **Desenvolvimento (2 parágrafos):** Argumentos claros com exemplos.\n3. **Conclusão:** Síntese da ideia e proposta prática.',
  },
  {
    id: 'english_french_basics',
    patterns: [/\b(como dizer|traduz|em ingl[êe]s|em franc[êe]s|em espanhol|frases em ingl[êe]s)\b/i],
    keywords: ['ingles', 'frances', 'espanhol', 'traduzir', 'traducao', 'idioma'],
    title: 'Guia Rápido de Idiomas (PT · EN · ES · FR)',
    answer:
      '### Expressões essenciais em 4 idiomas:\n| Português | Inglês | Espanhol | Francês |\n|---|---|---|---|\n| Olá / Bom dia | Hello / Good morning | Hola / Buenos días | Bonjour |\n| Obrigado(a) | Thank you | Gracias | Merci |\n| Como estás? | How are you? | ¿Cómo estás? | Comment allez-vous ? |\n| Por favor | Please | Por favor | S’il vous plaît |\n| Sem problemas | No problem | Sin problema | Pas de problème |\n| Até logo | See you soon | Hasta pronto | À bientôt |',
  },
  {
    id: 'business_productivity',
    patterns: [/\b(ideias? de neg[óo]cio|empreendedorismo|produtividade|pomodoro|plano de neg[óo]cio|como estudar melhor|gest[ãa]o do tempo|marketing)\b/i],
    keywords: ['negocio', 'empresa', 'produtividade', 'pomodoro', 'estudar', 'tempo', 'marketing', 'financeiro'],
    title: 'Produtividade, Negócios & Estratégia',
    answer:
      '### Produtividade Prática:\n- **Técnica Pomodoro:** 25 minutos de foco total + 5 minutos de pausa (a cada 4 ciclos, pausa de 15–20 min).\n- **Regra 80/20 (Pareto):** Foca nos 20% de tarefas que geram 80% do resultado.\n\n### Lançar um Projeto / Negócio Digital (MVP):\n1. Identifica um problema real que as pessoas querem resolver rápido.\n2. Cria uma versão simples (**MVP**) em vez de esperar pela perfeição.\n3. Recolhe feedback real dos primeiros utilizadores e melhora em ciclos curtos.',
  },
  {
    id: 'continents_oceans',
    patterns: [/\b(continentes|oceanos|maior pa[íi]s|rio mais longo|montanha mais alta|evereste)\b/i],
    keywords: ['continentes', 'oceanos', 'geografia', 'evereste', 'oceano', 'planeta terra'],
    title: 'Geografia Mundial Básica',
    answer:
      '- **Continentes:** África, América, Antártida, Ásia, Europa e Oceania.\n- **Oceanos:** Pacífico (o maior), Atlântico, Índico, Antártico (Austral) e Ártico.\n- **Montanha mais alta:** Monte Evereste (**8.848 m**, nos Himalaias).\n- **Maior país em área:** Rússia.\n- **Maior floresta tropical:** Amazónia.',
  },
];

// ----------------------------------------------------
// 7. Local Archive Search & Topic Helpers
// ----------------------------------------------------
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text: string): string[] {
  const stop = new Set([
    'para', 'como', 'sobre', 'que', 'uma', 'uns', 'umas', 'dos', 'das', 'com', 'sem',
    'por', 'pela', 'pelo', 'qual', 'quais', 'onde', 'quando', 'quero', 'saber', 'isso',
    'isto', 'esta', 'este', 'the', 'and', 'for', 'with', 'about', 'what', 'how', 'pode', 'podes',
  ]);
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
}

function searchLocalCreatorArchive(
  query: string,
  email: string,
  conversations: Conversation[],
  favorites: FavoriteItem[]
): Array<{ title: string; content: string; source: string; score: number }> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const matches: Array<{ title: string; content: string; source: string; score: number }> = [];

  for (const kb of loadCreatorOfflineKnowledge(email)) {
    const hay = normalizeText(`${kb.query} ${kb.answer}`);
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 2 : 0), 0);
    if (score >= 2) {
      matches.push({
        title: kb.query,
        content: kb.answer,
        source: 'Histórico ZUNO',
        score: score + 1,
      });
    }
  }

  for (const fav of favorites) {
    const hay = normalizeText(`${fav.conversationTitle || ''} ${fav.content}`);
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 2 : 0), 0);
    if (score >= 2) {
      matches.push({
        title: fav.conversationTitle || 'Favorito Guardado',
        content: fav.content,
        source: 'Favoritos da Conta',
        score: score + 2,
      });
    }
  }

  for (const conv of conversations) {
    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      if (msg.role !== 'assistant' || msg.content.length < 20) continue;
      const prevUser = i > 0 && conv.messages[i - 1]?.role === 'user' ? conv.messages[i - 1].content : '';
      const hay = normalizeText(`${conv.title} ${prevUser} ${msg.content}`);
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      if (score >= Math.min(2, terms.length)) {
        matches.push({
          title: prevUser || conv.title,
          content: msg.content,
          source: `Conversa: ${conv.title}`,
          score,
        });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return matches
    .filter((m) => {
      const key = m.content.slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function findCuratedOfflineTopic(prompt: string): CuratedOfflineTopic | null {
  const norm = normalizeText(prompt);
  for (const topic of CURATED_TOPICS) {
    if (topic.patterns.some((re) => re.test(prompt) || re.test(norm))) {
      return topic;
    }
  }
  let bestTopic: CuratedOfflineTopic | null = null;
  let bestScore = 0;
  for (const topic of CURATED_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (norm.includes(kw)) score += kw.includes(' ') ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  return bestScore >= 2 ? bestTopic : null;
}

function tryAnswerCapitalQuestion(prompt: string): string | null {
  const norm = normalizeText(prompt);
  if (!/\b(capital|capitais|onde fica|pais|país)\b/i.test(norm)) return null;
  const matched = CAPITALS_MAP.filter((c) => c.aliases.some((a) => norm.includes(a)));
  if (matched.length > 0) {
    if (matched.length === 1) {
      const c = matched[0];
      return `A capital de **${c.country}** é **${c.capital}** *(Continente: ${c.continent})*.`;
    }
    return matched
      .map((c) => `- **${c.country}:** ${c.capital} *(${c.continent})*`)
      .join('\n');
  }
  if (/\bcapitais\b/i.test(norm)) {
    return (
      `### Capitais Mundiais\n` +
      CAPITALS_MAP.slice(0, 12)
        .map((c) => `- **${c.country}:** ${c.capital}`)
        .join('\n')
    );
  }
  return null;
}

const OFFLINE_FUN_FACTS = [
  'O coração humano bate cerca de **100.000 vezes por dia**, bombeando aproximadamente 7.500 litros de sangue.',
  'Um dia em **Vénus** (uma rotação completa) é mais longo do que um ano em Vénus (uma volta ao redor do Sol).',
  'O **mel natural** praticamente nunca estraga — já foram encontrados potes de mel com mais de 3.000 anos ainda próprios para consumo.',
  'A luz do Sol demora cerca de **8 minutos e 20 segundos** a chegar à Terra.',
  'Os **polvos** têm três corações e sangue azul devido à hemocianina rica em cobre.',
];

// ----------------------------------------------------
// 8. Smart Dynamic Composer (Makes ANY prompt feel natural & helpful)
// ----------------------------------------------------
function composeDynamicNaturalResponse(prompt: string, user: UserProfile): string {
  const norm = normalizeText(prompt);
  const cleanSubject = prompt
    .replace(/^(?:como\s+|o que [eé]\s+|explica(?:-me)?\s+|faz(?:-me)?\s+|cria(?:-me)?\s+|escreve(?:-me)?\s+|ajuda(?:-me)?\s+(?:a|com)\s+)/i, '')
    .replace(/\?+$/, '')
    .trim();

  // Comparison: "A vs B" / "diferença entre A e B"
  const vsMatch = prompt.match(/(?:diferen[çc]a\s+entre|compara(?:r)?)\s+(.+?)\s+(?:e|vs\.?|versus)\s+([^?.!]+)/i)
    || prompt.match(/^(.+?)\s+vs\.?\s+([^?.!]+)/i);
  if (vsMatch) {
    const a = vsMatch[1].trim();
    const b = vsMatch[2].trim();
    return (
      `### Comparação: ${a} vs ${b}\n\n` +
      `| Critério | ${a} | ${b} |\n` +
      `|---|---|---|\n` +
      `| **Foco Principal** | Ideal quando precisas de simplicidade e foco direto em ${a} | Orientado para casos específicos onde ${b} se destaca |\n` +
      `| **Quando Escolher** | Projetos que privilegiam velocidade inicial e clareza | Cenários que exigem características próprias de ${b} |\n` +
      `| **Dica Prática** | Avalia o teu objetivo e recursos disponíveis antes de decidir | Testa uma prova de conceito pequena antes de adotar em escala |\n\n` +
      `Se quiseres, diz-me qual é o teu contexto exato (trabalho, estudo ou software) para eu recomendar a melhor opção entre **${a}** e **${b}**.`
    );
  }

  // Email / Letter / Message / Proposal drafting
  if (/\b(e-?mail|carta|mensagem|proposta|convite|an[úu]ncio|discurso)\b/i.test(norm)) {
    return (
      `### Rascunho Estruturado — ${cleanSubject || 'Comunicação Profissional'}\n\n` +
      `**Assunto:** ${cleanSubject ? cleanSubject.charAt(0).toUpperCase() + cleanSubject.slice(1) : 'Apresentação & Próximos Passos'}\n\n` +
      `Olá **[Nome do Destinatário]**, tudo bem?\n\n` +
      `Entro em contacto relativamente a **${cleanSubject || 'este assunto'}** para partilhar uma proposta objetiva e clara.\n\n` +
      `### Pontos principais:\n` +
      `- **Objetivo:** Apresentar a solução de forma direta e prática.\n` +
      `- **Benefício imediato:** Poupança de tempo, maior organização e resultados mensuráveis.\n` +
      `- **Próximo passo:** Podemos alinhar os detalhes ainda esta semana conforme a tua disponibilidade.\n\n` +
      `Fico à disposição para responder a qualquer questão.\n\n` +
      `Com os melhores cumprimentos,\n` +
      `**${user.name || 'Francisco Mutela Emanuel'}**`
    );
  }

  // Code generation request
  if (/\b(c[óo]digo|fun[çc][aã]o|script|componente|programa|html|css|python|typescript|javascript|sql)\b/i.test(norm)) {
    const isPy = /\bpython\b/i.test(norm);
    const isSql = /\bsql\b/i.test(norm);
    if (isPy) {
      return (
        `### Implementação em Python\n\n` +
        `\`\`\`python\ndef processar_pedido(dados: str) -> dict:\n    texto = dados.strip()\n    if not texto:\n        return {"ok": False, "erro": "Entrada vazia"}\n    palavras = texto.split()\n    return {\n        "ok": True,\n        "resumo": texto,\n        "total_palavras": len(palavras),\n    }\n\nresultado = processar_pedido("${cleanSubject.slice(0, 40) || 'ZUNO AI'}")\nprint(resultado)\n\`\`\`\n\n` +
        `Se quiseres adaptar para um framework específico (FastAPI, Flask ou automação de ficheiros), diz-me o formato exato!`
      );
    }
    if (isSql) {
      return (
        `### Estrutura SQL Recomendada\n\n` +
        `\`\`\`sql\nCREATE TABLE IF NOT EXISTS registos (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  titulo TEXT NOT NULL,\n  estado TEXT DEFAULT 'ativo',\n  criado_em INTEGER NOT NULL\n);\n\nSELECT id, titulo, estado\nFROM registos\nWHERE estado = 'ativo'\nORDER BY criado_em DESC\nLIMIT 20;\n\`\`\``
      );
    }
    return (
      `### Solução em TypeScript\n\n` +
      `\`\`\`typescript\nexport interface ResultadoProcessamento {\n  sucesso: boolean;\n  titulo: string;\n  detalhes: string[];\n}\n\nexport function executarFluxo(entrada: string): ResultadoProcessamento {\n  const limpo = entrada.trim();\n  if (!limpo) {\n    throw new Error('É necessário fornecer um conteúdo válido.');\n  }\n  return {\n    sucesso: true,\n    titulo: limpo,\n    detalhes: limpo.split(/\\s+/).filter(Boolean),\n  };\n}\n\`\`\`\n\n` +
      `Queres que eu acrescente validação extra, testes unitários ou ligação a uma API?`
    );
  }

  // How-to / Step-by-step / Lists / Plans
  if (/^(?:como|passo|dicas|plano|estrategia|lista|ideias|guia)\b/i.test(norm) || /\b(como\s+fazer|como\s+posso|passos\s+para)\b/i.test(norm)) {
    return (
      `### Plano Prático: ${cleanSubject || prompt}\n\n` +
      `1. **Definir o Objetivo Claro:** Estabelece exatamente o resultado esperado com **${cleanSubject || 'esta meta'}** e um critério simples para saber que funcionou.\n` +
      `2. **Preparar os Recursos Essenciais:** Reúne ferramentas, referências e prazos antes de começar a execução.\n` +
      `3. **Executar em Blocos Curtos:** Divide o trabalho em 2 ou 3 etapas rápidas (começa pelo núcleo mais importante).\n` +
      `4. **Validar e Ajustar:** Testa o resultado logo na primeira versão e melhora com base no retorno obtido.\n\n` +
      `Se quiseres, diz-me o nível de detalhe ou contexto (iniciante, profissional ou técnico) que adaptamos já cada passo!`
    );
  }

  // Conversational open question fallback
  return (
    `### Sobre: ${cleanSubject || prompt}\n\n` +
    `Aqui está uma abordagem direta e estruturada para **${cleanSubject || prompt}**:\n\n` +
    `- **Visão Geral:** O ponto essencial é alinhar o objetivo principal com ações práticas e mensuráveis, evitando complexidade desnecessária.\n` +
    `- **Pontos-Chave:**\n` +
    `  1. Clarifica o propósito central e quem beneficia do resultado.\n` +
    `  2. Estrutura em etapas curtas (análise → execução → revisão).\n` +
    `  3. Usa exemplos reais ou métricas simples para validar a qualidade.\n\n` +
    `Queres que eu transforme isto num **texto pronto**, num **plano passo a passo**, ou num **exemplo prático**?`
  );
}

// ----------------------------------------------------
// 9. Creator Offline Conversational AI Engine
// ----------------------------------------------------
export function generateCreatorOfflineChatResponse(params: {
  prompt: string;
  user: UserProfile;
  conversations: Conversation[];
  favorites: FavoriteItem[];
  activeConversation?: Conversation | null;
}): string {
  const { prompt, user, conversations, favorites, activeConversation } = params;
  const trimmed = prompt.trim();
  const norm = normalizeText(trimmed);

  if (!isCreatorOfflineAccount(user.email)) {
    return 'O Modo Offline exclusivo está disponível apenas para a conta oficial do criador (franciscomutelae@gmail.com).';
  }

  if (isCreatorRecognitionQuery(trimmed)) {
    return CREATOR_WELCOME_MESSAGE;
  }

  const lastAssistantMsg = [...(activeConversation?.messages || [])]
    .reverse()
    .find((m) => m.role === 'assistant' && m.content.trim().length > 0);
  const lastUserMsg = [...(activeConversation?.messages || [])]
    .reverse()
    .find((m) => m.role === 'user' && m.content.trim() !== trimmed);

  // 1. Conversational Greetings & Check-ins
  if (/^(ol[aá]|oi|e\s*a[ií]|bom\s*dia|boa\s*tarde|boa\s*noite|salve|hey|hello|hi|hola|bonjour)(?:[\s,]+zuno(?:\s+ai)?)?[\s\!\.\?]*$/i.test(trimmed)) {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Bom dia' : hour < 19 ? 'Boa tarde' : 'Boa noite';
    return `${greeting}, **${user.name?.split(' ')[0] || 'Francisco'}**! Estou pronto para ajudar.\n\nPodes falar comigo normalmente sobre qualquer tema — programação, ideias de negócio, redação, matemática, traduções, ciências ou as tuas conversas e favoritos guardados.\n\nComo posso acelerar o teu trabalho hoje?`;
  }

  if (/\b(tudo\s+bem|como\s+est[aá]s|como\s+vais|t[áa]\s+tudo|how\s+are\s+you|todo\s+bien|comment\s+[çc]a\s+va)\b/i.test(norm)) {
    return `Tudo ótimo por aqui, Francisco — 100% operacional! 😊\n\nE contigo, como estão as coisas? Se quiseres trocar ideias, tirar alguma dúvida, gerar imagens, fazer contas rápidas ou redigir um texto, é só pedir.`;
  }

  if (/^(obrigado|obrigada|valeu|muito\s+obrigado|thanks|thank\s+you|gracias|merci)[\s\!\.\?]*$/i.test(norm)) {
    return `Sempre às ordens, **Francisco**! Se surgir mais alguma pergunta ou quiseres continuar a conversa, estou aqui.`;
  }

  if (/^(adeus|tch?au|at[eé]\s+logo|at[eé]\s+j[aá]|bye|goodbye|hasta\s+luego|au\s+revoir)[\s\!\.\?]*$/i.test(norm)) {
    return `Até já, Francisco! Todas as conversas e criações ficam guardadas com segurança na tua conta e sincronizam automaticamente assim que houver ligação.`;
  }

  // 2. Capabilities / Help
  if (/\b(quem\s+[eé]s\s+tu|o\s+que\s+sabes\s+fazer|o\s+que\s+podes\s+fazer|como\s+funciona\s+o\s+modo\s+offline|ajuda|help|vamos\s+conversar)\b/i.test(norm)) {
    return (
      `Sou o **ZUNO**, o teu assistente inteligente com experiência completa.\n\n` +
      `Podes pedir-me:\n` +
      `- **Conversação & Respostas:** Tecnologia, IA, programação, negócios, ciências, geografia e redação\n` +
      `- **Criação & Edição de Imagens:** Basta escrever *"cria uma imagem de..."* ou usar o **ZUNO AI IMAGE**\n` +
      `- **10 Ferramentas Profissionais:** Writer, Study, Code, Translate, Vision, PDF, Voice, Creative, Image e Search\n` +
      `- **Cálculos, Percentagens & Conversões:** Ex.: *"15% de 1250"* ou *"30 celsius para fahrenheit"*\n` +
      `- **Histórico & Memórias:** Consulta automática das tuas conversas e favoritos.\n\n` +
      `O que gostarias de fazer agora?`
    );
  }

  // 3. Fun Fact / Motivation
  if (/\b(curiosidade|facto\s+interessante|fato\s+interessante|algo\s+novo|surpreende)\b/i.test(norm)) {
    const fact = OFFLINE_FUN_FACTS[Math.floor(Date.now() / 1000) % OFFLINE_FUN_FACTS.length];
    return `💡 **Curiosidade:**\n\n${fact}\n\nQueres saber outra curiosidade ou explorar outro assunto?`;
  }

  if (/\b(motiva|conselho|desanimado|cansado|foco|dica\s+de\s+vida)\b/i.test(norm)) {
    return `Grande passo é continuar mesmo quando o caminho parece exigente, Francisco. Cada grande plataforma nasceu linha a linha, melhoria a melhoria.\n\nDica prática para agora:\n1. Escolhe **apenas 1 prioridade** para os próximos 25 minutos.\n2. Faz uma pequena pausa e bebe água.\n3. Se quiseres, diz-me qual é essa tarefa e organizamos os passos juntos aqui mesmo!`;
  }

  // 4. Creator / ZUNO AI
  if (
    (/\bzuno\b/i.test(norm) && /\b(quem|criou|criador|fundador|sobre|o que|dono|historia)\b/i.test(norm)) ||
    /\bquem\s+(?:te\s+)?(?:criou|fundou|desenvolveu)\b/i.test(norm)
  ) {
    return `A **ZUNO AI** (*Intelligence Without Limits*) foi idealizada e criada por **Francisco Mutela Emanuel**.\n\nEsta conta (\`${CREATOR_OFFLINE_EMAIL}\`) conta com acesso completo contínuo, permitindo conversar, gerar imagens, usar as ferramentas e pesquisar o histórico com sincronização automática.`;
  }

  // 5. Memories Inspection
  if (/\b(minhas?\s+memorias?|o\s+que\s+lembras|o\s+que\s+sabes\s+sobre\s+mim)\b/i.test(norm)) {
    if (user.memories && user.memories.length > 0) {
      return `### As Tuas Memórias Guardadas (${user.memories.length})\n${user.memories.map((m) => `- ${m}`).join('\n')}\n\nUso estas referências automaticamente para personalizar as respostas!`;
    }
    return `Ainda não tens memórias personalizadas adicionadas nas Definições da conta, Francisco — mas reconheço-te como criador oficial da **ZUNO AI** e mantenho o contexto desta conversa ativo.`;
  }

  // 6. Date & Time
  if (/\b(que\s+horas|hora\s+atual|que\s+dia|data\s+de\s+hoje|data\s+atual|que\s+ano\s+estamos)\b/i.test(norm)) {
    const now = new Date();
    return `Agora são **${now.toLocaleTimeString('pt-PT')}** e hoje é **${now.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })}** *(hora local do dispositivo)*.`;
  }

  // 7. Follow-up conversational commands using activeConversation context
  if (/^(explica\s+melhor|d[aá]\s+um\s+exemplo|exemplo|simplifica|mais\s+detalhes|continua|e\s+depois\??|por\s+qu[êe]\??)[\s\!\.\?]*$/i.test(norm)) {
    if (lastUserMsg) {
      const topic = findCuratedOfflineTopic(lastUserMsg.content);
      if (topic?.followUpExample) {
        return `Claro! Continuando sobre **${topic.title}**:\n\n${topic.followUpExample}`;
      }
      if (lastAssistantMsg) {
        return `Continuando sobre *"${lastUserMsg.content.slice(0, 80)}"*:\n\nEm termos práticos, o mais importante é aplicar passo a passo — começando pelo núcleo principal e validando o resultado antes de expandir. Diz-me qual ponto específico queres ver em detalhe ou com código/exemplo!`;
      }
    }
    return `Com certeza! Diz-me qual é o tema ou pergunta sobre o qual queres um exemplo ou explicação mais detalhada.`;
  }

  // 8. Math calculations, percentages & conversions
  const mathRes = tryEvaluateMathExpression(trimmed);
  if (mathRes) {
    return mathRes;
  }

  // 9. Capitals & Geography
  const capitalRes = tryAnswerCapitalQuestion(trimmed);
  if (capitalRes) {
    return capitalRes;
  }

  // 10. JSON formatting
  if (/^(?:formata|valida|minifica|json)\b/i.test(norm) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    const candidate = trimmed.replace(/^(?:formata|valida|minifica|json)\s*:?\s*/i, '').trim();
    try {
      const parsed = JSON.parse(candidate);
      return `### JSON Formatado\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      if (trimmed.startsWith('{')) {
        return '⚠️ O bloco JSON fornecido contém erros de sintaxe. Verifica as vírgulas e as aspas.';
      }
    }
  }

  // 11. Text Summary
  const summarizeMatch = trimmed.match(/^(?:resume|resuma|resumir|resumo\s+de)\s*:?\s+([\s\S]{50,})$/i);
  if (summarizeMatch) {
    const body = summarizeMatch[1].trim();
    const sentences = body
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12);
    const picked = sentences.slice(0, Math.min(4, Math.max(2, Math.ceil(sentences.length / 3))));
    const bulletSummary = (picked.length > 0 ? picked : [body.slice(0, 260) + '...'])
      .map((s) => `- ${s}`)
      .join('\n');
    return `### Resumo Estruturado\n${bulletSummary}`;
  }

  // 11b. Explicit drafting (email/carta/proposta) or comparison ("X vs Y" / "compara") takes precedence over loose topic keywords
  if (
    /\b(compara(?:r)?|vs\.?|versus)\b/i.test(norm) ||
    /\b(escreve|redige|cria)\s+(?:um|uma)\s+(?:e-?mail|carta|mensagem|proposta|convite|discurso)\b/i.test(norm)
  ) {
    return composeDynamicNaturalResponse(trimmed, user);
  }

  // 12. Strong match in local archive / favorites / previously cached online replies
  const archiveMatches = searchLocalCreatorArchive(trimmed, user.email, conversations, favorites);
  if (archiveMatches.length > 0 && archiveMatches[0].score >= 4) {
    const top = archiveMatches[0];
    const extra = archiveMatches
      .slice(1)
      .map((m) => `- **${m.title}** (*${m.source}*): ${m.content.slice(0, 140).replace(/\n+/g, ' ')}...`)
      .join('\n');

    return (
      `${top.content.slice(0, 2400)}` +
      (extra ? `\n\n#### Referências relacionadas do teu arquivo:\n${extra}` : '')
    );
  }

  // 13. Curated Built-in Knowledge Base
  const curated = findCuratedOfflineTopic(trimmed);
  if (curated) {
    return `### ${curated.title}\n\n${curated.answer}\n\n*Se quiseres aprofundar ou ver um exemplo prático, pede **"dá um exemplo"**!*`;
  }

  // 14. Secondary archive match
  if (archiveMatches.length > 0) {
    const top = archiveMatches[0];
    return `${top.content.slice(0, 2000)}`;
  }

  // 15. Smart Natural Composer Fallback (acts seamlessly like online)
  return composeDynamicNaturalResponse(trimmed, user);
}

// ----------------------------------------------------
// 10. Local Canvas Image Synthesis & Editing Engine
// ----------------------------------------------------
function getAspectDimensions(ratio: ImageAspectRatio): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 720, height: 1280 };
    case '16:9':
      return { width: 1280, height: 720 };
    case '4:3':
      return { width: 1024, height: 768 };
    case '3:4':
      return { width: 768, height: 1024 };
    default:
      return { width: 1024, height: 1024 };
  }
}

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number): () => number {
  let s = seed || 123456789;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getStylePalette(style: ImageStyle, prompt: string): {
  bgTop: string;
  bgMid: string;
  bgBot: string;
  accent1: string;
  accent2: string;
  glow: string;
} {
  const norm = normalizeText(prompt);
  if (/\b(sol|praia|dourad|p[oô]r do sol|deserto|fogo|ouro|outono)\b/.test(norm)) {
    return {
      bgTop: '#1c1238',
      bgMid: '#9a3412',
      bgBot: '#f59e0b',
      accent1: '#fde047',
      accent2: '#fb7185',
      glow: 'rgba(251, 191, 36, 0.55)',
    };
  }
  if (/\b(floresta|natureza|montanha|lago|pinheiro|verde|relva|jardim)\b/.test(norm)) {
    return {
      bgTop: '#042f2e',
      bgMid: '#0f766e',
      bgBot: '#064e3b',
      accent1: '#34d399',
      accent2: '#38bdf8',
      glow: 'rgba(52, 211, 153, 0.45)',
    };
  }
  switch (style) {
    case 'logotipo':
    case 'futurista':
    case 'produto':
      return {
        bgTop: '#030712',
        bgMid: '#0f172a',
        bgBot: '#1e1b4b',
        accent1: '#38bdf8',
        accent2: '#a855f7',
        glow: 'rgba(56, 189, 248, 0.6)',
      };
    case 'anime':
    case 'fantasia':
      return {
        bgTop: '#1e1b4b',
        bgMid: '#4338ca',
        bgBot: '#ec4899',
        accent1: '#67e8f9',
        accent2: '#f472b6',
        glow: 'rgba(244, 114, 182, 0.55)',
      };
    case 'cartoon':
      return {
        bgTop: '#0ea5e9',
        bgMid: '#38bdf8',
        bgBot: '#fde047',
        accent1: '#f97316',
        accent2: '#f43f5e',
        glow: 'rgba(253, 224, 71, 0.6)',
      };
    case 'minimalista':
      return {
        bgTop: '#0f172a',
        bgMid: '#1e293b',
        bgBot: '#334155',
        accent1: '#e2e8f0',
        accent2: '#60a5fa',
        glow: 'rgba(148, 163, 184, 0.35)',
      };
    default:
      return {
        bgTop: '#050814',
        bgMid: '#1e3a8a',
        bgBot: '#4c1d95',
        accent1: '#3b82f6',
        accent2: '#c084fc',
        glow: 'rgba(99, 102, 241, 0.5)',
      };
  }
}

export async function generateCreatorOfflineImage(params: {
  prompt: string;
  style?: ImageStyle;
  aspectRatio?: ImageAspectRatio;
  quality?: 'standard' | 'hd' | 'ultra';
  referenceImage?: string;
  isEdit?: boolean;
  userId?: string;
  variationIndex?: number;
}): Promise<GeneratedImage> {
  const {
    prompt,
    style = 'realista',
    aspectRatio = '1:1',
    quality = 'hd',
    referenceImage,
    isEdit = false,
    userId = 'creator',
    variationIndex = 0,
  } = params;

  const { width, height } = getAspectDimensions(aspectRatio);
  const seed = hashSeed(`${prompt}|${style}|${aspectRatio}|${variationIndex}|${Date.now() % 10000}`);
  const rng = createRng(seed);
  const palette = getStylePalette(style, prompt);

  if (typeof document === 'undefined') {
    throw new Error('Renderização visual indisponível fora do navegador.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto gráfico indisponível.');
  }

  const norm = normalizeText(prompt);

  // If editing an uploaded/existing reference image, transform it directly
  if (isEdit && referenceImage) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Apply tone filter inferred from edit prompt
        if (/\b(dourad|sol|quente|sunset|ouro|luz)\b/.test(norm)) {
          ctx.filter = 'contrast(1.12) saturate(1.28) sepia(0.22) brightness(1.06)';
        } else if (/\b(noite|escuro|estrelad|dramat|neon|futur)\b/.test(norm)) {
          ctx.filter = 'contrast(1.22) saturate(1.18) brightness(0.84) hue-rotate(12deg)';
        } else if (/\b(oleo|pintura|artist|vintage)\b/.test(norm)) {
          ctx.filter = 'contrast(1.18) saturate(1.35) sepia(0.15)';
        } else {
          ctx.filter = 'contrast(1.08) saturate(1.18) brightness(1.03)';
        }
        ctx.drawImage(img, 0, 0, width, height);
        ctx.filter = 'none';

        // Atmospheric blend overlay
        const overlayGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.35,
          width * 0.1,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.75
        );
        overlayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
        overlayGrad.addColorStop(1, palette.glow.replace(/[\d.]+\)$/, '0.28)'));
        ctx.fillStyle = overlayGrad;
        ctx.fillRect(0, 0, width, height);

        // Luminous particles if requested
        if (/\b(part[íi]culas|brilh|estrel|luzes|aurora|m[áa]gic)\b/.test(norm)) {
          for (let i = 0; i < 65; i++) {
            const x = rng() * width;
            const y = rng() * height;
            const r = 1.5 + rng() * 4.5;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(253, 224, 71, ${(0.35 + rng() * 0.6).toFixed(2)})`;
            ctx.fill();
          }
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = referenceImage;
    });
  } else {
    // 1. Deep Atmospheric Sky / Studio Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, width * 0.3, height);
    bgGrad.addColorStop(0, palette.bgTop);
    bgGrad.addColorStop(0.55, palette.bgMid);
    bgGrad.addColorStop(1, palette.bgBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient Aurora / Nebula Glow Orbs
    for (let i = 0; i < 4; i++) {
      const gx = width * (0.15 + rng() * 0.7);
      const gy = height * (0.15 + rng() * 0.55);
      const gr = Math.min(width, height) * (0.28 + rng() * 0.35);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, i % 2 === 0 ? palette.glow : `${palette.accent2}66`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    // 3. Stars / Bokeh Particles
    const particleCount = style === 'minimalista' ? 12 : 90;
    for (let i = 0; i < particleCount; i++) {
      const x = rng() * width;
      const y = rng() * (height * 0.75);
      const r = (style === 'realista' || style === 'fotografico' ? 2 + rng() * 14 : 0.8 + rng() * 2.5);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(style === 'realista' ? 0.04 + rng() * 0.09 : 0.25 + rng() * 0.65).toFixed(2)})`;
      ctx.fill();
    }

    // 4. Subject / Scene Composition by Style & Prompt Theme
    if (style === 'logotipo' || /\b(log[oó]tipo|logo|marca|emblema)\b/.test(norm)) {
      const cx = width / 2;
      const cy = height / 2;
      const rad = Math.min(width, height) * 0.24;

      ctx.save();
      ctx.shadowColor = palette.accent1;
      ctx.shadowBlur = 35;
      ctx.lineWidth = Math.max(8, rad * 0.11);
      const ringGrad = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
      ringGrad.addColorStop(0, palette.accent1);
      ringGrad.addColorStop(1, palette.accent2);
      ctx.strokeStyle = ringGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      // Inner geometric diamond / Z mark
      ctx.lineWidth = Math.max(6, rad * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx - rad * 0.48, cy - rad * 0.36);
      ctx.lineTo(cx + rad * 0.48, cy - rad * 0.36);
      ctx.lineTo(cx - rad * 0.48, cy + rad * 0.36);
      ctx.lineTo(cx + rad * 0.48, cy + rad * 0.36);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    } else if (
      style === 'paisagem' ||
      style === 'cinematografico' ||
      /\b(montanha|lago|praia|mar|c[eé]u|lua|sol|floresta|penhasco|cidade|metr[oó]pole)\b/.test(norm)
    ) {
      // Celestial sun or moon
      const sunX = width * (0.35 + rng() * 0.3);
      const sunY = height * 0.28;
      const sunR = Math.min(width, height) * (/\blua\b/.test(norm) ? 0.11 : 0.08);
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 2.2);
      sunGrad.addColorStop(0, '#ffffff');
      sunGrad.addColorStop(0.45, palette.accent1);
      sunGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Layered mountain silhouettes or futuristic skyline
      const isCity = style === 'futurista' || /\b(cidade|metr[oó]pole|arranha|cyberpunk|futur)\b/.test(norm);
      if (isCity) {
        const horizon = height * 0.72;
        for (let b = 0; b < 24; b++) {
          const bw = width / 20 + rng() * (width / 24);
          const bx = (b / 24) * width;
          const bh = height * (0.14 + rng() * 0.38);
          ctx.fillStyle = b % 2 === 0 ? '#090d1f' : '#111834';
          ctx.fillRect(bx, horizon - bh, bw, bh);
          ctx.fillStyle = b % 3 === 0 ? palette.accent1 : palette.accent2;
          for (let wy = horizon - bh + 12; wy < horizon - 14; wy += 16) {
            if (rng() > 0.45) {
              ctx.fillRect(bx + 8, wy, Math.max(4, bw * 0.22), 4);
            }
          }
        }
      } else {
        for (let layer = 0; layer < 3; layer++) {
          const baseY = height * (0.56 + layer * 0.07);
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, baseY);
          const steps = 7;
          for (let s = 1; s <= steps; s++) {
            const px = (s / steps) * width;
            const py = baseY - rng() * (height * (0.18 - layer * 0.04));
            ctx.lineTo(px, py);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle =
            layer === 0 ? 'rgba(15, 23, 42, 0.55)' : layer === 1 ? 'rgba(15, 23, 42, 0.8)' : '#050814';
          ctx.fill();
        }
      }

      // Water reflection band
      const waterGrad = ctx.createLinearGradient(0, height * 0.72, 0, height);
      waterGrad.addColorStop(0, 'rgba(30, 58, 138, 0.45)');
      waterGrad.addColorStop(1, '#020617');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, height * 0.72, width, height * 0.28);
      for (let r = 0; r < 18; r++) {
        ctx.fillStyle = `rgba(255,255,255,${(0.06 + rng() * 0.14).toFixed(2)})`;
        const rw = width * (0.08 + rng() * 0.24);
        ctx.fillRect(sunX - rw / 2 + (rng() - 0.5) * 40, height * 0.74 + r * 11, rw, 2);
      }
    } else {
      // 3D / Studio Object / Portrait / Abstract Luminous Composition
      const cx = width / 2;
      const cy = height * 0.46;
      const orbR = Math.min(width, height) * 0.22;

      // Studio light pedestal
      const pedGrad = ctx.createRadialGradient(cx, height * 0.78, 10, cx, height * 0.78, width * 0.36);
      pedGrad.addColorStop(0, palette.glow);
      pedGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pedGrad;
      ctx.fillRect(0, height * 0.65, width, height * 0.35);

      // Primary sculpted 3D form
      const sphereGrad = ctx.createRadialGradient(
        cx - orbR * 0.32,
        cy - orbR * 0.32,
        orbR * 0.08,
        cx,
        cy,
        orbR
      );
      sphereGrad.addColorStop(0, '#ffffff');
      sphereGrad.addColorStop(0.3, palette.accent1);
      sphereGrad.addColorStop(0.82, palette.accent2);
      sphereGrad.addColorStop(1, '#090d1f');

      ctx.save();
      ctx.shadowColor = palette.accent1;
      ctx.shadowBlur = 45;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.restore();

      // Orbiting light arcs
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.35 + rng() * 0.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, orbR * 1.48, orbR * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle film vignette & crisp bottom framing
    const vig = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2, 6, 23, 0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  }

  const dataUrl = canvas.toDataURL('image/png');
  return {
    id: `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    prompt,
    style,
    aspectRatio,
    quality,
    url: dataUrl,
    model: 'ZUNO Diffusion Engine',
    createdAt: Date.now(),
    isEdit,
  };
}

// ----------------------------------------------------
// 11. Local Vision & File Analysis Helpers
// ----------------------------------------------------
async function inspectImageOffline(dataUrl: string): Promise<{
  width: number;
  height: number;
  aspect: string;
  brightness: string;
  dominantTone: string;
}> {
  if (typeof document === 'undefined') {
    return { width: 1024, height: 1024, aspect: '1:1', brightness: 'Equilibrada', dominantTone: 'Azul / Neutro' };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || img.width || 800;
      const h = img.naturalHeight || img.height || 600;
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      if (ctx) {
        ctx.drawImage(img, 0, 0, 32, 32);
        const pixels = ctx.getImageData(0, 0, 32, 32).data;
        for (let i = 0; i < pixels.length; i += 4) {
          rSum += pixels[i];
          gSum += pixels[i + 1];
          bSum += pixels[i + 2];
          count++;
        }
      }
      const rAvg = count ? rSum / count : 120;
      const gAvg = count ? gSum / count : 120;
      const bAvg = count ? bSum / count : 140;
      const lum = 0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg;
      const brightness = lum > 175 ? 'Alta (Clara)' : lum < 80 ? 'Baixa (Escura / Noturna)' : 'Equilibrada';
      let dominantTone = 'Neutro / Equilibrado';
      if (bAvg > rAvg + 20 && bAvg > gAvg + 10) dominantTone = 'Frio (Tons Azuis / Violeta)';
      else if (rAvg > bAvg + 25 && gAvg > bAvg + 15) dominantTone = 'Quente (Dourado / Âmbar)';
      else if (gAvg > rAvg + 20 && gAvg > bAvg + 15) dominantTone = 'Natural (Tons Verdes)';
      else if (rAvg > gAvg + 25 && rAvg > bAvg + 25) dominantTone = 'Vibrante (Vermelho / Coral)';

      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const d = gcd(w, h) || 1;
      resolve({
        width: w,
        height: h,
        aspect: `${Math.round(w / d)}:${Math.round(h / d)}`,
        brightness,
        dominantTone,
      });
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024, aspect: '1:1', brightness: 'Equilibrada', dominantTone: 'Neutro' });
    };
    img.src = dataUrl;
  });
}

// ----------------------------------------------------
// 12. Full Creator Tool Workspace Engine (All 10 Tools)
// ----------------------------------------------------
export async function executeCreatorOfflineToolAsync(params: {
  toolId: ToolId;
  query: string;
  user: UserProfile;
  conversations: Conversation[];
  favorites: FavoriteItem[];
  uploadedImage?: string | null;
  options?: { tone?: string; format?: string; targetLang?: string; codeAction?: string };
}): Promise<{ result: string; citations: Array<{ title: string; url: string }> }> {
  const { toolId, query, user, conversations, favorites, uploadedImage, options } = params;
  const trimmed = query.trim();

  if (isCreatorRecognitionQuery(trimmed)) {
    return { result: CREATOR_WELCOME_MESSAGE, citations: [] };
  }

  if (toolId === 'search') {
    const matches = searchLocalCreatorArchive(trimmed, user.email, conversations, favorites);
    if (matches.length > 0) {
      const body = matches
        .map((m, idx) => `### ${idx + 1}. ${m.title}\n*Fonte: ${m.source}*\n\n${m.content.slice(0, 950)}`)
        .join('\n\n---\n\n');
      return { result: body, citations: [] };
    }
    const curated = findCuratedOfflineTopic(trimmed);
    if (curated) {
      return { result: `### ${curated.title}\n\n${curated.answer}`, citations: [] };
    }
    const cap = tryAnswerCapitalQuestion(trimmed);
    if (cap) {
      return { result: cap, citations: [] };
    }
    return {
      result: generateCreatorOfflineChatResponse({ prompt: trimmed, user, conversations, favorites }),
      citations: [],
    };
  }

  if (toolId === 'writer') {
    const tone = options?.tone || 'profissional';
    const format = options?.format || 'artigo';
    const subject = trimmed || 'Inovação e Produtividade Digital';
    if (format === 'email') {
      return {
        result:
          `### E-mail (${tone.toUpperCase()})\n\n` +
          `**Assunto:** ${subject.slice(0, 72)}\n\n` +
          `Olá **[Nome]**,\n\n` +
          `Espero que este e-mail te encontre bem. Escrevo relativamente a **${subject}** com o objetivo de apresentar uma proposta objetiva e alinhada às vossas prioridades.\n\n` +
          `- **Enquadramento:** Solução orientada a eficiência, qualidade e resultados mensuráveis.\n` +
          `- **Próximo passo sugerido:** Agendar uma breve conversa de 15 minutos para validação.\n\n` +
          `Com os melhores cumprimentos,\n**${user.name || 'Francisco Mutela Emanuel'}**`,
        citations: [],
      };
    }
    if (format === 'proposta') {
      return {
        result:
          `# Proposta Comercial B2B\n## Objeto: ${subject}\n\n` +
          `### 1. Sumário Executivo\nApresentamos uma abordagem estratégica para **${subject}**, desenhada com tom **${tone}** e foco em retorno rápido.\n\n` +
          `### 2. Escopo & Entregáveis\n- Diagnóstico e planeamento detalhado\n- Implementação modular com validação contínua\n- Suporte técnico e acompanhamento pós-entrega\n\n` +
          `### 3. Cronograma Sugerido\n1. **Semana 1:** Levantamento e arquitetura\n2. **Semana 2–3:** Execução e testes\n3. **Semana 4:** Entrega e otimização`,
        citations: [],
      };
    }
    if (format === 'redes_sociais') {
      return {
        result:
          `### Post para LinkedIn / Redes Sociais (${tone})\n\n` +
          `🚀 **${subject}**\n\n` +
          `A maioria das equipas tenta resolver isto com mais esforço, quando a verdadeira vantagem está no método:\n\n` +
          `✅ Clareza no objetivo principal\n✅ Execução simples em ciclos curtos\n✅ Aprendizagem contínua com feedback real\n\n` +
          `Qual tem sido o maior desafio nesta área? Partilha nos comentários 👇\n\n` +
          `#ZUNOAI #Inovacao #Produtividade #Tecnologia`,
        citations: [],
      };
    }
    return {
      result:
        `# ${subject}\n*Tom: ${tone} · Formato: ${format}*\n\n` +
        `### Introdução\nO tema **${subject}** assume um papel determinante no cenário atual, exigindo clareza estratégica e execução disciplinada.\n\n` +
        `### Pontos-Chave\n- **Enquadramento:** Definição clara de propósito e público-alvo.\n- **Desenvolvimento:** Aplicação prática com foco em eficiência e impacto.\n- **Resultados Esperados:** Maior consistência, escalabilidade e qualidade final.\n\n` +
        `### Conclusão\nAo combinar planeamento objetivo com execução iterativa, **${subject}** transforma-se numa vantagem concreta e sustentável.`,
      citations: [],
    };
  }

  if (toolId === 'study') {
    const curated = findCuratedOfflineTopic(trimmed);
    if (curated) {
      return {
        result:
          `### Guia de Estudo — ${curated.title}\n\n${curated.answer}\n\n` +
          `#### Exercícios Rápidos de Revisão:\n1. Resume em 2 frases o conceito central acima.\n2. Dá 1 exemplo prático de aplicação.\n3. Identifica qual parte merece mais atenção na tua revisão.`,
        citations: [],
      };
    }
    const math = tryEvaluateMathExpression(trimmed);
    if (math) {
      return { result: `### Resolução Passo a Passo\n\n${math}`, citations: [] };
    }
    return {
      result:
        `### Guia de Estudo Estruturado: ${trimmed}\n\n` +
        `#### 1. Explicação Intuitiva\nPensa em **${trimmed}** como um sistema com 3 peças ligadas: a **base teórica** (o porquê), o **mecanismo** (como funciona na prática) e a **aplicação real**.\n\n` +
        `#### 2. Resumo em Tópicos-Chave\n- **Conceito central:** Identifica a definição principal antes de memorizar detalhes.\n- **Relações:** Liga o novo tema a algo que já conheces.\n- **Erros comuns a evitar:** Decorar fórmulas sem entender o contexto.\n\n` +
        `#### 3. Auto-Teste (3 Perguntas)\n1. Qual é o problema que este conceito resolve?\n2. Quais são as suas 2 características principais?\n3. Como aplicarias isto num exercício prático?`,
      citations: [],
    };
  }

  if (toolId === 'code') {
    const action = options?.codeAction || 'debug';
    const isPy = /\bpython\b/i.test(trimmed);
    if (action === 'explain') {
      return {
        result:
          `### Explicação Técnica Passo a Passo\n\n` +
          `1. **Entrada e Validação:** Verifica primeiro o formato dos dados recebidos para evitar falhas silenciosas.\n` +
          `2. **Fluxo Principal:** Mantém funções puras e pequenas com nomes explícitos.\n` +
          `3. **Tratamento de Erros:** Usa blocos \`try/catch\` com mensagens claras e retorno previsível.\n\n` +
          `${trimmed.length > 0 ? `> **Analisado:** \`${trimmed.slice(0, 120)}${trimmed.length > 120 ? '...' : ''}\`` : ''}`,
        citations: [],
      };
    }
    if (action === 'tests') {
      return {
        result:
          `### Suite de Testes Unitários (Vitest)\n\n` +
          `\`\`\`typescript\nimport { describe, it, expect } from 'vitest';\n\ndescribe('Validação de Fluxo', () => {\n  it('deve processar entrada válida corretamente', () => {\n    const input = '${trimmed.slice(0, 32).replace(/'/g, '') || 'ZUNO AI'}';\n    expect(input.trim().length).toBeGreaterThan(0);\n  });\n\n  it('deve rejeitar entrada vazia', () => {\n    expect(''.trim()).toBe('');\n  });\n});\n\`\`\``,
        citations: [],
      };
    }
    if (isPy) {
      return {
        result:
          `### ZUNO Code (${action.toUpperCase()} · Python)\n\n` +
          `\`\`\`python\ndef executar_seguro(entrada: str) -> dict:\n    limpo = entrada.strip()\n    if not limpo:\n        raise ValueError("Entrada obrigatória")\n    return {"ok": True, "resultado": limpo}\n\nif __name__ == "__main__":\n    print(executar_seguro("${trimmed.slice(0, 40).replace(/"/g, '') || 'ZUNO AI'}"))\n\`\`\``,
        citations: [],
      };
    }
    return {
      result:
        `### ZUNO Code (${action.toUpperCase()} · TypeScript)\n\n` +
        `\`\`\`typescript\nexport async function executarOperacao(input: string): Promise<{ ok: boolean; data: string }> {\n  const cleaned = input.trim();\n  if (!cleaned) {\n    throw new Error('Entrada obrigatória');\n  }\n  return { ok: true, data: cleaned };\n}\n\`\`\`\n\n` +
        `> **Boas práticas aplicadas:** Tipagem estrita, validação explícita na entrada e retorno determinístico.`,
      citations: [],
    };
  }

  if (toolId === 'translate') {
    const target = options?.targetLang || 'Inglês (US)';
    const lowerTarget = normalizeText(target);
    const dictionary: Record<string, { en: string; fr: string; es: string; pt: string }> = {
      'ola': { en: 'Hello', fr: 'Bonjour', es: 'Hola', pt: 'Olá' },
      'bom dia': { en: 'Good morning', fr: 'Bonjour', es: 'Buenos días', pt: 'Bom dia' },
      'boa tarde': { en: 'Good afternoon', fr: 'Bon après-midi', es: 'Buenas tardes', pt: 'Boa tarde' },
      'boa noite': { en: 'Good evening', fr: 'Bonsoir', es: 'Buenas noches', pt: 'Boa noite' },
      'obrigado': { en: 'Thank you', fr: 'Merci', es: 'Gracias', pt: 'Obrigado' },
      'por favor': { en: 'Please', fr: "S'il vous plaît", es: 'Por favor', pt: 'Por favor' },
      'como estas': { en: 'How are you?', fr: 'Comment allez-vous ?', es: '¿Cómo estás?', pt: 'Como estás?' },
      'inteligencia artificial': { en: 'Artificial Intelligence', fr: 'Intelligence Artificielle', es: 'Inteligencia Artificial', pt: 'Inteligência Artificial' },
      'pensar fora da caixa': { en: 'Think outside the box', fr: 'Sortir des sentiers battus', es: 'Pensar fuera de la caja', pt: 'Pensar fora da caixa' },
    };
    const normQ = normalizeText(trimmed);
    const dictHit = Object.entries(dictionary).find(([k]) => normQ.includes(k));
    let langCode: 'en' | 'fr' | 'es' | 'pt' = 'en';
    if (lowerTarget.includes('franc')) langCode = 'fr';
    else if (lowerTarget.includes('espanh')) langCode = 'es';
    else if (lowerTarget.includes('portug')) langCode = 'pt';

    return {
      result:
        `### Tradução Contextual → ${target}\n\n` +
        `**Texto Original:**\n> ${trimmed}\n\n` +
        (dictHit
          ? `**Tradução Direta:** **${dictHit[1][langCode]}**\n\n`
          : `**Adaptação Estruturada (${target}):**\n` +
            `- Mantém o registo natural, claro e idiomático do idioma **${target}**.\n` +
            `- Preserva termos técnicos, nomes próprios e intenção comunicativa original.\n\n`) +
        `*Guia rápido de referência:*\n` +
        `\`PT: Olá / Obrigado / Por favor\` → \`EN: Hello / Thank you / Please\` → \`FR: Bonjour / Merci / S'il vous plaît\` → \`ES: Hola / Gracias / Por favor\``,
      citations: [],
    };
  }

  if (toolId === 'vision') {
    if (uploadedImage) {
      const info = await inspectImageOffline(uploadedImage);
      return {
        result:
          `### ZUNO Vision — Análise Visual Detalhada\n\n` +
          `- **Resolução detetada:** \`${info.width} × ${info.height} px\` *(Proporção ${info.aspect})*\n` +
          `- **Luminosidade global:** ${info.brightness}\n` +
          `- **Paleta predominante:** ${info.dominantTone}\n\n` +
          `**Resposta ao teu pedido (*"${trimmed || 'Análise geral'}"*):**\n` +
          `A composição apresenta enquadramento ${info.width >= info.height ? 'horizontal/panorâmico' : 'vertical/retrato'} com contraste visual ${info.brightness.toLowerCase()} e tonalidade ${info.dominantTone.toLowerCase()}, adequada para apresentações, UI ou edição no **ZUNO AI IMAGE**.`,
        citations: [],
      };
    }
    return {
      result: `Carrega ou arrasta uma imagem para que o **ZUNO Vision** analise a resolução, paleta cromática, luminosidade e responda à tua pergunta (*"${trimmed}"*).`,
      citations: [],
    };
  }

  if (toolId === 'pdf') {
    const words = trimmed.split(/\s+/).filter(Boolean);
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
    const numbers = trimmed.match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
    return {
      result:
        `### ZUNO PDF & Docs — Síntese Executiva\n\n` +
        `- **Volume analisado:** ${words.length} palavras · ${sentences.length || 1} frases · leitura estimada de ${Math.max(1, Math.ceil(words.length / 180))} min\n` +
        (numbers.length > 0 ? `- **Valores / Datas identificados:** ${numbers.slice(0, 8).join(', ')}\n` : '') +
        `\n#### Pontos Principais Extraídos:\n` +
        (sentences.length > 0
          ? sentences.slice(0, 4).map((s) => `- ${s.trim()}`).join('\n')
          : `- ${trimmed.slice(0, 260)}`),
      citations: [],
    };
  }

  if (toolId === 'voice') {
    return {
      result:
        `### ZUNO Voice — Prática & Diálogo\n\n` +
        `Excelente iniciativa! Sobre **"${trimmed}"**:\n\n` +
        `- **Sugestão de resposta falada (30s):** Começa com uma frase direta que resume o teu ponto principal, apresenta 1 exemplo concreto e fecha com uma pergunta aberta.\n` +
        `- **Dica de dicção & ritmo:** Faz uma pausa breve de 1 segundo após cada ideia-chave.\n\n` +
        `*Podes usar também o botão de microfone e o leitor de voz nas mensagens do chat.*`,
      citations: [],
    };
  }

  if (toolId === 'creative') {
    return {
      result:
        `### ZUNO Creative — Conceitos & Ideias Originais\n\n` +
        `Para **"${trimmed}"**, aqui tens 3 direções criativas de alto impacto:\n\n` +
        `1. **Conceito Âncora (Memorável):** Foca numa promessa simples de uma frase que qualquer pessoa entende em 3 segundos.\n` +
        `2. **Narrativa Visual & Gancho:** Abre com um contraste forte (antes vs depois) nos primeiros 5 segundos.\n` +
        `3. **Identidade & Nome:** Combina palavras curtas e sonoras (ex.: *ZunoPulse*, *NovaLinha*, *VetorZero*) alinhadas ao teu público.`,
      citations: [],
    };
  }

  return {
    result: generateCreatorOfflineChatResponse({
      prompt: trimmed,
      user,
      conversations,
      favorites,
    }),
    citations: [],
  };
}

export function executeCreatorOfflineTool(params: {
  toolId: ToolId;
  query: string;
  user: UserProfile;
  conversations: Conversation[];
  favorites: FavoriteItem[];
  options?: { tone?: string; format?: string; codeAction?: string };
}): { result: string; citations: Array<{ title: string; url: string }> } {
  const { toolId, query, user, conversations, favorites, options } = params;
  const trimmed = query.trim();

  if (isCreatorRecognitionQuery(trimmed)) {
    return { result: CREATOR_WELCOME_MESSAGE, citations: [] };
  }

  if (toolId === 'writer') {
    const tone = options?.tone || 'profissional';
    const format = options?.format || 'artigo';
    return {
      result:
        `# ${trimmed}\n*Formato: ${format.toUpperCase()} · Tom: ${tone}*\n\n` +
        `### 1. Introdução\nApresentação objetiva sobre **${trimmed}**, destacando o contexto principal e o propósito central.\n\n` +
        `### 2. Pontos-Chave\n- **Enquadramento:** Definição clara do objetivo e público-alvo.\n- **Desenvolvimento:** Estruturação das ideias principais com clareza.\n- **Aplicação prática:** Passos concretos e próximos marcos.\n\n` +
        `### 3. Conclusão\nSíntese final com chamada à ação alinhada ao estilo *${tone}*.`,
      citations: [],
    };
  }

  return {
    result: generateCreatorOfflineChatResponse({
      prompt: trimmed,
      user,
      conversations,
      favorites,
    }),
    citations: [],
  };
}
