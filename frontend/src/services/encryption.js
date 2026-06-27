import CryptoJS from 'crypto-js';

const SECRET_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback_secret_key_if_env_fails_2026';

export const encrypt = (text) => {
  if (!text) return text;
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

export const decrypt = (ciphertext) => {
  if (!ciphertext) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext; // Se falhar e retornar vazio, devolve o original (fallback de retrocompatibilidade)
  } catch (e) {
    return ciphertext; // Se não estiver criptografado, devolve o texto original
  }
};

// Encriptar todo o objeto de Lead (campos sensíveis)
export const encryptLead = (lead) => {
  return {
    ...lead,
    phone: encrypt(lead.phone),
    email: encrypt(lead.email)
  };
};

// Descriptografar todo o objeto de Lead
export const decryptLead = (lead) => {
  return {
    ...lead,
    phone: decrypt(lead.phone),
    email: decrypt(lead.email)
  };
};
