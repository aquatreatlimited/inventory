"use server";

import { createClient } from "./server";
import type { 
  Profile, 
  UserRole,
  SaleMetrics, 
  InventoryMetrics, 
  CustomerMetrics, 
  InventoryValueItem 
} from "@/lib/types/index";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./admin";
import { cache } from "react";
import type { Database } from "@/types/supabase";
import { subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from "date-fns";
import { format } from "date-fns";

// Add these helper functions at the top of the file
function processDailySales(
  sales: any[]
): Array<{ date: string; total_amount: number }> {
  const dailyTotals = sales.reduce((acc: { [key: string]: number }, sale) => {
    const date = format(new Date(sale.created_at), "yyyy-MM-dd");
    acc[date] = (acc[date] || 0) + sale.total_amount;
    return acc;
  }, {});

  return Object.entries(dailyTotals).map(([date, total_amount]) => ({
    date,
    total_amount,
  }));
}

function sumSales(sales: Array<{ total_amount: number }>): number {
  return sales.reduce((sum, sale) => sum + sale.total_amount, 0);
}

function calculateInventoryValue(inventory: InventoryValueItem[]): number {
  return inventory.reduce(
    (total, item) => total + item.quantity * (item.products?.unit_price || 0),
    0
  );
}

// Cache the getUsers function
export const getUsers = cache(async (): Promise<Profile[]> => {
  try {
    const supabase = await createClient();

    // First verify if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Promise.reject("Unauthorized");
    }

    // Then verify if user is admin
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      return Promise.reject("Unauthorized: Admin access required");
    }

    // Finally fetch all users
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return Promise.reject(error.message);
    }

    if (!data) {
      return [];
    }

    return data as Profile[];
  } catch (error) {
    return Promise.reject("Failed to fetch users");
  }
});

export async function deleteUser(userId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/users");
  } catch (error) {
    throw error;
  }
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/users");
  } catch (error) {
    throw error;
  }
}

export async function getUserById(userId: string): Promise<Profile> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function changeUserPassword(
  userId: string,
  password: string,
  isPersonal: boolean = false
): Promise<void> {
  try {
    const supabase = await createClient();

    if (isPersonal) {
      // For personal password changes, use updateUser
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw new Error(error.message);
      }
    } else {
      // For admin password changes, use admin.updateUserById
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (error) {
        throw new Error(error.message);
      }
    }
  } catch (error) {
    console.error("Password change error:", error);
    throw error;
  }
}

export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Profile;
  } catch (error) {
    throw error;
  }
}

export async function createUser(
  email: string,
  password: string,
  full_name: string,
  role: UserRole
): Promise<void> {
  "use server";

  try {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
        },
      });

    if (authError) throw authError;
    if (!authData.user) throw new Error("No user data returned");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name,
        email,
        role,
      });

    if (profileError) throw profileError;

    revalidatePath("/users");
  } catch (error) {
    console.error("Create user error:", error);
    throw error;
  }
}

// Add these types at the top
interface Product {
  id: string;
  name: string;
  description: string | null;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
  inventory: {
    quantity: number;
    location: "kamulu" | "utawala";
  }[];
}

// Add these functions to your existing file
export async function getProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        description,
        min_stock_level,
        created_at,
        updated_at,
        inventory (
          quantity,
          location
        )
      `
      )
      .order("name");

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
}

export async function getLocationProducts(location: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:product_categories(id, name),
        inventory!inner(quantity)
      `)
      .eq('inventory.location', location);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

// Add this function to handle product creation with inventory
export async function createProduct(
  name: string,
  description: string | null,
  min_stock_level: number,
  category_id: string | null = null
): Promise<void> {
  try {
    const supabase = await createClient();

    // First get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    // Then get their profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)  // Important: Query by user ID
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    if (!['admin', 'clerk'].includes(profile.role)) {
      throw new Error('You do not have permission to create products');
    }

    // Create the product with category
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        name,
        description,
        min_stock_level,
        category_id,
      })
      .select()
      .single();

    if (productError) {
      console.error('Product creation error:', productError);
      throw new Error(productError.message);
    }

    // Create inventory entries
    const { error: inventoryError } = await supabase
      .from("inventory")
      .insert([
        {
          product_id: product.id,
          location: "kamulu",
          quantity: 0,
        },
        {
          product_id: product.id,
          location: "utawala",
          quantity: 0,
        },
      ]);

    if (inventoryError) {
      console.error('Inventory creation error:', inventoryError);
      throw new Error(inventoryError.message);
    }

    revalidatePath("/inventory/kamulu");
    revalidatePath("/inventory/utawala");
  } catch (error) {
    console.error('Error in createProduct:', error);
    throw error;
  }
}

