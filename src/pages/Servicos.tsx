import { useCallback, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import PageLayout from '@/components/layout/PageLayout';
import PageCard from '@/components/layout/PageCard';
import { Badge, Button, Combobox, Input, Modal, Switch, Table } from '@/components/ui';
import { servicoService, type SalvarServico, type Servico } from '@/services/servico.service';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PAGE_SIZE = 10;

type FiltroAtivo = 'todos' | 'ativos' | 'inativos';

const vazio: SalvarServico = {
    nome: '',
    duracaoMinutos: 30,
    preco: 0,
    categoria: '',
    ativo: true,
};

function parsePreco(texto: string): number {
    const n = Number(texto.trim().replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

function formatarPrecoInput(valor: number): string {
    if (!Number.isFinite(valor) || valor === 0) return '';
    return String(valor).replace('.', ',');
}

function mensagemErro(err: unknown): string {
    const ax = err as AxiosError<{ message?: string }>;
    if (ax.code === 'ERR_NETWORK') {
        return 'API Lyra local (:8092) fora do ar. Suba a api.salao.';
    }
    return ax.response?.data?.message || 'Não foi possível concluir a operação.';
}

export default function ServicosPage() {
    const [itens, setItens] = useState<Servico[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [busca, setBusca] = useState('');
    const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('todos');
    const [carregando, setCarregando] = useState(true);
    const [erroLista, setErroLista] = useState('');
    const [formAberto, setFormAberto] = useState(false);
    const [editando, setEditando] = useState<Servico | null>(null);
    const [form, setForm] = useState<SalvarServico>(vazio);
    const [precoTexto, setPrecoTexto] = useState('');
    const [formErro, setFormErro] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [categorias, setCategorias] = useState<string[]>([]);

    const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const carregar = useCallback(async () => {
        setCarregando(true);
        setErroLista('');
        try {
            const data = await servicoService.listar({
                search: busca.trim() || undefined,
                ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
                page: pagina,
                pageSize: PAGE_SIZE,
            });
            const ultima = Math.max(1, Math.ceil(data.total / data.pageSize));
            if (data.items.length === 0 && data.total > 0 && pagina > ultima) {
                setPagina(ultima);
                return;
            }
            setItens(data.items);
            setTotal(data.total);
            setCategorias(data.categorias ?? []);
        } catch (e) {
            setErroLista(mensagemErro(e));
            setItens([]);
            setTotal(0);
        } finally {
            setCarregando(false);
        }
    }, [busca, filtroAtivo, pagina]);

    useEffect(() => {
        void carregar();
        // busca só recarrega no Filtrar; pagina/filtro disparam aqui.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional
    }, [pagina, filtroAtivo]);

    const tituloForm = editando ? 'Editar serviço' : 'Novo serviço';
    const podeSalvar = form.nome.trim().length > 0 && form.duracaoMinutos >= 1 && form.preco >= 0;

    const fecharForm = () => {
        if (salvando) return;
        setFormAberto(false);
    };

    const abrirNovo = () => {
        setEditando(null);
        setForm({ ...vazio });
        setPrecoTexto('');
        setFormErro('');
        setFormAberto(true);
    };

    const abrirEditar = (s: Servico) => {
        setEditando(s);
        setForm({
            nome: s.nome,
            duracaoMinutos: s.duracaoMinutos,
            preco: s.preco,
            categoria: s.categoria ?? '',
            ativo: s.ativo,
        });
        setPrecoTexto(formatarPrecoInput(s.preco));
        setFormErro('');
        setFormAberto(true);
    };

    const salvar = async () => {
        if (!podeSalvar) {
            setFormErro('Preencha nome, duração e preço.');
            return;
        }
        setSalvando(true);
        setFormErro('');
        const payload: SalvarServico = {
            ...form,
            nome: form.nome.trim(),
            preco: parsePreco(precoTexto),
            categoria: form.categoria?.trim() || null,
        };
        try {
            if (editando) {
                await servicoService.atualizar(editando.id, payload);
                setFormAberto(false);
                await carregar();
            } else {
                await servicoService.criar(payload);
                setFormAberto(false);
                if (pagina !== 1) setPagina(1);
                else await carregar();
            }
        } catch (e) {
            setFormErro(mensagemErro(e));
        } finally {
            setSalvando(false);
        }
    };

    const alternarAtivo = async (s: Servico) => {
        setErroLista('');
        try {
            await servicoService.alterarAtivo(s.id, !s.ativo);
            await carregar();
        } catch (e) {
            setErroLista(mensagemErro(e));
        }
    };

    const aplicarFiltro = () => {
        if (pagina !== 1) setPagina(1);
        else void carregar();
    };

    const vazioLista = useMemo(
        () => !carregando && itens.length === 0 && !erroLista,
        [carregando, itens.length, erroLista]
    );

    const de = total === 0 ? 0 : (pagina - 1) * PAGE_SIZE + 1;
    const ate = Math.min(pagina * PAGE_SIZE, total);

    return (
        <PageLayout
            titulo="Serviços"
            subtitulo="Catálogo"
            acoes={
                <Button size="sm" onClick={abrirNovo}>
                    Novo serviço
                </Button>
            }
        >
            <PageCard>
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                    <Input
                        label="Buscar"
                        placeholder="Nome ou categoria"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') aplicarFiltro();
                        }}
                    />
                    <Button variant="secondary" onClick={aplicarFiltro}>
                        Filtrar
                    </Button>
                    <div className="flex flex-wrap gap-2">
                        {([
                            ['todos', 'Todos'],
                            ['ativos', 'Ativos'],
                            ['inativos', 'Inativos'],
                        ] as const).map(([id, label]) => (
                            <Button
                                key={id}
                                size="sm"
                                variant={filtroAtivo === id ? 'primary' : 'secondary'}
                                onClick={() => {
                                    setFiltroAtivo(id);
                                    setPagina(1);
                                }}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                {erroLista && (
                    <p className="mb-4 text-sm" style={{ color: 'var(--destructive)' }} role="alert">
                        {erroLista}
                    </p>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando catálogo…
                    </p>
                )}

                {vazioLista && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        {busca.trim() || filtroAtivo !== 'todos'
                            ? 'Nenhum serviço encontrado com esse filtro.'
                            : 'Nenhum serviço cadastrado. Use «Novo serviço» para montar o catálogo.'}
                    </p>
                )}

                {!carregando && itens.length > 0 && (
                    <>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Cell>Nome</Table.Cell>
                                    <Table.Cell>Categoria</Table.Cell>
                                    <Table.Cell>Duração</Table.Cell>
                                    <Table.Cell>Preço</Table.Cell>
                                    <Table.Cell>Status</Table.Cell>
                                    <Table.Cell></Table.Cell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {itens.map((s) => (
                                    <Table.Row key={s.id} className={s.ativo ? '' : 'opacity-60'}>
                                        <Table.Cell>
                                            <span className="font-medium" style={{ color: 'var(--ink)' }}>
                                                {s.nome}
                                            </span>
                                        </Table.Cell>
                                        <Table.Cell>{s.categoria || '—'}</Table.Cell>
                                        <Table.Cell>{s.duracaoMinutos} min</Table.Cell>
                                        <Table.Cell>{brl.format(s.preco)}</Table.Cell>
                                        <Table.Cell>
                                            <Badge variant={s.ativo ? 'ok' : 'faint'} size="sm">
                                                {s.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => abrirEditar(s)}>
                                                    Editar
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={s.ativo ? 'ghost' : 'secondary'}
                                                    onClick={() => void alternarAtivo(s)}
                                                >
                                                    {s.ativo ? 'Desativar' : 'Ativar'}
                                                </Button>
                                            </div>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {de}–{ate} de {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={pagina <= 1}
                                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                                >
                                    Anterior
                                </Button>
                                <span className="text-sm tabular-nums" style={{ color: 'var(--ink)' }}>
                                    {pagina} / {totalPaginas}
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={pagina >= totalPaginas}
                                    onClick={() => setPagina((p) => p + 1)}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </PageCard>

            <Modal
                aberto={formAberto}
                titulo={tituloForm}
                eyebrow="Catálogo"
                subtitulo={
                    editando
                        ? 'Altere duração, preço ou categoria. Serviço inativo continua editável.'
                        : 'O que o salão oferece. Nome único por empresa.'
                }
                onClose={fecharForm}
                rodape={
                    <>
                        <Button variant="ghost" onClick={fecharForm} disabled={salvando}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void salvar()} disabled={salvando || !podeSalvar}>
                            {salvando ? 'Salvando…' : 'Salvar'}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label="Nome"
                        required
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    />
                    <Combobox
                        label="Categoria"
                        placeholder={categorias.length ? 'Selecione ou digite' : 'Opcional'}
                        options={categorias}
                        value={form.categoria ?? ''}
                        onChange={(categoria) => setForm((f) => ({ ...f, categoria }))}
                    />
                    <Input
                        label="Duração (minutos)"
                        type="number"
                        min={1}
                        max={1440}
                        required
                        value={form.duracaoMinutos}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, duracaoMinutos: Number(e.target.value) || 0 }))
                        }
                    />
                    <Input
                        label="Preço (R$)"
                        inputMode="decimal"
                        placeholder="0,00"
                        required
                        value={precoTexto}
                        onChange={(e) => {
                            const texto = e.target.value.replace(/[^\d,]/g, '');
                            setPrecoTexto(texto);
                            setForm((f) => ({ ...f, preco: parsePreco(texto) }));
                        }}
                    />
                </div>
                <div className="mt-5">
                    <Switch
                        checked={form.ativo}
                        onChange={(ativo) => setForm((f) => ({ ...f, ativo }))}
                        label="Ativo no catálogo"
                        descricao="Inativos continuam na lista e podem ser editados."
                    />
                </div>
                {formErro && (
                    <p className="mt-3 text-sm" style={{ color: 'var(--destructive)' }} role="alert">
                        {formErro}
                    </p>
                )}
            </Modal>
        </PageLayout>
    );
}
