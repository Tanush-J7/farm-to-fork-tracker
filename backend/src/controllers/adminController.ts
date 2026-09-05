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

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('users').delete().eq('id', id).select();

    if (error) throw error;
    res.status(200).json({ success: true, message: 'User deleted successfully', data });
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

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { data: users, error: userError } = await supabase.from('users').select('id, role, created_at');
    const { data: products, error: productError } = await supabase.from('products').select('id, name, quantity, ai_quality_label, created_at, blockchain_hash');

    if (userError || productError) throw new Error('Database fetch failed');

    const activeUsers = users.length;
    const productsTracked = products.length;
    
    // Revenue mock: assume $10 per kg of quantity
    const totalRevenue = products.reduce((sum, p) => sum + ((p.quantity || 0) * 10), 0);
    const blockchainTxs = products.filter(p => p.blockchain_hash).length;

    // Quality distribution
    const qualityMap: Record<string, number> = { 'Excellent': 0, 'Good': 0, 'Average': 0, 'Poor': 0, 'Unknown': 0 };
    products.forEach(p => {
      const label = p.ai_quality_label || 'Unknown';
      if (qualityMap[label] !== undefined) qualityMap[label]++;
      else qualityMap['Unknown']++;
    });

    const qualityData = [
      { name: "Excellent", value: qualityMap['Excellent'], color: "#22c55e" },
      { name: "Good", value: qualityMap['Good'], color: "#84cc16" },
      { name: "Average", value: qualityMap['Average'], color: "#eab308" },
      { name: "Poor", value: qualityMap['Poor'], color: "#ef4444" },
    ].filter(q => q.value > 0);

    // Recent Transactions
    const recentTx = products
      .filter(p => p.blockchain_hash)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(p => ({
        id: p.blockchain_hash.substring(0, 6) + '...' + p.blockchain_hash.slice(-4),
        product: p.name,
        type: 'Register',
        time: new Date(p.created_at).toLocaleDateString(),
        status: 'Confirmed'
      }));

    // For charts, mock last 6 months structure
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const last6Months = Array.from({length: 6}, (_, i) => {
      let d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return { month: months[d.getMonth()], num: d.getMonth(), year: d.getFullYear() };
    });

    const monthlyData = last6Months.map(m => {
      const prodsInMonth = products.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === m.num && d.getFullYear() === m.year;
      });
      return {
        month: m.month,
        products: prodsInMonth.length,
        revenue: prodsInMonth.reduce((sum, p) => sum + ((p.quantity || 0) * 10), 0)
      };
    });

    const userGrowthData = last6Months.map(m => {
      const usersInMonth = users.filter(u => {
        const d = new Date(u.created_at);
        return d.getMonth() === m.num && d.getFullYear() === m.year;
      });
      return {
        month: m.month,
        farmers: usersInMonth.filter(u => u.role === 'farmer').length,
        processors: usersInMonth.filter(u => u.role === 'processor').length,
        distributors: usersInMonth.filter(u => u.role === 'distributor').length,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        activeUsers,
        productsTracked,
        blockchainTxs,
        monthlyData,
        qualityData,
        userGrowthData,
        recentTx
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
