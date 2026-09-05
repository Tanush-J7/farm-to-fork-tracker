import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ethers } from 'ethers';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    
    const { data: activeShipments } = await supabase
      .from('products')
      .select('id')
      .in('status', ['In Transit', 'Processing']);
      
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

    const { data: aiAlerts } = await supabase
      .from('products')
      .select('id')
      .eq('ai_quality_label', 'Poor');

    res.status(200).json({
      success: true,
      data: {
        totalProducts: productCount || 0,
        activeShipments: activeShipments?.length || 0,
        totalUsers: userCount || 0,
        aiAlerts: aiAlerts?.length || 0,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at, wallet_address')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role) {
      res.status(400).json({ success: false, message: 'Role is required' });
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, name, email, role')
      .single();

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getBlockchainHealth = async (req: Request, res: Response) => {
  try {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!rpcUrl || !privateKey || !contractAddress) {
       res.status(200).json({ 
          success: true, 
          data: { 
             status: 'warning', 
             message: 'Blockchain env variables not configured on backend',
             walletBalance: '0.0',
             network: 'Unknown'
          }
       });
       return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    const network = await provider.getNetwork();

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        message: 'Connected to blockchain',
        walletAddress: wallet.address,
        walletBalance: ethers.formatEther(balance),
        network: network.name || network.chainId.toString(),
        contractAddress
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Blockchain Connection Error', error });
  }
};
