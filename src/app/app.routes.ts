import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/features/features').then((m) => m.Features),
      },
      {
        path: 'pricing',
        loadComponent: () => import('./pages/pricing/pricing').then((m) => m.Pricing),
      },
      {
        path: 'about',
        loadComponent: () => import('./pages/about/about').then((m) => m.About),
      },
      {
        path: 'contact',
        loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
      },
    ],
  },
];
