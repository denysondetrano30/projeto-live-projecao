// Projeto Live: aba "Máscaras" (painéis de LED). Cada saída guarda várias máscaras com nome
// (outputs[id].mascaras) e qual está em uso (outputs[id].mascaraAtiva). As formas ficam em frações
// da tela (0 a 1); na tela de edição aparecem em pixels da saída.
import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { Output, PLForma, PLMascara } from "../../../../types/Output"
import { outputs } from "../../../stores"

export const plMascaraUI = writable({ outputId: "", editId: "", formaId: "" })

export function saidasDeTela(lista = get(outputs)) {
    return Object.entries(lista)
        .filter(([, o]) => o && !o.stageOutput)
        .map(([id, o]) => ({ id, nome: o.name || "Saída", o: o as Output }))
}

export function mudarSaida(outputId: string, f: (o: any) => void) {
    outputs.update((a: any) => {
        const o = a[outputId]
        if (!o) return a
        if (!o.mascaras) o.mascaras = []
        f(o)
        return a
    })
}
export function mudarMascara(outputId: string, mascaraId: string, f: (m: PLMascara) => void) {
    mudarSaida(outputId, (o) => {
        const m = o.mascaras.find((k: PLMascara) => k.id === mascaraId)
        if (m) f(m)
    })
}
export function mudarForma(outputId: string, mascaraId: string, formaId: string, f: (k: PLForma) => void) {
    mudarMascara(outputId, mascaraId, (m) => {
        const k = m.formas.find((x) => x.id === formaId)
        if (k) f(k)
    })
}

export function novaMascara(outputId: string) {
    const id = uid()
    mudarSaida(outputId, (o) => o.mascaras.push({ id, nome: "Máscara " + (o.mascaras.length + 1), formas: [] }))
    plMascaraUI.update((u) => ({ ...u, editId: id, formaId: "" }))
    return id
}
export function ativarMascara(outputId: string, id: string) {
    mudarSaida(outputId, (o) => {
        if (id) o.mascaraAtiva = id
        else delete o.mascaraAtiva
    })
}

export function resolucao(o: Output | undefined) {
    return { W: o?.forcedResolution?.width || o?.bounds?.width || 1920, H: o?.forcedResolution?.height || o?.bounds?.height || 1080 }
}
