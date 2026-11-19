// Projeto Live (somun tela, 19/11): temporizador direto na tela.
// Uma sobreposição pronta "Contagem" (id pl_contagem) com um item de temporizador. Mostrar no telão
// troca o temporizador e a posição dela e liga a sobreposição; esconder tira. Duas posições (decisão
// dela): "meio grande" e "canto pequeno"; a última usada fica guardada (special.plContagemPosicao).
// A escolha da posição é na setinha do botão "Mostrar no telão ▾" da coluna da direita; dois cliques
// num temporizador da aba Temporizadores usam a mesma escolha.

import { get } from "svelte/store"
import type { Overlay } from "../../types/Show"
import { clearOverlay } from "../components/output/clear"
import { getAllActiveOutputs, setOutput } from "../components/helpers/output"
import { playPauseGlobal } from "../components/drawer/timers/timers"
import { activeTimers, outputs, overlays, special, timers } from "../stores"
import { isMainWindow } from "./common"

export const OVERLAY_CONTAGEM = "pl_contagem"
export type PosicaoContagem = "meio" | "canto"

export const POSICOES: { id: PosicaoContagem; nome: string }[] = [
    { id: "meio", nome: "Meio, grande" },
    { id: "canto", nome: "Canto, pequeno" }
]

// medidas numa tela 1920x1080, com margem de segurança (nada encosta na borda)
const ESTILOS: Record<PosicaoContagem, string> = {
    meio: "top:290px;left:260px;width:1400px;height:500px;color:#FFFFFF;text-shadow:4px 4px 16px rgb(0 0 0 / 80%);",
    canto: "top:860px;left:1420px;width:420px;height:150px;color:#FFFFFF;border-radius:16px;background-color:rgb(0 0 0 / 0.55);"
}

export function posicaoContagem(_atualizar: any = null): PosicaoContagem {
    return get(special).plContagemPosicao === "canto" ? "canto" : "meio"
}

function montar(timerId: string, posicao: PosicaoContagem): Overlay {
    return {
        name: "Contagem",
        color: "#E5483B",
        category: null,
        items: [{ type: "timer", style: ESTILOS[posicao], align: "align-items:center;", timer: { id: timerId } } as any]
    }
}

// sobreposições no ar: as postas direto e as que vêm de uma cena (19/11: contagem dentro de uma cena)
export function sobreposicoesNoAr(_atualizar: any = null): string[] {
    const ids = new Set<string>()
    getAllActiveOutputs().forEach((o: any) => {
        ;(o?.out?.overlays || []).forEach((id: string) => ids.add(id))
        const cena = o?.out?.scene
        if (cena) (cena.overlays || []).filter((id: string) => !(cena.hiddenOverlays || []).includes(id)).forEach((id: string) => ids.add(id))
    })
    return [...ids]
}

function timersDaSobreposicao(id: string): string[] {
    return ((get(overlays)[id]?.items || []) as any[]).filter((i) => i?.type === "timer").map((i) => i.timer?.id || i.timerId || "").filter(Boolean)
}

// temporizadores que estão aparecendo no telão (em qualquer sobreposição, inclusive a "Contagem")
export function timersNaTela(_atualizar: any = null): string[] {
    return [...new Set(sobreposicoesNoAr().flatMap(timersDaSobreposicao))]
}

export function contagemNaTela(_atualizar: any = null): boolean {
    return sobreposicoesNoAr().includes(OVERLAY_CONTAGEM)
}

// acabou: parado no tempo final (o FreeShow deixa ele assim, em 00:00, depois de terminar)
export function terminou(a: any): boolean {
    if (!a || a.paused !== true) return false
    const t: any = get(timers)[a.id] || a
    return typeof a.currentTime === "number" && a.currentTime === (t.end || 0)
}

// a linha do temporizador da direita aparece: rodando, pausado no meio, ou aparecendo no telão
export function temporizadorEmUso(_a: any = null, _b: any = null): boolean {
    const naTela = timersNaTela()
    if (naTela.some((id) => get(timers)[id])) return true
    return get(activeTimers).some((a: any) => !a.showId && get(timers)[a.id] && !terminou(a))
}

export function timerDaContagem(_atualizar: any = null): string {
    return (get(overlays)[OVERLAY_CONTAGEM]?.items?.[0] as any)?.timer?.id || ""
}

