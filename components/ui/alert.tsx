import React from 'react'

export function Alert({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'success' | 'error' }) {
  const variants: any = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  }
  return <div className={`rounded border px-3 py-2 text-sm ${variants[variant]}`}>{children}</div>
}
