import React from 'react';
import { CiPizza } from 'react-icons/ci';
import { BsCodeSlash } from 'react-icons/bs';
import { FaRegLaughSquint } from 'react-icons/fa';
import { IoGameControllerOutline } from 'react-icons/io5';
import { GiBearFace, GiSoundOn } from 'react-icons/gi';
import { BiFootball } from 'react-icons/bi';
import { CgGirl } from 'react-icons/cg';

export const topics = [
  {
    name: 'beauty',
    icon: React.createElement(CgGirl as any, { size: 20 }) as any,
  },
  {
    name: 'dance',
    icon: React.createElement(GiSoundOn as any, { size: 20 }) as any,
  },
  {
    name: 'food',
    icon: React.createElement(CiPizza as any, { size: 20 }) as any,
  },
  {
    name: 'gaming',
    icon: React.createElement(IoGameControllerOutline as any, {
      size: 20,
    }) as any,
  },
  {
    name: 'animals',
    icon: React.createElement(GiBearFace as any, { size: 20 }) as any,
  },
  {
    name: 'sports',
    icon: React.createElement(BiFootball as any, { size: 20 }) as any,
  },
  {
    name: 'development',
    icon: React.createElement(BsCodeSlash as any, { size: 20 }) as any,
  },
  {
    name: 'comedy',
    icon: React.createElement(FaRegLaughSquint as any, { size: 20 }) as any,
  },
];

export const socialIcons = [
  { icon: '/facebook.png', name: 'facebook' },
  { icon: '/pinterest.png', name: 'pinterest' },
  { icon: '/twitter.png', name: 'twitter' },
  { icon: '/reddit.png', name: 'reddit' },
];
