"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ReturnHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReturnHistory {
  id: string;
  created_at: string;
  total_refund_amount: number;
  notes: string | null;
  created_by_profile: {
    full_name: string;
  };
  sale_return_items: Array<{
    quantity_returned: number;
    unit_price: number;
    total_price: number;
    sale_item: {
      product: {
        name: string;
      };
    };
  }>;
  sale: {
    id: string;
    customer_name: string;
  };
}

export function ReturnHistoryDrawer({
  open,
  onOpenChange,
}: ReturnHistoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: returns, isLoading } = useQuery<ReturnHistory[]>({
    queryKey: ["all-returns"],
    queryFn: async () => {
      const response = await fetch(`/api/returns`);
      if (!response.ok) throw new Error("Failed to fetch returns");
      return response.json();
    },
    enabled: open,
  });

  const filteredReturns = returns?.filter(
    (returnRecord) =>
      returnRecord.sale.customer_name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      returnRecord.sale_return_items.some((item) =>
        item.sale_item.product.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className='min-h-[95vh]'>
        <DrawerHeader>
          <DrawerTitle>Return History</DrawerTitle>
          <DrawerDescription>
            View history of all product returns
          </DrawerDescription>
          <div className='relative mt-4'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50' />
            <Input
              placeholder='Search returns...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='pl-9'
            />
          </div>
        </DrawerHeader>

        <div className='p-4 overflow-auto'>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          ) : !filteredReturns || filteredReturns.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <div className='rounded-full bg-muted p-3 mb-4'>
                <RotateCcw className='h-6 w-6 text-muted-foreground' />
              </div>
              <p className='text-lg font-medium mb-2'>No Returns Found</p>
              <p className='text-sm text-muted-foreground'>
                There are no product returns recorded in the system yet.
              </p>
            </div>
          ) : (
            <div className='space-y-6'>
              {filteredReturns?.map((returnRecord) => (
                <div
                  key={returnRecord.id}
                  className='border rounded-lg p-4 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='font-medium'>
                        {returnRecord.sale.customer_name}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        Processed by {returnRecord.created_by_profile.full_name}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {format(
                          new Date(returnRecord.created_at),
                          "MMM d, yyyy h:mm a"
                        )}
                      </p>
                    </div>
                    <p className='font-medium'>
                      KES {returnRecord.total_refund_amount}
                    </p>
                  </div>

                  {returnRecord.notes && (
                    <p className='text-sm bg-muted p-2 rounded'>
                      {returnRecord.notes}
                    </p>
                  )}

                  <div className='space-y-2'>
                    <p className='text-sm font-medium'>Returned Items:</p>
                    {returnRecord.sale_return_items.map((item, index) => (
                      <div
                        key={index}
                        className='flex justify-between text-sm pl-4'>
                        <span>
                          {item.sale_item.product.name} ×{" "}
                          {item.quantity_returned}
                        </span>
                        <span>KES {item.total_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
