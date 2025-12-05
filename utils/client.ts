import { createClient } from 'next-sanity';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2023-01-01';

const hasEnv = !!projectId;

export const client = hasEnv
  ? createClient({
      projectId,
      dataset: 'production',
      apiVersion,
      useCdn: false,
      token: process.env.NEXT_PUBLIC_SANITY_TOKEN,
      ignoreBrowserTokenWarning: true,
    })
  : ({
      fetch: async () => {
        throw new Error('Missing Sanity env');
      },
      create: async () => {
        throw new Error('Missing Sanity env');
      },
      createIfNotExists: async () => {
        throw new Error('Missing Sanity env');
      },
      delete: async () => {
        throw new Error('Missing Sanity env');
      },
      patch: () => ({
        setIfMissing: () => ({
          insert: () => ({
            commit: async () => {
              throw new Error('Missing Sanity env');
            },
          }),
        }),
        unset: () => ({
          commit: async () => {
            throw new Error('Missing Sanity env');
          },
        }),
      }),
      assets: {
        upload: async () => {
          throw new Error('Missing Sanity env');
        },
      },
    } as any);
