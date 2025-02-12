"use client";

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
import { Search, RefreshCw, RotateCcw } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SaleDetailsSheet } from "./SaleDetailsSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReturnDrawer } from "./ReturnDrawer";
import { ReturnHistoryDrawer } from "./ReturnHistoryDrawer";
import { Sale, SaleItem } from "@/types/sales";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PendingAction {
  id: string;
  action: "approved" | "rejected";
}

// First, add a helper function to get payment badge styles
const getPaymentBadgeStyles = (method: string) => {
  switch (method) {
    case "mpesa":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    case "cash":
      return "bg-blue-50 text-blue-700 border-blue-200/50";
    case "bank_transfer":
      return "bg-purple-50 text-purple-700 border-purple-200/50";
    case "cheque":
      return "bg-amber-50 text-amber-700 border-amber-200/50";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/50";
  }
};

export function SalesTable() {
  const { state } = useSidebar();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const router = useRouter();
  const [selectedReturnSale, setSelectedReturnSale] = useState<Sale | null>(
    null
  );
  const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canManageStatus =
    user?.role && ["admin", "accountant"].includes(user.role);

  // Add new permission check for returns
  const canProcessReturns =
    user?.role && ["admin", "clerk"].includes(user.role);

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const response = await fetch("/api/sales");
      if (!response.ok) throw new Error("Failed to fetch sales");
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const filteredAndPaginatedSales = () => {
    let filtered = [...sales];

    if (searchTerm) {
      filtered = filtered.filter(
        (sale) =>
          sale.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sale.customer_email
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          sale.customer_phone?.includes(searchTerm) ||
          sale.profiles.full_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          sale.sale_items.some((item: SaleItem) =>
            item.products.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
      paginatedSales: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / itemsPerPage),
      totalSales: filtered.length,
    };
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast({
        title: "Success",
        description: "Sales refreshed successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to refresh sales",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusClick = (
    saleId: string,
    action: "approved" | "rejected"
  ) => {
    if (!canManageStatus) {
      toast({
        variant: "destructive",
        title: "Unauthorized",
        description: "You don't have permission to perform this action",
      });
      return;
    }

    setPendingAction({ id: saleId, action });
    setShowStatusDialog(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingAction || !user?.id) return;

    setIsStatusChanging(true);
    try {
      const response = await fetch(`/api/sales/${pendingAction.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: pendingAction.action,
          approved_by: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.checkInventory) {
          toast({
            variant: "destructive",
            title: "Stock Check Required",
            description: (
              <div className='flex flex-col gap-2'>
                <p>{data.details}</p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push("/inventory")}>
                  Check Inventory
                </Button>
              </div>
            ),
          });
        } else {
          throw new Error(data.error || "Failed to update status");
        }
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["sales"] });

      toast({
        title: "Success",
        description: `Sale ${pendingAction.action} successfully`,
      });
      setShowStatusDialog(false);
      setPendingAction(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsStatusChanging(false);
    }
  };

  if (isLoading) {
    return (
      <div className='w-[75vw] mx-auto mt-4 space-y-6'>
        <h2 className='text-3xl font-bold tracking-tight text-center'>
          Sales Management
        </h2>
        <div className='flex flex-col items-center gap-2 mb-8'>
          <div className='w-32 h-4 bg-gray-200 animate-pulse rounded-md' />
        </div>

        <div className='flex items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-gray-100/50 shadow-sm'>
          <div className='w-72 h-10 bg-gray-200 animate-pulse rounded-md' />
          <div className='flex items-center gap-4'>
            <div className='w-10 h-10 bg-gray-200 animate-pulse rounded-md' />
            <div className='w-32 h-6 bg-gray-200 animate-pulse rounded-md' />
          </div>
        </div>

        <div className='overflow-hidden rounded-lg border border-gray-100/50 bg-white/50 backdrop-blur-sm shadow-sm'>
          <div className='p-4 space-y-4'>
            <div className='grid grid-cols-7 gap-4 pb-4'>
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className='h-4 bg-gray-200 animate-pulse rounded-md'
                />
              ))}
            </div>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='grid grid-cols-7 gap-4 py-3 border-t border-gray-100/50'>
                {[...Array(7)].map((_, j) => (
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

  const { paginatedSales, totalPages, totalSales } =
    filteredAndPaginatedSales();

  return (
    <div className='w-[75vw] mx-auto mt-4 space-y-6'>
      <div className='flex flex-col items-center gap-2 mb-8'>
        <h2 className='text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent'>
          Sales Management
        </h2>
        <p className='text-sm text-muted-foreground/60'>
          View and manage sales transactions
        </p>
      </div>

      <div className='flex items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-gray-100/50 shadow-sm'>
        <div className='relative w-full md:w-72'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50' />
          <Input
            placeholder='Search sales...'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className='pl-9 border-gray-100/50 bg-white/50 focus:bg-white transition-colors'
          />
        </div>

        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            onClick={() => setSelectedHistorySale({ id: "dummy" } as Sale)}
            className='gap-2'>
            <RotateCcw className='h-4 w-4' />
            Return History
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={handleRefresh}
            disabled={isRefreshing}
            className='border-gray-100/50 hover:bg-white/50 transition-colors'>
            <RefreshCw
              className={cn("h-4 w-4 text-muted-foreground/70", {
                "animate-spin": isRefreshing,
              })}
            />
          </Button>
          <Badge
            variant='secondary'
            className='bg-white/50 text-muted-foreground/70'>
            {totalSales} {totalSales === 1 ? "sale" : "sales"}
          </Badge>
        </div>
      </div>

      <div className='overflow-hidden rounded-lg border border-gray-100/50 bg-white/50 backdrop-blur-sm shadow-sm'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[100px]'>Date</TableHead>
              <TableHead className='w-[200px]'>Customer</TableHead>
              <TableHead className='w-[300px]'>Items</TableHead>
              <TableHead className='w-[150px]'>Total Amount</TableHead>
              <TableHead className='w-[120px]'>Status</TableHead>
              <TableHead className='w-[200px] text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-center py-4'>
                  No sales found
                </TableCell>
              </TableRow>
            ) : (
              paginatedSales.map((sale) => (
                <TableRow
                  key={sale.id}
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => setSelectedSale(sale)}>
                  <TableCell className='whitespace-nowrap'>
                    {format(new Date(sale.created_at), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-col'>
                      <span className='font-medium truncate'>
                        {sale.customer_name}
                      </span>
                      {sale.customer_phone && (
                        <span className='text-sm text-muted-foreground truncate'>
                          {sale.customer_phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-col gap-1 max-w-[300px]'>
                      {sale.sale_items
                        .filter((item: SaleItem) => item.effective_quantity > 0)
                        .map((item: SaleItem, index: number) => (
                          <div key={index} className='text-sm truncate'>
                            {item.products.name} × {item.effective_quantity}
                          </div>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    KES {sale.total_amount}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sale.status === "approved"
                          ? "default"
                          : sale.status === "pending"
                          ? "outline"
                          : "destructive"
                      }
                      className={cn(
                        "whitespace-nowrap w-fit",
                        sale.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : sale.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      )}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      {sale.status === "pending" && canManageStatus && (
                        <>
                          <Button
                            size='sm'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusClick(sale.id, "approved");
                            }}
                            className='bg-green-100 text-green-800 hover:bg-green-200 whitespace-nowrap'>
                            Approve
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusClick(sale.id, "rejected");
                            }}
                            className='text-red-800 hover:bg-red-100 whitespace-nowrap'>
                            Reject
                          </Button>
                        </>
                      )}
                      {sale.status === "approved" && canProcessReturns && (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReturnSale(sale);
                          }}
                          className='gap-2'>
                          <RotateCcw className='h-4 w-4' />
                          Return
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className='flex justify-center mt-6'>
          <Pagination>
            <PaginationContent className='bg-white/50 backdrop-blur-sm border border-gray-100/50 rounded-lg shadow-sm px-2'>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  className={cn(
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i + 1}>
                  <PaginationLink
                    onClick={() => setCurrentPage(i + 1)}
                    isActive={currentPage === i + 1}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  className={cn(
                    currentPage === totalPages &&
                      "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "approved" ? "Approve" : "Reject"} Sale
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {pendingAction?.action} this sale?
              {pendingAction?.action === "rejected" &&
                " This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingAction(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmStatusChange}
              disabled={isStatusChanging}
              className={cn(
                pendingAction?.action === "approved"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}>
              {isStatusChanging ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {pendingAction?.action === "approved"
                    ? "Approving..."
                    : "Rejecting..."}
                </>
              ) : pendingAction?.action === "approved" ? (
                "Approve"
              ) : (
                "Reject"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SaleDetailsSheet
        sale={selectedSale}
        open={!!selectedSale}
        onOpenChange={(open) => !open && setSelectedSale(null)}
      />

      <ReturnDrawer
        sale={selectedReturnSale}
        open={!!selectedReturnSale}
        onOpenChange={(open) => !open && setSelectedReturnSale(null)}
      />

      <ReturnHistoryDrawer
        open={!!selectedHistorySale}
        onOpenChange={(open) => !open && setSelectedHistorySale(null)}
      />
    </div>
  );
}
