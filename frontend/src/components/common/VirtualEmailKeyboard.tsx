import React, { useState } from 'react';
import { Delete, CornerDownLeft, ArrowBigUp } from 'lucide-react';

export interface VirtualEmailKeyboardProps {
  value: string;
  onChange: (newValue: string) => void;
  onSubmit?: () => void;
  isSubmitDisabled?: boolean;
  submitLabel?: string;
  className?: string;
}

export const VirtualEmailKeyboard: React.FC<VirtualEmailKeyboardProps> = ({
  value,
  onChange,
  onSubmit,
  isSubmitDisabled = false,
  submitLabel = 'Kirim Email',
  className = '',
}) => {
  const [isUppercase, setIsUppercase] = useState(false);

  const row1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const row2 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row3 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row4 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', '.', '_', '-'];

  const quickDomains = ['@gmail.com', '@yahoo.com', '@icloud.com', '@outlook.com'];

  const handleChar = (char: string) => {
    const finalChar = isUppercase ? char.toUpperCase() : char.toLowerCase();
    onChange(value + finalChar);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const handleDomainChip = (domain: string) => {
    // If value already has an @, replace domain or append
    const atIndex = value.indexOf('@');
    if (atIndex !== -1) {
      onChange(value.substring(0, atIndex) + domain);
    } else {
      onChange(value + domain);
    }
  };

  return (
    <div className={`w-full max-w-2xl flex flex-col gap-2.5 select-none ${className}`}>
      {/* Quick Domain Shortcuts */}
      <div className="flex items-center justify-center gap-2 flex-wrap mb-1">
        <span className="text-[11px] font-semibold text-slate-400 mr-1">Shortcut:</span>
        {quickDomains.map((domain) => (
          <button
            key={domain}
            type="button"
            onClick={() => handleDomainChip(domain)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            {domain}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-xs font-medium transition-all active:scale-95 cursor-pointer ml-auto"
        >
          Reset
        </button>
      </div>

      {/* Row 1: Numbers */}
      <div className="grid grid-cols-10 gap-1.5">
        {row1.map((char) => (
          <button
            key={char}
            type="button"
            onClick={() => handleChar(char)}
            className="h-11 rounded-xl glass-panel text-base font-bold text-white flex items-center justify-center touch-manipulation active:scale-90 active:bg-amber-500/20 active:border-amber-500 transition-all cursor-pointer shadow-sm"
          >
            {char}
          </button>
        ))}
      </div>

      {/* Row 2: QWERTY */}
      <div className="grid grid-cols-10 gap-1.5">
        {row2.map((char) => {
          const displayChar = isUppercase ? char.toUpperCase() : char;
          return (
            <button
              key={char}
              type="button"
              onClick={() => handleChar(char)}
              className="h-11 rounded-xl glass-panel text-base font-bold text-white flex items-center justify-center touch-manipulation active:scale-90 active:bg-amber-500/20 active:border-amber-500 transition-all cursor-pointer shadow-sm"
            >
              {displayChar}
            </button>
          );
        })}
      </div>

      {/* Row 3: ASDFGHJKL */}
      <div className="grid grid-cols-9 gap-1.5 px-3">
        {row3.map((char) => {
          const displayChar = isUppercase ? char.toUpperCase() : char;
          return (
            <button
              key={char}
              type="button"
              onClick={() => handleChar(char)}
              className="h-11 rounded-xl glass-panel text-base font-bold text-white flex items-center justify-center touch-manipulation active:scale-90 active:bg-amber-500/20 active:border-amber-500 transition-all cursor-pointer shadow-sm"
            >
              {displayChar}
            </button>
          );
        })}
      </div>

      {/* Row 4: ZXCVBNM . _ - */}
      <div className="grid grid-cols-10 gap-1.5">
        {row4.map((char) => {
          const displayChar = isUppercase && char.match(/[a-z]/i) ? char.toUpperCase() : char;
          return (
            <button
              key={char}
              type="button"
              onClick={() => handleChar(char)}
              className="h-11 rounded-xl glass-panel text-base font-bold text-white flex items-center justify-center touch-manipulation active:scale-90 active:bg-amber-500/20 active:border-amber-500 transition-all cursor-pointer shadow-sm"
            >
              {displayChar}
            </button>
          );
        })}
      </div>

      {/* Row 5: Modifiers, @, Space, Backspace, Submit */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsUppercase(!isUppercase)}
          className={`h-12 px-4 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
            isUppercase
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
              : 'glass-panel text-slate-300 border-white/10'
          }`}
          aria-label="Caps Lock"
        >
          <ArrowBigUp className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => handleChar('@')}
          className="h-12 w-14 rounded-xl glass-panel text-lg font-black text-amber-400 flex items-center justify-center touch-manipulation active:scale-90 active:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer shadow-sm"
        >
          @
        </button>

        <button
          type="button"
          onClick={handleBackspace}
          className="h-12 px-5 rounded-xl glass-panel text-slate-300 flex items-center justify-center touch-manipulation active:scale-90 active:bg-red-500/20 active:border-red-500 transition-all cursor-pointer"
          aria-label="Hapus karakter"
        >
          <Delete className="w-6 h-6" />
        </button>

        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="h-12 flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 touch-manipulation active:scale-95 transition-all shadow-glow-primary disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            <span>{submitLabel}</span>
            <CornerDownLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
};
