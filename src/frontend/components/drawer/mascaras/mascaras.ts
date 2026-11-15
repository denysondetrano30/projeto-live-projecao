// Projeto Live: aba "Máscaras" (painéis de LED). Cada saída guarda várias máscaras com nome
// (outputs[id].mascaras) e qual está em uso (outputs[id].mascaraAtiva). As formas ficam em frações
// da tela (0 a 1); na tela de edição aparecem em pixels da saída.
import { get, writable } from "svelte/store"
import { uid } from "uid"
import type { Output, PLForma, PLMascara } from "../../../../types/Output"
import { outputs } from "../../../stores"

export const plMascaraUI = writable({ outputId: "", editId: "", formaId: "", modo: "mascaras" as "mascaras" | "projetores" })

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

// cantos de uma forma: [sup. esq., sup. dir., inf. dir., inf. esq.] em fração do menor lado
export function cantosDe(f: PLForma): number[] {
    if (f.cantosSoltos && f.cantos?.length === 4) return f.cantos
    const r = f.raio || 0
    return [r, r, r, r]
}
// caminho SVG de um retângulo com cada canto arredondado do seu jeito
export function caminhoRet(x: number, y: number, w: number, h: number, cantos: number[]) {
    const lado = Math.min(w, h)
    const [a, b, c, d] = cantos.map((v) => Math.max(0, Math.min(0.5, v || 0)) * lado)
    return `M${x + a},${y} H${x + w - b} A${b},${b} 0 0 1 ${x + w},${y + b} V${y + h - c} A${c},${c} 0 0 1 ${x + w - c},${y + h} H${x + d} A${d},${d} 0 0 1 ${x},${y + h - d} V${y + a} A${a},${a} 0 0 1 ${x + a},${y} Z`
}

export function resolucao(o: Output | undefined) {
    return { W: o?.forcedResolution?.width || o?.bounds?.width || 1920, H: o?.forcedResolution?.height || o?.bounds?.height || 1080 }
}
