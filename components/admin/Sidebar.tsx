import Link from 'next/link'

export default function AdminSidebar() {
  const items = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/posts', label: 'Posts' },
    { href: '/admin/users', label: 'Users' },
  ]
  return (
    <div className="w-56 border-r border-gray-200 dark:border-gray-800 p-4 space-y-2">
      {items.map(i => (
        <Link key={i.href} href={i.href} className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          {i.label}
        </Link>
      ))}
    </div>
  )
}
