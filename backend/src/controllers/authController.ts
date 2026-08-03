import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'farmchain_super_secret_key';

const signToken = (id: string, role: string) =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '30d' });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, walletAddress } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Please provide name, email and password' });
      return;
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      res.status(400).json({ success: false, message: 'User with this email already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        role,
        wallet_address: walletAddress,
      })
      .select('id, name, email, role')
      .single();

    if (error || !user) {
      res.status(500).json({ success: false, message: 'Server Error', error });
      return;
    }

    const token = signToken(user.id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Please provide email and password' });
      return;
    }

    // Password is included here because the backend uses the Supabase
    // service-role key, which bypasses RLS/column restrictions — unlike
    // Mongoose's `select: false`, Supabase has no per-column select guard,
    // so we simply avoid returning `password` in any response payload.
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, password, role')
      .eq('email', email)
      .maybeSingle<IUser>();

    if (error || !user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = signToken(user.id, user.role);

    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
