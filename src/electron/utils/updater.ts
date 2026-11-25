// somun tela: atualização automática (decidido com ela em 25/11).
//
// Cada envio ao GitHub monta o instalador e publica em Releases > "somun-tela" (fixo, sem login).
// O somun tela confere lá ao abrir e a cada 2 horas, baixa escondido e:
// - mostra "versão nova" na barra de cima (só com o telão desligado) com "Atualizar agora" ou "Depois";
// - com "Depois" (ou sem clicar em nada), instala sozinho quando fechar o programa.
// Nunca procura no FreeShow original (o que apagaria as funções do somun).
// Só Windows por enquanto (Mac sem assinatura da Apple não se atualiza sozinho).

import { autoUpdater } from "electron-updater"
import { isProd } from ".."

const FEED = "https://github.com/denysondetrano30/projeto-live-projecao/releases/download/somun-tela"
const INTERVAL = 2 * 60 * 60 * 1000

let started = false
let readyVersion = ""

function check() {
    autoUpdater.checkForUpdates().catch((err) => console.warn("somun tela: não conferiu atualização:", err?.message || err))
}

export function plUpdaterStart() {
    if (started || !isProd || process.platform !== "win32") return
    started = true

    autoUpdater.setFeedURL({ provider: "generic", url: FEED })
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = true
    autoUpdater.allowDowngrade = false

    autoUpdater.on("update-downloaded", (info) => {
        readyVersion = info?.version || "nova"
    })
    autoUpdater.on("error", (err) => console.warn("somun tela: erro na atualização:", err?.message || err))

    setTimeout(check, 15000)
    setInterval(check, INTERVAL)
}

export function plUpdaterState() {
    return { pronta: !!readyVersion, versao: readyVersion }
}

export function plUpdaterNow() {
    if (!readyVersion) return
    // silencioso e abre de novo depois de instalar
    autoUpdater.quitAndInstall(true, true)
}

// O botão antigo do FreeShow ("atualizar sozinho" nas configurações) passa a usar o nosso.
export default async function checkForUpdates() {
    plUpdaterStart()
}
