"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ReportWrapper } from "./ReportWrapper";
import { useToast } from "@/hooks/use-toast";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { pdf } from "@react-pdf/renderer";
import { InventoryReportPDF } from "@/components/pdf/InventoryReportPDF";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ProductInventory {
  quantity: number;
  location: "kamulu" | "utawala";
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  min_stock_level: number;
  inventory: ProductInventory[];
}

interface ProductWithUniqueId extends Product {
  uniqueId: string;
}

// New interface for the consolidated product view
interface ConsolidatedProduct {
  id: string;
  name: string;
  description: string | null;
  min_stock_level: number;
  utawalaQuantity: number;
  kamuluQuantity: number;
  totalQuantity: number;
}

export function InventoryReport() {
  const [selectedLocation, setSelectedLocation] = useState<
    "all" | "kamulu" | "utawala"
  >("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: utawalaProducts = [], isLoading: isLoadingUtawala } = useQuery<
    Product[]
  >({
    queryKey: ["products", "utawala"],
    queryFn: async () => {
      const response = await fetch("/api/products?location=utawala");
      if (!response.ok) throw new Error("Failed to fetch Utawala inventory");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: kamuluProducts = [], isLoading: isLoadingKamulu } = useQuery<
    Product[]
  >({
    queryKey: ["products", "kamulu"],
    queryFn: async () => {
      const response = await fetch("/api/products?location=kamulu");
      if (!response.ok) throw new Error("Failed to fetch Kamulu inventory");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Create a consolidated view of products across locations
  const consolidatedProducts: ConsolidatedProduct[] = (() => {
    // Create a map of product IDs to their consolidated data
    const productMap = new Map<string, ConsolidatedProduct>();

    // Process Utawala products
    utawalaProducts.forEach((product) => {
      productMap.set(product.id, {
        id: product.id,
        name: product.name,
        description: product.description,
        min_stock_level: product.min_stock_level,
        utawalaQuantity: product.inventory[0].quantity,
        kamuluQuantity: 0, // Will be updated if exists in Kamulu
        totalQuantity: product.inventory[0].quantity,
      });
    });

    // Process Kamulu products
    kamuluProducts.forEach((product) => {
      if (productMap.has(product.id)) {
        // Product exists in Utawala, update Kamulu quantity
        const existingProduct = productMap.get(product.id)!;
        existingProduct.kamuluQuantity = product.inventory[0].quantity;
        existingProduct.totalQuantity += product.inventory[0].quantity;
      } else {
        // Product only exists in Kamulu
        productMap.set(product.id, {
          id: product.id,
          name: product.name,
          description: product.description,
          min_stock_level: product.min_stock_level,
          utawalaQuantity: 0,
          kamuluQuantity: product.inventory[0].quantity,
          totalQuantity: product.inventory[0].quantity,
        });
      }
    });

    // Convert map to array and sort by name
    return Array.from(productMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  })();

  // Filter products based on selected location and search query
  const filteredProducts = consolidatedProducts
    .filter((product) => {
      // Filter by location
      if (selectedLocation === "all") return true;
      return selectedLocation === "utawala"
        ? product.utawalaQuantity > 0
        : product.kamuluQuantity > 0;
    })
    .filter((product) => {
      // Filter by search query
      if (!searchQuery.trim()) return true;
      return (
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description &&
          product.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });

  // Calculate pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocation, searchQuery]);

  const totalProducts = filteredProducts.length;
  const lowStockProducts = filteredProducts.filter(
    (product) =>
      product.totalQuantity <= product.min_stock_level &&
      product.totalQuantity > 0
  ).length;
  const outOfStockProducts = filteredProducts.filter(
    (product) => product.totalQuantity === 0
  ).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products", "utawala"] }),
        queryClient.invalidateQueries({ queryKey: ["products", "kamulu"] }),
      ]);
      toast({
        title: "Success",
        description: "Report data refreshed successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh report data",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      // Fetch logo first
      const logoResponse = await fetch("/api/logo");
      const { logo } = await logoResponse.json();

      // Generate PDF with logo
      const blob = await pdf(
        <InventoryReportPDF
          products={filteredProducts}
          totalProducts={totalProducts}
          lowStockProducts={lowStockProducts}
          outOfStockProducts={outOfStockProducts}
          selectedLocation={selectedLocation}
          logo={logo}
        />
      ).toBlob();

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inventory-report-${format(
        new Date(),
        "yyyy-MM-dd"
      )}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF",
      });
    }
  };

  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if there are few pages
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Always show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            isActive={currentPage === 1}
            onClick={() => setCurrentPage(1)}>
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if current page is far from the start
      if (currentPage > 3) {
        items.push(
          <PaginationItem key='ellipsis-start'>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              isActive={currentPage === i}
              onClick={() => setCurrentPage(i)}>
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if current page is far from the end
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key='ellipsis-end'>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Always show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              isActive={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}>
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

  const isLoading = isLoadingUtawala || isLoadingKamulu;

  if (isLoading) {
    return (
      <div className='space-y-6'>
        {/* Filters skeleton */}
        <div className='flex items-center justify-between'>
          <div className='w-[180px] h-10 bg-gray-200 animate-pulse rounded-md' />
          <div className='flex gap-2'>
            <div className='w-24 h-10 bg-gray-200 animate-pulse rounded-md' />
            <div className='w-24 h-10 bg-gray-200 animate-pulse rounded-md' />
          </div>
        </div>

        {/* Stats cards skeleton */}
        <div className='grid gap-4 md:grid-cols-3'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='p-6 rounded-lg border border-gray-100/50 bg-white/50'>
              <div className='space-y-3'>
                <div className='w-24 h-5 bg-gray-200 animate-pulse rounded-md' />
                <div className='w-16 h-4 bg-gray-200 animate-pulse rounded-md' />
                <div className='w-32 h-8 bg-gray-200 animate-pulse rounded-md' />
              </div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className='rounded-lg border border-gray-100/50 bg-white/50'>
          <div className='p-4 space-y-4'>
            <div className='w-48 h-6 bg-gray-200 animate-pulse rounded-md' />
            <div className='space-y-3'>
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
      </div>
    );
  }

  return (
    <ReportWrapper>
      <div className='flex items-center justify-between mb-4'>
        <Select
          value={selectedLocation}
          onValueChange={(value: "all" | "kamulu" | "utawala") =>
            setSelectedLocation(value)
          }>
          <SelectTrigger className='w-[180px]'>
            <SelectValue placeholder='Select location' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Locations</SelectItem>
            <SelectItem value='kamulu'>Kamulu Store</SelectItem>
            <SelectItem value='utawala'>Utawala Store</SelectItem>
          </SelectContent>
        </Select>
        <div className='flex gap-2'>
          <Button
            variant='outline'
            onClick={handleRefresh}
            disabled={isRefreshing}>
            <RefreshCw
              className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>

          <Button variant='outline' onClick={handleExportPDF}>
            <Download className='mr-2 h-4 w-4' />
            Export PDF
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-3 mb-4'>
        <Card>
          <CardHeader>
            <CardTitle>Total Products</CardTitle>
            <CardDescription>Across selected location(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low Stock Items</CardTitle>
            <CardDescription>Below minimum level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{lowStockProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Out of Stock</CardTitle>
            <CardDescription>Zero quantity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{outOfStockProducts}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle>Inventory Details</CardTitle>
            <div className='relative w-64'>
              <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Search products...'
                className='pl-8'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Utawala Stock</TableHead>
                <TableHead>Kamulu Stock</TableHead>
                <TableHead>Total Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-center py-6 text-muted-foreground'>
                    {searchQuery
                      ? "No products match your search"
                      : "No products found"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className='font-medium'>
                      {product.name}
                    </TableCell>
                    <TableCell>{product.utawalaQuantity}</TableCell>
                    <TableCell>{product.kamuluQuantity}</TableCell>
                    <TableCell className='font-semibold'>
                      {product.totalQuantity}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.totalQuantity === 0
                            ? "destructive"
                            : product.totalQuantity <= product.min_stock_level
                            ? "outline"
                            : "default"
                        }
                        className={cn(
                          product.totalQuantity === 0
                            ? "bg-red-100 text-red-800"
                            : product.totalQuantity <= product.min_stock_level
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        )}>
                        {product.totalQuantity === 0
                          ? "Out of Stock"
                          : product.totalQuantity <= product.min_stock_level
                          ? "Low Stock"
                          : "In Stock"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className='mt-4'>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      className={cn(
                        "cursor-pointer",
                        currentPage === 1 && "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>

                  {renderPaginationItems()}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      className={cn(
                        "cursor-pointer",
                        currentPage === totalPages &&
                          "pointer-events-none opacity-50"
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {totalProducts > 0 && (
            <div className='text-xs text-muted-foreground mt-2 text-center'>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, totalProducts)} of{" "}
              {totalProducts} products
            </div>
          )}
        </CardContent>
      </Card>
    </ReportWrapper>
  );
}
