import Link from 'next/link';
import { CgMathPlus } from 'react-icons/cg';
import { IoSearchOutline } from 'react-icons/io5';
import { signIn, useSession } from 'next-auth/react';
import { FaUserCircle } from 'react-icons/fa';
import User from './User';
import LogoLight from '../utils/LogoLight';
import LogoDark from '../utils/LogoDark';
import { FormEvent, useRef } from 'react';
import { useRouter } from 'next/router';
import useStore from '../store';
import { BiMenuAltLeft } from 'react-icons/bi';
import { toggleSidebarDrawer } from '../utils/sidebar-drawer';

type Props = {
  hasSidebar: boolean;
};

export default function Navbar({ hasSidebar }: Props) {
  const { data: user }: any = useSession();

  const { theme } = useStore();
  const router = useRouter();

  const searchInputRef = useRef<HTMLInputElement>(null);

  function handleSearch(e: FormEvent) {
    e.preventDefault();

    const searchTerm = searchInputRef.current?.value!.trim();

    if (!searchTerm) return;

    router.push(`/search?q=${searchTerm}`);
  }

  return (
    <nav className='fixed left-0 right-0 top-0 z-10 flex h-16 items-center justify-center bg-transparent'>
      <div className='relative mx-auto h-full w-full px-2 py-2 lg:px-4'>
        <Link
          href='/'
          aria-label='TikTok_logo'
          className={`absolute left-2 top-2 ${!hasSidebar ? 'block' : 'hidden lg:block'} `}
        >
          {theme === 'dark' ? <LogoDark /> : <LogoLight />}
        </Link>

        {hasSidebar && (
          <button
            onClick={toggleSidebarDrawer}
            className='absolute left-2 top-2 flex items-center justify-center rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-darkBtnHover lg:hidden'
          >
            <BiMenuAltLeft size={30} />
          </button>
        )}

        <form
          onSubmit={handleSearch}
          className='absolute left-1/2 top-2 hidden w-full max-w-lg -translate-x-1/2 items-center justify-between overflow-hidden rounded-full border bg-gray-100 focus-within:border-gray-300 focus-within:bg-gray-200 dark:border-transparent dark:bg-darkSecondary dark:text-white dark:focus-within:border-gray-500 dark:focus-within:bg-darkSecondary md:flex'
        >
          <input
            ref={searchInputRef}
            defaultValue={router.query.q || ''}
            type='text'
            placeholder='Search accounts and videos'
            className='peer w-full flex-1 border-none bg-transparent p-2 pl-4 outline-none dark:placeholder-gray-500'
          />

          <button
            type='submit'
            className='flex h-10 w-11 cursor-pointer items-center justify-center border-l border-l-gray-200 text-gray-400 peer-focus:border-l-gray-300 dark:border-l-gray-500 dark:peer-focus:border-l-gray-500'
          >
            <IoSearchOutline size={23} />
          </button>
        </form>

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
