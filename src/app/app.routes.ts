import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/landing',
    pathMatch: 'full'
  },
  {
    path: 'landing',
    loadComponent: () => import('./components/landing/landing.component').then(c => c.LandingComponent),
    title: 'Landing - Finance App'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(c => c.DashboardComponent),
    title: 'Dashboard - Finance App'
  },
  {
    path: 'add-transaction',
    loadComponent: () => import('./components/add-transaction/add-transaction.component').then(c => c.AddTransactionComponent),
    title: 'Nova Transação - Finance App'
  },
  {
    path: 'transactions',
    loadComponent: () => import('./components/transactions/transactions.component').then(c => c.TransactionsComponent),
    title: 'Transações - Finance App'
  },
  {
    path: 'edit-transaction/:id',
    loadComponent: () => import('./components/add-transaction/add-transaction.component').then(c => c.AddTransactionComponent),
    title: 'Editar Transação - Finance App'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
