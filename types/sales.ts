export interface SaleItem {
  id: string;
  quantity: number;
  effective_quantity: number;
  unit_price: number;
  total_price: number;
  products: {
    name: string;
  };
}

export interface Sale {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  total_amount: number;
  payment_method: "cash" | "bank_transfer" | "mpesa" | "cheque";
  payment_reference: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles: {
    full_name: string;
  };
  approved_by_profile: {
    full_name: string;
  } | null;
  sale_items: SaleItem[];
}
