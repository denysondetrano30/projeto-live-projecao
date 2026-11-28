<script lang="ts">
    // Projeto Live (somun tela, 28/11): aba "Fundos" da barra de baixo (decisão dela). Tudo que entra por aqui
    // é fundo: repete sem parar, mudo, atrás da letra, e a letra nunca fecha. Os do somun (Raios, Névoa) e os
    // vídeos/imagens dela ("+ Adicionar fundo" ou arrastando arquivos para cá). Clicar põe no telão; clicar de
    // novo tira. Os ajustes do que está no ar ficam à direita (SomunPainelFundo). Botão direito: tirar da lista.
    import { onDestroy } from "svelte"
    import { Main } from "../../../../types/IPC/Main"
    import { ToMain } from "../../../../types/IPC/ToMain"
    import { destroyMain, receiveToMain, sendMain } from "../../../IPC/main"
    import { outLocked, outputs, selected, special } from "../../../stores"
    import { FUNDOS, adicionarMeusFundos, meusFundos, tirarMeuFundo } from "../../../utils/projetoLiveFundos"
    import { porFundo } from "../../../utils/projetoLiveFundosAcoes"
    import { mediaExtensions } from "../../../values/extensions"
    import { getExtension, getMediaType, loadThumbnail } from "../../helpers/media"
    import { getFirstActiveOutput } from "../../helpers/output"
    import SelectElem from "../../system/SelectElem.svelte"
    import SomunFundo from "../../output/layers/SomunFundo.svelte"

    $: bg = (getFirstActiveOutput($outputs) as any)?.out?.background
    $: noAr = bg?.plFundo || bg?.type === "somun" ? bg?.path || bg?.id || "" : ""
    $: meus = meusFundos($special)

    function escolher(id: string, nome: string) {
        if ($outLocked) return
        porFundo(id, nome)
    }

    // miniaturas dos fundos dela
    let miniaturas: { [path: string]: string } = {}
    $: meus.forEach((f) => {
        if (miniaturas[f.path] !== undefined) return
        miniaturas[f.path] = ""
        loadThumbnail(f.path).then((t) => (miniaturas = { ...miniaturas, [f.path]: t || "" }))
    })

    // "+ Adicionar fundo": escolher arquivos
    const PICK_ID = "pl_fundos_adicionar"
    const ouvinte = receiveToMain(ToMain.OPEN_FILE2, (data: any) => {
        if (data?.id !== PICK_ID || data?.channel !== "MEDIA" || !data.files?.length) return
        adicionarMeusFundos(data.files.map((x: any) => (typeof x === "string" ? x : x?.path)))
    })
    onDestroy(() => destroyMain(ouvinte))
    function adicionar() {
        sendMain(Main.OPEN_FILE, { channel: "MEDIA", id: PICK_ID, filter: { name: "Vídeos e imagens", extensions: mediaExtensions }, multiple: true } as any)
    }

    // arrastar arquivos do computador para a aba
    let arrastando = false
    function soltar(e: DragEvent) {
        arrastando = false
        let arquivos: string[] = Array.from(e.dataTransfer?.files || []).map((x: any) => {
            try {
                return (window as any).api?.showFilePath?.(x) || x.path || ""
            } catch {
                return x.path || ""
            }
        })
        // ou cartões arrastados da aba Mídia
        if (!arquivos.length && $selected?.id === "media") arquivos = ($selected.data || []).map((x: any) => x?.path || "")
        arquivos = arquivos.filter((p: string) => p && mediaExtensions.includes(getExtension(p).toLowerCase()))
        if (!arquivos.length) return
        e.preventDefault()
        e.stopPropagation()
        adicionarMeusFundos(arquivos)
    }

    // botão direito: tirar da lista
    let menu: { path: string; x: number; y: number } | null = null
    function abrirMenu(e: MouseEvent, path: string) {
        e.preventDefault()
        e.stopPropagation()
        menu = { path, x: e.clientX, y: e.clientY }
    }
</script>

<svelte:window on:click={() => (menu = null)} on:keydown={(e) => e.key === "Escape" && (menu = null)} />

<div class="aba" class:arrastando on:dragover|preventDefault={() => (arrastando = true)} on:dragleave={() => (arrastando = false)} on:drop={soltar}>
    <div class="lista">
        {#each FUNDOS as f}
            <button class="cartao" class:ativo={noAr === f.id} on:click={() => escolher(f.id, f.nome)} title={noAr === f.id ? "Tirar do telão" : "Pôr no telão"}>
                <div class="mini"><SomunFundo id={f.id} /></div>
                <span>{f.nome}</span>
            </button>
        {/each}

        {#each meus as f (f.path)}
            <SelectElem id="media" data={{ name: f.name, path: f.path, type: getMediaType(getExtension(f.path)) }} draggable>
                <button class="cartao" class:ativo={noAr === f.path} on:click={() => escolher(f.path, f.name)} on:contextmenu={(e) => abrirMenu(e, f.path)} title={noAr === f.path ? "Tirar do telão" : "Pôr no telão"}>
                    <div class="mini">
                        {#if miniaturas[f.path]}<img src={miniaturas[f.path]} alt="" draggable="false" />{/if}
                    </div>
                    <span title={f.path}>{f.name}</span>
                </button>
            </SelectElem>
        {/each}

        <button class="cartao novo" on:click={adicionar} title="Escolher vídeos ou imagens do computador (ou arraste para cá)">
            <span class="mais">+</span>
            <span>Adicionar fundo</span>
        </button>
    </div>
    <p class="dica">Fundo repete sem parar, atrás da letra. Clique para pôr no telão; clique de novo para tirar.</p>
</div>

{#if menu}
    <div class="menu" style="left: {menu.x}px; top: {menu.y}px;">
        <button
            on:click={() => {
                if (menu) tirarMeuFundo(menu.path)
                menu = null
            }}>Tirar dos fundos</button
        >
    </div>
{/if}

<style>
    .aba {
        min-height: 100%;
        border: 2px dashed transparent;
    }
    .aba.arrastando {
        border-color: #3a3a3a;
    }
    .lista {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
        padding: 10px;
    }
    .lista :global(.selectElem) {
        display: flex;
    }
    .cartao {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 6px;
        border-radius: 8px;
        border: 2px solid transparent;
        background: #1c1c1c;
        color: var(--text);
        font-family: inherit;
        font-size: 0.95em;
        cursor: pointer;
        text-align: start;
    }
    .cartao span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .cartao:hover {
        border-color: #3a3a3a;
    }
    .cartao.ativo {
        border-color: #e5483b;
    }
    .mini {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 5px;
        overflow: hidden;
        background: #232323;
    }
    .mini img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
    .novo {
        border: 2px dashed #3a3a3a;
        background: none;
        align-items: center;
        justify-content: center;
        color: #a8a8a8;
        min-height: 120px;
    }
    .novo:hover {
        color: #f2f2f2;
        border-color: #8c8c8c;
    }
    .mais {
        font-size: 1.8em;
        line-height: 1;
    }
    .dica {
        padding: 0 12px 12px;
        opacity: 0.5;
        font-size: 0.85em;
    }
    .menu {
        position: fixed;
        z-index: 100;
        background: #232323;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        padding: 4px;
    }
    .menu button {
        border: none;
        background: none;
        color: #f2f2f2;
        font-family: inherit;
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 4px;
    }
    .menu button:hover {
        background: #2a2a2a;
    }
</style>
