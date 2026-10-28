import Link from 'next/link'
import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'

export type Crumb = { label: string | null; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const label = item.label ?? <Skeleton className="h-4 w-24" />
          return (
            <Fragment key={`${item.href ?? 'current'}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {isLast || !item.href ? (
                  <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={item.href} />} className="truncate">
                    {label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
