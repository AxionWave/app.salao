import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(consulta: string): boolean {
    const assinar = useCallback(
        (avisar: () => void) => {
            const mq = window.matchMedia(consulta);
            mq.addEventListener('change', avisar);
            return () => mq.removeEventListener('change', avisar);
        },
        [consulta]
    );
    return useSyncExternalStore(assinar, () => window.matchMedia(consulta).matches);
}

/** Mesmo corte do `md:` do Tailwind: abaixo disso, o layout de celular. */
export const useTelaLarga = () => useMediaQuery('(min-width: 768px)');
