import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // для GCM 12 байт — стандарт
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  if (hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY должен быть 64 hex-символа (32 байта)',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Шифрует строку. Формат: iv:authTag:ciphertext (все hex).
 * Расшифровка возможна только тем же ключом.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Расшифровывает строку формата iv:authTag:ciphertext.
 * Если строка не зашифрована (старый формат) — возвращает как есть.
 * Так делаем миграцию бесшовной.
 */
export function decryptToken(payload: string): string {
  const parts = payload.split(':');

  // Если это не наш формат — возвращаем как есть
  if (parts.length !== 3) {
    return payload;
  }

  const [ivHex, tagHex, dataHex] = parts;

  if (
    ivHex.length !== IV_LENGTH * 2 ||
    tagHex.length !== TAG_LENGTH * 2
  ) {
    return payload;
  }

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (e) {
    console.error('[crypto] decrypt failed:', (e as Error).message);
    // Возвращаем как есть — если ключ сменился, лучше не падать
    return payload;
  }
}

/**
 * Проверка: зашифрована ли строка в нашем формате.
 */
export function isEncrypted(payload: string): boolean {
  const parts = payload.split(':');
  if (parts.length !== 3) return false;
  const [ivHex, tagHex] = parts;
  return ivHex.length === IV_LENGTH * 2 && tagHex.length === TAG_LENGTH * 2;
}