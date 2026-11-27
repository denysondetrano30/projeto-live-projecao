<script lang="ts">
    // Projeto Live: centro da aba Máscaras (quadro para desenhar as formas)
    import { uid } from "uid"
    import type { PLForma, PLMascara } from "../../../../types/Output"
    import { outputs, styles } from "../../../stores"
    import ProjetoLiveMascara from "../../output/layers/ProjetoLiveMascara.svelte"
    import { ativarMascara, mudarForma, mudarMascara, novaMascara, plMascaraUI, resolucao, telasDeMascara } from "./mascaras"

    $: saida = telasDeMascara($outputs, $styles).find((s) => s.id === $plMascaraUI.outputId)
    $: m = ((saida?.o.mascaras || []) as PLMascara[]).find((k) => k.id === $plMascaraUI.editId) || null
    $: emUso = !!m && saida?.o.mascaraAtiva === m.id
    $: ({ W, H } = resolucao(saida?.o))
    $: oid = saida?.id || ""

    function sel(id: string) {
        plMascaraUI.update((u) => ({ ...u, formaId: id }))
    }
    function addForma(tipo: "ret" | "circ") {
        if (!m) return
        const id = uid()
        const n = m.formas.length
        const w = tipo === "circ" ? Math.min(0.3, (0.3 * H) / W) : 0.3
        const h = tipo === "circ" ? (w * W) / H : 0.6
        mudarMascara(oid, m.id, (k) => k.formas.push({ id, tipo, x: Math.min(0.05 + n * 0.05, 1 - w), y: Math.min(0.2 + n * 0.03, 1 - h), w, h, raio: tipo === "ret" ? 0.1 : 0 }))
        sel(id)
    }

    // arrastar / mudar tamanho
    let quadro: HTMLDivElement
    let arrasto: { modo: "mover" | "tamanho"; px: number; py: number; f: PLForma; mid: string } | null = null
    function inicio(e: PointerEvent, f: PLForma, modo: "mover" | "tamanho") {
        if (!m) return
        e.preventDefault()
        e.stopPropagation()
        sel(f.id)
        arrasto = { modo, px: e.clientX, py: e.clientY, f: { ...f }, mid: m.id }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", fim, { once: true })
    }
    function mover(e: PointerEvent) {
        if (!arrasto || !quadro) return
        const r = quadro.getBoundingClientRect()
        const dx = (e.clientX - arrasto.px) / r.width
        const dy = (e.clientY - arrasto.py) / r.height
        const o = arrasto.f
        const aj = (v: number) => Math.round(v * 2000) / 2000
        mudarForma(oid, arrasto.mid, o.id, (k) => {
            if (arrasto?.modo === "mover") {
                k.x = aj(Math.max(0, Math.min(1 - o.w, o.x + dx)))
                k.y = aj(Math.max(0, Math.min(1 - o.h, o.y + dy)))
            } else if (o.tipo === "img" && o.ar) {
                // imagem: muda o tamanho sem deformar (vale o lado que mais mexeu)
                const porLarg = Math.max(0.02, o.w + dx)
                const porAlt = Math.max(0.02, o.h + dy) * ((H * o.ar) / W)
                let w = Math.abs(dx) * W >= Math.abs(dy) * H ? porLarg : porAlt
                w = Math.min(w, 1 - o.x, ((1 - o.y) * H * o.ar) / W)
                k.w = aj(w)
                k.h = aj((w * W) / (o.ar * H))
            } else {
                k.w = aj(Math.max(0.02, Math.min(1 - o.x, o.w + dx)))
                k.h = aj(Math.max(0.02, Math.min(1 - o.y, o.h + dy)))
            }
        })
    }
    function fim() {
        arrasto = null
        window.removeEventListener("pointermove", mover)
    }
    // setas do teclado movem a forma selecionada (Shift = 10 px)
    function teclas(e: KeyboardEvent) {
        if (!m || !$plMascaraUI.formaId || !quadro?.isConnected) return
        if ((e.target as HTMLElement)?.closest("input, textarea, select")) return
        const passo = e.shiftKey ? 10 : 1
        const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key]
        if (!d) return
        e.preventDefault()
        mudarForma(oid, m.id, $plMascaraUI.formaId, (k) => {
            k.x = Math.max(0, Math.min(1 - k.w, k.x + d[0] / W))
            k.y = Math.max(0, Math.min(1 - k.h, k.y + d[1] / H))
        })
    }
</script>

<svelte:window on:keydown={teclas} />

