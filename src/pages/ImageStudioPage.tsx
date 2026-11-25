import React from 'react';
import { ZUNOImageGenerator } from '../components/image/ZUNOImageGenerator';
import { Sparkles } from 'lucide-react';

interface ImageStudioPageProps {
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToPricing: () => void;
  onRequireAuth?: (featureLabel?: string) => void;
  onOpenAuth?: (mode: 'login' | 'signup' | 'switch') => void;
}

export const ImageStudioPage: React.FC<ImageStudioPageProps> = ({
  onShowToast,
  onNavigateToPricing,
  onRequireAuth,
  onOpenAuth,
}) => {
  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-[550px] h-[550px] bg-purple-600/15 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <ZUNOImageGenerator
          onShowToast={onShowToast}
          onNavigateToPricing={onNavigateToPricing}
          onRequireAuth={onRequireAuth}
          onOpenAuth={onOpenAuth}
        />
      </div>
    </div>
  );
};
