import { randomBytes, pbkdf2Sync } from 'crypto';
require('dotenv').config();

const iterations = parseInt(process.env.PBKDF2_ITERATIONS || '10000', 10);
const keylen = parseInt(process.env.PBKDF2_KEYLEN || '64', 10);
const digest = process.env.PBKDF2_DIGEST || 'sha512';

export function hashPasswordCrypto(password: string): { salt: string, hash: string } {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return { salt, hash };
}

export function comparePasswordCrypto(password: string, salt: string, hash: string): boolean {
    const hashToCompare = pbkdf2Sync(password, salt, iterations, keylen, digest).toString('hex');
    return hash === hashToCompare;
}
