"use client";

import React from "react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, RefreshCw, Minus, FileDown, Edit } from "lucide-react";
import {
  getLocationProducts,
  updateStockLevel,
} from "@/lib/supabase/supabase-actions";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { EditProductDialog } from "./EditProductDialog";

interface ProductListProps {
  location: "kamulu" | "utawala";
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  min_stock_level: number;
  category_id: string | null;
  inventory: Array<{
    quantity: number;
    location: "kamulu" | "utawala";
  }>;
}

export function ProductList({ location }: ProductListProps) {
  const { state } = useSidebar();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products", location],
    queryFn: () => getLocationProducts(location),
    staleTime: 1000 * 60 * 5,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const response = await fetch("/api/product-categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const filteredAndPaginatedProducts = () => {
    let filtered = [...products];

    if (selectedCategory) {
      filtered = filtered.filter(
        (product) => product.category_id === selectedCategory
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
      paginatedProducts: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / itemsPerPage),
      totalProducts: filtered.length,
    };
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["products", location] });
  };

  const handleStockAdjustment = async () => {
    try {
      if (!selectedProduct) return;
      await updateStockLevel(selectedProduct.id, location, newQuantity);

      queryClient.invalidateQueries({ queryKey: ["products", location] });
      toast({
        title: "Success",
        description: "Stock level updated successfully",
      });
      setShowStockDialog(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const getCategoryName = (categoryId: string | null): string => {
    const category = categories.find((c: Category) => c.id === categoryId);
    return category?.name || "Uncategorized";
  };

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    const exportData = products.map((product) => ({
      Name: product.name,
      Category: getCategoryName(product.category_id),
      "Stock Level": product.inventory[0].quantity,
    }));

    switch (format) {
      case "csv":
        // CSV export logic
        const csvContent = [
          Object.keys(exportData[0]).join(","),
          ...exportData.map((row) => Object.values(row).join(",")),
        ].join("\n");
        const csvBlob = new Blob([csvContent], { type: "text/csv" });
        const csvUrl = URL.createObjectURL(csvBlob);
        const csvLink = document.createElement("a");
        csvLink.href = csvUrl;
        csvLink.download = `${location}-inventory.csv`;
        csvLink.click();
        break;

      case "xlsx":
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");

        // Generate the XLSX file
        XLSX.writeFile(wb, `${location}-inventory.xlsx`);
        break;

      case "pdf":
        // Initialize jsPDF
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(16);
        doc.text(
          `${
            location.charAt(0).toUpperCase() + location.slice(1)
          } Inventory Report`,
          14,
          15
        );
        doc.setFontSize(10);

        // Add timestamp
        const timestamp = new Date().toLocaleString();
        doc.text(`Generated on: ${timestamp}`, 14, 25);

        // Create the table
        (doc as any).autoTable({
          head: [Object.keys(exportData[0])],
          body: exportData.map((row) => Object.values(row)),
          startY: 35,
          theme: "grid",
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 12,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 10,
            cellPadding: 3,
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
        });

        // Save the PDF
        doc.save(`${location}-inventory.pdf`);
        break;
    }

    toast({
      title: "Export Successful",
      description: `Inventory has been exported as ${format.toUpperCase()}`,
    });
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        {/* Search and filters skeleton */}
        <div className='flex items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-gray-100/50 shadow-sm'>
          <div className='w-72 h-10 bg-gray-200 animate-pulse rounded-md' />
          <div className='flex items-center gap-4'>
            <div className='w-10 h-10 bg-gray-200 animate-pulse rounded-md' />
            <div className='w-32 h-6 bg-gray-200 animate-pulse rounded-md' />
          </div>
        </div>

        {/* Table skeleton */}
        <div className='overflow-hidden rounded-lg border border-gray-100/50 bg-white/50 backdrop-blur-sm shadow-sm'>
          <div className='p-4 space-y-4'>
            {/* Table header */}
            <div className='grid grid-cols-5 gap-4 pb-4'>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className='h-4 bg-gray-200 animate-pulse rounded-md'
                />
              ))}
            </div>
            {/* Table rows */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='grid grid-cols-5 gap-4 py-3 border-t border-gray-100/50'>
                {[...Array(5)].map((_, j) => (
                  <div
                    key={j}
                    className='h-4 bg-gray-200 animate-pulse rounded-md'
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { paginatedProducts, totalPages, totalProducts } =
    filteredAndPaginatedProducts();

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-4'>
        {/* Search and Category Filter Group */}
        <div className='flex items-center gap-4 flex-1'>
          <div className='relative w-full md:w-72'>
            <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='Search products...'
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className='pl-8'
            />
          </div>

          <Select
            value={selectedCategory || "all"}
            onValueChange={(value) => {
              setSelectedCategory(value === "all" ? null : value);
              setCurrentPage(1);
            }}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Select category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refresh, Export and Total Count */}
        <div className='flex items-center gap-4'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' className='gap-2'>
                <FileDown className='h-4 w-4' />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                Export as XLSX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant='outline'
            size='icon'
            onClick={handleRefresh}
            className='hover:bg-gray-100'>
            <RefreshCw className='h-4 w-4' />
          </Button>
          <Badge variant='secondary' className='bg-white/50'>
            {totalProducts} products
          </Badge>
        </div>
      </div>

      {/* Table */}
      <div
        className={`rounded-md border transition-all duration-300 ${
          state === "expanded" ? "w-[75vw]" : "w-[93vw]"
        }`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Stock Level</TableHead>
              <TableHead>Min. Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center py-4'>
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className='font-medium'>{product.name}</TableCell>
                  <TableCell>{getCategoryName(product.category_id)}</TableCell>
                  <TableCell>{product.description || "—"}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <span>{product.inventory[0].quantity}</span>
                      <Button
                        variant='outline'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => {
                          setSelectedProduct(product);
                          setNewQuantity(product.inventory[0].quantity);
                          setShowStockDialog(true);
                        }}>
                        <Plus className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{product.min_stock_level}</TableCell>
                  <TableCell>
                    <Badge
                      variant='outline'
                      className={cn(
                        product.inventory[0].quantity <= product.min_stock_level
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      )}>
                      {product.inventory[0].quantity <= product.min_stock_level
                        ? "Low Stock"
                        : "In Stock"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowEditDialog(true);
                      }}>
                      <Edit className='h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className='flex justify-center mt-4'>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  className='cursor-pointer'
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                />
              </PaginationItem>

              {/* Generate page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((pageNumber) => {
                  // Show first page, last page, and pages around current page
                  return (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    Math.abs(pageNumber - currentPage) <= 1
                  );
                })
                .map((pageNumber, i, array) => {
                  // If there's a gap, show ellipsis
                  if (i > 0 && array[i - 1] !== pageNumber - 1) {
                    return (
                      <React.Fragment key={`ellipsis-${pageNumber}`}>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            className='cursor-pointer'
                            onClick={() => setCurrentPage(pageNumber)}
                            isActive={pageNumber === currentPage}>
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    );
                  }

                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        className='cursor-pointer'
                        onClick={() => setCurrentPage(pageNumber)}
                        isActive={pageNumber === currentPage}>
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

              <PaginationItem>
                <PaginationNext
                  className='cursor-pointer'
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {showStockDialog && (
        <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock Level</DialogTitle>
            </DialogHeader>
            <div className='space-y-4'>
              <div>
                <p className='text-sm font-medium mb-2'>
                  Product: {selectedProduct?.name}
                </p>
                <p className='text-sm text-muted-foreground mb-4'>
                  Current Stock: {selectedProduct?.inventory[0].quantity}
                </p>
              </div>
              <div className='flex items-center gap-4'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() =>
                    setNewQuantity((prev) => Math.max(0, prev - 1))
                  }>
                  <Minus className='h-4 w-4' />
                </Button>
                <Input
                  type='number'
                  min='0'
                  value={newQuantity}
                  onChange={(e) =>
                    setNewQuantity(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className='w-24 text-center'
                />
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setNewQuantity((prev) => prev + 1)}>
                  <Plus className='h-4 w-4' />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline'>Cancel</Button>
              </DialogClose>
              <Button onClick={handleStockAdjustment}>Update Stock</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <EditProductDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        product={selectedProduct}
      />
    </div>
  );
}
