import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl w-full ${maxWidth} p-6 shadow-2xl border border-[#C49A52]/40 space-y-4 animate-in fade-in zoom-in-95 duration-150`}>
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <h3 className="font-serif-royal font-bold text-lg text-[#641C24]">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black font-bold p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
