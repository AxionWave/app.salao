import { useEffect, useRef } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { API_CONFIG } from '@core/config';
import { AUTH_STORAGE_KEYS } from '@core/auth/auth.storage';
import { authService, refreshAccessToken } from '@core/services';
import { MODULO_AGENDA } from '@/constants/moduleCodes';

/**
 * Uma conexão só com o hub do painel (/api/salao/hub/painel), aberta enquanto alguma tela escuta.
 * O servidor só manda: `agendaAlterada` (recarregue a agenda) e `notificacao` (aviso novo do sino).
 */

type Ouvinte = (dados: unknown) => void;

const ouvintes = new Map<string, Set<Ouvinte>>();
const aoReconectar = new Set<() => void>();
let conexao: HubConnection | null = null;
let assinantes = 0;
let encerrar: number | undefined;
let tentarDeNovo: number | undefined;
let tentativas = 0;

/** O token vence em silêncio quando a tela fica parada; renova antes de reconectar. */
async function tokenAtual(): Promise<string> {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN) ?? '';
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
        if (payload.exp && payload.exp * 1000 < Date.now() + 30_000) return await refreshAccessToken();
    } catch {
        // Token ilegível: vai como está e o servidor recusa.
    }
    return token;
}

function espera(n: number): number {
    return Math.min(30_000, 1000 * 2 ** n);
}

function despachar(evento: string, dados: unknown) {
    ouvintes.get(evento)?.forEach((o) => o(dados));
}

function criar(): HubConnection {
    const c = new HubConnectionBuilder()
        .withUrl(`${API_CONFIG.productApi}${API_CONFIG.productBase}/hub/painel`, {
            accessTokenFactory: tokenAtual,
            // Sem cookies: a sessão vai no token, e o CORS não precisa liberar credenciais.
            withCredentials: false,
        })
        .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => espera(ctx.previousRetryCount) })
        .configureLogging(LogLevel.Warning)
        .build();
    ouvintes.forEach((_, evento) => c.on(evento, (dados) => despachar(evento, dados)));
    // Quem ficou desconectado perdeu avisos: as telas recarregam.
    c.onreconnected(() => aoReconectar.forEach((f) => f()));
    c.onclose(() => {
        if (assinantes > 0 && conexao === c) agendarInicio();
    });
    return c;
}

function agendarInicio() {
    window.clearTimeout(tentarDeNovo);
    tentarDeNovo = window.setTimeout(() => void iniciar(), espera(tentativas++));
}

async function iniciar() {
    if (!conexao || conexao.state !== HubConnectionState.Disconnected) return;
    try {
        await conexao.start();
        if (tentativas > 0) aoReconectar.forEach((f) => f());
        tentativas = 0;
    } catch {
        if (assinantes > 0) agendarInicio();
    }
}

function entrar() {
    assinantes++;
    window.clearTimeout(encerrar);
    if (!conexao) conexao = criar();
    void iniciar();
}

function sair() {
    assinantes--;
    if (assinantes > 0) return;
    // Trocar de tela desmonta e monta de novo: espera um pouco antes de fechar.
    encerrar = window.setTimeout(() => {
        if (assinantes > 0 || !conexao) return;
        window.clearTimeout(tentarDeNovo);
        const c = conexao;
        conexao = null;
        tentativas = 0;
        void c.stop();
    }, 5_000);
}

function ouvir(evento: string, ouvinte: Ouvinte): () => void {
    let lista = ouvintes.get(evento);
    if (!lista) {
        lista = new Set();
        ouvintes.set(evento, lista);
        conexao?.on(evento, (dados) => despachar(evento, dados));
    }
    lista.add(ouvinte);
    return () => {
        lista.delete(ouvinte);
    };
}

/** Só quem tem a Agenda entra no hub (o servidor recusa os demais). */
export function podeOuvirAoVivo(): boolean {
    return authService.hasModulo(MODULO_AGENDA);
}

/**
 * Chama `ouvinte` a cada mensagem `evento` do hub. `reconectou` roda quando a conexão volta depois de cair,
 * para a tela buscar o que perdeu.
 */
export function useAoVivo<T>(evento: string, ouvinte: (dados: T) => void, reconectou?: () => void) {
    const ref = useRef({ ouvinte, reconectou });
    ref.current = { ouvinte, reconectou };

    useEffect(() => {
        if (!podeOuvirAoVivo()) return;
        const parar = ouvir(evento, (dados) => ref.current.ouvinte(dados as T));
        const aoVoltar = () => ref.current.reconectou?.();
        aoReconectar.add(aoVoltar);
        entrar();
        return () => {
            parar();
            aoReconectar.delete(aoVoltar);
            sair();
        };
    }, [evento]);
}

/** Recarrega quando a agenda da empresa muda em outra tela (ou quando a conexão volta). Agrupa rajadas. */
export function useAgendaAoVivo(recarregar: () => void) {
    const timer = useRef<number>();
    const agendar = () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(recarregar, 400);
    };
    useEffect(() => () => window.clearTimeout(timer.current), []);
    useAoVivo('agendaAlterada', agendar, agendar);
}
