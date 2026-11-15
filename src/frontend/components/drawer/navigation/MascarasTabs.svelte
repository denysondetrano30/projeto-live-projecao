<script lang="ts">
    // Projeto Live: lado esquerdo da aba Máscaras (saída, máscaras com nome, qual está em uso)
    import type { PLMascara } from "../../../../types/Output"
    import { outputs } from "../../../stores"
    import { ativarMascara, mudarSaida, novaMascara, plMascaraUI, saidasDeTela } from "../mascaras/mascaras"

    $: saidas = saidasDeTela($outputs)
    $: if (!saidas.find((s) => s.id === $plMascaraUI.outputId) && saidas[0]) plMascaraUI.update((u) => ({ ...u, outputId: saidas[0].id, editId: "", formaId: "" }))
    $: saida = saidas.find((s) => s.id === $plMascaraUI.outputId)
    $: mascaras = (saida?.o.mascaras || []) as PLMascara[]
    $: ativa = saida?.o.mascaraAtiva || ""
    $: if (saida && !mascaras.find((m) => m.id === $plMascaraUI.editId) && mascaras.length) plMascaraUI.update((u) => ({ ...u, editId: ativa || mascaras[0].id, formaId: "" }))

    function editar(id: string) {
        plMascaraUI.update((u) => ({ ...u, editId: id, formaId: "" }))
    }
    function apagar(m: PLMascara) {
        if (!saida || !confirm(`Apagar a máscara "${m.nome}"?`)) return
        mudarSaida(saida.id, (o) => {
            o.mascaras = o.mascaras.filter((k: PLMascara) => k.id !== m.id)
            if (o.mascaraAtiva === m.id) delete o.mascaraAtiva
        })
    }
</script>

<div class="nav">
    {#if saidas.length > 1}
        <label for="plSaida">Saída</label>
        <select id="plSaida" value={$plMascaraUI.outputId} on:change={(e) => plMascaraUI.set({ outputId: e.currentTarget.value, editId: "", formaId: "" })}>
            {#each saidas as s}
                <option value={s.id}>{s.nome}</option>
            {/each}
        </select>
    {/if}

    {#if saida}
        <button class="item" class:on={!ativa} on:click={() => ativarMascara(saida.id, "")}>
            <span class="bola" class:acesa={!ativa} />
            Sem máscara (tela inteira)
        </button>
        {#each mascaras as m (m.id)}
            <div class="item" class:editando={m.id === $plMascaraUI.editId}>
                <button class="usar" title={m.id === ativa ? "Em uso" : "Usar esta máscara agora"} on:click={() => ativarMascara(saida.id, m.id)}><span class="bola" class:acesa={m.id === ativa} /></button>
                <button class="nome" on:click={() => editar(m.id)}>{m.nome}</button>
                <button class="x" title="Apagar" on:click={() => apagar(m)}>×</button>
            </div>
        {/each}
        <button class="nova" on:click={() => novaMascara(saida.id)}>+ Nova máscara</button>
        <p class="dica">A bolinha acesa é a máscara que está no telão agora. Clique no nome para editar.</p>
    {/if}
</div>

<style>
    .nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 8px;
    }
    label,
    .dica {
        font-size: 0.8em;
        opacity: 0.6;
        margin: 4px 2px 0;
    }
    select {
        background: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 6px;
        padding: 6px 8px;
        margin-bottom: 8px;
        font-family: inherit;
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
        padding: 6px 8px;
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
        padding: 2px 0;
    }
    .x {
        opacity: 0.4;
        font-size: 1.2em;
        padding: 0 4px;
    }
    .x:hover {
        opacity: 1;
        color: #ff8a80;
    }
    .bola {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--text);
        opacity: 0.5;
    }
    .bola.acesa {
        background: var(--secondary);
        border-color: var(--secondary);
        opacity: 1;
    }
    .nova {
        margin-top: 6px;
        padding: 8px;
        border: 1px dashed var(--primary-lighter);
        border-radius: 6px;
        text-align: center;
    }
</style>
