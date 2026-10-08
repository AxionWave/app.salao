import { authService } from '@core/services';

/** Módulo raiz do hub ASC — não é do Lyra. */
const ASC_RAIZ = 'ASC0000000';

/** SuperAdmin e quem tem o hub no JWT podem voltar ao ASC. Equipe Lyra pura não. */
export function temAcessoHubAsc(): boolean {
    return authService.hasModulo(ASC_RAIZ);
}
