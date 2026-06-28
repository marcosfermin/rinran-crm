const { parsePhoneNumber, isValidPhoneNumber } = require('libphonenumber-js');

const COUNTRY_FLAGS = {
  AF: '🇦🇫', AL: '🇦🇱', DZ: '🇩🇿', AD: '🇦🇩', AO: '🇦🇴', AG: '🇦🇬', AR: '🇦🇷',
  AM: '🇦🇲', AU: '🇦🇺', AT: '🇦🇹', AZ: '🇦🇿', BS: '🇧🇸', BH: '🇧🇭', BD: '🇧🇩',
  BB: '🇧🇧', BY: '🇧🇾', BE: '🇧🇪', BZ: '🇧🇿', BJ: '🇧🇯', BT: '🇧🇹', BO: '🇧🇴',
  BA: '🇧🇦', BW: '🇧🇼', BR: '🇧🇷', BN: '🇧🇳', BG: '🇧🇬', BF: '🇧🇫', BI: '🇧🇮',
  CV: '🇨🇻', KH: '🇰🇭', CM: '🇨🇲', CA: '🇨🇦', CF: '🇨🇫', TD: '🇹🇩', CL: '🇨🇱',
  CN: '🇨🇳', CO: '🇨🇴', KM: '🇰🇲', CG: '🇨🇬', CD: '🇨🇩', CR: '🇨🇷', HR: '🇭🇷',
  CU: '🇨🇺', CY: '🇨🇾', CZ: '🇨🇿', DK: '🇩🇰', DJ: '🇩🇯', DM: '🇩🇲', DO: '🇩🇴',
  EC: '🇪🇨', EG: '🇪🇬', SV: '🇸🇻', GQ: '🇬🇶', ER: '🇪🇷', EE: '🇪🇪', SZ: '🇸🇿',
  ET: '🇪🇹', FJ: '🇫🇯', FI: '🇫🇮', FR: '🇫🇷', GA: '🇬🇦', GM: '🇬🇲', GE: '🇬🇪',
  DE: '🇩🇪', GH: '🇬🇭', GR: '🇬🇷', GD: '🇬🇩', GT: '🇬🇹', GN: '🇬🇳', GW: '🇬🇼',
  GY: '🇬🇾', HT: '🇭🇹', HN: '🇭🇳', HU: '🇭🇺', IS: '🇮🇸', IN: '🇮🇳', ID: '🇮🇩',
  IR: '🇮🇷', IQ: '🇮🇶', IE: '🇮🇪', IL: '🇮🇱', IT: '🇮🇹', JM: '🇯🇲', JP: '🇯🇵',
  JO: '🇯🇴', KZ: '🇰🇿', KE: '🇰🇪', KI: '🇰🇮', KP: '🇰🇵', KR: '🇰🇷', KW: '🇰🇼',
  KG: '🇰🇬', LA: '🇱🇦', LV: '🇱🇻', LB: '🇱🇧', LS: '🇱🇸', LR: '🇱🇷', LY: '🇱🇾',
  LI: '🇱🇮', LT: '🇱🇹', LU: '🇱🇺', MG: '🇲🇬', MW: '🇲🇼', MY: '🇲🇾', MV: '🇲🇻',
  ML: '🇲🇱', MT: '🇲🇹', MH: '🇲🇭', MR: '🇲🇷', MU: '🇲🇺', MX: '🇲🇽', FM: '🇫🇲',
  MD: '🇲🇩', MC: '🇲🇨', MN: '🇲🇳', ME: '🇲🇪', MA: '🇲🇦', MZ: '🇲🇿', MM: '🇲🇲',
  NA: '🇳🇦', NR: '🇳🇷', NP: '🇳🇵', NL: '🇳🇱', NZ: '🇳🇿', NI: '🇳🇮', NE: '🇳🇪',
  NG: '🇳🇬', NO: '🇳🇴', OM: '🇴🇲', PK: '🇵🇰', PW: '🇵🇼', PA: '🇵🇦', PG: '🇵🇬',
  PY: '🇵🇾', PE: '🇵🇪', PH: '🇵🇭', PL: '🇵🇱', PT: '🇵🇹', QA: '🇶🇦', RO: '🇷🇴',
  RU: '🇷🇺', RW: '🇷🇼', KN: '🇰🇳', LC: '🇱🇨', VC: '🇻🇨', WS: '🇼🇸', SM: '🇸🇲',
  ST: '🇸🇹', SA: '🇸🇦', SN: '🇸🇳', RS: '🇷🇸', SC: '🇸🇨', SL: '🇸🇱', SG: '🇸🇬',
  SK: '🇸🇰', SI: '🇸🇮', SB: '🇸🇧', SO: '🇸🇴', ZA: '🇿🇦', SS: '🇸🇸', ES: '🇪🇸',
  LK: '🇱🇰', SD: '🇸🇩', SR: '🇸🇷', SE: '🇸🇪', CH: '🇨🇭', SY: '🇸🇾', TW: '🇹🇼',
  TJ: '🇹🇯', TZ: '🇹🇿', TH: '🇹🇭', TL: '🇹🇱', TG: '🇹🇬', TO: '🇹🇴', TT: '🇹🇹',
  TN: '🇹🇳', TR: '🇹🇷', TM: '🇹🇲', TV: '🇹🇻', UG: '🇺🇬', UA: '🇺🇦', AE: '🇦🇪',
  GB: '🇬🇧', US: '🇺🇸', UY: '🇺🇾', UZ: '🇺🇿', VU: '🇻🇺', VE: '🇻🇪', VN: '🇻🇳',
  YE: '🇾🇪', ZM: '🇿🇲', ZW: '🇿🇼',
};

