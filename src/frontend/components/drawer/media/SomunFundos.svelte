<script lang="ts">
    // Projeto Live (somun tela, 28/11): "Fundos do somun" na aba Mídia. Clicar põe no telão (clicar de novo
    // tira), como qualquer fundo. Os cartões já mostram o fundo andando, com as cores que ele lembra.
    import { outLocked, outputs } from "../../../stores"
    import { FUNDOS } from "../../../utils/projetoLiveFundos"
    import { getFirstActiveOutput, setOutput } from "../../helpers/output"
    import { clearBackground } from "../../output/clear"
    import SomunFundo from "../../output/layers/SomunFundo.svelte"

    $: noAr = (getFirstActiveOutput($outputs) as any)?.out?.background?.id || ""

    function escolher(f: (typeof FUNDOS)[number]) {
        if ($outLocked) return
        if (noAr === f.id) clearBackground()
        else setOutput("background", { id: f.id, name: f.nome, type: "somun" })
    }
</script>

<div class="lista">
    {#each FUNDOS as f}
        <button class="cartao" class:ativo={noAr === f.id} on:click={() => escolher(f)} title={noAr === f.id ? "Tirar do telão" : "Pôr no telão"}>
            <div class="mini"><SomunFundo id={f.id} /></div>
            <span>{f.nome}</span>
        </button>
    {/each}
</div>
<p class="dica">Clique para pôr no telão. Cor, velocidade e o resto ficam no painel "Fundo", embaixo do telão.</p>

<style>
    .lista {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 10px;
        padding: 10px;
    }
    .cartao {
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
    }
    .dica {
        padding: 0 12px 12px;
        opacity: 0.5;
        font-size: 0.85em;
    }
</style>
