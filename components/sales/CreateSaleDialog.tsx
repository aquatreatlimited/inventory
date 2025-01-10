"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2, Plus, Check, ChevronsUpDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SaleItemsTable } from "./SaleItemsTable";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

const saleFormSchema = z.object({
  customer_id: z.string().optional(),
  customer_name: z.string().min(2, "Customer name is required"),
  customer_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal("")),
  payment_method: z.enum(["cash", "bank_transfer", "mpesa", "cheque"]),
  payment_reference: z.string().optional(),
  save_customer: z.boolean().default(false),
  request_id: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string(),
        quantity: z.number().positive(),
        unit_price: z.number().positive(),
        total_price: z.number().positive(),
      })
    )
    .min(1, "At least one item is required"),
});

type SaleFormValues = z.infer<typeof saleFormSchema>;

interface CreateSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProducts?: {
    product_id: string;
    product_name: string;
    quantity: number;
    requestId?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
  }[];
}

export function CreateSaleSheet({
  open,
  onOpenChange,
  defaultProducts = [],
}: CreateSaleDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [linkedRequestId, setLinkedRequestId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Fetch existing customers
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
    enabled: open, // Only fetch when dialog is open
  });

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customer_id: undefined,
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      payment_method: "cash",
      payment_reference: "",
      save_customer: false,
      items: [] as SaleItem[],
    },
  });

  useEffect(() => {
    if (defaultProducts.length > 0) {
      // Set the initial items
      form.setValue(
        "items",
        defaultProducts.map((p) => ({
          product_id: p.product_id,
          quantity: p.quantity,
          unit_price: 0,
          total_price: 0,
        }))
      );

      // Store the request ID if it exists
      if (defaultProducts[0].requestId) {
        setLinkedRequestId(defaultProducts[0].requestId);
      }

      // Set customer details if they exist
      if (defaultProducts[0].customer_name) {
        form.setValue("customer_name", defaultProducts[0].customer_name);
        form.setValue(
          "customer_phone",
          defaultProducts[0].customer_phone || ""
        );
        form.setValue(
          "customer_email",
          defaultProducts[0].customer_email || ""
        );
      }
    }
  }, [defaultProducts, form]);

  // Handle customer selection
  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find((c: Customer) => c.id === customerId);
    if (customer) {
      form.setValue("customer_id", customer.id);
      form.setValue("customer_name", customer.name);
      form.setValue("customer_phone", customer.phone || "");
      form.setValue("customer_email", customer.email || "");
    }
  };

  // Add useEffect to handle customer selection and validation
  useEffect(() => {
    const customerId = form.watch("customer_id");
    const customerName = form.watch("customer_name");
    const customerPhone = form.watch("customer_phone");
    const customerEmail = form.watch("customer_email");
    const saveCustomer = form.watch("save_customer");

    if (customerId) {
      // If customer is selected from existing customers, set save_customer to false
      form.setValue("save_customer", false);
    } else if (
      saveCustomer &&
      (customerName || customerPhone || customerEmail)
    ) {
      // Only check for existing customers if save_customer is true
      const existingCustomer = customers.find(
        (c) =>
          c.name.toLowerCase() === customerName?.toLowerCase() ||
          (customerPhone && c.phone === customerPhone) ||
          (customerEmail && c.email === customerEmail)
      );

      if (existingCustomer) {
        toast({
          variant: "destructive",
          title: "Customer Already Exists",
          description:
            "Customer already exists, cannot be registered again. Please untick the checkbox or select from the search.",
        });
        form.setValue("save_customer", false);
      }
    }
  }, [
    form.watch("customer_id"),
    form.watch("customer_name"),
    form.watch("customer_phone"),
    form.watch("customer_email"),
    form.watch("save_customer"),
    customers,
    toast,
  ]);

  const onSubmit = async (values: SaleFormValues) => {
    try {
      setIsCreating(true);

      // Create a new object without save_customer field for API submission
      const { save_customer, ...saleData } = values;

      // If save_customer is true and no customer_id exists, check for duplicates again
      if (save_customer && !values.customer_id) {
        const existingCustomer = customers.find(
          (c) =>
            c.name.toLowerCase() === values.customer_name.toLowerCase() ||
            (values.customer_phone && c.phone === values.customer_phone) ||
            (values.customer_email && c.email === values.customer_email)
        );

        if (existingCustomer) {
          toast({
            variant: "destructive",
            title: "Customer Already Exists",
            description:
              "Customer already exists, cannot be registered again. Please untick the checkbox or select from the search.",
          });
          setIsCreating(false);
          return;
        }

        const customerResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.customer_name,
            phone: values.customer_phone,
            email: values.customer_email,
          }),
        });

        if (!customerResponse.ok) {
          throw new Error("Failed to create customer");
        }

        const customer = await customerResponse.json();
        saleData.customer_id = customer.id;
      } else if (!values.customer_id) {
        // If not saving as new customer and no customer_id, try to find existing customer
        const existingCustomer = customers.find(
          (c) =>
            c.name.toLowerCase() === values.customer_name.toLowerCase() ||
            (values.customer_phone && c.phone === values.customer_phone) ||
            (values.customer_email && c.email === values.customer_email)
        );

        if (existingCustomer) {
          saleData.customer_id = existingCustomer.id;
        }
      }

      // Add request_id if this sale is linked to a request
      if (linkedRequestId) {
        saleData.request_id = linkedRequestId;
      }

      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData), // Send saleData instead of values
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create sale");
      }

      await queryClient.invalidateQueries({ queryKey: ["sales"] });

      toast({
        title: "Success",
        description: "Sale created successfully",
      } as any);

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create sale",
      } as any);
    } finally {
      setIsCreating(false); // End loading regardless of outcome
    }
  };

  const handleClearForm = () => {
    form.reset({
      customer_id: undefined,
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      payment_method: "cash",
      payment_reference: "",
      save_customer: false,
      items: [],
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='min-w-[60vw] overflow-y-auto'>
        <SheetHeader>
          <div className='flex items-center justify-between'>
            <div>
              <SheetTitle>Create New Sale</SheetTitle>
              <SheetDescription>
                Create a new sale by filling in the details below.
              </SheetDescription>
            </div>
            <Button
              variant='outline'
              onClick={handleClearForm}
              type='button'
              size='sm'>
              Clear Form
            </Button>
          </div>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='space-y-6 mt-6'>
            {/* Existing Customer Selection */}
            <FormField
              control={form.control}
              name='customer_id'
              render={({ field }) => (
                <FormItem className='flex flex-col'>
                  <FormLabel>Select Existing Customer (Optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          role='combobox'
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}>
                          {field.value
                            ? customers.find(
                                (customer) => customer.id === field.value
                              )?.name
                            : "Search customers..."}
                          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      align='start'
                      className='w-[var(--radix-popover-trigger-width)] p-0'>
                      <Command className='w-full'>
                        <CommandInput placeholder='Search customers...' />
                        <CommandList>
                          <CommandEmpty className='p-4'>
                            {customers.length === 0 ? (
                              <div className='text-center space-y-2'>
                                <p className='text-sm text-muted-foreground'>
                                  No customers available yet.
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                  Fill in the customer details below to create a
                                  new customer.
                                </p>
                              </div>
                            ) : (
                              "No customer found."
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={(value) => {
                                  field.onChange(value);
                                  handleCustomerSelect(value);
                                  // Close the popover
                                  const button =
                                    document.querySelector('[role="combobox"]');
                                  if (button instanceof HTMLElement) {
                                    button.click();
                                  }
                                }}
                                className='w-full'>
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === customer.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <div className='flex flex-col'>
                                  <span>{customer.name}</span>
                                  {customer.phone && (
                                    <span className='text-xs text-muted-foreground'>
                                      {customer.phone}
                                    </span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Details */}
            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='customer_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter customer name' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='customer_phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder='Enter phone number' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='customer_email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='Enter email address'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='payment_method'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select payment method' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='cash'>Cash</SelectItem>
                        <SelectItem value='bank_transfer'>
                          Bank Transfer
                        </SelectItem>
                        <SelectItem value='mpesa'>M-Pesa</SelectItem>
                        <SelectItem value='cheque'>Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Save Customer Checkbox */}
            <FormField
              control={form.control}
              name='save_customer'
              render={({ field }) => (
                <FormItem className='flex items-center gap-2'>
                  <FormControl>
                    <input
                      type='checkbox'
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={!!form.watch("customer_id")}
                    />
                  </FormControl>
                  <FormLabel className='!mt-0'>Save as new customer</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='items'
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Sale Items</FormLabel>
                  <FormControl>
                    <SaleItemsTable
                      items={value as SaleItem[]}
                      onChange={onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter>
              <div className='flex justify-end gap-4'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Creating...
                    </>
                  ) : (
                    "Create Sale"
                  )}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
