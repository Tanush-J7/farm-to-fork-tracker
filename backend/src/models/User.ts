// Row shape for the `users` table in Supabase (Postgres).
// This is a plain type now — Supabase handles storage/constraints,
// so there's no schema object to define like there was with Mongoose.
export type UserRole = 'admin' | 'farmer' | 'processor' | 'distributor' | 'retailer' | 'consumer';

export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hash, only selected explicitly
  role: UserRole;
  wallet_address?: string | null;
  created_at: string;
  updated_at: string;
}

// Shape returned to clients (never includes the password hash)
export type PublicUser = Omit<IUser, 'password'>;
