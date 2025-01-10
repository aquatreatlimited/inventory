"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { getLocationProducts } from "@/lib/supabase/supabase-actions";
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
import { Label } from "@/components/ui/label";

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SaleItemsTableProps {
  items: SaleItem[];
  onChange: (items: SaleItem[]) => void;
}

export function SaleItemsTable({ items, onChange }: SaleItemsTableProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);

  const { data: products = [] } = useQuery({
    queryKey: ["products", "utawala"],
    queryFn: () => getLocationProducts("utawala"),
  });

  const handleQuantityChange = (value: string) => {
    const numValue = value === "" ? "" : parseInt(value);
    setQuantity(numValue as number);
    if (numValue && unitPrice) {
      setTotalPrice(numValue * unitPrice);
    }
  };

  const handleUnitPriceChange = (value: string) => {
    const numValue = value === "" ? "" : parseFloat(value);
    setUnitPrice(numValue as number);
    if (numValue && quantity) {
      setTotalPrice(quantity * numValue);
    }
  };

  const handleTotalPriceChange = (value: string) => {
    const numValue = value === "" ? "" : parseFloat(value);
    setTotalPrice(numValue as number);
    if (numValue && quantity > 0) {
      setUnitPrice(numValue / quantity);
    }
  };

  const handleAddItem = () => {
    if (!selectedProduct || !quantity || !unitPrice || !totalPrice) return;

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const newItem: SaleItem = {
      product_id: selectedProduct,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    };

    onChange([...items, newItem]);
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    setTotalPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems);
  };

  const clearFormState = () => {
    setSelectedProduct("");
    setQuantity(1);
    setUnitPrice(0);
    setTotalPrice(0);
  };

  useEffect(() => {
    if (items.length === 0) {
      clearFormState();
    }
  }, [items]);

  return (
    <div className='space-y-4'>
      <div className='flex items-end gap-4'>
        <div className='flex-1'>
          <Label htmlFor='product'>Product</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                role='combobox'
                className={cn(
                  "w-full justify-between",
                  !selectedProduct && "text-muted-foreground"
                )}>
                {selectedProduct
                  ? products.find((product) => product.id === selectedProduct)
                      ?.name
                  : "Select product..."}
                <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[400px] p-0'>
              <Command>
                <CommandInput placeholder='Search product...' />
                <CommandList>
                  <CommandEmpty>No product found.</CommandEmpty>
                  <CommandGroup>
                    {products.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={(value) => {
                          setSelectedProduct(value);
                          const button =
                            document.querySelector('[role="combobox"]');
                          if (button instanceof HTMLElement) {
                            button.click();
                          }
                        }}>
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProduct === product.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {product.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className='w-24'>
          <Label htmlFor='quantity'>Quantity</Label>
          <Input
            id='quantity'
            type='number'
            min='1'
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
          />
        </div>

        <div className='w-32'>
          <Label htmlFor='unitPrice'>Unit Price</Label>
          <Input
            id='unitPrice'
            type='number'
            min='0'
            step='0.01'
            value={unitPrice}
            onChange={(e) => handleUnitPriceChange(e.target.value)}
          />
        </div>

        <div className='w-32'>
          <Label htmlFor='totalPrice'>Total Price</Label>
          <Input
            id='totalPrice'
            type='number'
            min='0'
            step='0.01'
            value={totalPrice}
            onChange={(e) => handleTotalPriceChange(e.target.value)}
          />
        </div>

        <Button
          type='button'
          onClick={handleAddItem}
          disabled={!selectedProduct || quantity <= 0 || unitPrice <= 0}>
          <Plus className='h-4 w-4 mr-2' />
          Add Item
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className='w-[100px]'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center py-4'>
                  No items added
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => {
                const product = products.find((p) => p.id === item.product_id);
                return (
                  <TableRow key={index}>
                    <TableCell>{product?.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.unit_price}</TableCell>
                    <TableCell>{item.total_price}</TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => handleRemoveItem(index)}
                        className='h-8 w-8 p-0'>
                        <Trash2 className='h-4 w-4 text-destructive' />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