// Add this function to handle stock adjustments
export async function updateStockLevel(
  productId: string,
  location: "kamulu" | "utawala",
  quantity: number
): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("inventory")
      .update({ quantity })
      .eq("product_id", productId)
      .eq("location", location);

    if (error) throw error;

    revalidatePath("/inventory/kamulu");
    revalidatePath("/inventory/utawala");
  } catch (error) {
    throw error;
  }
}

// Add this type
interface TransferRecord {
  product_id: string;
  from_location: "kamulu" | "utawala";
  to_location: "kamulu" | "utawala";
  quantity: number;
  transferred_by: string;
  notes?: string;
}

// Add this function to record transfers
export async function recordTransfer({
  product_id,
  from_location,
  to_location,
  quantity,
  transferred_by,
  status = 'pending'
}: {
  product_id: string;
  from_location: string;
  to_location: string;
  quantity: number;
  transferred_by: string;
  status?: 'pending' | 'completed' | 'cancelled';
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transfers')
    .insert({
      product_id,
      from_location,
      to_location,
      quantity,
      transferred_by,
      status,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSalesMetrics(): Promise<SaleMetrics> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const thirtyDaysAgo = subMonths(now, 1);


    // Simplify the query first to check if we get any data
    const { data: dailySales, error } = await supabase
      .from("sales")
      .select("created_at, total_amount")
      .gte("created_at", thirtyDaysAgo.toISOString())
      .eq("status", "approved");

    if (error) {
      console.error("Error fetching sales:", error);
      throw error;
    }


    if (!dailySales || dailySales.length === 0) {
      // Return empty data structure instead of throwing
      return {
        dailySales: [],
        currentDaySales: 0,
        previousDaySales: 0,
        totalSales: 0,
        pendingSales: 0
      };
    }

    // Process sales data
    const processedDailySales = dailySales.reduce((acc: any[], sale) => {
      const date = format(new Date(sale.created_at), "yyyy-MM-dd");
      const existingDate = acc.find(item => item.date === date);
      
      if (existingDate) {
        existingDate.total_amount += sale.total_amount;
      } else {
        acc.push({
          date,
          total_amount: sale.total_amount,
        });
      }
      return acc;
    }, []);


    // Get current day's sales
    const currentDayStart = startOfDay(now);
    const { data: currentDay } = await supabase
      .from("sales")
      .select("total_amount")
      .gte("created_at", currentDayStart.toISOString())
      .eq("status", "approved");

    // Get previous day's sales
    const previousDayStart = startOfDay(subDays(now, 1));
    const previousDayEnd = endOfDay(subDays(now, 1));
    const { data: previousDay } = await supabase
      .from("sales")
      .select("total_amount")
      .gte("created_at", previousDayStart.toISOString())
      .lte("created_at", previousDayEnd.toISOString())
      .eq("status", "approved");

    // Get pending sales count
    const { count: pendingSales } = await supabase
      .from("sales")
      .select("*", { count: "exact" })
      .eq("status", "pending");

    const result = {
      dailySales: processedDailySales,
      currentDaySales: sumSales(currentDay || []),
      previousDaySales: sumSales(previousDay || []),
      totalSales: sumSales(dailySales),
      pendingSales: pendingSales || 0,
    };

    return result;
  } catch (error) {
    console.error("Error in getSalesMetrics:", error);
    throw error;
  }
}

export async function getInventoryMetrics(): Promise<InventoryMetrics> {
  const supabase = await createClient();

  // Get low stock items with proper typing
  const { data: lowStockItems } = await supabase
    .from("inventory")
    .select(
      `
      id,
      quantity,
      min_stock_level,
      product:products (
        name,
        unit_price
      )
    `
    )
    .lt("quantity", "min_stock_level");

  // Get total inventory value
  const { data: inventory } = (await supabase.from("inventory").select(`
      quantity,
      products (
        unit_price
      )
    `)) as { data: InventoryValueItem[] };

  return {
    lowStockCount: lowStockItems?.length || 0,
    totalValue: calculateInventoryValue(inventory || []),
    lowStockItems: lowStockItems || [],
  };
}

export async function getCustomerMetrics(): Promise<CustomerMetrics> {
  const supabase = await createClient();

  // Get total customers
  const { count: totalCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact" });

  // Get new customers this month
  const { count: newCustomers } = await supabase
    .from("customers")
    .select("*", { count: "exact" })
    .gte("created_at", startOfMonth(new Date()).toISOString());

  // Get recent sales
  const { data: recentSales } = await supabase
    .from("sales")
    .select(
      `
      id,
      customer_name,
      created_at,
      total_amount
    `
    )
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    totalCustomers: totalCustomers || 0,
    newCustomers: newCustomers || 0,
    recentSales: recentSales || [],
  };
}

export async function testDatabaseConnection() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sales")
      .insert({
        total_amount: 1000,
        status: "approved",
        created_at: new Date().toISOString(),
      })
      .select();

    if (error) {
      console.error("Error inserting test data:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}
