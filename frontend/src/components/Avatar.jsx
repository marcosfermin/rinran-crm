import { useState } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  xs: 'w-8 h-8 text-base',
  sm: 'w-10 h-10 text-xl',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

export function Avatar({ contact, size = 'md', className = '', onClick }) {
  const [imgError, setImgError] = useState(false);
  const base = `${SIZES[size] || SIZES.md} rounded-full overflow-hidden bg-gray-800 flex items-center justify-center shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`;

  if (contact?.profile_pic_url && !imgError) {
    return (
      <div className={base} onClick={onClick}>
        <img
          src={contact.profile_pic_url}
          alt={contact?.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={base} onClick={onClick}>
      <span>{contact?.country_flag || '👤'}</span>
    </div>
  );
}

export function PhotoLightbox({ contact, onClose }) {
  if (!contact) return null;
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 gap-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
        onClick={onClose}
      >
        <X size={24} />
      </button>

      {contact.profile_pic_url ? (
        <img
          src={contact.profile_pic_url}
          alt={contact.name}
          className="w-64 h-64 rounded-full object-cover shadow-2xl border-4 border-gray-700"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className="w-64 h-64 rounded-full bg-gray-800 flex items-center justify-center text-8xl"
          onClick={e => e.stopPropagation()}
        >
          {contact.country_flag || '👤'}
        </div>
      )}

      <div className="text-center" onClick={e => e.stopPropagation()}>
        <p className="text-white font-semibold text-xl">{contact.name}</p>
        <p className="text-gray-400 text-sm mt-1 font-mono">{contact.phone}</p>
      </div>
    </div>
  );
}
