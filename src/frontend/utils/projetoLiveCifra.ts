// Projeto Live: cifra colada (acordes em cima da letra, como no Cifra Club) → música da Projeção.
//
// O conversor de texto do FreeShow só reconhece acordes simples; uma linha com F#m7(9), A7M ou
// Bm7(11) virava texto e os acordes iam para o telão. Aqui:
// 1. a cifra é lida linha a linha: linha só de acordes + a linha de letra embaixo dela viram a
//    letra limpa e a lista de acordes com a posição de cada um (na letra sem os espaços do começo);
//    linha de acordes sem letra (introdução, solo) e tom/capotraste/tablatura são deixados de fora;
// 2. a música é criada só com a letra (o telão e a live nunca recebem acorde como texto);
// 3. os acordes entram em cada linha (line.chords), que é o que o retorno de palco mostra.

import { uid } from "uid"
import type { Chords, Show } from "../../types/Show"
import { convertText } from "../converters/txt"

// Um acorde: nota (A–G), sustenido/bemol e o resto (m, 7, M, 9, (11), sus4, dim, º, +, /baixo, *).
const CHORD = /^\(?[A-G](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|º|°|\+|-|\d|\(|\)|\/[A-G](?:#|b)?|#|b)*\)?\*?$/
const SEPARATOR = /^[|/\\.\-–—~]+$|^x\d+$|^\(x\d+\)$/i

function isChordLine(line: string) {
    const tokens = line.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) return false
    let chords = 0
    for (const token of tokens) {
        if (SEPARATOR.test(token)) continue
        if (!CHORD.test(token)) return false
        chords++
    }
    return chords > 0
}

function isHeader(line: string) {
    return /^\[[^\]]+\]$/.test(line.trim())
}

function skip(line: string) {
    const t = line.trim()
    if (/^(tom|capotraste|afina[cç][aã]o)\s*:/i.test(t)) return true
    if (/^[EADGBe]\s*\|/.test(t)) return true // tablatura
    if (/^\[?tab\b/i.test(t)) return true
    if (/^parte\s+\d+\s+de\s+\d+$/i.test(t)) return true
    // "[Intro] F#m E D": parte só de instrumento
    const label = t.match(/^\[[^\]]+\]\s+(.+)$/)
    if (label && isChordLine(label[1])) return true
    return false
}

export function plCifraNormalize(text: string) {
    return text.replace(/\s+/g, " ").trim().toLowerCase()
}

/** A letra limpa e, para cada linha de letra, os acordes (posição na linha sem espaços do começo). */
export function plCifraParse(cifra: string) {
    const lines = cifra
        .replace(/\r/g, "")
        .replace(/[   \t]/g, " ")
        .split("\n")
        .filter((line) => !skip(line))
    const out: string[] = []
    const chords = new Map<string, { pos: number; key: string }[]>()

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) {
            if (out.length && out[out.length - 1] !== "") out.push("")
            continue
        }
        if (isHeader(line)) {
            if (out.length && out[out.length - 1] !== "") out.push("")
            out.push(line.trim())
            continue
        }
        if (!isChordLine(line)) {
            out.push(line.trim())
            continue
        }

        // Linha de acordes: a letra é a próxima linha (pula linhas em branco no meio).
        let j = i + 1
        while (j < lines.length && !lines[j].trim()) j++
        const lyric = lines[j]
        if (j >= lines.length || isChordLine(lyric) || isHeader(lyric)) continue // só instrumento

        const indent = lyric.length - lyric.trimStart().length
        // Espaços a mais dentro da letra (do alinhamento da cifra) viram um só; "map" leva a posição
        // antiga para a nova.
        const raw = lyric.trim()
        const map: number[] = []
        let text = ""
        for (let k = 0; k < raw.length; k++) {
            if (raw[k] === " " && text.endsWith(" ")) {
                map.push(text.length - 1)
                continue
            }
            map.push(text.length)
            text += raw[k]
        }
        const found: { pos: number; key: string }[] = []
        const finder = /\S+/g
        let match: RegExpExecArray | null
        while ((match = finder.exec(line)) !== null) {
            const key = match[0]
            if (SEPARATOR.test(key)) continue
            let pos = Math.max(0, match.index - indent)
            while (pos < raw.length && raw[pos] === " ") pos++
            pos = pos >= raw.length ? text.length : map[pos]
            found.push({ pos, key: key.replace(/\*$/, "") })
        }
        out.push(text)
        const normalized = plCifraNormalize(text)
        if (found.length && !chords.has(normalized)) chords.set(normalized, found)
        i = j
    }

    return {
        letra: out
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
        chords
    }
}

/** Põe os acordes nas linhas da música (as linhas com o mesmo texto ganham os mesmos acordes). */
export function plCifraApply(show: Show, chords: Map<string, { pos: number; key: string }[]>) {
    Object.values(show.slides || {}).forEach((slide: any) => {
        ;(slide.items || []).forEach((item: any) => {
            ;(item.lines || []).forEach((line: any) => {
                const text = (line.text || []).map((part: any) => part?.value || "").join("")
                const found = chords.get(plCifraNormalize(text))
                if (!found) return
                line.chords = found.map((chord) => ({ id: uid(5), pos: chord.pos, key: chord.key }) as Chords)
            })
        })
    })
    return show
}

/** Cria a música a partir da cifra: a letra no telão, os acordes no retorno de palco. */
export function plCifraShow(name: string, cifra: string) {
    const { letra, chords } = plCifraParse(cifra)
    const { id, show } = convertText({ name, text: letra, noFormatting: true, returnData: true, open: false })
    plCifraApply(show, chords)
    return { id, show: show as Show, letra }
}
