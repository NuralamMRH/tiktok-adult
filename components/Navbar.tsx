import Link from 'next/link';
import { CgMathPlus } from 'react-icons/cg';
import { signIn, useSession } from 'next-auth/react';
import { FaUserCircle } from 'react-icons/fa';
import User from './User';
import { BiMenuAltLeft } from 'react-icons/bi';
import { toggleSidebarDrawer } from '../utils/sidebar-drawer';

type Props = {
  hasSidebar: boolean;
};

export default function Navbar({ hasSidebar }: Props) {
  const { data: user }: any = useSession();

  return (
    <nav className='fixed left-0 right-0 top-0 z-10 flex h-16 items-center justify-center bg-transparent'>
      <div className='relative mx-auto h-full w-full px-2 py-2 lg:px-4'>
        {hasSidebar && (
          <button
            onClick={toggleSidebarDrawer}
            className='absolute left-2 top-2 flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-darkBtnHover lg:hidden'
          >
            <BiMenuAltLeft size={30} />
          </button>
        )}

        <div className='absolute right-1 top-2 flex items-center'>
          {user ? (
            <>
              <Link
                href='/upload'
                className='btn-secondary mr-2 flex items-center'
              >
                <CgMathPlus />
                <p className='ml-2'>Upload</p>
              </Link>

              <User />
            </>
          ) : (
            <button
              onClick={() => signIn('google')}
              aria-label='login'
              className='inline-flex h-11 w-11 items-center justify-center rounded-full p-[4px] duration-200 hover:bg-gray-200 dark:hover:bg-darkSecondary xs:h-12 xs:w-12'
            >
              <FaUserCircle
                size={25}
                className='text-white-600 dark:text-white'
              />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
