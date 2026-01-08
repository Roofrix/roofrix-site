import { Routes } from '@angular/router';
import { PublicLayout } from './layouts/public-layout/public-layout';
import { DashboardLayout } from './layouts/dashboard-layout/dashboard-layout';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, customerGuard, designerGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Public routes
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
      {
        path: 'signin',
        loadComponent: () => import('./pages/auth/signin/signin').then((m) => m.SignIn),
      },
      {
        path: 'signup',
        loadComponent: () => import('./pages/auth/signup/signup').then((m) => m.SignUp),
      },
      {
        path: '404',
        loadComponent: () => import('./pages/errors/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },

  // Dashboard routes (protected)
  {
    path: 'dashboard',
    component: DashboardLayout,
    canActivate: [authGuard],
    children: [
      // Customer routes
      {
        path: 'customer/new-order',
        loadComponent: () => import('./pages/dashboard/customer/new-order/new-order').then((m) => m.NewOrder),
        canActivate: [customerGuard],
      },
      {
        path: 'customer/orders',
        loadComponent: () => import('./pages/dashboard/customer/orders/orders').then((m) => m.CustomerOrders),
        canActivate: [customerGuard],
      },

      // Admin routes
      {
        path: 'admin/orders',
        loadComponent: () => import('./pages/dashboard/admin/orders/orders').then((m) => m.AdminOrders),
        canActivate: [adminGuard],
      },

      // Default dashboard redirect based on role (handled by guards)
      {
        path: '',
        redirectTo: 'customer/new-order',
        pathMatch: 'full',
      },
    ],
  },

  // Catch all
  {
    path: '**',
    redirectTo: '/404',
  },
];
