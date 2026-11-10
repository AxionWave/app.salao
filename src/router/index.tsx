import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import LoginPage from '@/pages/Login';
import InicioPage from '@/pages/Inicio';
import AgendaPage from '@/pages/Agenda';
import ServicosPage from '@/pages/Servicos';
import ClientesPage from '@/pages/Clientes';
import ProfissionaisPage from '@/pages/Profissionais';
import ConfiguracoesPage from '@/pages/Configuracoes';
import PerfilPage from '@/pages/Perfil';
import PrimeiroAcessoPage from '@/pages/PrimeiroAcesso';
import ConfirmarPresencaPage from '@/pages/ConfirmarPresenca';
import ErroRota from '@/components/ErroRota';
import ModuleProtectedRoute from './ModuleProtectedRoute';
import ProtectedRoute from './ProtectedRoute';
import { MODULOS_RAIZ } from '@/constants/moduleCodes';

const rotas: RouteObject[] = [
    { path: '/', element: <Navigate to="/login" replace /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/primeiro-acesso', element: <PrimeiroAcessoPage /> },
    { path: '/c/:token', element: <ConfirmarPresencaPage /> },
    {
        path: '/perfil',
        element: (
            <ProtectedRoute>
                <PerfilPage />
            </ProtectedRoute>
        ),
    },
    {
        path: '/inicio',
        element: (
            <ModuleProtectedRoute moduloCodigo={[...MODULOS_RAIZ]}>
                <InicioPage />
            </ModuleProtectedRoute>
        ),
    },
    {
        path: '/agenda',
        element: (
            <ModuleProtectedRoute moduloCodigo="LYR0000001">
                <AgendaPage />
            </ModuleProtectedRoute>
        ),
    },
    {
        path: '/servicos',
        element: (
            <ModuleProtectedRoute moduloCodigo="LYR0000002">
                <ServicosPage />
            </ModuleProtectedRoute>
        ),
    },
    {
        path: '/clientes',
        element: (
            <ModuleProtectedRoute moduloCodigo="LYR0000003">
                <ClientesPage />
            </ModuleProtectedRoute>
        ),
    },
    {
        path: '/profissionais',
        element: (
            <ModuleProtectedRoute moduloCodigo="LYR0000004">
                <ProfissionaisPage />
            </ModuleProtectedRoute>
        ),
    },
    {
        path: '/configuracoes',
        element: (
            <ModuleProtectedRoute moduloCodigo="LYR0000005">
                <ConfiguracoesPage />
            </ModuleProtectedRoute>
        ),
    },
];

const router = Sentry.wrapCreateBrowserRouterV6(createBrowserRouter)(
    // O router captura erros de renderização antes de qualquer ErrorBoundary; o errorElement os reporta.
    [{ errorElement: <ErroRota />, children: rotas }],
    { basename: (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/' },
);

export default router;
