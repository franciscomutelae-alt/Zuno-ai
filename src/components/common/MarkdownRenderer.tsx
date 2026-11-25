import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Terminal, 
  ExternalLink, 
  Maximize2, 
  X, 
  Download, 
  Info, 
  Sparkles, 
  AlertTriangle, 
  Quote, 
  Calculator, 
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onImageClick?: (url: string, alt: string) => void;
  allowCodeBlocks?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  onImageClick,
  allowCodeBlocks = true 
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt: string; caption?: string } | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleCopyCode = (codeText: string, index: number) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleImageOpen = (url: string, alt: string, caption?: string) => {
    if (onImageClick) {
      onImageClick(url, alt);
    } else {
      setLightboxImage({ url, alt, caption });
    }
  };

  const handleImageError = (url: string) => {
    setFailedImages((prev) => new Set(prev).add(url));
  };

  // Helper for syntax highlighting tokens in code blocks
  const renderHighlightedCode = (code: string, lang: string) => {
    const lines = code.split('\n');

    return (
      <div className="font-mono text-xs sm:text-[13px] leading-relaxed">
        {lines.map((line, lineIdx) => {
          // Tokenize line with keywords, strings, comments, numbers
          return (
            <div key={lineIdx} className="table-row group/line hover:bg-white/[0.03]">
              <span className="table-cell select-none pr-4 text-right text-slate-600 group-hover/line:text-slate-400 font-mono text-[11px] w-8">
                {lineIdx + 1}
              </span>
              <span className="table-cell text-slate-200 whitespace-pre">
                {highlightLineTokens(line, lang)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Simple, fast syntax tokenizer for keywords, strings, comments, numbers
  const highlightLineTokens = (line: string, lang: string): React.ReactNode => {
    if (!line) return ' ';

    // Single-line comments
    if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('--')) {
      return <span className="text-slate-500 italic">{line}</span>;
    }

    const tokenRegex = /(\/\/.*$|#.*$|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b(?:const|let|var|function|return|class|import|export|from|if|else|switch|case|default|for|while|do|try|catch|finally|throw|new|async|await|def|self|print|type|interface|extends|implements|public|private|protected|static|readonly|enum|select|from|where|insert|into|update|delete|true|false|null|undefined|None|True|False)\b|\b\d+(?:\.\d+)?\b)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let tokenIdx = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      const tok = match[0];

      // Comment
      if (tok.startsWith('//') || tok.startsWith('#')) {
        parts.push(<span key={tokenIdx++} className="text-slate-500 italic">{tok}</span>);
      }
      // String
      else if (tok.startsWith('"') || tok.startsWith("'") || tok.startsWith('`')) {
        parts.push(<span key={tokenIdx++} className="text-emerald-400">{tok}</span>);
      }
      // Numbers
      else if (/^\d+(?:\.\d+)?$/.test(tok)) {
        parts.push(<span key={tokenIdx++} className="text-amber-400 font-semibold">{tok}</span>);
      }
      // Keywords
      else if (/^(true|false|null|undefined|None|True|False)$/.test(tok)) {
        parts.push(<span key={tokenIdx++} className="text-rose-400 font-bold">{tok}</span>);
      }
      else {
        parts.push(<span key={tokenIdx++} className="text-purple-400 font-semibold">{tok}</span>);
      }

      lastIndex = match.index + tok.length;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return parts.length > 0 ? parts : line;
  };

  // Convert basic LaTeX formulas into readable styled Unicode / math format
  const formatMathFormula = (mathStr: string): string => {
    return mathStr
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, '∑(de $1 até $2)')
      .replace(/\\sum/g, '∑')
      .replace(/\\int/g, '∫')
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\pm/g, '±')
      .replace(/\\approx/g, '≈')
      .replace(/\\neq/g, '≠')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\infty/g, '∞')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\pi/g, 'π')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\omega/g, 'ω')
      .replace(/\\in/g, '∈')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/\^n/g, 'ⁿ')
      .replace(/_0/g, '₀')
      .replace(/_1/g, '₁')
      .replace(/_2/g, '₂')
      .replace(/_i/g, 'ᵢ')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/[{}\\]/g, '');
  };

  // Main block parser (Code blocks, Math blocks, Tables, Images, Callouts, Paragraphs)
  const renderContentBlocks = () => {
    // 1. Split code blocks (including unclosed blocks during streaming)
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)(?:```|$)/g;
    const blocks: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Text segment before code block
      if (match.index > lastIndex) {
        const textSegment = content.substring(lastIndex, match.index);
        blocks.push(
          <div key={`text-${blockIndex++}`} className="space-y-3">
            {renderMixedTextSegment(textSegment, blockIndex)}
          </div>
        );
      }

      // Code block
      const lang = match[1] || 'plaintext';
      const code = match[2];
      const currentIndex = blockIndex++;

      // When code blocks are forbidden (e.g. general questions where user did not ask for code), suppress display
      if (allowCodeBlocks === false) {
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) break;
        continue;
      }

      blocks.push(
        <div
          key={`code-${currentIndex}`}
          className="my-5 rounded-2xl border border-slate-700/80 bg-[#070b18] shadow-2xl overflow-hidden font-mono"
        >
          {/* Code Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/90 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                {lang}
              </span>
            </div>
            <button
              onClick={() => handleCopyCode(code, currentIndex)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
              title="Copiar código"
            >
              {copiedIndex === currentIndex ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>

          {/* Syntax Highlighted Body */}
          <div className="p-4 overflow-x-auto bg-[#050814]/90 custom-scrollbar">
            {renderHighlightedCode(code, lang)}
          </div>
        </div>
      );

      lastIndex = match.index + match[0].length;
      if (match[0].length === 0) break;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      blocks.push(
        <div key={`text-${blockIndex++}`} className="space-y-3">
          {renderMixedTextSegment(remainingText, blockIndex)}
        </div>
      );
    }

    return blocks;
  };

  // Parse lines for GFM Tables, Images, Callouts, Math blocks, Headings, Lists
  const renderMixedTextSegment = (text: string, baseKey: number) => {
    const rawLines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < rawLines.length) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // 1. Math Block ($$...$$)
      if (trimmed.startsWith('$$')) {
        let mathContent = trimmed.slice(2);
        if (mathContent.endsWith('$$')) {
          mathContent = mathContent.slice(0, -2);
          i++;
        } else {
          // Multiline math
          i++;
          while (i < rawLines.length && !rawLines[i].trim().endsWith('$$')) {
            mathContent += '\n' + rawLines[i];
            i++;
          }
          if (i < rawLines.length) {
            mathContent += '\n' + rawLines[i].trim().replace(/\$\$$/, '');
            i++;
          }
        }

        elements.push(
          <div
            key={`math-${baseKey}-${i}`}
            className="my-4 p-4 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-slate-900/60 shadow-xl flex items-center justify-center gap-3 font-serif italic text-base sm:text-lg text-blue-200 overflow-x-auto"
          >
            <Calculator className="w-5 h-5 text-purple-400 shrink-0 not-italic" />
            <div className="text-center font-mono text-sm sm:text-base text-slate-100">
              {formatMathFormula(mathContent.trim())}
            </div>
          </div>
        );
        continue;
      }

      // 2. GFM Table Detection (| col1 | col2 |)
      if (
        trimmed.startsWith('|') &&
        trimmed.endsWith('|') &&
        i + 1 < rawLines.length &&
        rawLines[i + 1].includes('|') &&
        rawLines[i + 1].includes('-')
      ) {
        const tableLines: string[] = [];
        while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
          tableLines.push(rawLines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const headerRow = tableLines[0].split('|').slice(1, -1).map((s) => s.trim());
          const alignRow = tableLines[1].split('|').slice(1, -1).map((s) => s.trim());
          const dataRows = tableLines.slice(2).map((rowStr) =>
            rowStr.split('|').slice(1, -1).map((s) => s.trim())
          );

          const alignments = alignRow.map((a) => {
            if (a.startsWith(':') && a.endsWith(':')) return 'center';
            if (a.endsWith(':')) return 'right';
            return 'left';
          });

          elements.push(
            <div
              key={`table-${baseKey}-${i}`}
              className="my-5 overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-950/70 shadow-2xl custom-scrollbar"
            >
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white font-bold border-b border-slate-700/90">
                    {headerRow.map((col, cIdx) => (
                      <th
                        key={cIdx}
                        className={`px-4 py-3 uppercase tracking-wider text-[11px] font-extrabold text-blue-300 ${
                          alignments[cIdx] === 'center'
                            ? 'text-center'
                            : alignments[cIdx] === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {formatInline(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {dataRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-blue-600/[0.04] transition-colors even:bg-slate-900/40 odd:bg-slate-950/30"
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-4 py-3 text-slate-200 leading-relaxed ${
                            alignments[cIdx] === 'center'
                              ? 'text-center'
                              : alignments[cIdx] === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {formatInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 3. Standalone Image: ![Alt](url "Caption") or ![Alt](url)
      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
      if (imageMatch) {
        const altText = imageMatch[1] || 'Imagem ilustrativa';
        const imgUrl = imageMatch[2];
        const caption = imageMatch[3] || altText;

        if (!failedImages.has(imgUrl)) {
          elements.push(
            <div
              key={`img-${baseKey}-${i}`}
              className="my-5 rounded-2xl border border-slate-700/80 bg-[#080d1e] overflow-hidden shadow-2xl group/card max-w-xl mx-auto"
            >
              <div
                onClick={() => handleImageOpen(imgUrl, altText, caption)}
                className="relative aspect-video sm:aspect-[16/10] bg-slate-950 overflow-hidden cursor-pointer"
              >
                <img
                  src={imgUrl}
                  alt={altText}
                  onError={() => handleImageError(imgUrl)}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity flex items-end justify-between p-4">
                  <span className="flex items-center gap-1.5 text-xs text-white font-medium bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ver em alta resolução</span>
                  </span>
                </div>
              </div>

              {caption && (
                <div className="p-3 bg-slate-900/90 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate italic">{caption}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">
                    Wikimedia / Verificada
                  </span>
                </div>
              )}
            </div>
          );
        }
        i++;
        continue;
      }

      // 4. GitHub-style Callouts: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]
      const calloutMatch = trimmed.match(/^>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]\s*(.*)/i);
      if (calloutMatch) {
        const calloutType = calloutMatch[1].toUpperCase();
        let calloutBody = calloutMatch[2];
        i++;

        // Collect following lines in the callout
        while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
          calloutBody += '\n' + rawLines[i].trim().replace(/^>\s*/, '');
          i++;
        }

        let borderClass = 'border-blue-500/40 bg-blue-950/20 text-blue-200';
        let IconComp = Info;
        let titleLabel = 'Nota Informativa';

        if (calloutType === 'TIP') {
          borderClass = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200';
          IconComp = Sparkles;
          titleLabel = 'Dica Prática';
        } else if (calloutType === 'WARNING' || calloutType === 'CAUTION') {
          borderClass = 'border-amber-500/40 bg-amber-950/20 text-amber-200';
          IconComp = AlertTriangle;
          titleLabel = 'Atenção';
        } else if (calloutType === 'IMPORTANT') {
          borderClass = 'border-purple-500/40 bg-purple-950/20 text-purple-200';
          IconComp = CheckCircle2;
          titleLabel = 'Importante';
        }

        elements.push(
          <div
            key={`callout-${baseKey}-${i}`}
            className={`my-4 p-4 rounded-2xl border-l-4 rounded-r-2xl border ${borderClass} shadow-lg space-y-1`}
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <IconComp className="w-4 h-4 shrink-0" />
              <span>{titleLabel}</span>
            </div>
            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed pl-6 whitespace-pre-line">
              {formatInline(calloutBody.trim())}
            </div>
          </div>
        );
        continue;
      }

      // 5. Standard Blockquote
      if (trimmed.startsWith('> ')) {
        let quoteText = trimmed.replace(/^>\s*/, '');
        i++;
        while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
          quoteText += ' ' + rawLines[i].trim().replace(/^>\s*/, '');
          i++;
        }

        elements.push(
          <blockquote
            key={`quote-${baseKey}-${i}`}
            className="my-4 border-l-4 border-gradient-to-b from-blue-500 to-purple-500 border-blue-500 pl-4 py-2 italic text-slate-300 bg-blue-500/5 rounded-r-2xl flex items-start gap-3"
          >
            <Quote className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 not-italic" />
            <div className="leading-relaxed text-xs sm:text-sm">{formatInline(quoteText)}</div>
          </blockquote>
        );
        continue;
      }

      // 6. Horizontal Rules (--- or ***)
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        elements.push(
          <div
            key={`hr-${baseKey}-${i}`}
            className="h-px my-6 bg-gradient-to-r from-transparent via-slate-700 to-transparent"
          />
        );
        i++;
        continue;
      }

      // 7. Headings
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${baseKey}-${i}`}
            className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-6 mb-3 pb-2 border-b border-slate-800/80 flex items-center gap-2"
          >
            <span>{formatInline(trimmed.replace(/^#\s+/, ''))}</span>
          </h1>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${baseKey}-${i}`}
            className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight mt-5 mb-2.5 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span>{formatInline(trimmed.replace(/^##\s+/, ''))}</span>
          </h2>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${baseKey}-${i}`}
            className="text-base sm:text-lg font-semibold text-blue-300 mt-4 mb-2 flex items-center gap-1.5"
          >
            <span>{formatInline(trimmed.replace(/^###\s+/, ''))}</span>
          </h3>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4
            key={`h4-${baseKey}-${i}`}
            className="text-sm sm:text-base font-semibold text-purple-300 mt-3 mb-1.5"
          >
            {formatInline(trimmed.replace(/^####\s+/, ''))}
          </h4>
        );
        i++;
        continue;
      }

      // 8. Lists (Unordered & Ordered)
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
        const isNumbered = /^\d+\.\s/.test(trimmed);

        if (isNumbered) {
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            elements.push(
              <div
                key={`li-num-${baseKey}-${i}`}
                className="flex items-start gap-3 my-1.5 pl-1 text-slate-200 text-xs sm:text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {numMatch[1]}
                </span>
                <span className="leading-relaxed flex-1">{formatInline(numMatch[2])}</span>
              </div>
            );
          }
        } else {
          // Bullet list or Checkbox
          const itemText = trimmed.replace(/^(\*|-)\s+/, '');
          const isCheckDone = itemText.startsWith('[x] ') || itemText.startsWith('[X] ');
          const isCheckEmpty = itemText.startsWith('[ ] ');

          if (isCheckDone || isCheckEmpty) {
            elements.push(
              <div
                key={`li-chk-${baseKey}-${i}`}
                className="flex items-start gap-2.5 my-1.5 pl-1 text-slate-200 text-xs sm:text-sm"
              >
                <span className={`mt-0.5 shrink-0 ${isCheckDone ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isCheckDone ? <Check className="w-4 h-4" /> : <div className="w-3.5 h-3.5 rounded border border-slate-600" />}
                </span>
                <span className={`leading-relaxed ${isCheckDone ? 'line-through text-slate-400' : ''}`}>
                  {formatInline(itemText.replace(/^\[[ xX]\]\s*/, ''))}
                </span>
              </div>
            );
          } else {
            elements.push(
              <div
                key={`li-bullet-${baseKey}-${i}`}
                className="flex items-start gap-2.5 my-1.5 pl-2 text-slate-200 text-xs sm:text-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-400 mt-2 shrink-0 shadow-sm" />
                <span className="leading-relaxed flex-1">{formatInline(itemText)}</span>
              </div>
            );
          }
        }

        i++;
        continue;
      }

      // 9. Empty space
      if (!trimmed) {
        elements.push(<div key={`sp-${baseKey}-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 10. Regular Paragraph
      elements.push(
        <p key={`p-${baseKey}-${i}`} className="leading-relaxed text-slate-200 text-xs sm:text-sm">
          {formatInline(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Helper for inline styles: Bold, Italic, Strikethrough, Math, Code, Link, Citations [1]
  const formatInline = (text: string): React.ReactNode => {
    if (!text) return '';

    const parts: React.ReactNode[] = [];
    // Regex for: inline code, math $...$, bold/italic, strikethrough, links [text](url), citations [1]
    const inlineRegex = /(`[^`]+`|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[\d+\]|\[[^\]]+\]\([^)]+\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIdx = 0;

    while ((match = inlineRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const tok = match[0];

      // Inline code `...`
      if (tok.startsWith('`') && tok.endsWith('`')) {
        parts.push(
          <code
            key={keyIdx++}
            className="px-1.5 py-0.5 rounded-md bg-blue-950/70 text-blue-300 font-mono text-xs border border-blue-800/40 font-semibold"
          >
            {tok.slice(1, -1)}
          </code>
        );
      }
      // Inline math $...$
      else if (tok.startsWith('$') && tok.endsWith('$') && tok.length > 2) {
        parts.push(
          <span
            key={keyIdx++}
            className="px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-300 font-serif italic text-xs border border-purple-800/30 mx-0.5"
          >
            {formatMathFormula(tok.slice(1, -1))}
          </span>
        );
      }
      // Bold **...**
      else if (tok.startsWith('**') && tok.endsWith('**')) {
        parts.push(
          <strong key={keyIdx++} className="font-bold text-white">
            {tok.slice(2, -2)}
          </strong>
        );
      }
      // Italic *...*
      else if (tok.startsWith('*') && tok.endsWith('*')) {
        parts.push(
          <em key={keyIdx++} className="italic text-slate-300">
            {tok.slice(1, -1)}
          </em>
        );
      }
      // Strikethrough ~~...~~
      else if (tok.startsWith('~~') && tok.endsWith('~~')) {
        parts.push(
          <span key={keyIdx++} className="line-through text-slate-500">
            {tok.slice(2, -2)}
          </span>
        );
      }
      // Citation badge [1], [2]
      else if (/^\[\d+\]$/.test(tok)) {
        parts.push(
          <span
            key={keyIdx++}
            className="inline-flex items-center justify-center text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1 py-0.2 rounded-md mx-0.5 align-super cursor-pointer hover:bg-purple-500/30 transition-colors"
            title={`Referência da fonte ${tok}`}
          >
            {tok.slice(1, -1)}
          </span>
        );
      }
      // Link [text](url)
      else if (tok.startsWith('[') && tok.includes('](')) {
        const linkMatch = tok.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          parts.push(
            <a
              key={keyIdx++}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline font-medium inline-flex items-center gap-0.5 transition-colors"
            >
              <span>{linkMatch[1]}</span>
              <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-70" />
            </a>
          );
        } else {
          parts.push(tok);
        }
      }

      lastIndex = match.index + tok.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="markdown-content text-slate-200 select-text leading-relaxed">
      {renderContentBlocks()}

      {/* Embedded Lightbox Modal if an image in markdown is clicked */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full rounded-3xl border border-slate-800 bg-[#070c1d] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Top Bar */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {lightboxImage.alt || 'Imagem'}
              </span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image View */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/60 min-h-[300px]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.alt}
                className="max-h-[65vh] max-w-full rounded-2xl object-contain shadow-2xl"
              />
            </div>

            {/* Bottom info bar */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-300 italic truncate">{lightboxImage.caption || lightboxImage.alt}</p>
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Abrir Imagem Original</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
