"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Minus, Check, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getLocationProducts } from "@/lib/supabase/supabase-actions";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  description: string | null;
  inventory: Array<{
    quantity: number;
    location: "kamulu" | "utawala";
  }>;
}

export function UpdateStockLevel() {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<
    "utawala" | "kamulu"
  >("utawala");
  const [action, setAction] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products", selectedLocation],
    queryFn: () => getLocationProducts(selectedLocation),
    enabled: open, // Only fetch when dialog is open
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep unused data for 30 minutes
  });

  // Sort products alphabetically
  const sortedProducts = [...products].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const selectedProductDetails = sortedProducts.find(
    (p) => p.id === selectedProduct
  );

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a product",
      });
      return;
    }

    const currentQuantity = selectedProductDetails?.inventory[0]?.quantity || 0;
    const quantityNum = parseInt(quantity);

    if (!quantity || isNaN(quantityNum)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid quantity",
      });
      return;
    }

    const adjustment = action === "add" ? quantityNum : -quantityNum;

    if (action === "remove" && quantityNum > currentQuantity) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot remove more than current stock",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: selectedProduct,
          location: selectedLocation,
          quantity: adjustment,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update stock level");
      }

      await queryClient.invalidateQueries({ queryKey: ["products"] });

      toast({
        title: "Success",
        description: "Stock level updated successfully",
      });
      setOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct("");
    setSelectedLocation("utawala");
    setAction("add");
    setQuantity("");
    setCommandOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetForm();
      }}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' className='gap-2'>
          <Plus className='h-4 w-4' />
          Update Stock
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Stock Level</DialogTitle>
        </DialogHeader>
        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Location</label>
            <Select
              value={selectedLocation}
              onValueChange={(value: "utawala" | "kamulu") =>
                setSelectedLocation(value)
              }>
              <SelectTrigger>
                <SelectValue placeholder='Select location' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='utawala'>Utawala</SelectItem>
                <SelectItem value='kamulu'>Kamulu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Product</label>
            <Popover open={commandOpen} onOpenChange={setCommandOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  role='combobox'
                  aria-expanded={commandOpen}
                  className='w-full justify-between'>
                  {selectedProduct
                    ? sortedProducts.find(
                        (product) => product.id === selectedProduct
                      )?.name
                    : "Select a product..."}
                  <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className='w-[var(--radix-popover-trigger-width)] p-0'
                side='bottom'
                align='start'
                sideOffset={4}
                alignOffset={0}
                avoidCollisions={true}>
                <Command>
                  <CommandInput placeholder='Search products...' />
                  <CommandList className='max-h-[200px] overflow-y-auto'>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {sortedProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.name}
                          onSelect={() => {
                            setSelectedProduct(product.id);
                            setCommandOpen(false);
                          }}
                          className='cursor-pointer'>
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProduct === product.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className='flex flex-col'>
                            <span>{product.name}</span>
                            {product.description && (
                              <span className='text-xs text-muted-foreground'>
                                {product.description}
                              </span>
                            )}
                            <span className='text-xs text-muted-foreground'>
                              Current Stock: {product.inventory[0].quantity}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Action</label>
            <Select
              value={action}
              onValueChange={(value: "add" | "remove") => setAction(value)}>
              <SelectTrigger>
                <SelectValue placeholder='Select action' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='add'>Add Stock</SelectItem>
                <SelectItem value='remove'>Remove Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Quantity</label>
            {selectedProductDetails && (
              <p className='text-sm text-muted-foreground mb-2'>
                Current Stock: {selectedProductDetails.inventory[0].quantity}
              </p>
            )}
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='icon'
                onClick={() => {
                  const current = parseInt(quantity) || 0;
                  if (current > 0) {
                    setQuantity((current - 1).toString());
                  }
                }}>
                <Minus className='h-4 w-4' />
              </Button>
              <Input
                type='number'
                min='0'
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || parseInt(value) >= 0) {
                    setQuantity(value);
                  }
                }}
                className='w-24 text-center'
                placeholder='Enter quantity'
              />
              <Button
                variant='outline'
                size='icon'
                onClick={() => {
                  const current = parseInt(quantity) || 0;
                  setQuantity((current + 1).toString());
                }}>
                <Plus className='h-4 w-4' />
              </Button>
            </div>
            {action === "remove" &&
              selectedProductDetails &&
              parseInt(quantity) >
                selectedProductDetails.inventory[0].quantity && (
                <p className='text-sm text-destructive mt-1'>
                  Cannot remove more than current stock
                </p>
              )}
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedProduct || quantity === ""}>
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Updating...
              </>
            ) : (
              "Update Stock"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
