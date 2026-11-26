// Projeto Live: cifra colada (acordes em cima da letra, como no Cifra Club) → música da Projeção.
//
// O conversor de texto do FreeShow só reconhece acordes simples; uma linha com F#m7(9), A7M ou
// Bm7(11) virava texto e os acordes iam para o telão. Aqui:
// 1. a cifra é lida linha a linha: linha só de acordes + a linha de letra embaixo dela viram a
//    letra limpa e a lista de acordes com a posição de cada um (na letra sem os espaços do começo);
//    linha de acordes sem letra (introdução, solo) e tom/capotraste/tablatura são deixados de fora;
// 2. a música é criada só com a letra (o telão e a live nunca recebem acorde como texto);
// 3. os acordes entram em cada linha (line.chords), que é o que o retorno de palco mostra.
// 4. recado entre colchetes numa linha só ("[Repete 2x]", "[Só teclado]") vai só para o retorno de
//    palco: entra como um "acorde" com o texto do recado — no fim da linha de cima (se vier logo
//    embaixo dela) ou no começo da próxima linha de letra. Nome de parte ("[Refrão]", "[Intro]",
//    "[Ponte]"...) continua sendo o nome da parte, como sempre.

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

// Nomes de parte que a cifra usa (Cifra Club e afins). Outro texto entre colchetes é recado.
const PARTES = /^(intro(du[cç][aã]o)?|refr[aã]o|pr[eé][- ]?refr[aã]o|verso|estrofe|ponte|bridge|chorus|verse|pre[- ]?chorus|coro|final|outro|solo|interl[uú]dio|tag|vamp|parte|primeira parte|segunda parte|terceira parte|quarta parte|ending|instrumental|riff|pass?agem|passagem)(\s*\d+)?$/i

function bracketText(line: string) {
    const m = line.trim().match(/^\[([^\]]+)\]$/)
    return m ? m[1].trim() : null
}

function isHeader(line: string) {
    const t = bracketText(line)
    return t !== null && PARTES.test(semAcento(t))
}

function isNote(line: string) {
    const t = bracketText(line)
    return t !== null && !PARTES.test(semAcento(t)) && !/^tab/i.test(t)
}

function semAcento(text: string) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "")
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
    // Recado esperando a próxima linha de letra.
    let pendingNote = ""
    const addChord = (text: string, chord: { pos: number; key: string }, first = false) => {
        const key = plCifraNormalize(text)
        const list = chords.get(key) || []
        // Recado no começo de uma linha que já tem acorde no começo: os dois juntos, sem um em cima do outro.
        if (first && list[0]?.pos === 0) list[0] = { pos: 0, key: chord.key + " · " + list[0].key }
        else if (first) list.unshift(chord)
        else list.push(chord)
        chords.set(key, list)
    }
    const pushLyric = (text: string) => {
        out.push(text)
        if (pendingNote) {
            addChord(text, { pos: 0, key: pendingNote }, true)
            pendingNote = ""
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line.trim()) {
            if (out.length && out[out.length - 1] !== "") out.push("")
            continue
        }
        if (isNote(line)) {
            const note = bracketText(line)!.replace(/[<>&"]/g, "") // o retorno desenha o acorde como HTML
            const previous = out.length ? out[out.length - 1] : ""
            const rightAfter = i > 0 && lines[i - 1].trim() && previous && !bracketText(previous)
            if (rightAfter) addChord(previous, { pos: previous.length, key: note })
            else pendingNote = pendingNote ? pendingNote + " · " + note : note
            continue
        }
        if (isHeader(line)) {
            if (out.length && out[out.length - 1] !== "") out.push("")
            out.push(line.trim())
            continue
        }
        if (!isChordLine(line)) {
            pushLyric(line.trim())
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
        const normalized = plCifraNormalize(text)
        if (found.length && !chords.has(normalized)) chords.set(normalized, found)
        pushLyric(text)
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
