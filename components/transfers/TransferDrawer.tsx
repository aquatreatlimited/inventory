"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLocationProducts,
  updateStockLevel,
  recordTransfer,
} from "@/lib/supabase/supabase-actions";
import { useToast } from "@/hooks/use-toast";
import { TransferTables } from "./TransferTables";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, PackageOpen } from "lucide-react";

interface TransferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferDrawer({ open, onOpenChange }: TransferDrawerProps) {
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(
    new Map()
  );
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferDirection, setTransferDirection] = useState<
    "kamulu-to-utawala" | "utawala-to-kamulu"
  >("kamulu-to-utawala");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Get source products
  const { data: sourceProducts = [] } = useQuery({
    queryKey: [
      "products",
      transferDirection === "kamulu-to-utawala" ? "kamulu" : "utawala",
    ],
    queryFn: () =>
      getLocationProducts(
        transferDirection === "kamulu-to-utawala" ? "kamulu" : "utawala"
      ),
    enabled: open,
  });

  // Get target products
  const { data: targetProducts = [] } = useQuery({
    queryKey: [
      "products",
      transferDirection === "kamulu-to-utawala" ? "utawala" : "kamulu",
    ],
    queryFn: () =>
      getLocationProducts(
        transferDirection === "kamulu-to-utawala" ? "utawala" : "kamulu"
      ),
    enabled: open,
  });

  const handleTransfer = async () => {
    try {
      const fromLocation =
        transferDirection === "kamulu-to-utawala" ? "kamulu" : "utawala";
      const toLocation =
        transferDirection === "kamulu-to-utawala" ? "utawala" : "kamulu";

      if (!user) {
        throw new Error("Not authenticated");
      }

      // Process all selected products
      await Promise.all(
        Array.from(selectedProducts.entries()).map(
          async ([productId, amount]) => {
            const sourceProduct = sourceProducts.find(
              (p) => p.id === productId
            );
            const targetProduct = targetProducts.find(
              (p) => p.id === productId
            );

            if (!sourceProduct || !targetProduct) return;

            // Create transfer request with pending status
            await recordTransfer({
              product_id: productId,
              from_location: fromLocation,
              to_location: toLocation,
              quantity: amount,
              transferred_by: user.id,
              status: "pending", // Explicitly set status to pending
            });
          }
        )
      );

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description:
          "Transfer request created successfully. Awaiting clerk approval.",
      });
      setSelectedProducts(new Map());
      setShowTransferDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleRemoveProduct = (productId: string) => {
    const newSelectedProducts = new Map(selectedProducts);
    newSelectedProducts.delete(productId);
    setSelectedProducts(newSelectedProducts);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className='h-[95vh] flex flex-col'>
        <DrawerHeader className='flex-none'>
          <DrawerTitle>Transfer Inventory</DrawerTitle>
          <DrawerDescription>
            Move products between Kamulu and Utawala stores
          </DrawerDescription>
        </DrawerHeader>

        <div className='flex flex-col h-full overflow-hidden'>
          <div className='flex-none p-4 space-y-2'>
            <label className='text-sm font-medium text-muted-foreground'>
              Select Transfer Direction
            </label>
            <div className='flex items-center gap-4'>
              <Button
                variant={
                  transferDirection === "kamulu-to-utawala"
                    ? "default"
                    : "outline"
                }
                onClick={() => {
                  setTransferDirection("kamulu-to-utawala");
                  setSelectedProducts(new Map());
                }}
                className='flex-1'>
                <ArrowRight className='mr-2 h-4 w-4' />
                Kamulu to Utawala
              </Button>
              <Button
                variant={
                  transferDirection === "utawala-to-kamulu"
                    ? "default"
                    : "outline"
                }
                onClick={() => {
                  setTransferDirection("utawala-to-kamulu");
                  setSelectedProducts(new Map());
                }}
                className='flex-1'>
                <ArrowRight className='mr-2 h-4 w-4' />
                Utawala to Kamulu
              </Button>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto px-4'>
            <TransferTables
              fromLocation={
                transferDirection === "kamulu-to-utawala" ? "kamulu" : "utawala"
              }
              toLocation={
                transferDirection === "kamulu-to-utawala" ? "utawala" : "kamulu"
              }
              selectedProducts={selectedProducts}
              onProductSelect={(product) => {
                setShowTransferDialog(true);
                const currentAmount = selectedProducts.get(product.id) || 0;
                setSelectedProducts(
                  new Map(selectedProducts.set(product.id, currentAmount))
                );
              }}
              onProductRemove={handleRemoveProduct}
            />
          </div>

          <div className='flex-none p-4 border-t bg-background sticky bottom-0 shadow-[0_-1px_2px_rgba(0,0,0,0.1)]'>
            {selectedProducts.size > 0 && (
              <Button size='lg' onClick={handleTransfer} className='w-full'>
                <PackageOpen className='mr-2 h-4 w-4' />
                Create Transfer Request ({selectedProducts.size}{" "}
                {selectedProducts.size === 1 ? "item" : "items"})
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>

      {/* Transfer Amount Dialog */}
      {showTransferDialog && (
        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Transfer Amount</DialogTitle>
              <DialogDescription>
                Specify the quantity to transfer for each product
              </DialogDescription>
            </DialogHeader>
            <div className='space-y-4'>
              {Array.from(selectedProducts.entries()).map(
                ([productId, amount]) => {
                  const product = sourceProducts.find(
                    (p) => p.id === productId
                  );
                  if (!product) return null;

                  return (
                    <div key={productId} className='space-y-2'>
                      <div className='flex justify-between items-center'>
                        <label className='text-sm font-medium'>
                          {product.name}
                        </label>
                        <span className='text-sm text-muted-foreground'>
                          Available: {product.inventory[0].quantity}
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Input
                          type='number'
                          min='0'
                          max={product.inventory[0].quantity}
                          value={amount}
                          onChange={(e) => {
                            const newAmount = Math.min(
                              parseInt(e.target.value) || 0,
                              product.inventory[0].quantity
                            );
                            setSelectedProducts(
                              new Map(
                                selectedProducts.set(productId, newAmount)
                              )
                            );
                          }}
                          className='w-full'
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
            <DialogFooter>
              <Button
                variant='outline'
                onClick={() => setShowTransferDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => setShowTransferDialog(false)}
                disabled={Array.from(selectedProducts.values()).every(
                  (amount) => amount === 0
                )}>
                Confirm Amounts
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Drawer>
  );
}
