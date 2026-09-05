import { Navigate } from 'react-router-dom';
import { authService } from '@core/services';
import { APP_CONFIG, urlPrimeiroAcessoAsc } from '@core/config';
import { buildSsoLaunchUrl } from '@core/auth/sso';
import PageCard from '@/components/layout/PageCard';
import { Button } from '@/components/ui';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function PrimeiroAcessoPage() {
    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    if (!authService.needsPasswordChange()) {
        return <Navigate to="/inicio" replace />;
    }

    const irParaAsc = () => {
        window.location.assign(buildSsoLaunchUrl(urlPrimeiroAcessoAsc()));
    };

    return (
        <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: 'var(--background)' }}>
            <div className="absolute right-4 top-4">
                <ThemeToggle />
            </div>
            <PageCard fill={false} className="w-full max-w-md p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--faint)' }}>
                    {APP_CONFIG.nome}
                </p>
                <h1 className="mt-2 font-display text-2xl font-semibold">Defina sua senha no ASC</h1>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    Sua conta precisa trocar a senha no primeiro acesso. Esse fluxo fica no ASC; o Lyra não duplica a
                    troca de senha.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                    <Button variant="primary" fullWidth onClick={irParaAsc}>
                        Abrir primeiro acesso no ASC
                    </Button>
                    <Button
                        variant="ghost"
                        fullWidth
                        onClick={() => {
                            authService.logout();
                            window.location.assign('/login');
                        }}
                    >
                        Sair
                    </Button>
                </div>
            </PageCard>
        </div>
    );
}
