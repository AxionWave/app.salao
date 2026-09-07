import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Abre o formulário de cadastro quando a URL vem com `?novo=1` (atalhos do início). */
export function useAbrirNovoDaQuery(pronto: boolean, abrir: () => void) {
    const [params, setParams] = useSearchParams();
    const pedirNovo = params.get('novo') === '1';
    const consumido = useRef(false);

    useEffect(() => {
        if (!pronto || !pedirNovo || consumido.current) return;
        consumido.current = true;
        abrir();
        setParams({}, { replace: true });
    }, [pronto, pedirNovo, abrir, setParams]);
}
