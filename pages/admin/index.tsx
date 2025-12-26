import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ROOT_URL } from '../../utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [scraperStatus, setScraperStatus] = useState<any>(null);
  const [publisherStatus, setPublisherStatus] = useState<any>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [pageLimit, setPageLimit] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    axios
      .get(`${ROOT_URL}/api/admin/metrics`)
      .then((r) => setMetrics(r.data))
      .catch(() => {});
    axios
      .get(`${ROOT_URL}/logs/scraper-status.json`)
      .then((r) => setScraperStatus(r.data))
      .catch(() => {});
    axios
      .get(`${ROOT_URL}/logs/publisher-status.json`)
      .then((r) => setPublisherStatus(r.data))
      .catch(() => {});
  }, []);

  async function updateConfig() {
    await axios.post(`${ROOT_URL}/api/admin/scraper/config`, { baseUrl });
  }

  async function runScraper() {
    setRunning(true);
    try {
      await axios.post(`${ROOT_URL}/api/admin/scraper/run`, {
        pageLimit,
        baseUrl,
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className='space-y-6 p-6'>
      <h1 className='text-2xl font-semibold'>Admin Dashboard</h1>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
        <Card>
          <CardHeader>
            <CardTitle>Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>
              {metrics?.totalPosts ?? '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>
              {metrics?.totalUsers ?? '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>
              {metrics?.totalComments ?? '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Likes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-3xl font-bold'>
              {metrics?.totalLikes ?? '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Scraper Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div>
                <Badge>Last Run</Badge>{' '}
                <span className='ml-2'>{scraperStatus?.lastRun ?? '-'}</span>
              </div>
              <div>
                <Badge>Next In</Badge>{' '}
                <span className='ml-2'>
                  {scraperStatus?.nextRunInSeconds ?? '-'}
                </span>
              </div>
              <div>
                <Badge>Last List Count</Badge>{' '}
                <span className='ml-2'>
                  {scraperStatus?.lastListCount ?? '-'}
                </span>
              </div>
              <Link href='/logs/scraper.log' className='text-blue-600'>
                Open Log
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Publisher Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div>
                <Badge>Last Run</Badge>{' '}
                <span className='ml-2'>{publisherStatus?.lastRun ?? '-'}</span>
              </div>
              <Link href='/logs/publisher.log' className='text-blue-600'>
                Open Log
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <Input
                placeholder='Base URL'
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <Button onClick={updateConfig}>Update Config</Button>
            </div>
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                placeholder='Page Limit'
                value={pageLimit}
                onChange={(e) => setPageLimit(Number(e.target.value))}
                className='w-40'
              />
              <Button
                onClick={runScraper}
                disabled={running}
                variant='secondary'
              >
                {running ? 'Running...' : 'Run Scraper'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex gap-4'>
        <Link href='/admin/posts' className='rounded border px-4 py-2'>
          Manage Posts
        </Link>
        <Link href='/admin/users' className='rounded border px-4 py-2'>
          Manage Users
        </Link>
      </div>
    </div>
  );
}
