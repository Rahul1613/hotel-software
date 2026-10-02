import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark' | 'gold';
  showSubtitle?: boolean;
}

export const EkdantLogo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'dark',
}) => {
  const isLight = variant === 'light';

  const heightClass = {
    sm: 'h-8 sm:h-9',
    md: 'h-11 sm:h-12',
    lg: 'h-16 sm:h-20',
    xl: 'h-24 sm:h-28',
  }[size];

  return (
    <div className="inline-flex items-center select-none">
      <img 
        src="/ekdant_logo.png" 
        alt="Hotel Ekdant Family Restaurant" 
        className={`w-auto object-contain transition-all ${heightClass} ${
          isLight ? 'brightness-0 invert drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'drop-shadow-xs'
        }`}
      />
    </div>
  );
};
