// somun: atualização automática (decidido com ela em 25/11). Só Windows por enquanto.
//
// O somun live e o somun tela vêm no MESMO instalador, então a atualização é uma só: o instalador
// inteiro, publicado pelo workflow do somun live em Releases > "33.0.1-projetolive" (sem login),
// junto com "somun-versao.json" ({ numero, tamanho }). O instalador grava o número dele em
// <pasta do somun>\somun-versao.txt.
//
// - Confere ao abrir e a cada 2 horas. Versão nova = número de lá maior que o daqui.
// - Quem baixa é o somun live (ele sabe quando está transmitindo e não baixa no ar). O somun tela só
//   baixa se o somun live não estiver aberto (PC só de projeção).
// - Baixado: "versão nova" na barra de cima (só com o telão desligado), com "Atualizar agora"
//   (fecha, instala e abre de novo) ou "Depois" (instala ao fechar, se o somun live também estiver
//   fechado — nunca fecha o outro no meio do culto).
// - Sem somun-versao.txt (modo de desenvolvimento ou instalação antiga): não faz nada.

import { app } from "electron"
import { execSync, spawn } from "child_process"
import { createWriteStream, existsSync, readFileSync, renameSync, statSync, unlinkSync } from "fs"
import { tmpdir } from "os"
import { dirname, join } from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"

const BASE = "https://github.com/denysondetrano30/projeto-live/releases/download/33.0.1-projetolive"
const INTERVAL = 2 * 60 * 60 * 1000

let started = false
let busy = false
let readyNumber = 0
let readyFile = ""

function localNumber(): number {
    try {
        const file = join(dirname(process.execPath), "..", "somun-versao.txt")
        return parseInt(readFileSync(file, "utf8").trim(), 10) || 0
    } catch {
        return 0
    }
}

function running(image: string): boolean {
    try {
        const out = execSync(`tasklist /FI "IMAGENAME eq ${image}" /NH`, { windowsHide: true, encoding: "utf8" })
        return out.toLowerCase().includes(image.toLowerCase())
    } catch {
        return false
    }
}

async function check() {
    if (busy) return
    busy = true
    try {
        const mine = localNumber()
        if (!mine) return
        const res = await fetch(`${BASE}/somun-versao.json?t=${Date.now()}`, { cache: "no-store" })
        if (!res.ok) return
        const info = (await res.json()) as { numero?: number; tamanho?: number }
        const numero = Number(info.numero) || 0
        const tamanho = Number(info.tamanho) || 0
        if (numero <= mine || !tamanho) return

        const file = join(tmpdir(), `somun-atualizacao-${numero}.exe`)
        const complete = () => existsSync(file) && statSync(file).size === tamanho
        if (!complete()) {
            // o somun live baixa; aqui só se ele não estiver aberto
            if (running("obs64.exe")) return
            const part = file + ".tela.part"
            const download = await fetch(`${BASE}/ProjetoLive-Instalador.exe?t=${Date.now()}`, { cache: "no-store" })
            if (!download.ok || !download.body) return
            await pipeline(Readable.fromWeb(download.body as any), createWriteStream(part))
            if (statSync(part).size !== tamanho) {
                unlinkSync(part)
                return
            }
            if (!complete()) renameSync(part, file)
            else unlinkSync(part)
        }
        if (complete()) {
            readyNumber = numero
            readyFile = file
        }
    } catch (err: any) {
        console.warn("somun: não conferiu atualização:", err?.message || err)
    } finally {
        busy = false
    }
}

export function plUpdaterStart() {
    if (started || !app.isPackaged || process.platform !== "win32") return
    started = true
    setTimeout(check, 20000)
    setInterval(check, INTERVAL)

    // "Depois": instala quando fechar, se o somun live também estiver fechado
    app.on("quit", () => {
        if (!readyFile || !existsSync(readyFile) || running("obs64.exe")) return
        launch(`start "" "${readyFile}" /S`)
    })
}

function launch(command: string) {
    // pelo cmd, porque o instalador pede administrador (o Windows mostra a pergunta)
    const child = spawn("cmd.exe", ["/d", "/c", command], { detached: true, stdio: "ignore", windowsHide: true, windowsVerbatimArguments: true })
    child.unref()
}

export function plUpdaterState() {
    return { pronta: !!readyFile, versao: readyNumber ? String(readyNumber) : "" }
}

export function plUpdaterNow() {
    if (!readyFile || !existsSync(readyFile)) return
    // instala (o instalador fecha o somun live, se estiver aberto) e abre o somun tela de novo
    launch(`"start "" /wait "${readyFile}" /S & start "" "${process.execPath}""`)
    readyFile = ""
    app.quit()
}

// O botão antigo do FreeShow ("atualizar sozinho" nas configurações) passa a usar o nosso.
export default async function checkForUpdates() {
    plUpdaterStart()
}
