<script lang="ts">
    // Projeto Live: lado direito da aba Máscaras (medidas da forma selecionada e PNG)
    import { uid } from "uid"
    import type { PLMascara } from "../../../../types/Output"
    import { outputs } from "../../../stores"
    import { imageExtensions } from "../../../values/extensions"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import { encodeFilePath } from "../../helpers/media"
    import { cantosDe, mudarForma, mudarMascara, plMascaraUI, resolucao, saidasDeTela } from "../mascaras/mascaras"

    $: saida = saidasDeTela($outputs).find((s) => s.id === $plMascaraUI.outputId)
    $: m = ((saida?.o.mascaras || []) as PLMascara[]).find((k) => k.id === $plMascaraUI.editId) || null
    $: f = m?.formas.find((k) => k.id === $plMascaraUI.formaId) || null
    $: ({ W, H } = resolucao(saida?.o))
    $: oid = saida?.id || ""

    function px(campo: "x" | "y" | "w" | "h", valor: string) {
        const v = Number(valor)
        if (!m || !f || isNaN(v)) return
        const total = campo === "x" || campo === "w" ? W : H
        mudarForma(oid, m.id, f.id, (k) => {
            k[campo] = Math.max(0, Math.min(1, v / total))
            // imagem: largura e altura andam juntas (sem deformar)
            if (k.tipo === "img" && k.ar) {
                if (campo === "w") k.h = (k.w * W) / (k.ar * H)
                if (campo === "h") k.w = (k.h * H * k.ar) / W
            }
        })
    }
    const emPx = (v: number, total: number) => Math.round(v * total)

    // cantos (igual ao Photoshop: cadeado liga os quatro)
    const NOMES = ["Sup. esquerdo", "Sup. direito", "Inf. esquerdo", "Inf. direito"]
    const ORDEM = [0, 1, 3, 2] // na grade: sup. esq., sup. dir., inf. esq., inf. dir.
    $: lado = f ? Math.min(f.w * W, f.h * H) : 1
    $: cantos = f ? cantosDe(f) : [0, 0, 0, 0]
    function trocarCadeado() {
        if (!m || !f) return
        const atuais = cantosDe(f)
        mudarForma(oid, m.id, f.id, (k) => {
            if (k.cantosSoltos) {
                k.cantosSoltos = false
                k.raio = Math.max(...atuais)
            } else {
                k.cantosSoltos = true
                k.cantos = [...atuais]
            }
        })
    }
    function canto(i: number, frac: number) {
        if (!m || !f) return
        const v = Math.max(0, Math.min(0.5, frac))
        mudarForma(oid, m.id, f.id, (k) => {
            if (!k.cantosSoltos) k.raio = v
            else {
                k.cantos = [...cantosDe(k)]
                k.cantos[i] = v
            }
        })
    }
    function cantoPx(i: number, valor: string) {
        const v = Number(valor)
        if (!isNaN(v)) canto(i, v / lado)
    }
    function atalho(qual: "cima" | "baixo" | "esq" | "dir") {
        if (!m || !f) return
        const r = Math.max(...cantosDe(f)) || 0.1
        const mapa = { cima: [r, r, 0, 0], baixo: [0, 0, r, r], esq: [r, 0, 0, r], dir: [0, r, r, 0] }
        mudarForma(oid, m.id, f.id, (k) => {
            k.cantosSoltos = true
            k.cantos = mapa[qual]
        })
    }
    function duplicar() {
        if (!m || !f) return
        const id = uid()
        const c = { ...f, id, x: Math.min(f.x + f.w + 0.01, 1 - f.w) }
        mudarMascara(oid, m.id, (k) => k.formas.push(c))
        plMascaraUI.update((u) => ({ ...u, formaId: id }))
    }
    // PNG vira uma peça: entra centralizada, ocupando até 60% da tela, na proporção da imagem
    let novaImagem: string | undefined = undefined
    function adicionarImagem(caminho: string) {
        if (!m || !caminho) return
        const mid = m.id
        const img = new Image()
        img.onload = () => {
            const ar = img.naturalWidth / img.naturalHeight || 1
            let w = 0.6
            let h = (w * W) / (ar * H)
            if (h > 0.6) {
                h = 0.6
                w = (h * H * ar) / W
            }
            const id = uid()
            mudarMascara(oid, mid, (k) => {
                k.formas.push({ id, tipo: "img", src: caminho, ar, x: (1 - w) / 2, y: (1 - h) / 2, w, h })
                delete k.png
            })
            plMascaraUI.update((u) => ({ ...u, formaId: id }))
            novaImagem = undefined
        }
        img.src = encodeFilePath(caminho)
    }

    function apagar() {
        if (!m || !f) return
        const id = f.id
        mudarMascara(oid, m.id, (k) => (k.formas = k.formas.filter((x) => x.id !== id)))
        plMascaraUI.update((u) => ({ ...u, formaId: "" }))
    }
</script>

