import { encryptToken, decryptToken, isEncrypted } from '../src/lib/crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const original = 'gho_TestToken_1234567890abcdef';

console.log('Ключ задан:', !!process.env.TOKEN_ENCRYPTION_KEY);
console.log('Длина ключа:', process.env.TOKEN_ENCRYPTION_KEY?.length);
console.log('');

try {
  const encrypted = encryptToken(original);
  console.log('Зашифрован:', encrypted.slice(0, 60) + '...');
  console.log('Формат ок:', isEncrypted(encrypted));

  const decrypted = decryptToken(encrypted);
  console.log('Расшифрован:', decrypted);
  console.log('Совпадает:', decrypted === original);
} catch (e) {
  console.error('ОШИБКА:', (e as Error).message);
}