import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';

// Virtualization
const VirtDashboard = React.lazy(() => import('./pages/Virtualization/Dashboard'));
const VirtInstances = React.lazy(() => import('./pages/Virtualization/Instances'));
const VirtHosts = React.lazy(() => import('./pages/Virtualization/Hosts'));

// 路由级别的加载占位
const RouteLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

// 懒加载包装器
const LazyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<RouteLoader />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />, // App renders Layout with Outlet
    children: [
      { index: true, element: <Navigate to="/virtualization/dashboard" replace /> },

      {
        path: '/virtualization/dashboard',
        element: <LazyRoute><VirtDashboard /></LazyRoute>,
      },
      {
        path: '/virtualization/instances',
        element: <LazyRoute><VirtInstances /></LazyRoute>,
      },
      {
        path: '/virtualization/hosts',
        element: <LazyRoute><VirtHosts /></LazyRoute>,
      },
    ],
  },
]);
