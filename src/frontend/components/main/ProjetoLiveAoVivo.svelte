<script lang="ts">
    // Projeto Live: recados e sugestões do diretor no canto da tela (bloco 6).
    import { onMount } from "svelte"
    import { plCultosLoad } from "../../utils/projetoLiveCultos"
    import { plLiveDiscard, plLiveDismiss, plLiveInsert, plLiveRecados, plLiveReply, plLiveStart, plLiveSugestoes } from "../../utils/projetoLiveAoVivo"

    const PRONTAS = ["OK", "Pronto", "Agora não"]

    let writing: string | null = null
    let text = ""

    onMount(async () => {
        await plCultosLoad()
        plLiveStart()
    })

    function send(id: string) {
        plLiveReply(id, text)
        writing = null
        text = ""
    }

    function where(s: any) {
        if (s.posicao?.tipo === "depoisItem") return `depois de “${s.posicao.titulo || "item"}”`
        if (s.posicao?.tipo === "depoisAtual") return "logo depois do item atual"
        return "quando der"
    }
</script>

{#if $plLiveRecados.length || $plLiveSugestoes.length}
    <div class="pl-live">
        {#each $plLiveRecados as recado (recado.id)}
            <div class="card">
                <div class="head"><span class="dot"></span>Diretor</div>
                <div class="msg">{recado.texto}</div>
                {#if writing === recado.id}
                    <!-- svelte-ignore a11y-autofocus -->
                    <input autofocus bind:value={text} placeholder="Escreva a resposta" on:keydown={(e) => e.key === "Enter" && send(recado.id)} on:keydown={(e) => e.key === "Escape" && (writing = null)} />
                {:else}
                    <div class="row">
                        {#each PRONTAS as pronta}
                            <button on:click={() => plLiveReply(recado.id, pronta)}>{pronta}</button>
                        {/each}
                        <button class="ghost" on:click={() => ((writing = recado.id), (text = ""))}>Responder…</button>
                        <button class="ghost x" title="Fechar" on:click={() => plLiveDismiss(recado.id)}>×</button>
                    </div>
                {/if}
            </div>
        {/each}

        {#each $plLiveSugestoes as sugestao (sugestao.id)}
            <div class="card">
                <div class="head"><span class="dot media"></span>Sugestão do diretor</div>
                <div class="msg"><b>{sugestao.titulo}</b> · {where(sugestao)}</div>
                {#if sugestao.estado === "baixando"}
                    <div class="note">Baixando do Drive…</div>
                {:else if sugestao.estado === "erro"}
                    <div class="note err">Não deu para baixar: {sugestao.motivo}</div>
                {/if}
                <div class="row">
                    <button disabled={sugestao.estado !== "na_fila"} on:click={() => plLiveInsert(sugestao.id)}>Inserir</button>
                    <button class="ghost" on:click={() => plLiveDiscard(sugestao.id)}>Descartar</button>
                </div>
            </div>
        {/each}
    </div>
{/if}

<style>
    .pl-live {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 5000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 320px;
    }
    .card {
        background: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        padding: 10px 12px;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
        color: var(--text);
    }
    .head {
        font-size: 0.75em;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.7;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--secondary);
    }
    .dot.media {
        background: #4caf50;
    }
    .msg {
        margin: 6px 0 8px;
        font-size: 1.05em;
        line-height: 1.3;
    }
    .note {
        font-size: 0.85em;
        opacity: 0.75;
        margin-bottom: 8px;
    }
    .note.err {
        color: #ff8a80;
        opacity: 1;
    }
    .row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }
    button {
        background: var(--secondary);
        color: var(--secondary-text);
        border: none;
        border-radius: 5px;
        padding: 4px 10px;
        cursor: pointer;
        font-size: 0.9em;
    }
    button:disabled {
        opacity: 0.4;
        cursor: default;
    }
    button.ghost {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--primary-lighter);
    }
    button.x {
        margin-left: auto;
    }
    input {
        width: 100%;
        padding: 5px 8px;
        border-radius: 5px;
        border: 1px solid var(--primary-lighter);
        background: var(--primary-darkest);
        color: var(--text);
    }
</style>
