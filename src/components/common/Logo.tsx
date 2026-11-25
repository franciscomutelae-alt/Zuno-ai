import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSlogan = false, className = '' }) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Original ZUNO AI Geometric Core Symbol */}
      <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1.5px] shadow-lg shadow-indigo-500/25 ${iconSizes[size]}`}>
        <div className="w-full h-full bg-[#070b19] rounded-[10px] flex items-center justify-center relative overflow-hidden group">
          {/* Subtle glowing center flare */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-transparent to-purple-500/30 opacity-70 group-hover:opacity-100 transition-opacity" />
          
          {/* Stylized 'Z' Node vector */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-3/5 h-3/5 relative z-10 transition-transform group-hover:scale-110 duration-300"
          >
            <path
              d="M5 6H19L9 18H19"
              stroke="url(#zunoGrad)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="5" cy="6" r="2" fill="#60a5fa" />
            <circle cx="19" cy="18" r="2" fill="#c084fc" />
            <defs>
              <linearGradient id="zunoGrad" x1="5" y1="6" x2="19" y2="18" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60a5fa" />
                <stop offset="0.5" stopColor="#818cf8" />
                <stop offset="1" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          <span className={`font-extrabold text-white tracking-wider ${textSizes[size]}`}>ZUNO</span>
          <span className={`bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent font-black ${textSizes[size]}`}>AI</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 ml-0.5">
            2.5
          </span>
        </div>
        {showSlogan && (
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            A tua inteligência. Sem limites.
          </span>
        )}
      </div>
    </div>
  );
};
