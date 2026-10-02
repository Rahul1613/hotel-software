import React from 'react';

interface FoodBadgeProps {
  isVeg: boolean;
  foodType?: string;
  size?: 'sm' | 'md';
}

export const FoodBadge: React.FC<FoodBadgeProps> = ({ isVeg, foodType, size = 'md' }) => {
  const boxSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  if (isVeg) {
    return (
      <div 
        title="Vegetarian"
        className={`flex items-center justify-center border-2 border-[#258451] rounded-sm bg-white shrink-0 ${boxSize}`}
      >
        <div className={`rounded-full bg-[#258451] ${dotSize}`} />
      </div>
    );
  }

  // Non-Veg standard green/red compliance
  const typeLabel = foodType ? foodType.toUpperCase() : 'NON-VEG';

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <div 
        title={`Non-Vegetarian (${typeLabel})`}
        className={`flex items-center justify-center border-2 border-[#C83E3E] rounded-sm bg-white shrink-0 ${boxSize}`}
      >
        {/* Standard non-veg red triangle/circle */}
        <div 
          className="w-0 h-0 border-x-[4px] border-x-transparent border-b-[8px] border-b-[#C83E3E]" 
        />
      </div>
      {foodType && foodType !== 'veg' && (
        <span className="text-[10px] font-semibold tracking-wider text-[#C83E3E] uppercase bg-red-50 border border-red-200 px-1 py-0.5 rounded">
          {foodType}
        </span>
      )}
    </div>
  );
};
