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
import { activeTimers, overlays, special, timers } from "../stores"

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

export function contagemNaTela(_atualizar: any = null): boolean {
    return getAllActiveOutputs().some((o: any) => (o?.out?.overlays || []).includes(OVERLAY_CONTAGEM))
}

export function timerDaContagem(_atualizar: any = null): string {
    return (get(overlays)[OVERLAY_CONTAGEM]?.items?.[0] as any)?.timer?.id || ""
}

export function mostrarContagem(timerId: string, posicao: PosicaoContagem = posicaoContagem()) {
    if (!timerId || !get(timers)[timerId]) return
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

export function esconderContagem() {
    clearOverlay(OVERLAY_CONTAGEM)
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
