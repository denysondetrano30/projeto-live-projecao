// somun tela: "Relatar problema" (decidido com ela em 25/11).
//
// Grava em Firestore › relatos (sem login; as regras só deixam criar, com tamanho limitado). Ela lê
// na página "Relatos" do Diretor. Vai junto: texto, contato (opcional), versão, sistema, a conta
// (e-mail), um print da janela (se a pessoa deixar) e o registro técnico (últimas mensagens de erro
// e aviso deste processo e da janela).

import { app } from "electron"
import { readFileSync } from "fs"
import { release } from "os"
import { dirname, join } from "path"
import { mainWindow } from ".."
import { PL_FIREBASE } from "./firebase"

const lines: string[] = []
function keep(kind: string, parts: any[]) {
    try {
        const text = parts
            .map((p) => {
                if (p && p.stack) return String(p.stack)
                if (typeof p === "object") {
                    try {
                        return JSON.stringify(p)
                    } catch {
                        return String(p)
                    }
                }
                return String(p)
            })
            .join(" ")
        lines.push(`${new Date().toISOString().slice(11, 19)} ${kind} ${text}`.slice(0, 2000))
        if (lines.length > 300) lines.shift()
    } catch {
        // nada
    }
}
for (const kind of ["error", "warn"] as const) {
    const original = console[kind]
    console[kind] = (...args: any[]) => {
        keep(kind, args)
        original.apply(console, args)
    }
}
process.on("uncaughtException", (err) => keep("exceção", [err]))

function installed(): string {
    try {
        return readFileSync(join(dirname(process.execPath), "..", "somun-versao.txt"), "utf8").trim()
    } catch {
        return ""
    }
}

export async function plRelatarPrint(): Promise<string> {
    try {
        if (!mainWindow || mainWindow.isDestroyed()) return ""
        let image = await mainWindow.webContents.capturePage()
        const size = image.getSize()
        if (size.width > 1280) image = image.resize({ width: 1280 })
        let quality = 60
        let data = image.toJPEG(quality)
        while (data.length > 560000 && quality > 25) {
            quality -= 10
            data = image.toJPEG(quality)
        }
        return "data:image/jpeg;base64," + data.toString("base64")
    } catch (err) {
        console.warn("somun tela: print do relato falhou:", err)
        return ""
    }
}

export async function plRelatarEnviar(data: { texto: string; contato?: string; conta?: string; print?: string; registro?: string }) {
    const number = installed()
    const fields: any = {
        texto: { stringValue: (data.texto || "").slice(0, 4000) },
        app: { stringValue: "tela" },
        versao: { stringValue: (number ? `${number} · ` : "") + app.getVersion() },
        sistema: { stringValue: `Windows ${release()} · ${process.arch} · Electron ${process.versions.electron}`.slice(0, 600) },
        registro: { stringValue: (`[janela]\n${data.registro || ""}\n\n[processo principal]\n${lines.join("\n")}`).slice(-55000) },
        em: { timestampValue: new Date().toISOString() },
        resolvido: { booleanValue: false }
    }
    if (data.contato) fields.contato = { stringValue: data.contato.slice(0, 200) }
    if (data.conta) fields.conta = { stringValue: data.conta.slice(0, 200) }
    if (data.print && data.print.length <= 800000) fields.print = { stringValue: data.print }
    try {
        const url = `https://firestore.googleapis.com/v1/projects/${PL_FIREBASE.projectId}/databases/(default)/documents/relatos?key=${PL_FIREBASE.apiKey}`
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) })
        if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
        return { ok: true }
    } catch (err: any) {
        return { ok: false, detail: err?.message || String(err) }
    }
}
