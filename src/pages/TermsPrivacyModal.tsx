import React from 'react';
import { X, Shield, FileText, CheckCircle2, Lock } from 'lucide-react';

interface TermsPrivacyModalProps {
  isOpen: boolean;
  type: 'terms' | 'privacy';
  onClose: () => void;
}

export const TermsPrivacyModal: React.FC<TermsPrivacyModalProps> = ({
  isOpen,
  type,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative max-w-2xl w-full rounded-3xl border border-slate-800 bg-[#070b18] p-6 sm:p-8 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            {type === 'privacy' ? (
              <Shield className="w-5 h-5 text-blue-400" />
            ) : (
              <FileText className="w-5 h-5 text-purple-400" />
            )}
            <h3 className="text-lg font-bold text-white">
              {type === 'privacy' ? 'Política de Privacidade ZUNO AI' : 'Termos de Utilização ZUNO AI'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto py-6 space-y-5 text-xs text-slate-300 leading-relaxed pr-2">
          {type === 'privacy' ? (
            <>
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  1. Proteção de Dados & Conformidade RGPD
                </h4>
                <p>
                  No ZUNO AI, a privacidade é um pilar estruturante. Todos os dados submetidos no chat, ficheiros e documentos carregados são transmitidos de forma encriptada através de protocolos TLS 1.3 de última geração e processados estritamente para fornecer as respostas solicitadas.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">2. Não Utilização para Treino Público</h4>
                <p>
                  Os teus dados privados e prompts não são vendidos a terceiros nem disponibilizados publicamente. Todas as consultas ao motor de inteligência artificial são realizadas através de APIs seguras de nível empresarial.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">3. Controlo Total da Memória</h4>
                <p>
                  O utilizador tem controlo soberano sobre qualquer memória persistente. A qualquer momento podes desativar a memória, inspecionar cada item armazenado ou eliminar todos os dados associados na secção de Definições.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">4. Direito ao Esquecimento</h4>
                <p>
                  Disponibilizamos um botão direto para Eliminar Conta e Dados. Ao acionar essa função, todo o histórico, faturas e memórias são apagados sem retenção residual.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">1. Objeto do Serviço</h4>
                <p>
                  O ZUNO AI é uma plataforma internacional de inteligência artificial desenhada para fornecer assistência criativa, técnica, educacional e de produtividade através de modelos de inteligência artificial de alta performance.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">2. Utilização Responsável</h4>
                <p>
                  O utilizador compromete-se a não utilizar a plataforma para gerar conteúdos ilegais, difamatórios, maliciosos, que violem direitos de autor ou que constituam ataques de injeção de comandos (prompt injection).
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">3. Planos & Subscrições</h4>
                <p>
                  O plano Free disponibiliza mensagens diárias gratuitas com reinicialização diária. Os planos Pro e Ultra proporcionam quotas superiores e ferramentas avançadas com possibilidade de cancelamento a qualquer instante sem taxas de rescisão.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-bold text-white">4. Propriedade Intelectual do Utilizador</h4>
                <p>
                  Todo o código, textos, histórias e conteúdos gerados pelas ferramentas ZUNO pertencem inteiramente ao utilizador para qualquer finalidade académica ou comercial.
                </p>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs cursor-pointer"
          >
            Compreendi e Aceito
          </button>
        </div>
      </div>
    </div>
  );
};
