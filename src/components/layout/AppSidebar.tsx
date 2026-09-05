import { NavLink } from 'react-router-dom';
import { authService } from '@core/services';
import { APP_CONFIG, urlInicioAsc } from '@core/config';
import { buildSsoLaunchUrl } from '@core/auth/sso';
import { MODULOS } from '@/constants/moduleCodes';

export default function AppSidebar() {
    const user = authService.getStoredUserInfo();
    const nomeEmpresa = user?.empresaNome || APP_CONFIG.empresa;

    const irParaAsc = () => {
        window.location.assign(buildSsoLaunchUrl(urlInicioAsc()));
    };

    const visiveis = MODULOS.filter((m) => {
        if (authService.hasModulo(m.codigo)) return true;
        return 'aliases' in m && Array.isArray(m.aliases)
            ? m.aliases.some((a) => authService.hasModulo(a))
            : false;
    });

    return (
        <aside
            className="fixed inset-y-0 left-0 z-40 hidden h-screen w-72 flex-col md:flex"
            style={{
                background: 'var(--lyra-sidebar)',
                color: 'var(--lyra-sidebar-fg)',
                borderRight: '1px solid var(--lyra-sidebar-border)',
            }}
        >
            <div
                className="flex h-[var(--lyra-header-height)] shrink-0 items-center border-b px-5"
                style={{ borderColor: 'var(--lyra-sidebar-border)' }}
            >
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
            </div>
            <nav className="flex-1 space-y-0.5 p-3">
                {visiveis.map((m) => (
                    <NavLink
                        key={m.codigo}
                        to={m.path}
                        className={({ isActive }) =>
                            `block rounded-lyra px-3 py-2 text-sm font-medium ${isActive ? '' : 'opacity-80 hover:opacity-100'}`
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
                        {m.nome}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
