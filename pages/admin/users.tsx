import { useEffect, useState } from 'react';
import axios from 'axios';
import { ROOT_URL } from '../../utils';
import { Card, CardContent } from '../../components/ui/card';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get(`${ROOT_URL}/api/user`)
      .then((r) => setUsers(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>Users</h1>
      <div className='space-y-2'>
        {users.map((u) => (
          <Card key={u._id}>
            <CardContent className='flex items-center gap-4 p-4'>
              <img
                src={u.image}
                alt='user'
                className='h-12 w-12 rounded-full'
              />
              <div>
                <div className='font-medium'>{u.userName}</div>
                <div className='text-sm text-gray-600 dark:text-gray-300'>
                  {u._id}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
