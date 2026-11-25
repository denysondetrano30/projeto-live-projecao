// somun tela: guarda as últimas mensagens de erro e aviso da janela, para o "Relatar problema"
// mandar junto (registro técnico). Importado cedo (SomunTop).

const lines: string[] = []
let installed = false

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

export function plRelatarInstall() {
    if (installed) return
    installed = true
    for (const kind of ["error", "warn"] as const) {
        const original = console[kind]
        console[kind] = (...args: any[]) => {
            keep(kind, args)
            original.apply(console, args)
        }
    }
    window.addEventListener("error", (e) => keep("erro", [`${e.message} @ ${e.filename || ""}:${e.lineno || ""}`]))
    window.addEventListener("unhandledrejection", (e) => keep("promessa", [e.reason]))
}

export function plRelatarRegistro() {
    return lines.join("\n")
}