export function mostrarContagem(timerId: string, posicao: PosicaoContagem = posicaoContagem()) {
    if (!timerId || !get(timers)[timerId]) return
    // só troca de lugar/temporizador: não mexe no play/pausa
    if (contagemNaTela() && timerDaContagem() === timerId) reposicionando = Date.now()
    special.update((s) => ({ ...s, plContagemPosicao: posicao }))
    overlays.update((a) => {
        a[OVERLAY_CONTAGEM] = { ...(a[OVERLAY_CONTAGEM] || {}), ...montar(timerId, posicao) }
        return a
    })
    // a saída não redesenha uma sobreposição que já está no ar: tira e põe de volta (troca de posição/temporizador)
    if (contagemNaTela()) {
        clearOverlay(OVERLAY_CONTAGEM)
        setTimeout(() => setOutput("overlays", OVERLAY_CONTAGEM, false, "", true), 60)
    } else setOutput("overlays", OVERLAY_CONTAGEM, false, "", true)
}

// esconde a "Contagem" e qualquer outra sobreposição posta à mão que mostre esse temporizador
export function esconderContagem(timerId: string = "") {
    clearOverlay(OVERLAY_CONTAGEM)
    if (!timerId) return
    getAllActiveOutputs().forEach((o: any) => {
        ;(o?.out?.overlays || []).forEach((id: string) => {
            if (id !== OVERLAY_CONTAGEM && timersDaSobreposicao(id).includes(timerId)) clearOverlay(id)
        })
    })
}

// dois cliques no temporizador: mostra; se já é ele na tela, esconde
export function alternarContagem(timerId: string) {
    if (contagemNaTela() && timerDaContagem() === timerId) esconderContagem()
    else mostrarContagem(timerId)
}

// ±segundos no temporizador (se ainda não começou, prepara parado no novo tempo)
export function ajustarTempo(timerId: string, segundos: number) {
    const t: any = get(timers)[timerId]
    if (!t || t.type !== "counter") return
    const inicio = t.start || 0
    const fim = t.end || 0
    const desce = fim < inicio
    activeTimers.update((a) => {
        let i = a.findIndex((x) => x.id === timerId && !x.showId)
        if (i < 0) {
            a.push({ ...t, id: timerId, currentTime: inicio, paused: true })
            i = a.length - 1
        }
        const atual = typeof a[i].currentTime === "number" ? a[i].currentTime : inicio
        // contagem regressiva: "+10s" dá mais tempo (o número sobe)
        let novo = atual + segundos
        if (desce) novo = Math.max(fim, novo)
        else novo = Math.max(inicio, novo)
        a[i].currentTime = novo
        delete a[i].startTime
        return a
    })
}

// Entrou no telão uma sobreposição com temporizador (dois cliques na lista do culto, Mais › Sobreposições,
// uma cena, uma ação…): o temporizador começa a contar sozinho, como acontece nos slides (19/11, pedido
// dela). Se já tinha terminado, começa de novo do início; se está rodando, segue.
let reposicionando = 0

// sobreposição antiga com o temporizador só dentro dela (sem estar na lista de temporizadores): cria na lista
function garantirTimer(id: string) {
    if (get(timers)[id]) return
    let dados: any = null
    sobreposicoesNoAr().forEach((o) => {
        const item: any = ((get(overlays)[o]?.items || []) as any[]).find((i) => i?.type === "timer" && (i.timer?.id || i.timerId) === id)
        if (item?.timer?.type) dados = item.timer
    })
    if (!dados) return
    timers.update((a) => {
        const novo: any = { ...dados, name: dados.name || "Contagem" }
        delete novo.id
        a[id] = novo
        return a
    })
}
let vistos: string[] | null = null
outputs.subscribe(() => {
    if (!isMainWindow()) return
    const agora = timersNaTela()
    const antes = vistos
    vistos = agora
    if (antes === null) return
    if (Date.now() - reposicionando < 1500) return
    agora
        .filter((id) => !antes.includes(id))
        .forEach((id) => {
            garantirTimer(id)
            const t: any = get(timers)[id]
            if (!t || t.type !== "counter") return
            const ativo: any = get(activeTimers).find((a: any) => a.id === id && !a.showId)
            if (ativo && !ativo.paused) return
            if (ativo && terminou(ativo)) activeTimers.update((a) => a.filter((x: any) => x !== ativo))
            playPauseGlobal(id, t, true)
        })
})
