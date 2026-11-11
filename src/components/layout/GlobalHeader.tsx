import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { authService, type StoredUserInfo } from '@core/services';
import ThemeToggle from '@/components/ui/ThemeToggle';
import SinoPainel from './SinoPainel';
import { Button } from '@/components/ui';
import type { ReactNode } from 'react';

export default function GlobalHeader({
    titulo,
    subtitulo,
    acoes,
    userInfo,
    onLogout,
    onMenu,
}: {
    titulo: string;
    subtitulo: string;
    acoes?: ReactNode;
    userInfo?: StoredUserInfo | null;
    onLogout?: () => void;
    onMenu?: () => void;
}) {
    const displayName = useMemo(
        () => userInfo?.username || userInfo?.email || 'Usuário',
        [userInfo?.username, userInfo?.email]
    );
    const userEmail = userInfo?.email || userInfo?.username || '';
    const profileLabel = useMemo(() => {
        const roles = authService.getRoles();
        if (roles.length > 0) return roles[0];
        return 'Acesso padrão';
    }, []);
    const userInitial = displayName.trim().charAt(0)?.toUpperCase() || 'U';

    return (
        <header
            className="sticky top-0 z-30 shrink-0 border-b md:static"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)', paddingTop: 'var(--lyra-safe-top)' }}
        >
            <div className="flex h-[var(--lyra-header-height)] items-center gap-2 px-3 md:gap-4 md:px-8">
                {onMenu && (
                    <button
                        type="button"
                        onClick={onMenu}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lyra md:hidden"
                        style={{ color: 'var(--ink)' }}
                        aria-label="Abrir menu"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    </button>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                        className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
                        style={{ color: 'var(--faint)' }}
                    >
                        {subtitulo}
                    </span>
                    <h1 className="truncate font-display text-lg font-semibold tracking-tight md:text-2xl">{titulo}</h1>
                </div>

                <div className="flex shrink-0 items-center gap-2 md:gap-3">
                    {acoes}
                    <SinoPainel />
                    <ThemeToggle className="hidden md:inline-flex" />

                    <Link
                        to="/perfil"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold md:hidden"
                        style={{ background: 'var(--gradient-copper)', color: 'var(--primary-foreground)' }}
                        title="Meu perfil"
                        aria-label="Meu perfil"
                    >
                        {userInitial}
                    </Link>
                    <div
                        className="ml-1 hidden items-center gap-2.5 rounded-lyra border py-1.5 pl-2 pr-2 md:flex"
                        style={{ background: 'var(--panel)', borderColor: 'var(--line)' }}
                    >
                        <Link to="/perfil" className="flex items-center gap-2.5 transition-opacity hover:opacity-80" title="Meu perfil">
                            <div
                                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                                style={{ background: 'var(--gradient-copper)', color: 'var(--primary-foreground)' }}
                            >
                                {userInitial}
                            </div>
                            <div className="hidden min-w-0 flex-col leading-tight lg:flex">
                                <span className="max-w-[10rem] truncate text-xs font-semibold">{displayName}</span>
                                <span className="max-w-[10rem] truncate text-[0.65rem]" style={{ color: 'var(--muted-foreground)' }}>
                                    {userEmail || profileLabel}
                                </span>
                            </div>
                        </Link>
                        <Button variant="danger" size="sm" onClick={onLogout} title="Sair">
                            Sair
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}
