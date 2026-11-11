import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { authService } from '@core/services';
import { APP_CONFIG, urlInicioAsc } from '@core/config';
import { buildSsoLaunchUrl } from '@core/auth/sso';
import { MODULOS } from '@/constants/moduleCodes';
import { temAcessoHubAsc } from '@/lib/acesso';
import { useTermos } from '@/contexts/TermosContext';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui';

/** Fixa à esquerda no computador; no celular é uma gaveta aberta pelo botão de menu do cabeçalho. */
export default function AppSidebar({
    aberto = false,
    onFechar,
    onLogout,
}: {
    aberto?: boolean;
    onFechar?: () => void;
    onLogout?: () => void;
}) {
    const termos = useTermos();
    const user = authService.getStoredUserInfo();
    const nomeEmpresa = user?.empresaNome || APP_CONFIG.empresa;
    const podeIrAoAsc = temAcessoHubAsc();
    const nomeUsuario = user?.username || user?.email || 'Usuário';

    useEffect(() => {
        if (!aberto) return;
        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onFechar?.();
        };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', esc);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', esc);
        };
    }, [aberto, onFechar]);

    const irParaAsc = () => {
        window.location.assign(buildSsoLaunchUrl(urlInicioAsc()));
    };

    const visiveis = MODULOS.filter((m) => {
        if (authService.hasModulo(m.codigo)) return true;
        return m.aliases?.some((a) => authService.hasModulo(a)) ?? false;
    });

    return (
        <>
            {aberto && (
                <button
                    type="button"
                    className="lyra-fade fixed inset-0 z-[60] md:hidden"
                    style={{ background: 'oklch(0 0 0 / 0.45)' }}
                    aria-label="Fechar menu"
                    onClick={onFechar}
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-[70] flex h-dvh w-72 max-w-[85vw] flex-col transition-transform duration-200 md:z-40 md:max-w-none md:translate-x-0 ${
                    aberto ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
                }`}
                style={{
                    background: 'var(--lyra-sidebar)',
                    color: 'var(--lyra-sidebar-fg)',
                    borderRight: '1px solid var(--lyra-sidebar-border)',
                    paddingTop: 'var(--lyra-safe-top)',
                    paddingLeft: 'env(safe-area-inset-left)',
                }}
                aria-label="Menu"
            >
                <div
                    className="flex h-[var(--lyra-header-height)] shrink-0 items-center gap-2 border-b px-5"
                    style={{ borderColor: 'var(--lyra-sidebar-border)' }}
                >
                    {podeIrAoAsc ? (
                        <button
                            type="button"
                            onClick={irParaAsc}
                            title="Voltar ao início do ASC"
                            className="block w-full min-w-0 rounded-lyra text-left outline-none focus-visible:ring-2 focus-visible:ring-copper/40"
                        >
                            <p
                                className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] underline-offset-2 hover:underline"
                                style={{ color: 'var(--lyra-sidebar-muted)' }}
                            >
                                {nomeEmpresa}
                            </p>
                            <p className="mt-0.5 font-display text-xl font-semibold">{APP_CONFIG.nome}</p>
                        </button>
                    ) : (
                        <div className="min-w-0 flex-1">
                            <p
                                className="truncate text-[11px] font-semibold uppercase tracking-[0.16em]"
                                style={{ color: 'var(--lyra-sidebar-muted)' }}
                            >
                                {nomeEmpresa}
                            </p>
                            <p className="mt-0.5 font-display text-xl font-semibold">{APP_CONFIG.nome}</p>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={onFechar}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lyra md:hidden"
                        style={{ color: 'var(--lyra-sidebar-muted)' }}
                        aria-label="Fechar menu"
                    >
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
                <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
                    {visiveis.map((m) => (
                        <NavLink
                            key={m.codigo}
                            to={m.path}
                            onClick={onFechar}
                            className={({ isActive }) =>
                                `block rounded-lyra px-3 py-2.5 text-sm font-medium md:py-2 ${isActive ? '' : 'opacity-80 hover:opacity-100'}`
                            }
                            style={({ isActive }) =>
                                isActive
                                    ? {
                                          background: 'var(--gradient-copper)',
                                          color: 'var(--primary-foreground)',
                                      }
                                    : { color: 'var(--lyra-sidebar-fg)' }
                            }
                        >
                            {m.termo ? termos[m.termo].plural : m.nome}
                        </NavLink>
                    ))}
                </nav>
                <div
                    className="shrink-0 border-t p-3 md:hidden"
                    style={{ borderColor: 'var(--lyra-sidebar-border)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
                >
                    <div className="flex items-center gap-2">
                        <Link to="/perfil" onClick={onFechar} className="flex min-w-0 flex-1 items-center gap-2.5" title="Meu perfil">
                            <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                                style={{ background: 'var(--gradient-copper)', color: 'var(--primary-foreground)' }}
                            >
                                {nomeUsuario.trim().charAt(0).toUpperCase() || 'U'}
                            </span>
                            <span className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate text-sm font-semibold">{nomeUsuario}</span>
                                <span className="truncate text-xs" style={{ color: 'var(--lyra-sidebar-muted)' }}>
                                    Meu perfil
                                </span>
                            </span>
                        </Link>
                        <ThemeToggle />
                    </div>
                    {onLogout && (
                        <Button variant="danger" size="sm" fullWidth className="mt-3" onClick={onLogout}>
                            Sair
                        </Button>
                    )}
                </div>
            </aside>
        </>
    );
}
