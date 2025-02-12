"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sale, SaleItem } from "@/types/sales";

interface ReturnItem {
  sale_item_id: string;
  quantity_returned: number;
  unit_price: number;
}

interface ReturnDrawerProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnDrawer({ sale, open, onOpenChange }: ReturnDrawerProps) {
  const [selectedItems, setSelectedItems] = useState<Map<string, ReturnItem>>(
    new Map()
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleQuantityChange = (saleItem: SaleItem, quantity: number) => {
    const newQuantity = Math.max(0, Math.min(quantity, saleItem.quantity));

    if (newQuantity === 0) {
      const newSelectedItems = new Map(selectedItems);
      newSelectedItems.delete(saleItem.id);
      setSelectedItems(newSelectedItems);
      return;
    }

    setSelectedItems(
      new Map(selectedItems).set(saleItem.id, {
        sale_item_id: saleItem.id,
        quantity_returned: newQuantity,
        unit_price: saleItem.unit_price,
      })
    );
  };

  const totalRefundAmount = Array.from(selectedItems.values()).reduce(
    (total, item) => total + item.quantity_returned * item.unit_price,
    0
  );

  const handleSubmit = async () => {
    if (!sale) return;

    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/sales/${sale.id}/returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: notes || undefined,
          items: Array.from(selectedItems.values()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process return");
      }

      await queryClient.invalidateQueries({ queryKey: ["sales"] });

      toast.success("Return processed successfully");
      onOpenChange(false);
      setSelectedItems(new Map());
      setNotes("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className='h-[95vh] flex flex-col'>
        <DrawerHeader className='flex-none'>
          <DrawerTitle>Process Return</DrawerTitle>
          <DrawerDescription>
            Select items and quantities to return from sale #{sale.id}
          </DrawerDescription>
        </DrawerHeader>

        <div className='flex-1 overflow-auto px-4'>
          <div className='space-y-6'>
            {/* Customer Info */}
            <div className='rounded-lg border p-4'>
              <h4 className='font-medium mb-2'>Customer Details</h4>
              <p className='text-sm text-muted-foreground'>
                {sale.customer_name}
              </p>
              <p className='text-sm text-muted-foreground mt-1'>
                Original Sale Amount: KES {sale.total_amount}
              </p>
            </div>

            {/* Return Items */}
            <div className='space-y-4'>
              <h4 className='font-medium'>Select Items to Return</h4>
              {sale.sale_items.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center justify-between border rounded-lg p-4'>
                  <div className='flex-1'>
                    <p className='font-medium'>{item.products.name}</p>
                    <p className='text-sm text-muted-foreground'>
                      Unit Price: KES {item.unit_price}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Original Quantity: {item.quantity}
                    </p>
                  </div>

                  <div className='flex items-center gap-2'>
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => {
                        const current = selectedItems.get(item.id);
                        handleQuantityChange(
                          item,
                          (current?.quantity_returned || 0) - 1
                        );
                      }}>
                      <Minus className='h-4 w-4' />
                    </Button>
                    <Input
                      type='number'
                      min='0'
                      max={item.quantity}
                      value={selectedItems.get(item.id)?.quantity_returned || 0}
                      onChange={(e) =>
                        handleQuantityChange(
                          item,
                          parseInt(e.target.value) || 0
                        )
                      }
                      className='w-20 text-center'
                    />
                    <Button
                      variant='outline'
                      size='icon'
                      onClick={() => {
                        const current = selectedItems.get(item.id);
                        handleQuantityChange(
                          item,
                          (current?.quantity_returned || 0) + 1
                        );
                      }}>
                      <Plus className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className='space-y-2'>
              <label
                htmlFor='notes'
                className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                Notes (Optional)
              </label>
              <Textarea
                id='notes'
                placeholder='Add any notes about this return...'
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DrawerFooter className='flex-none border-t bg-background'>
          <div className='flex items-center justify-between mb-4'>
            <span className='font-medium'>Total Refund Amount:</span>
            <span className='text-lg font-bold'>
              KES {totalRefundAmount.toFixed(2)}
            </span>
          </div>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              onClick={() => onOpenChange(false)}
              className='flex-1'>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || selectedItems.size === 0}
              className={cn("flex-1", isSubmitting && "opacity-50")}>
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Processing...
                </>
              ) : (
                "Process Return"
              )}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
