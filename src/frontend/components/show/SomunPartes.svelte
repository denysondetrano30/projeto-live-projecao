<script lang="ts">
    // Projeto Live (somun Telão, 19/11): nome da música e as partes dela (Verso, Refrão, Ponte…) em
    // botõezinhos em cima dos slides. Substitui a aba "Grupos" da direita.
    // Clique: pula até a parte (rola e marca o 1º slide dela; não põe no telão — decisão de 19/11).
    // Botão direito no botãozinho: "Pôr esta parte no arranjo" (o que o clique da aba Grupos fazia).
    import { activePopup, popupData, selected, showsCache } from "../../stores"
    import { _show } from "../helpers/shows"

    export let showId: string

    $: show = $showsCache[showId]
    $: ref = show ? _show(showId).layouts("active").ref()[0] || [] : []
    $: partes = listarPartes(ref, show)

    function listarPartes(lista: any[], s: any) {
        const vistos = new Set<string>()
        const out: { id: string; nome: string; cor: string; indice: number }[] = []
        lista.forEach((r: any, i: number) => {
            if (!r || r.type === "child") return
            const slide = s?.slides?.[r.id]
            if (!slide || slide.group === "." || vistos.has(r.id)) return
            vistos.add(r.id)
            out.push({ id: r.id, nome: slide.group || "—", cor: slide.color || "", indice: i })
        })
        // nomes repetidos ganham número, como nos slides ("Verso 1", "Verso 2")
        const total: { [nome: string]: number } = {}
        out.forEach((p) => (total[p.nome] = (total[p.nome] || 0) + 1))
        const visto: { [nome: string]: number } = {}
        out.forEach((p) => {
            if (total[p.nome] < 2) return
            visto[p.nome] = (visto[p.nome] || 0) + 1
            p.nome = p.nome + " " + visto[p.nome]
        })
        return out
    }

    function pular(indice: number) {
        selected.set({ id: "slide", data: [{ index: indice, showId }] })
        const slides = document.querySelectorAll(".center .grid > .main")
        const alvo = slides[indice] as HTMLElement | undefined
        alvo?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    function abrirExtras(aba: string) {
        popupData.set({ aba })
        activePopup.set("pl_show_extras")
    }
</script>

{#if show}
    <div class="partes">
        <span class="nome" data-title={show.name}>{show.name}</span>
        <div class="lista">
            {#each partes as parte (parte.id)}
                <button id={parte.id} class="parte context #pl_parte" style={parte.cor ? `border-color: ${parte.cor}66;` : ""} data-title="Ir para “{parte.nome}”<br>Botão direito: pôr no arranjo" on:click={() => pular(parte.indice)}>
                    {#if parte.cor}<i style="background-color: {parte.cor};" />{/if}
                    {parte.nome}
                </button>
            {/each}
        </div>
        <button class="extras" data-title="Arranjos, anotações, metadados e mídia desta música" on:click={() => abrirExtras("arranjos")}>⋯</button>
    </div>
{/if}

<style>
    .partes {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px 8px;
        border-bottom: 1px solid #2a2a2a;
        background-color: var(--primary-darker);
        position: sticky;
        top: 0;
        z-index: 5;
    }
    .nome {
        font-weight: 600;
        font-size: 1.05em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 30%;
    }
    .lista {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        flex: 1;
    }
    button {
        font-family: inherit;
        color: var(--text);
        cursor: pointer;
    }
    .parte {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        border: 1px solid #3a3a3a;
        background-color: #1c1c1c;
        font-size: 0.85em;
    }
    .parte:hover {
        background-color: #2a2a2a;
    }
    .parte i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
    }
    .extras {
        border: 1px solid #2a2a2a;
        background: transparent;
        border-radius: 6px;
        padding: 0 10px;
        height: 26px;
        font-size: 1.1em;
    }
    .extras:hover {
        background-color: #232323;
    }
</style>
