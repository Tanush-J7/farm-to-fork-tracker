// Row shape for the `products` table in Supabase (Postgres).
export interface IProduct {
  id: string;
  product_id: number; // mapping to blockchain ID
  name: string;
  category: string;
  batch_number: string;
  quantity: number;
  farmer_id: string;
  current_owner_id: string;
  status: string;
  organic_status: boolean;
  expiry_date?: string | null;
  product_image_url?: string | null;
  ai_quality_score?: number | null;
  ai_quality_label?: string | null;
  ai_shelf_life?: unknown;
  blockchain_hash?: string | null;
  created_at: string;
  updated_at: string;
}
