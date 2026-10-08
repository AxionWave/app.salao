import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { authService } from '@core/services';
import NoPermissionPage from '@/components/NoPermissionPage';

export default function ModuleProtectedRoute({
    children,
    moduloCodigo,
}: {
    children: ReactNode;
    moduloCodigo: string | string[];
}) {
    const location = useLocation();
    const codes = Array.isArray(moduloCodigo) ? moduloCodigo : [moduloCodigo];

    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (authService.needsPasswordChange()) {
        return <Navigate to="/primeiro-acesso" replace />;
    }
    if (!codes.some((c) => authService.hasModulo(c))) {
        return (
            <NoPermissionPage message="Você não tem permissão para esta área. Fale com quem administra a empresa." />
        );
    }
    return <>{children}</>;
}
