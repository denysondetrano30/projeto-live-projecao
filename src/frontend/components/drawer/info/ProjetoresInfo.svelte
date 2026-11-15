<script lang="ts">
    // Projeto Live: lado direito da aba Mapeamento › Projetores (bordas, gama e região da saída escolhida)
    import { outputs } from "../../../stores"
    import { mudarMapa } from "../mascaras/mapa"
    import { plMascaraUI, saidasDeTela } from "../mascaras/mascaras"

    $: saida = saidasDeTela($outputs).find((s) => s.id === $plMascaraUI.outputId)
    $: mapa = saida?.o.mapa || {}
    $: bw = saida?.o.bounds?.width || 1920
    $: bh = saida?.o.bounds?.height || 1080
    $: regiao = mapa.regiao || { x: 0, y: 0, w: 1, h: 1 }
    $: bordas = mapa.bordas || {}

    const LADOS = [
        ["esq", "Esquerda"],
        ["dir", "Direita"],
        ["cima", "Em cima"],
        ["baixo", "Embaixo"]
    ]
    function borda(lado: string, px: string) {
        const v = Math.max(0, Number(px) || 0)
        const total = lado === "esq" || lado === "dir" ? bw : bh
        if (!saida) return
        mudarMapa(saida.id, (m) => {
            m.bordas = { ...(m.bordas || {}), [lado]: Math.min(0.9, v / total) }
        })
    }
    function reg(campo: string, pct: string) {
        const v = Number(pct)
        if (!saida || isNaN(v)) return
        mudarMapa(saida.id, (m) => {
            m.regiao = { ...(m.regiao || { x: 0, y: 0, w: 1, h: 1 }), [campo]: Math.max(campo === "w" || campo === "h" ? 0.01 : 0, Math.min(1, v / 100)) }
        })
    }
    function zerar() {
        if (!saida || !confirm(`Tirar todo o mapeamento de "${saida.nome}"?`)) return
        mudarMapa(saida.id, (m) => {
            Object.keys(m).forEach((k) => delete m[k])
        })
    }
    const pct = (v: number) => Math.round(v * 10000) / 100
</script>

<div class="info">
    {#if saida}
        <div class="titulo">{saida.nome}</div>
        <p class="dica">Projetor de {bw} × {bh} px{mapa.juncao ? " · faz parte da junção" : ""}.</p>

        <div class="titulo2">Fusão das bordas (px)</div>
        <div class="grade">
            {#each LADOS as [lado, nome]}
                <label>{nome} <input type="number" min="0" value={Math.round((bordas[lado] || 0) * (lado === "esq" || lado === "dir" ? bw : bh))} on:change={(e) => borda(lado, e.currentTarget.value)} /></label>
            {/each}
        </div>
        <label class="linha">Gama ({(mapa.gama || 2.2).toFixed(1)})
            <input type="range" min="1" max="3" step="0.1" value={mapa.gama || 2.2} on:input={(e) => saida && mudarMapa(saida.id, (m) => (m.gama = Number(e.currentTarget.value)))} />
        </label>
        <p class="dica">Se o meio da junção ficar mais claro, aumente a gama; se ficar escuro, diminua.</p>

        <div class="titulo2">Região da imagem (%)</div>
        <div class="grade">
            <label>X <input type="number" step="0.1" value={pct(regiao.x)} on:change={(e) => reg("x", e.currentTarget.value)} /></label>
            <label>Y <input type="number" step="0.1" value={pct(regiao.y)} on:change={(e) => reg("y", e.currentTarget.value)} /></label>
            <label>Largura <input type="number" step="0.1" value={pct(regiao.w)} on:change={(e) => reg("w", e.currentTarget.value)} /></label>
            <label>Altura <input type="number" step="0.1" value={pct(regiao.h)} on:change={(e) => reg("h", e.currentTarget.value)} /></label>
        </div>
        <p class="dica">Qual pedaço da imagem este projetor mostra (100% = a imagem toda). O assistente de junção preenche sozinho.</p>

        <button class="perigo" on:click={zerar}>Tirar mapeamento desta saída</button>
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
        font-weight: 700;
    }
    .titulo2 {
        font-weight: 600;
        margin-top: 8px;
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
        box-sizing: border-box;
        width: 100%;
    }
    button {
        cursor: pointer;
        margin-top: 12px;
        font-size: 0.9em;
    }
    .perigo {
        color: #ff8a80;
    }
</style>