<div class="editor">
    {#if !saida}
        <div class="aviso">Nenhuma saída de tela. Crie uma em Configurações › Saídas.</div>
    {:else if !m}
        <div class="aviso">
            <p>Máscara recorta o telão no formato dos painéis de LED: só aparece o que estiver dentro das formas, o resto fica preto.</p>
            <button class="primario" on:click={() => novaMascara(oid)}>+ Criar a primeira máscara</button>
        </div>
    {:else}
        <div class="topo">
            <input class="nome" value={m.nome} on:change={(e) => m && mudarMascara(oid, m.id, (k) => (k.nome = e.currentTarget.value.trim() || k.nome))} aria-label="Nome da máscara" />
            <button on:click={() => addForma("ret")}>+ Retângulo</button>
            <button on:click={() => addForma("circ")}>+ Círculo</button>
            <select value={m.camada || "fundo"} on:change={(e) => m && mudarMascara(oid, m.id, (k) => (k.camada = e.currentTarget.value))} title="Quais camadas a máscara recorta">
                <option value="fundo">Recorta só o fundo (letra por cima)</option>
                <option value="letra">Recorta fundo e letra</option>
                <option value="tudo">Recorta tudo (até sobreposições)</option>
            </select>
            <span class="corFora" title="Cor de fora das formas (onde hoje fica preto)">
                <span class="rotulo">Fora</span>
                <input type="color" value={m.cor || "#000000"} on:input={(e) => m && mudarMascara(oid, m.id, (k) => (k.cor = e.currentTarget.value))} aria-label="Cor de fora das formas" />
                <input type="range" min="0" max="100" value={m.opacidade ?? 100} on:input={(e) => m && mudarMascara(oid, m.id, (k) => (k.opacidade = Number(e.currentTarget.value)))} aria-label="Opacidade de fora das formas" />
                <span class="valor">{m.opacidade ?? 100}%</span>
            </span>
            <span class="espaco" />
            {#if emUso}
                <button class="emuso" on:click={() => ativarMascara(oid, "")}>● No telão · parar</button>
            {:else}
                <button class="primario" on:click={() => m && ativarMascara(oid, m.id)}>Usar no telão</button>
            {/if}
        </div>

        <div class="area">
            <div class="quadro" bind:this={quadro} style="aspect-ratio: {W} / {H};" on:pointerdown={() => sel("")}>
                <div class="fundo" />
                <ProjetoLiveMascara mascara={m} width={W} height={H} editor />
                {#each m.formas as f (f.id)}
                    <div class="forma" class:sel={f.id === $plMascaraUI.formaId} class:circ={f.tipo === "circ"} style="left: {f.x * 100}%; top: {f.y * 100}%; width: {f.w * 100}%; height: {f.h * 100}%;" on:pointerdown={(e) => inicio(e, f, "mover")}>
                        <span class="alca" on:pointerdown={(e) => inicio(e, f, "tamanho")} />
                    </div>
                {/each}
                {#if !m.formas.length && !m.png}
                    <div class="vazio">Clique em "+ Retângulo" e coloque uma forma no lugar de cada painel</div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .editor {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px;
        gap: 10px;
        box-sizing: border-box;
    }
    .aviso {
        margin: auto;
        max-width: 460px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: center;
        opacity: 0.9;
    }
    .topo {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }
    .espaco {
        flex: 1;
    }
    .corFora {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .corFora .rotulo {
        color: #a8a8a8;
        font-size: 0.9em;
    }
    .corFora input[type="color"] {
        width: 34px;
        height: 28px;
        padding: 2px;
        cursor: pointer;
    }
    .corFora input[type="range"] {
        width: 110px;
        padding: 0;
        border: none;
        background: transparent;
        accent-color: #f2f2f2;
    }
    .corFora .valor {
        min-width: 38px;
        text-align: end;
        font-size: 0.9em;
    }
    button,
    select,
    input {
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 6px 12px;
        font-family: inherit;
        font-size: 0.9em;
    }
    button {
        cursor: pointer;
    }
    button:hover {
        border-color: var(--secondary);
    }
    .primario {
        background: var(--secondary);
        color: var(--secondary-text);
        border-color: var(--secondary);
        font-weight: 600;
    }
    .emuso {
        color: var(--secondary);
        border-color: var(--secondary);
        font-weight: 600;
    }
    .nome {
        font-weight: 600;
        min-width: 180px;
    }
    .area {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        container-type: size;
    }
    .quadro {
        position: relative;
        max-width: 100%;
        max-height: 100%;
        width: 100cqw;
        border-radius: 4px;
        overflow: hidden;
        user-select: none;
        touch-action: none;
    }
    @container (min-aspect-ratio: 16/9) {
        .quadro {
            width: auto;
            height: 100cqh;
        }
    }
    .fundo {
        position: absolute;
        inset: 0;
        background: linear-gradient(120deg, #e85d3a, #b9347a 45%, #5a3fd0);
    }
    .forma {
        position: absolute;
        border: 2px dashed rgb(255 255 255 / 0.6);
        cursor: move;
        z-index: 10000;
        box-sizing: border-box;
    }
    .forma.circ {
        border-radius: 50%;
    }
    .forma.sel {
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px #000;
    }
    .alca {
        position: absolute;
        right: -7px;
        bottom: -7px;
        width: 14px;
        height: 14px;
        background: #fff;
        border: 2px solid #000;
        border-radius: 3px;
        cursor: nwse-resize;
    }
    .vazio {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 20px;
        color: #fff;
        font-weight: 600;
        text-shadow: 0 1px 4px #000;
        z-index: 10001;
        pointer-events: none;
    }
</style>
