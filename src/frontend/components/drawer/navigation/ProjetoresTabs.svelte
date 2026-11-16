<script lang="ts">
    // Projeto Live: lado esquerdo da aba Projetores (saídas; clique para o ajuste fino)
    import { outputs } from "../../../stores"
    import { mapaAtivo } from "../mascaras/mapa"
    import { plProjetorUI, saidasDeTela } from "../mascaras/mascaras"

    $: saidas = saidasDeTela($outputs)
    $: if (!saidas.find((s) => s.id === $plProjetorUI.outputId) && saidas[0]) plProjetorUI.set({ outputId: saidas[0].id })
</script>

<div class="nav">
    <p class="lbl">Saídas (projetores)</p>
    {#each saidas as s (s.id)}
        <button class="item" class:editando={s.id === $plProjetorUI.outputId} on:click={() => plProjetorUI.set({ outputId: s.id })}>
            <span class="nome">{s.nome}</span>
            {#if s.o.mapa?.juncao}<span class="tag">junção</span>{:else if mapaAtivo(s.o.mapa)}<span class="tag">ajustada</span>{/if}
        </button>
    {/each}
    <p class="dica">Clique numa saída para o ajuste fino (4 cantos, bordas, região). A junção monta tudo de uma vez. Máscaras ficam na aba Máscaras.</p>
</div>

<style>
    .nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 8px;
    }
    .lbl,
    .dica {
        font-size: 0.8em;
        opacity: 0.6;
        margin: 4px 2px 0;
    }
    button {
        background: none;
        border: 0;
        color: var(--text);
        font-family: inherit;
        font-size: 0.95em;
        cursor: pointer;
        text-align: left;
    }
    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 6px;
    }
    .item:hover,
    .item.editando {
        background: var(--primary-lighter);
    }
    .item.editando {
        box-shadow: inset 3px 0 0 var(--secondary);
    }
    .nome {
        flex: 1;
    }
    .tag {
        font-size: 0.75em;
        opacity: 0.7;
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 0 6px;
    }
</style>
