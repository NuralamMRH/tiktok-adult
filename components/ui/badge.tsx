import React from 'react'

export function Badge({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const cls = ['inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-semibold transition-colors dark:border-gray-700', className].join(' ')
  return <span className={cls}>{children}</span>
}
