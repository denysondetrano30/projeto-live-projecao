<script lang="ts">
    // Projeto Live (somun Telão): o que saiu de vista da música aberta — arranjos (layouts),
    // anotações, metadados e mídia do show. Abre pelo "⋯" ao lado das partes ou pelo botão direito.
    import { activeShow, popupData, showsCache } from "../../../stores"
    import Layouts from "../../slide/Layouts.svelte"
    import Notes from "../../show/tools/Notes.svelte"
    import { _show } from "../../helpers/shows"
    import Metadata from "../../show/tools/Metadata.svelte"
    import Media from "../../show/tools/Media.svelte"

    const abas = [
        { id: "arranjos", nome: "Arranjos" },
        { id: "anotacoes", nome: "Anotações" },
        { id: "metadados", nome: "Metadados" },
        { id: "midia", nome: "Mídia da música" }
    ]
    let aba = $popupData?.aba || "arranjos"
    $: temShow = !!$showsCache[$activeShow?.id || ""]
    $: nota = temShow ? _show().layouts("active").get("notes")[0] || "" : ""
    function salvarNota(e: any) {
        if (!temShow) return
        _show().layouts("active").set({ key: "notes", value: e.detail })
    }
</script>

<div class="extras">
    <div class="abas">
        {#each abas as a}
            <button class:ativa={aba === a.id} on:click={() => (aba = a.id)}>{a.nome}</button>
        {/each}
    </div>

    <div class="conteudo">
        {#if !temShow}
            <p class="vazio">Abra uma música primeiro.</p>
        {:else if aba === "arranjos"}
            <Layouts />
        {:else if aba === "anotacoes"}
            <Notes value={nota} lines={8} placeholder="Anotações desta música (este arranjo)" on:edit={salvarNota} />
        {:else if aba === "metadados"}
            <Metadata />
        {:else if aba === "midia"}
            <Media />
        {/if}
    </div>
</div>

<style>
    .extras {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 560px;
        min-height: 300px;
    }
    .abas {
        display: flex;
        gap: 6px;
    }
    .abas button {
        font-family: inherit;
        color: var(--text);
        background: #1c1c1c;
        border: 1px solid #2a2a2a;
        border-radius: 6px;
        padding: 5px 12px;
        cursor: pointer;
    }
    .abas button.ativa {
        border-color: #e8e8e8;
    }
    .conteudo {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 240px;
        max-height: 60vh;
        overflow: auto;
    }
    .vazio {
        opacity: 0.6;
        padding: 20px;
        text-align: center;
    }
</style>
