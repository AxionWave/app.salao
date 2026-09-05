import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { authService } from '@core/services';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    if (authService.needsPasswordChange()) {
        return <Navigate to="/primeiro-acesso" replace />;
    }
    return <>{children}</>;
}
