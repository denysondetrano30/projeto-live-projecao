<script lang="ts">
    // Projeto Live: lado direito da aba Máscaras (medidas da forma selecionada e PNG)
    import { uid } from "uid"
    import type { PLMascara } from "../../../../types/Output"
    import { outputs } from "../../../stores"
    import { imageExtensions } from "../../../values/extensions"
    import MaterialFilePicker from "../../inputs/MaterialFilePicker.svelte"
    import { mudarForma, mudarMascara, plMascaraUI, resolucao, saidasDeTela } from "../mascaras/mascaras"

    $: saida = saidasDeTela($outputs).find((s) => s.id === $plMascaraUI.outputId)
    $: m = ((saida?.o.mascaras || []) as PLMascara[]).find((k) => k.id === $plMascaraUI.editId) || null
    $: f = m?.formas.find((k) => k.id === $plMascaraUI.formaId) || null
    $: ({ W, H } = resolucao(saida?.o))
    $: oid = saida?.id || ""

    function px(campo: "x" | "y" | "w" | "h", valor: string) {
        const v = Number(valor)
        if (!m || !f || isNaN(v)) return
        const total = campo === "x" || campo === "w" ? W : H
        mudarForma(oid, m.id, f.id, (k) => (k[campo] = Math.max(0, Math.min(1, v / total))))
    }
    const emPx = (v: number, total: number) => Math.round(v * total)
    function duplicar() {
        if (!m || !f) return
        const id = uid()
        const c = { ...f, id, x: Math.min(f.x + f.w + 0.01, 1 - f.w) }
        mudarMascara(oid, m.id, (k) => k.formas.push(c))
        plMascaraUI.update((u) => ({ ...u, formaId: id }))
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
            <div class="titulo">{f.tipo === "circ" ? "Círculo" : "Retângulo"}</div>
            <div class="grade">
                <label>X <input type="number" value={emPx(f.x, W)} on:change={(e) => px("x", e.currentTarget.value)} /></label>
                <label>Y <input type="number" value={emPx(f.y, H)} on:change={(e) => px("y", e.currentTarget.value)} /></label>
                <label>Largura <input type="number" value={emPx(f.w, W)} on:change={(e) => px("w", e.currentTarget.value)} /></label>
                <label>Altura <input type="number" value={emPx(f.h, H)} on:change={(e) => px("h", e.currentTarget.value)} /></label>
            </div>
            <p class="dica">Em pixels da saída ({W}×{H}). Setas do teclado movem 1 px (Shift: 10 px).</p>
            {#if f.tipo === "ret"}
                <label class="raio">Cantos arredondados <input type="range" min="0" max="0.5" step="0.01" value={f.raio || 0} on:input={(e) => m && f && mudarForma(oid, m.id, f.id, (k) => (k.raio = Number(e.currentTarget.value)))} /></label>
            {/if}
            <div class="botoes">
                <button on:click={duplicar}>Duplicar forma</button>
                <button class="perigo" on:click={apagar}>Apagar forma</button>
            </div>
        {:else}
            <p class="dica">Clique numa forma para ver as medidas. Arraste para mover; o quadradinho branco muda o tamanho.</p>
        {/if}

        <div class="titulo" style="margin-top: 14px;">PNG (opcional)</div>
        <MaterialFilePicker label="Imagem da máscara" value={m.png} filter={{ name: "Imagem", extensions: imageExtensions }} on:change={(e) => m && mudarMascara(oid, m.id, (k) => (e.detail ? (k.png = e.detail) : delete k.png))} allowEmpty />
        <p class="dica">Preto esconde, transparente mostra. Pode usar junto com as formas.</p>
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