const COUNTRY_NAMES = {
  AR: 'Argentina', BO: 'Bolivia', BR: 'Brasil', CA: 'Canadá', CL: 'Chile',
  CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', DO: 'Rep. Dominicana',
  EC: 'Ecuador', SV: 'El Salvador', GT: 'Guatemala', HN: 'Honduras',
  MX: 'México', NI: 'Nicaragua', PA: 'Panamá', PY: 'Paraguay', PE: 'Perú',
  PR: 'Puerto Rico', UY: 'Uruguay', VE: 'Venezuela', US: 'Estados Unidos',
  ES: 'España', DE: 'Alemania', FR: 'Francia', IT: 'Italia', PT: 'Portugal',
  GB: 'Reino Unido', RU: 'Rusia', CN: 'China', IN: 'India', JP: 'Japón',
  KR: 'Corea del Sur', AU: 'Australia', ZA: 'Sudáfrica', NG: 'Nigeria',
  EG: 'Egipto', MA: 'Marruecos', TR: 'Turquía', SA: 'Arabia Saudita',
  AE: 'Emiratos Árabes', IL: 'Israel', PH: 'Filipinas', ID: 'Indonesia',
  MY: 'Malasia', TH: 'Tailandia', VN: 'Vietnam', PK: 'Pakistán',
};

function parsePhone(rawPhone) {
  // Normalize: ensure it has + prefix
  let phone = rawPhone.trim().replace(/\s+/g, '');
  if (!phone.startsWith('+')) phone = '+' + phone;

  try {
    const parsed = parsePhoneNumber(phone);
    if (!parsed) return { phone, country_code: null, country_flag: '🏳️', country_name: 'Desconocido' };

    const code = parsed.country || null;
    return {
      phone: parsed.number,
      country_code: code,
      country_flag: code ? (COUNTRY_FLAGS[code] || '🏳️') : '🏳️',
      country_name: code ? (COUNTRY_NAMES[code] || code) : 'Desconocido',
    };
  } catch {
    return { phone, country_code: null, country_flag: '🏳️', country_name: 'Desconocido' };
  }
}

module.exports = { parsePhone };
