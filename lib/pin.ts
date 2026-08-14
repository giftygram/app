import bcrypt from "bcryptjs";

export function hashPin(pin: string) {
  return bcrypt.hashSync(pin, 10);
}

export function verifyPin(pin: string, hash: string) {
  return bcrypt.compareSync(pin, hash);
}
