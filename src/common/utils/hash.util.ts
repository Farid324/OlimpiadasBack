// src/common/utils/hash.util.ts
import bcrypt from 'bcrypt';
export const hash = (plain: string) => bcrypt.hash(plain, 10);
export const compare = (plain: string, hashed: string) =>
  bcrypt.compare(plain, hashed);
