import React from 'react'

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-darkSecondary", className].join(' ')} {...props} />
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-4 border-b border-gray-200 dark:border-gray-800", className].join(' ')} {...props} />
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["text-lg font-semibold", className].join(' ')} {...props} />
}

export function CardContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={["p-4", className].join(' ')} {...props} />
}
