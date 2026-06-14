import crypto from 'node:crypto';
import type { UserRole } from '@prisma/client';

type TokenPayload = {
  userId: string;
  role: UserRole;
  login: string;
  exp: number;
};

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 120000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = 'sha256';

const getSecret = () => process.env.AUTH_SECRET || 'dev-only-auth-secret-change-me';

const getTokenTtlSeconds = () => {
  const value = Number(process.env.AUTH_TOKEN_TTL_SECONDS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TOKEN_TTL_SECONDS;
};

const toBase64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const fromBase64Url = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
};

const sign = (value: string) => toBase64Url(crypto.createHmac('sha256', getSecret()).update(value).digest());

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString('hex');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
};

export const verifyPassword = (password: string, storedHash: string) => {
  const [algorithm, iterationsRaw, salt, hash] = storedHash.split('$');

  if (algorithm !== 'pbkdf2' || !iterationsRaw || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  const calculated = crypto.pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculated, 'hex'));
};

export const createSessionToken = (payload: Omit<TokenPayload, 'exp'>) => {
  const tokenPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + getTokenTtlSeconds(),
  };
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

export const verifySessionToken = (token: string): TokenPayload | null => {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature || signature !== sign(encodedPayload)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as TokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
