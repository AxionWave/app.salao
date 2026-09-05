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
            <NoPermissionPage
                message={`O módulo ${codes.join(' / ')} não está no seu perfil de acesso.`}
                description="Peça a liberação no ASC (Cliente Admin) e faça login novamente."
            />
        );
    }
    return <>{children}</>;
}
