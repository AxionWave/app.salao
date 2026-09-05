import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { authService } from '@core/services';
import { MODULOS } from '@/constants/moduleCodes';
import AppSidebar from './AppSidebar';
import GlobalHeader from './GlobalHeader';
import { Button } from '@/components/ui';

export default function PageLayout({
    children,
    titulo,
    subtitulo,
    acoes,
    accessDenied,
}: {
    children?: ReactNode;
    titulo: string;
    subtitulo: string;
    acoes?: ReactNode;
    accessDenied?: { show: boolean; message?: string };
}) {
    const navigate = useNavigate();
    const userInfo = authService.getStoredUserInfo();

    const onLogout = () => {
        authService.logout();
        navigate('/login', { replace: true });
    };

    const visiveis = MODULOS.filter((m) => {
        if (authService.hasModulo(m.codigo)) return true;
        return 'aliases' in m && Array.isArray(m.aliases)
            ? m.aliases.some((a) => authService.hasModulo(a))
            : false;
    });

    if (accessDenied?.show) {
        return (
            <div className="min-h-[100dvh]" style={{ background: 'var(--background)', color: 'var(--ink)' }}>
                <AppSidebar />
                <main className="ml-0 flex min-h-[100dvh] items-center justify-center px-4 md:ml-72">
                    <div className="lyra-card w-full max-w-md px-8 py-10 text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--destructive)' }}>
                            Acesso restrito
                        </p>
                        <h1 className="mt-4 font-display text-2xl font-semibold">Permissão insuficiente</h1>
                        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                            {accessDenied.message ||
                                'Você não tem permissão para acessar este módulo. Peça acesso no ASC e faça login novamente.'}
                        </p>
                        <Link to="/inicio" className="mt-6 inline-block">
                            <Button variant="primary">Voltar ao início</Button>
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-[100dvh] flex-col" style={{ background: 'var(--background)', color: 'var(--ink)' }}>
            <AppSidebar />
            <main className="ml-0 flex min-h-[100dvh] flex-1 flex-col md:ml-72">
                <GlobalHeader titulo={titulo} subtitulo={subtitulo} userInfo={userInfo} onLogout={onLogout} acoes={acoes} />
                <nav
                    className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden"
                    style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
                >
                    {visiveis.map((m) => (
                        <NavLink
                            key={m.codigo}
                            to={m.path}
                            className={({ isActive }) =>
                                `whitespace-nowrap rounded-lyra px-3 py-1.5 text-xs font-medium ${isActive ? '' : 'opacity-70'}`
                            }
                            style={({ isActive }) =>
                                isActive
                                    ? { background: 'var(--gradient-copper)', color: 'var(--primary-foreground)' }
                                    : { color: 'var(--ink)' }
                            }
                        >
                            {m.nome}
                        </NavLink>
                    ))}
                </nav>
                <section className="lyra-rise flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-5">
                    <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
                </section>
            </main>
        </div>
    );
}
