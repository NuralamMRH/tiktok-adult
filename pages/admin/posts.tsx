import { useEffect, useState } from 'react';
import axios from 'axios';
import { ROOT_URL } from '../../utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';

export default function AdminPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [caption, setCaption] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => {
    axios
      .get(`${ROOT_URL}/api/post?limit=50`)
      .then((r) => setPosts(r.data))
      .catch(() => {});
  }, []);

  async function remove(id: string) {
    await axios.delete(`${ROOT_URL}/api/post/${id}`);
    setPosts((p) => p.filter((x) => x._id !== id));
  }

  async function save() {
    if (!editing) return;
    await axios.post(`${ROOT_URL}/api/admin/post/update`, {
      id: editing._id,
      caption,
      topic,
    });
    setPosts((p) =>
      p.map((x) => (x._id === editing._id ? { ...x, caption, topic } : x)),
    );
    setEditing(null);
  }

  return (
    <div className='space-y-4 p-6'>
      <h1 className='text-2xl font-semibold'>Posts</h1>
      <div className='space-y-2'>
        {posts.map((p) => (
          <Card key={p._id}>
            <CardHeader>
              <CardTitle>{p.caption}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-sm text-gray-600 dark:text-gray-300'>
                {p.topic}
              </div>
              <div className='mt-3 flex gap-2'>
                <Button variant='destructive' onClick={() => remove(p._id)}>
                  Delete
                </Button>
                <Button
                  onClick={() => {
                    setEditing(p);
                    setCaption(p.caption || '');
                    setTopic(p.topic || '');
                  }}
                >
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Post</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder='Caption'
              />
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder='Topic'
              />
              <div className='flex gap-2'>
                <Button onClick={save}>Save</Button>
                <Button variant='secondary' onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
