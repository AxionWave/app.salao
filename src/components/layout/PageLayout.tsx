import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '@core/services';
import AppSidebar from './AppSidebar';
import GlobalHeader from './GlobalHeader';
import { Button } from '@/components/ui';
import { useConfiguracaoEmpresa } from '@/contexts/TermosContext';
import { desligarPush } from '@/lib/push';
import { useTelaLarga } from '@/lib/useMediaQuery';

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
    const { limpar: limparTermos } = useConfiguracaoEmpresa();
    const userInfo = authService.getStoredUserInfo();
    const telaLarga = useTelaLarga();
    const [menuAberto, setMenuAberto] = useState(false);
    const fecharMenu = useCallback(() => setMenuAberto(false), []);

    const onLogout = async () => {
        // O aparelho deixa de receber os avisos de quem saiu (a remoção na API usa o token, que ainda existe aqui).
        await Promise.race([desligarPush(), new Promise((r) => setTimeout(r, 2000))]);
        authService.logout();
        limparTermos();
        navigate('/login', { replace: true });
    };

    const sidebar = (
        <AppSidebar aberto={menuAberto && !telaLarga} onFechar={fecharMenu} onLogout={() => void onLogout()} />
    );

    if (accessDenied?.show) {
        return (
            <div className="min-h-[100dvh]" style={{ background: 'var(--background)', color: 'var(--ink)' }}>
                {sidebar}
                <main className="ml-0 flex min-h-[100dvh] flex-col md:ml-72">
                    <GlobalHeader
                        titulo={titulo}
                        subtitulo={subtitulo}
                        userInfo={userInfo}
                        onLogout={() => void onLogout()}
                        onMenu={() => setMenuAberto(true)}
                    />
                    <div className="flex flex-1 items-center justify-center px-4 py-8">
                        <div className="lyra-card w-full max-w-md px-6 py-10 text-center sm:px-8">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--destructive)' }}>
                                Acesso restrito
                            </p>
                            <h1 className="mt-4 font-display text-2xl font-semibold">Permissão insuficiente</h1>
                            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                                {accessDenied.message ||
                                    'Você não tem permissão para esta área. Fale com quem administra a empresa.'}
                            </p>
                            <Link to="/inicio" className="mt-6 inline-block">
                                <Button variant="primary">Voltar ao início</Button>
                            </Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-[100dvh] flex-col" style={{ background: 'var(--background)', color: 'var(--ink)' }}>
            {sidebar}
            <main className="ml-0 flex min-h-[100dvh] min-w-0 flex-1 flex-col md:ml-72">
                <GlobalHeader
                    titulo={titulo}
                    subtitulo={subtitulo}
                    userInfo={userInfo}
                    onLogout={() => void onLogout()}
                    onMenu={() => setMenuAberto(true)}
                    acoes={telaLarga ? acoes : undefined}
                />
                {!telaLarga && acoes && <div className="flex flex-wrap justify-end gap-2 px-4 pt-3">{acoes}</div>}
                <section className="lyra-rise flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:px-6 md:py-5">
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
                </section>
            </main>
        </div>
    );
}
