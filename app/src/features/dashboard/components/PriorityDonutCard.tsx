'use client';

import { Label, Pie, PieChart } from 'recharts';
import { PriorityIcon } from '@/components/common/PriorityBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { ISSUE_PRIORITIES, type Issue } from '@/lib/api/schemas';

const chartConfig = {
  count: { label: 'Issues' },
  High: { label: 'High', color: 'var(--chart-1)' },
  Medium: { label: 'Medium', color: 'var(--chart-2)' },
  Low: { label: 'Low', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function PriorityDonutCard({ issues, isLoading }: { issues: Issue[]; isLoading: boolean }) {
  const data = [...ISSUE_PRIORITIES].reverse().map((priority) => ({
    priority,
    count: issues.filter((issue) => issue.priority === priority).length,
    fill: `var(--color-${priority})`,
  }));
  const total = issues.length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>By priority</CardTitle>
        <CardDescription>Your open issues.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {isLoading ? (
          <Skeleton className="size-48 rounded-full" />
        ) : total === 0 ? (
          <p className="py-16 text-sm text-muted-foreground">Nothing to chart yet.</p>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-52"
            aria-label="Open issues by priority"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel nameKey="priority" />}
              />
              <Pie data={data} dataKey="count" nameKey="priority" innerRadius={56} strokeWidth={4}>
                <Label
                  content={({ viewBox }) =>
                    viewBox && 'cx' in viewBox && 'cy' in viewBox ? (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-semibold"
                        >
                          {total}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 22}
                          className="fill-muted-foreground text-xs"
                        >
                          open
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
        <ul className="flex flex-wrap justify-center gap-4 text-sm">
          {data.map((entry) => (
            <li key={entry.priority} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: chartConfig[entry.priority].color }}
                aria-hidden="true"
              />
              <PriorityIcon priority={entry.priority} className="size-4 text-muted-foreground" />
              <span>
                {entry.priority} <span className="text-muted-foreground">{entry.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
