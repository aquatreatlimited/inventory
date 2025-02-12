"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  TooltipProps as RechartsTooltipProps,
} from "recharts";
import { format, formatCurrency } from "@/lib/utils";
import type { Profile } from "@/lib/types/index";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

interface DashboardContentProps {
  user: Profile;
}

interface SaleData {
  date: string;
  total_amount: number;
  items?: string[];
}

interface ChartData {
  date: string;
  sales: number;
  items?: string[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
  coordinate,
}: RechartsTooltipProps<ValueType, NameType>) => {
  if (active && payload?.[0]) {
    const items = payload[0].payload.items as string[] | undefined;
    const aggregatedItems = items?.reduce(
      (acc: { [key: string]: number }, item: string) => {
        const match = item.match(/(.*?)\s*\((\d+)\)$/);
        if (match) {
          const [, productName, quantity] = match;
          acc[productName] = (acc[productName] || 0) + parseInt(quantity, 10);
        }
        return acc;
      },
      {}
    );

    // Get the number of items to determine if we need to adjust position
    const itemCount = aggregatedItems ? Object.keys(aggregatedItems).length : 0;
    const estimatedHeight = 80 + itemCount * 24; // Base height + height per item
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 0;

    // Check if tooltip would overflow top or bottom of screen
    const wouldOverflowBottom = coordinate?.y
      ? coordinate.y + estimatedHeight > viewportHeight - 100
      : false;
    const wouldOverflowTop = coordinate?.y
      ? coordinate.y - estimatedHeight < 100
      : false;

    // Determine the transform based on overflow conditions
    let transform = "translateY(0)";
    if (wouldOverflowTop) {
      transform = "translateY(0)"; // Position below the point
    } else if (wouldOverflowBottom) {
      transform = "translateY(-100%)"; // Position above the point
    }

    return (
      <div
        className='rounded-lg border bg-background p-2 shadow-sm max-h-[400px] overflow-auto'
        style={{
          transform,
          maxWidth: "300px",
          position: "relative",
          pointerEvents: "auto",
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
        }}
        onMouseMove={(e) => {
          e.stopPropagation();
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}>
        <div className='flex flex-col gap-1'>
          <span className='font-medium'>{label}</span>
          <span className='text-muted-foreground'>
            {formatCurrency(payload[0].value as number)}
          </span>
          {aggregatedItems && Object.keys(aggregatedItems).length > 0 && (
            <div className='mt-1 border-t pt-1'>
              <span className='text-xs text-muted-foreground'>Items Sold:</span>
              <div
                className='mt-1 max-h-[250px] overflow-y-auto'
                onMouseEnter={(e) => e.stopPropagation()}
                onMouseLeave={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}>
                <ul className='text-sm text-muted-foreground space-y-1'>
                  {Object.entries(aggregatedItems)
                    .sort(([aName], [bName]) => aName.localeCompare(bName))
                    .map(([productName, quantity], index) => (
                      <li key={index} className='flex justify-between gap-4'>
                        <span className='truncate'>{String(productName)}</span>
                        <span className='flex-shrink-0'>
                          ({String(quantity)})
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function DashboardContent({ user }: DashboardContentProps) {
  const { data: salesMetrics, isLoading } = useQuery({
    queryKey: ["sales-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/sales-metrics");
      if (!response.ok) throw new Error("Failed to fetch sales metrics");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className='h-[calc(100vh-4rem)]'>
        <div className='h-full bg-gray-200 animate-pulse' />
      </div>
    );
  }

  const chartData: ChartData[] =
    salesMetrics?.dailySales?.map((sale: SaleData) => ({
      date: format(new Date(sale.date), "MMM dd"),
      sales: sale.total_amount,
      items: sale.items,
    })) || [];

  if (chartData.length === 0) {
    return (
      <div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
        <p className='text-muted-foreground'>No sales data available</p>
      </div>
    );
  }

  // Sort the data by date
  chartData.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className='h-[calc(100vh-4rem)] w-[75vw] p-6'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 60,
            bottom: 20,
          }}>
          <defs>
            <linearGradient id='salesGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#2563eb' stopOpacity={0.9} />
              <stop offset='45%' stopColor='#3b82f6' stopOpacity={0.7} />
              <stop offset='95%' stopColor='#60a5fa' stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id='salesHover' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#1d4ed8' stopOpacity={1} />
              <stop offset='45%' stopColor='#2563eb' stopOpacity={0.8} />
              <stop offset='95%' stopColor='#3b82f6' stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id='corporateGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#0284c7' stopOpacity={0.9} />
              <stop offset='45%' stopColor='#0ea5e9' stopOpacity={0.7} />
              <stop offset='95%' stopColor='#38bdf8' stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray='3 3'
            vertical={false}
            stroke='#e2e8f0'
            opacity={0.5}
          />
          <XAxis
            dataKey='date'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke='#64748b'
          />
          <YAxis
            tickFormatter={(value) => `KES ${value.toLocaleString()}`}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            stroke='#64748b'
          />
          <Tooltip<ValueType, NameType>
            content={CustomTooltip}
            cursor={{ fill: "rgba(148, 163, 184, 0.1)" }}
          />
          <Bar
            dataKey='sales'
            fill='url(#corporateGradient)'
            radius={[6, 6, 0, 0]}
            maxBarSize={50}
            onMouseEnter={(data, index) => {
              document
                .querySelector(`#bar-${index}`)
                ?.setAttribute("fill", "url(#salesHover)");
            }}
            onMouseLeave={(data, index) => {
              document
                .querySelector(`#bar-${index}`)
                ?.setAttribute("fill", "url(#corporateGradient)");
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DashboardContent;
