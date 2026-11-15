<script lang="ts">
    // Projeto Live: editor de máscaras da saída (painéis de LED).
    // Cada saída guarda várias máscaras com nome (outputs[id].mascaras) e qual está ativa (mascaraAtiva).
    // As formas ficam em frações da tela; os números aparecem em pixels da saída.
    import { uid } from "uid"
    import type { PLForma, PLMascara } from "../../../../types/Output"
    import { outputs } from "../../../stores"
    import { imageExtensions } from "../../../values/extensions"
    import Title from "../../input/Title.svelte"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import ProjetoLiveMascara from "../../output/layers/ProjetoLiveMascara.svelte"

    export let outputId = ""

    $: out = $outputs[outputId]
    $: mascaras = (out?.mascaras || []) as PLMascara[]
    $: ativa = out?.mascaraAtiva || ""
    $: W = out?.forcedResolution?.width || out?.bounds?.width || 1920
    $: H = out?.forcedResolution?.height || out?.bounds?.height || 1080

    let editId = ""
    $: if (!mascaras.find((m) => m.id === editId)) editId = ativa || mascaras[0]?.id || ""
    $: editando = mascaras.find((m) => m.id === editId) || null
    let formaId = ""
    $: forma = editando?.formas.find((f) => f.id === formaId) || null
    let renomeando = false

    function mudar(f: (o: any) => void) {
        outputs.update((a: any) => {
            const o = a[outputId]
            if (!o) return a
            if (!o.mascaras) o.mascaras = []
            f(o)
            return a
        })
    }
    function mudarMascara(f: (m: PLMascara) => void) {
        mudar((o) => {
            const m = o.mascaras.find((k: PLMascara) => k.id === editId)
            if (m) f(m)
        })
    }
    function mudarForma(f: (k: PLForma) => void) {
        mudarMascara((m) => {
            const k = m.formas.find((x) => x.id === formaId)
            if (k) f(k)
        })
    }

    function nova() {
        const id = uid()
        mudar((o) => o.mascaras.push({ id, nome: "Máscara " + (o.mascaras.length + 1), formas: [] }))
        editId = id
        formaId = ""
        renomeando = true
    }
    function duplicar() {
        if (!editando) return
        const id = uid()
        const copia = JSON.parse(JSON.stringify(editando))
        copia.id = id
        copia.nome = editando.nome + " (cópia)"
        mudar((o) => o.mascaras.push(copia))
        editId = id
    }
    function apagar() {
        if (!editando || !confirm(`Apagar a máscara "${editando.nome}"?`)) return
        const id = editando.id
        mudar((o) => {
            o.mascaras = o.mascaras.filter((m: PLMascara) => m.id !== id)
            if (o.mascaraAtiva === id) delete o.mascaraAtiva
        })
        formaId = ""
    }
    function ativar(id: string) {
        mudar((o) => {
            if (id) o.mascaraAtiva = id
            else delete o.mascaraAtiva
        })
    }

    function addForma(tipo: "ret" | "circ") {
        if (!editando) return
        const id = uid()
        const n = editando.formas.length
        const w = tipo === "circ" ? Math.min(0.3, (0.3 * H) / W) : 0.3
        const h = tipo === "circ" ? (w * W) / H : 0.6
        mudarMascara((m) => m.formas.push({ id, tipo, x: Math.min(0.05 + n * 0.05, 1 - w), y: Math.min(0.2 + n * 0.03, 1 - h), w, h, raio: tipo === "ret" ? 0.1 : 0 }))
        formaId = id
    }
    function duplicarForma() {
        if (!forma) return
        const id = uid()
        const c = { ...forma, id, x: Math.min(forma.x + forma.w + 0.01, 1 - forma.w) }
        mudarMascara((m) => m.formas.push(c))
        formaId = id
    }
    function apagarForma() {
        if (!forma) return
        const id = forma.id
        mudarMascara((m) => (m.formas = m.formas.filter((f) => f.id !== id)))
        formaId = ""
    }

    // arrastar / redimensionar no quadro
    let quadro: HTMLDivElement
    let arrasto: { modo: "mover" | "tamanho"; px: number; py: number; f: PLForma } | null = null
    function inicio(e: PointerEvent, f: PLForma, modo: "mover" | "tamanho") {
        e.preventDefault()
        e.stopPropagation()
        formaId = f.id
        arrasto = { modo, px: e.clientX, py: e.clientY, f: { ...f } }
        window.addEventListener("pointermove", mover)
        window.addEventListener("pointerup", fim, { once: true })
    }
    function mover(e: PointerEvent) {
        if (!arrasto || !quadro) return
        const r = quadro.getBoundingClientRect()
        const dx = (e.clientX - arrasto.px) / r.width
        const dy = (e.clientY - arrasto.py) / r.height
        const o = arrasto.f
        const ajuste = (v: number) => Math.round(v * 2000) / 2000
        if (arrasto.modo === "mover") {
            mudarForma((k) => {
                k.x = ajuste(Math.max(0, Math.min(1 - o.w, o.x + dx)))
                k.y = ajuste(Math.max(0, Math.min(1 - o.h, o.y + dy)))
            })
        } else {
            mudarForma((k) => {
                k.w = ajuste(Math.max(0.02, Math.min(1 - o.x, o.w + dx)))
                k.h = ajuste(Math.max(0.02, Math.min(1 - o.y, o.h + dy)))
            })
        }
    }
    function fim() {
        arrasto = null
        window.removeEventListener("pointermove", mover)
    }

    // números em pixels da saída
    function px(campo: "x" | "y" | "w" | "h", valor: string) {
        const v = Number(valor)
        if (isNaN(v)) return
        const total = campo === "x" || campo === "w" ? W : H
        mudarForma((k) => (k[campo] = Math.max(0, Math.min(1, v / total))))
    }
    const emPx = (v: number, total: number) => Math.round(v * total)
