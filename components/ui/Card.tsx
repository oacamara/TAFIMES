import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  action?: React.ReactNode
}

export function Card({ children, className, title, action }: CardProps) {
  const hasHeader = title || action

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm border border-gray-200',
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && (
            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
