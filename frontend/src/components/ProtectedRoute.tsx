import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#641C24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = currentUser.role.toLowerCase();
    const hasRole = allowedRoles.some(r => r.toLowerCase() === userRole || (userRole === 'owner'));
    if (!hasRole) {
      return (
        <div className="min-h-screen bg-[#FFF9F0] flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold font-serif-royal text-[#641C24] mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-600 mb-4">Your role ({currentUser.role}) does not have permission to access this area.</p>
          <a href="/staff" className="bg-[#641C24] text-white px-4 py-2 rounded-xl text-xs font-bold">Return to Dashboard</a>
        </div>
      );
    }
  }

  return <>{children}</>;
};