</script>

<Title label="Máscara do painel de LED" icon="screen" />

<div class="pl">
    <p class="dica">Recorta esta saída no formato dos painéis: só aparece o que estiver dentro das formas, o resto fica preto. Vale só para esta saída.</p>

    <div class="linha">
        <label for="plAtiva">Máscara em uso</label>
        <select id="plAtiva" value={ativa} on:change={(e) => ativar(e.currentTarget.value)}>
            <option value="">Nenhuma (tela inteira)</option>
            {#each mascaras as m}
                <option value={m.id}>{m.nome}</option>
            {/each}
        </select>
    </div>

    <div class="linha chips">
        {#each mascaras as m}
            <button class:on={m.id === editId} on:click={() => ((editId = m.id), (formaId = ""), (renomeando = false))}>{m.nome}{m.id === ativa ? " ●" : ""}</button>
        {/each}
        <button class="add" on:click={nova}>+ Nova máscara</button>
    </div>

    {#if editando}
        <div class="linha">
            {#if renomeando}
                <input class="nome" value={editando.nome} on:change={(e) => mudarMascara((m) => (m.nome = e.currentTarget.value.trim() || m.nome))} on:keydown={(e) => e.key === "Enter" && (renomeando = false)} on:blur={() => (renomeando = false)} autofocus />
            {:else}
                <b>{editando.nome}</b>
                <button class="link" on:click={() => (renomeando = true)}>Renomear</button>
            {/if}
            <span class="espaco" />
            {#if ativa === editando.id}
                <button on:click={() => ativar("")}>Parar de usar</button>
            {:else}
                <button class="primario" on:click={() => ativar(editando.id)}>Usar agora</button>
            {/if}
            <button on:click={duplicar}>Duplicar</button>
            <button class="perigo" on:click={apagar}>Apagar</button>
        </div>

        <div class="quadro" bind:this={quadro} style="aspect-ratio: {W} / {H};" on:pointerdown={() => (formaId = "")}>
            <div class="fundo" />
            <ProjetoLiveMascara mascara={editando} width={W} height={H} editor />
            {#each editando.formas as f (f.id)}
                <div
                    class="forma"
                    class:sel={f.id === formaId}
                    class:circ={f.tipo === "circ"}
                    style="left: {f.x * 100}%; top: {f.y * 100}%; width: {f.w * 100}%; height: {f.h * 100}%;"
                    on:pointerdown={(e) => inicio(e, f, "mover")}
                >
                    <span class="alca" on:pointerdown={(e) => inicio(e, f, "tamanho")} />
                </div>
            {/each}
            {#if !editando.formas.length && !editando.png}
                <div class="vazio">Adicione formas no lugar de cada painel (ou carregue um PNG)</div>
            {/if}
        </div>

        <div class="linha">
            <button on:click={() => addForma("ret")}>+ Retângulo</button>
            <button on:click={() => addForma("circ")}>+ Círculo</button>
            {#if forma}
                <button on:click={duplicarForma}>Duplicar forma</button>
                <button class="perigo" on:click={apagarForma}>Apagar forma</button>
            {/if}
        </div>

        {#if forma}
            <div class="linha numeros">
                <label>X <input type="number" value={emPx(forma.x, W)} on:change={(e) => px("x", e.currentTarget.value)} /></label>
                <label>Y <input type="number" value={emPx(forma.y, H)} on:change={(e) => px("y", e.currentTarget.value)} /></label>
                <label>Largura <input type="number" value={emPx(forma.w, W)} on:change={(e) => px("w", e.currentTarget.value)} /></label>
                <label>Altura <input type="number" value={emPx(forma.h, H)} on:change={(e) => px("h", e.currentTarget.value)} /></label>
                <span class="muted">px (tela de {W}×{H})</span>
            </div>
            {#if forma.tipo === "ret"}
                <div class="linha">
                    <label for="plRaio">Cantos arredondados</label>
                    <input id="plRaio" type="range" min="0" max="0.5" step="0.01" value={forma.raio || 0} on:input={(e) => mudarForma((k) => (k.raio = Number(e.currentTarget.value)))} />
                </div>
            {/if}
        {/if}

        <MaterialFilePicker label="PNG da máscara (preto esconde, transparente mostra)" value={editando.png} filter={{ name: "Imagem", extensions: imageExtensions }} on:change={(e) => mudarMascara((m) => (e.detail ? (m.png = e.detail) : delete m.png))} allowEmpty />
    {/if}
</div>

<style>
    .pl {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 8px 0 14px;
    }
    .dica,
    .muted {
        opacity: 0.65;
        font-size: 0.85em;
        margin: 0;
    }
    .linha {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }
    .espaco {
        flex: 1;
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
    button.primario,
    .chips button.on {
        background: var(--secondary);
        color: var(--secondary-text);
        border-color: var(--secondary);
    }
    button.perigo {
        color: #ff8a80;
    }
    button.link {
        background: none;
        border: 0;
        text-decoration: underline;
        opacity: 0.8;
    }
    .chips button {
        border-radius: 16px;
    }
    .chips button.add {
        border-style: dashed;
    }
    select {
        flex: 1;
        min-width: 200px;
    }
    .nome {
        flex: 1;
    }
    .numeros input {
        width: 80px;
    }
    input[type="range"] {
        flex: 1;
        padding: 0;
    }
    .quadro {
        position: relative;
        width: 100%;
        border-radius: 6px;
        overflow: hidden;
        user-select: none;
        touch-action: none;
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