<div class="info">
    {#if m}
        {#if f}
            <div class="titulo">{f.tipo === "circ" ? "Círculo" : f.tipo === "img" ? "Imagem" : "Retângulo"}</div>
            <div class="grade">
                <label>X <input type="number" value={emPx(f.x, W)} on:change={(e) => px("x", e.currentTarget.value)} /></label>
                <label>Y <input type="number" value={emPx(f.y, H)} on:change={(e) => px("y", e.currentTarget.value)} /></label>
                <label>Largura <input type="number" value={emPx(f.w, W)} on:change={(e) => px("w", e.currentTarget.value)} /></label>
                <label>Altura <input type="number" value={emPx(f.h, H)} on:change={(e) => px("h", e.currentTarget.value)} /></label>
            </div>
            <p class="dica">Em pixels da saída ({W}×{H}). Setas do teclado movem 1 px (Shift: 10 px).{f.tipo === "img" ? " Largura e altura andam juntas para não deformar." : ""}</p>
            {#if f.tipo === "ret"}
                <div class="cantosTopo">
                    <span class="titulo2">Cantos arredondados</span>
                    <button class="cadeado" class:aberto={f.cantosSoltos} title={f.cantosSoltos ? "Cada canto separado (clique para ligar os quatro)" : "Os quatro cantos juntos (clique para soltar)"} on:click={trocarCadeado}>
                        {f.cantosSoltos ? "🔓 Separados" : "🔗 Juntos"}
                    </button>
                </div>
                {#if !f.cantosSoltos}
                    <div class="linhaCanto">
                        <input type="range" min="0" max="0.5" step="0.005" value={cantos[0]} on:input={(e) => canto(0, Number(e.currentTarget.value))} />
                        <input type="number" value={Math.round(cantos[0] * lado)} on:change={(e) => cantoPx(0, e.currentTarget.value)} />
                    </div>
                {:else}
                    <div class="grade">
                        {#each ORDEM as i}
                            <label>{NOMES[ORDEM.indexOf(i)]}
                                <div class="linhaCanto">
                                    <input type="range" min="0" max="0.5" step="0.005" value={cantos[i]} on:input={(e) => canto(i, Number(e.currentTarget.value))} />
                                    <input type="number" value={Math.round(cantos[i] * lado)} on:change={(e) => cantoPx(i, e.currentTarget.value)} />
                                </div>
                            </label>
                        {/each}
                    </div>
                {/if}
                <div class="atalhos">
                    <span class="dica">Só os de:</span>
                    <button on:click={() => atalho("cima")}>cima</button>
                    <button on:click={() => atalho("baixo")}>baixo</button>
                    <button on:click={() => atalho("esq")}>esquerda</button>
                    <button on:click={() => atalho("dir")}>direita</button>
                </div>
            {/if}
            <div class="botoes">
                <button on:click={duplicar}>Duplicar forma</button>
                <button class="perigo" on:click={apagar}>Apagar forma</button>
            </div>
        {:else}
            <p class="dica">Clique numa forma para ver as medidas. Arraste para mover; o quadradinho branco muda o tamanho.</p>
        {/if}

        <div class="titulo" style="margin-top: 14px;">Imagem (PNG)</div>
        <MaterialFilePicker label="Adicionar imagem" value={novaImagem} filter={{ name: "Imagem", extensions: imageExtensions }} on:change={(e) => adicionarImagem(e.detail)} allowEmpty />
        <p class="dica">Entra como uma peça: arraste, mude o tamanho pelo quadradinho (sem deformar). Fica por cima; o transparente do PNG deixa ver o que está atrás.</p>
        {#if m.png}
            <label>Imagem antiga (tela inteira)
                <select value={m.pngAjuste || "contain"} on:change={(e) => m && mudarMascara(oid, m.id, (k) => (k.pngAjuste = e.currentTarget.value))}>
                    <option value="contain">Caber na tela (sem esticar)</option>
                    <option value="cover">Preencher a tela (corta as sobras)</option>
                    <option value="fill">Esticar até as bordas</option>
                </select>
            </label>
            <button on:click={() => m?.png && adicionarImagem(m.png)}>Transformar em peça ajustável</button>
        {/if}
    {/if}
</div>

<style>
    .info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
    }
    .titulo {
        font-weight: 600;
    }
    .dica {
        font-size: 0.8em;
        opacity: 0.6;
        margin: 0;
    }
    .grade {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }
    label {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 0.8em;
        opacity: 0.9;
    }
    input[type="number"],
    select,
    button {
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 5px 8px;
        font-family: inherit;
        font-size: 1.05em;
        width: 100%;
        box-sizing: border-box;
    }
    .cantosTopo {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
    }
    .titulo2 {
        font-size: 0.9em;
        font-weight: 600;
    }
    .cadeado {
        width: auto;
    }
    .cadeado.aberto {
        border-color: var(--secondary);
    }
    .linhaCanto {
        display: flex;
        gap: 6px;
        align-items: center;
    }
    .linhaCanto input[type="range"] {
        flex: 1;
        min-width: 0;
    }
    .linhaCanto input[type="number"] {
        width: 64px;
        flex: none;
    }
    .atalhos {
        display: flex;
        gap: 4px;
        align-items: center;
        flex-wrap: wrap;
    }
    .atalhos button {
        width: auto;
        padding: 3px 8px;
    }
    .botoes {
        display: flex;
        gap: 6px;
    }
    button {
        cursor: pointer;
        font-size: 0.85em;
    }
    .perigo {
        color: #ff8a80;
    }
</style>
