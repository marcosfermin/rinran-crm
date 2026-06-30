import { useState } from 'react';
import { X } from 'lucide-react';

const SIZES = {
  xs: 'w-8 h-8 text-[11px]',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-xl',
};

const INITIALS_COLORS = [
  'bg-rose-600',
  'bg-pink-600',
  'bg-fuchsia-600',
  'bg-purple-600',
  'bg-violet-600',
  'bg-indigo-600',
  'bg-blue-600',
  'bg-sky-600',
  'bg-cyan-600',
  'bg-teal-600',
  'bg-emerald-600',
  'bg-green-600',
  'bg-lime-600',
  'bg-yellow-600',
  'bg-amber-600',
  'bg-orange-600',
];

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InitialsAvatar({ contact, sizeClass, className, onClick }) {
  const color = INITIALS_COLORS[hashStr(contact?.phone || contact?.name || '') % INITIALS_COLORS.length];
  const initials = getInitials(contact?.name);
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 select-none font-semibold text-white ${color} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {initials}
    </div>
  );
}

export function Avatar({ contact, size = 'md', className = '', onClick }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZES[size] || SIZES.md;
  const base = `${sizeClass} rounded-full overflow-hidden bg-gray-800 flex items-center justify-center shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`;

  const photoSrc = contact?.id && contact?.profile_pic_url
    ? `/api/contacts/${contact.id}/photo`
    : null;

  if (photoSrc && !imgError) {
    return (
      <div className={base} onClick={onClick}>
        <img
          src={photoSrc}
          alt={contact?.name}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return <InitialsAvatar contact={contact} sizeClass={sizeClass} className={className} onClick={onClick} />;
}

export function PhotoLightbox({ contact, onClose }) {
  if (!contact) return null;
  const hasPhoto = contact.id && contact.profile_pic_url;
  const color = INITIALS_COLORS[hashStr(contact?.phone || contact?.name || '') % INITIALS_COLORS.length];

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

      {hasPhoto ? (
        <img
          src={`/api/contacts/${contact.id}/photo`}
          alt={contact.name}
          className="w-64 h-64 rounded-full object-cover shadow-2xl border-4 border-gray-700"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className={`w-64 h-64 rounded-full flex items-center justify-center text-7xl font-bold text-white shadow-2xl ${color}`}
          onClick={e => e.stopPropagation()}
        >
          {getInitials(contact.name)}
        </div>
      )}

      <div className="text-center" onClick={e => e.stopPropagation()}>
        <p className="text-white font-semibold text-xl">{contact.name}</p>
        <p className="text-gray-400 text-sm mt-1 font-mono">{contact.phone}</p>
      </div>
    </div>
  );
}
