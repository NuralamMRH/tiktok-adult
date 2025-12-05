import type { NextApiRequest, NextApiResponse } from 'next';
import { client } from '../../../../utils/client';
import { captionPostsQuery } from '../../../../utils/queries';
import { Video } from '../../../../types';

type Data = {
  data: Video[] | [];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method === 'GET') {
    const currentUserId = (req.query.currentUserId as string) || '';
    const caption = req.query.caption!;

    const query = captionPostsQuery(caption, currentUserId);
    const data: { data: Video[] } = await client.fetch(query);

    res.status(200).json(data);
  }
}

