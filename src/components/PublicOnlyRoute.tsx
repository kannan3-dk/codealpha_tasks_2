import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

export const PublicOnlyRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Checking session..." />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
