"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SaleItem {
  quantity: number;
  unit_price: number;
  total_price: number;
  products: {
    name: string;
  };
  effective_quantity: number;
}

interface Sale {
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

interface SaleDetailsSheetProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaleDetailsSheet({
  sale,
  open,
  onOpenChange,
}: SaleDetailsSheetProps) {
  if (!sale) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='min-w-[50vw] overflow-y-auto'>
        <SheetHeader className='space-y-6'>
          <div className='flex items-center justify-between'>
            <SheetTitle>Sale Details</SheetTitle>
            <Badge
              variant={
                sale.status === "approved"
                  ? "default"
                  : sale.status === "pending"
                  ? "outline"
                  : "destructive"
              }
              className={cn(
                "text-base px-4 py-1",
                sale.status === "approved"
                  ? "bg-green-100 text-green-800"
                  : sale.status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              )}>
              {sale.status.toUpperCase()}
            </Badge>
          </div>
        </SheetHeader>

        <div className='mt-8 space-y-6'>
          {/* Customer Information */}
          <div>
            <h3 className='text-lg font-semibold mb-4'>Customer Information</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-muted-foreground'>Name</p>
                <p className='font-medium'>{sale.customer_name}</p>
              </div>
              {sale.customer_phone && (
                <div>
                  <p className='text-sm text-muted-foreground'>Phone</p>
                  <p className='font-medium'>{sale.customer_phone}</p>
                </div>
              )}
              {sale.customer_email && (
                <div>
                  <p className='text-sm text-muted-foreground'>Email</p>
                  <p className='font-medium'>{sale.customer_email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Sale Items */}
          <div>
            <h3 className='text-lg font-semibold mb-4'>Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className='text-right'>Quantity</TableHead>
                  <TableHead className='text-right'>Unit Price</TableHead>
                  <TableHead className='text-right'>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.sale_items
                  .filter((item: SaleItem) => item.effective_quantity > 0)
                  .map((item: SaleItem, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{item.products.name}</TableCell>
                      <TableCell className='text-right'>
                        {item.effective_quantity}
                      </TableCell>
                      <TableCell className='text-right'>
                        KES {item.unit_price}
                      </TableCell>
                      <TableCell className='text-right'>
                        KES {item.unit_price * item.effective_quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                <TableRow>
                  <TableCell colSpan={3} className='text-right font-bold'>
                    Total Amount
                  </TableCell>
                  <TableCell className='text-right font-bold'>
                    KES {sale.total_amount}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Payment Information */}
          <div>
            <h3 className='text-lg font-semibold mb-4'>Payment Information</h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-muted-foreground'>Method</p>
                <p className='font-medium'>
                  {sale.payment_method.replace("_", " ")}
                </p>
              </div>
              {sale.payment_reference && (
                <div>
                  <p className='text-sm text-muted-foreground'>Reference</p>
                  <p className='font-medium'>{sale.payment_reference}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className='text-lg font-semibold mb-4'>
              Additional Information
            </h3>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm text-muted-foreground'>Created By</p>
                <p className='font-medium'>{sale.profiles.full_name}</p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Created At</p>
                <p className='font-medium'>
                  {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              {sale.approved_by_profile && (
                <div>
                  <p className='text-sm text-muted-foreground'>Approved By</p>
                  <p className='font-medium'>
                    {sale.approved_by_profile.full_name}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
