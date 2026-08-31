import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '@core/services';

export default function ModuleProtectedRoute({
    children,
    moduloCodigo,
}: {
    children: React.ReactNode;
    moduloCodigo: string | string[];
}) {
    const location = useLocation();
    const codes = Array.isArray(moduloCodigo) ? moduloCodigo : [moduloCodigo];
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }
    if (!codes.some((c) => authService.hasModulo(c))) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-lg font-semibold text-slate-900">Sem acesso a este módulo</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        O código <code className="rounded bg-slate-100 px-1">{codes.join(' / ')}</code> não está no seu JWT.
                        Peça acesso no ASC e faça login novamente.
                    </p>
                    <a href="/inicio" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
                        Voltar ao início
                    </a>
                </div>
            </div>
        );
    }
    return <>{children}</>;
}
