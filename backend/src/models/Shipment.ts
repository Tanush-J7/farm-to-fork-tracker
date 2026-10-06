export interface IShipment {
  id: string;
  shipment_tracking_id: string;
  request_id?: string | null;
  batch_number: string;
  product_id: string;
  retailer_id: string;
  processor_id: string;
  distributor_id?: string | null;
  quantity: number;
  unit: string;
  expected_delivery?: string | null;
  status: 'CREATED' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED' | 'RECEIVED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}
