"use client";

import { useRouter, usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ArrowLeftRight,
  FileText,
  Users,
  UserPlus,
  PackagePlus,
  Plus,
  FileDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
  SidebarGroup,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Register from "@/components/auth/Register";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { TransferDrawer } from "@/components/transfers/TransferDrawer";
import { CreateSaleSheet } from "@/components/sales/CreateSaleDialog";
import { cn } from "@/lib/utils";
import { CreateLPOSheet } from "@/components/lpo/CreateLPOSheet";
import Image from "next/image";

interface AppSidebarProps {
  user: Profile;
}

interface MenuItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface ActionItem {
  title: string;
  icon: LucideIcon;
  action: () => void;
}

interface NavItems {
  menu: MenuItem[];
  actions?: ActionItem[];
}

type UserRole = "admin" | "accountant" | "clerk" | "user";

type RoleBasedNavItems = {
  [K in UserRole]: NavItems;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showTransferDrawer, setShowTransferDrawer] = useState(false);
  const [showCreateSaleDialog, setShowCreateSaleDialog] = useState(false);
  const [showCreateLPOSheet, setShowCreateLPOSheet] = useState(false);

  const handleRegisterSuccess = () => {
    setSheetOpen(false);
    toast({
      title: "Success",
      description: "User registered successfully",
    });
  };

  const roleBasedNavItems: RoleBasedNavItems = {
    admin: {
      menu: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Inventory",
          href: "/inventory",
          icon: Package,
        },
        {
          title: "Sales",
          href: "/sales",
          icon: ClipboardList,
        },
        {
          title: "Transfers",
          href: "/transfers",
          icon: ArrowLeftRight,
        },
        {
          title: "Reports",
          href: "/reports",
          icon: FileText,
        },
        {
          title: "LPO",
          href: "/lpo",
          icon: FileText,
        },
        {
          title: "Users",
          href: "/users",
          icon: Users,
        },
      ],
      actions: [
        {
          title: "Add User",
          icon: UserPlus,
          action: () => setSheetOpen(true),
        },
        {
          title: "Add Product",
          icon: PackagePlus,
          action: () => setShowAddProductDialog(true),
        },
        {
          title: "Transfer Stock",
          icon: ArrowLeftRight,
          action: () => setShowTransferDrawer(true),
        },
        {
          title: "Create Sale",
          icon: Plus,
          action: () => setShowCreateSaleDialog(true),
        },
        {
          title: "Create LPO",
          icon: FileText,
          action: () => setShowCreateLPOSheet(true),
        },
      ],
    },
    accountant: {
      menu: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Inventory",
          href: "/inventory",
          icon: Package,
        },
        {
          title: "Reports",
          href: "/reports",
          icon: FileText,
        },
        {
          title: "Sales",
          href: "/sales",
          icon: ClipboardList,
        },
        {
          title: "LPO",
          href: "/lpo",
          icon: FileText,
        },
      ],
    },
    clerk: {
      menu: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Reports",
          href: "/reports",
          icon: FileText,
        },
        {
          title: "Inventory",
          href: "/inventory",
          icon: Package,
        },
        {
          title: "Sales",
          href: "/sales",
          icon: ClipboardList,
        },
        {
          title: "Transfers",
          href: "/transfers",
          icon: ArrowLeftRight,
        },
      ],
      actions: [
        {
          title: "Add Product",
          icon: PackagePlus,
          action: () => setShowAddProductDialog(true),
        },
        {
          title: "Create Sale",
          icon: Plus,
          action: () => setShowCreateSaleDialog(true),
        },
        {
          title: "Transfer Stock",
          icon: ArrowLeftRight,
          action: () => setShowTransferDrawer(true),
        },
        {
          title: "Create LPO",
          icon: FileText,
          action: () => setShowCreateLPOSheet(true),
        },
      ],
    },
    user: {
      menu: [],
    },
  };

  if (!user.role || !(user.role in roleBasedNavItems)) {
    return null;
  }

  const navItems = roleBasedNavItems[user.role];

  return (
    <>
      <div className='h-screen fixed left-0 top-0 z-50'>
        <Sidebar className='w-[280px] h-full bg-[#F8FAFC] border-r border-zinc-100/50'>
          <div className='p-4'>
            <Image
              src='/logo.png'
              alt='Aquatreat Logo'
              width={160}
              height={160}
              className='w-auto h-auto'
            />
          </div>

          <SidebarContent className=''>
            <SidebarGroup>
              <SidebarGroupLabel className='px-2 text-xs font-medium text-zinc-400 tracking-wider'>
                NAVIGATION
              </SidebarGroupLabel>
              <SidebarMenu className='mt-2'>
                {navItems.menu.map((item, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton
                      onClick={() => router.push(item.href)}
                      tooltip={item.title}
                      className={cn(
                        "relative px-3 py-2 rounded-lg transition-all duration-300 group",
                        "hover:bg-white/60",
                        pathname === item.href &&
                          "bg-white/80 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-indigo-600 before:to-purple-600"
                      )}>
                      <div
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          pathname === item.href
                            ? "bg-gradient-to-br from-indigo-50 to-purple-50"
                            : "group-hover:bg-zinc-50"
                        )}>
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-colors",
                            pathname === item.href
                              ? "text-indigo-600"
                              : "text-zinc-400 group-hover:text-zinc-600"
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-sm transition-colors ml-3",
                          pathname === item.href
                            ? "font-medium text-indigo-600"
                            : "text-zinc-600 group-hover:text-zinc-900"
                        )}>
                        {item.title}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>

            {navItems.actions && (
              <>
                <div className='h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent' />

                <SidebarGroup>
                  <SidebarGroupLabel className='px-2 text-xs font-medium text-zinc-400 tracking-wider'>
                    QUICK ACTIONS
                  </SidebarGroupLabel>
                  <SidebarMenu className='mt-2'>
                    {navItems.actions.map((item, index) => (
                      <SidebarMenuItem key={index}>
                        <SidebarMenuButton
                          onClick={item.action}
                          tooltip={item.title}
                          className='group px-3 py-2 rounded-lg hover:bg-white/60 transition-all duration-300'>
                          <div className='p-1.5 rounded-md bg-gradient-to-br from-zinc-50 to-zinc-100/50 group-hover:from-indigo-50 group-hover:to-purple-50'>
                            <item.icon className='h-4 w-4 text-zinc-500 group-hover:text-indigo-600' />
                          </div>
                          <span className='text-sm text-zinc-600 group-hover:text-zinc-900 ml-3'>
                            {item.title}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              </>
            )}
          </SidebarContent>
        </Sidebar>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className='min-w-[30vw] sm:min-w-[540px]'>
          <SheetHeader>
            <SheetTitle>Add New User</SheetTitle>
          </SheetHeader>
          <div className='mt-4'>
            <Register onSuccess={handleRegisterSuccess} className='w-full' />
          </div>
        </SheetContent>
      </Sheet>

      <AddProductDialog
        open={showAddProductDialog}
        onOpenChange={setShowAddProductDialog}
      />

      <TransferDrawer
        open={showTransferDrawer}
        onOpenChange={setShowTransferDrawer}
      />

      <CreateSaleSheet
        open={showCreateSaleDialog}
        onOpenChange={setShowCreateSaleDialog}
      />

      <CreateLPOSheet
        open={showCreateLPOSheet}
        onOpenChange={setShowCreateLPOSheet}
      />
    </>
  );
}
