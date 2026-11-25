# ZUNO AI — A tua inteligência. Sem limites.

Plataforma internacional de Inteligência Artificial de última geração, desenvolvida com arquitetura full-stack profissional, motor Google Gemini oficial (`@google/genai`), chat inteligente com streaming em tempo real via Server-Sent Events (SSE), 10 ferramentas especializadas, personalização com memória de contexto soberana, autenticação de utilizadores, planos de subscrição e consola administrativa.

---

## ⚡ Principais Funcionalidades

### 1. Sistema de Chat Inteligente
- **Streaming em tempo real** via rotas de backend com SSE.
- **Formatação rica em Markdown** com realce de sintaxe e botão de cópia de código com um clique.
- **Multimodalidade nativa**: Suporte a envio de imagens e documentos com pré-visualização e análise via `gemini-3.8-flash`.
- **Comunicação por Voz**: Reconhecimento de fala via Web Speech API (ditado por microfone) e síntese de voz neural (leitura em voz alta de respostas).
- **Gestão completa de histórico**: Pesquisa rápida, renomeação, eliminação e persistência local.
- **Ações de conversa**: Regenerar resposta, interromper geração (`AbortController`) e copiar para área de transferência.

### 2. Suite de 10 Ferramentas Especializadas (ZUNO Tools)
1. **ZUNO Writer**: Criação de artigos, copy persuasivo, e-mails comerciais e relatórios com seleção de tom e formato.
2. **ZUNO Study**: Tutor pedagógico passo a passo, resolução de exercícios e mapas mentais.
3. **ZUNO Code**: Engenharia de software, deteção e resolução de bugs, refatoração e testes.
4. **ZUNO Translate**: Tradução multilíngue contextual com explicações de nuances culturais e expressões idiomáticas.
5. **ZUNO Vision**: Análise visual multimodal com OCR, leitura de esquemas técnicos e design UI.
6. **ZUNO PDF & Docs**: Leitura, síntese e extração de conclusões sobre documentos extensos.
7. **ZUNO Voice**: Diálogo e prática de conversação por voz em tempo real.
8. **ZUNO Creative**: Brainstorming inovador, roteiros, storytelling e nomes de marcas.
9. **ZUNO Image**: Estúdio de direção de arte e engenharia de prompts visuais fotorealistas.
10. **ZUNO Search**: Pesquisa web em tempo real com **Google Search Grounding** oficial e citações de fontes com links verificados.

### 3. Autenticação & Sistema de Utilizadores
- Registo, Iniciar Sessão e Recuperação de Palavra-Passe com tokens seguros.
- Gestão de perfil: Nome, avatar, idioma, plano ativo e quotas diárias.
- Eliminação permanente de conta em conformidade com o RGPD.

### 4. Memória Persistente & Personalização Soberana
- Controlo total sobre o que a IA memoriza sobre o utilizador.
- Opção para ativar/desativar memória ou limpar itens individuais.
- Definição do tom da IA: Equilibrado, Conciso, Criativo, Académico ou Amigável.

### 5. Planos & Gestão de Subscrições
- **Plano Free**: Acesso ao chat essencial com limites diários.
- **Plano Pro**: Mensagens diárias de alta capacidade, todas as 10 ferramentas e análise multimodal.
- **Plano Ultra**: Potência máxima sem filas e suporte prioritário.
- Gestão de ciclo de faturação (mensal e anual com 2 meses grátis) e histórico de faturas com recibos.

### 6. Painel de Administração Protegido
- Monitorização de utilizadores ativos e pedidos à API Gemini.
- Estatísticas de consumo de tokens e tempo de atividade do servidor (*uptime*).
- Seletor dinâmico do modelo padrão do servidor (`gemini-3.8-flash` ou `gemini-3.1-flash-lite`).
- *Feature toggles* para ativar/desativar ferramentas em tempo real.
- Auditoria e registo de eventos do servidor.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend**: Node.js com Express e middleware Vite.
- **Motor de IA**: SDK oficial `@google/genai` (Google Gemini 3.8 Flash e Gemini 3.1 Flash Lite).
- **Grounding**: Ferramenta integrada `googleSearch` do Gemini.
- **Segurança**: Chave `GEMINI_API_KEY` isolada no servidor, sem exposição ao browser do cliente.

---

## 🚀 Como Executar

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar o servidor full-stack de desenvolvimento
npm run dev
```

O servidor iniciará automaticamente em `http://0.0.0.0:3000`.
