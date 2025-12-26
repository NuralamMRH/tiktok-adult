import React from 'react'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export function Button({
  children,
  className = '',
  variant = 'default',
  size = 'md',
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-5',
  }
  const variants = {
    default: 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200',
    secondary: 'bg-gray-200 text-black hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
  }
  const cls = [base, sizes[size], variants[variant], className].join(' ')
  return (
    <button className={cls} disabled={disabled} {...props}>
      {children}
    </button>
  )
}
