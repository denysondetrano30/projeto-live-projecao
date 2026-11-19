// Projeto Live (somun Telão): layout novo da Projeção (19/11, proposta "Tamo Telão simplificado"
// aprovada pela pessoa, com a identidade somun).
//
// - Na primeira vez, a Projeção passa a usar o tema "somun" (preto/cinzas, Outfit, vermelho só para o
//   que está no ar).
// - Saída de segurança: Configurações > Geral > "Layout clássico do FreeShow" volta o tema e a tela
//   antigos (special.plLayoutClassico). As partes novas da tela olham `layoutClassico`.

import { derived, get } from "svelte/store"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { clone } from "../components/helpers/array"
import { loaded, special, theme, themes } from "../stores"
import { updateThemeValues } from "./updateSettings"

export const TEMA_SOMUN = "somun"

export const layoutClassico = derived(special, ($special) => !!$special?.plLayoutClassico)

function garantirTema() {
    if (get(themes)[TEMA_SOMUN]) return
    themes.update((a) => {
        a[TEMA_SOMUN] = clone(defaultThemes[TEMA_SOMUN])
        return a
    })
}

function usarTema(id: string) {
    if (id === TEMA_SOMUN) garantirTema()
    const valores = get(themes)[id] || defaultThemes[id] || defaultThemes.default
    theme.set(get(themes)[id] ? id : "default")
    // os degradês do somun não existem nos outros temas: volta ao valor do global.css
    ;["--pl-gradiente", "--pl-gradiente-borda", "--pl-gradiente-barra"].forEach((v) => document.documentElement.style.removeProperty(v))
    updateThemeValues(valores)
}

export function definirLayoutClassico(classico: boolean) {
    special.update((a) => {
        if (classico) a.plLayoutClassico = true
        else delete a.plLayoutClassico
        return a
    })
    usarTema(classico ? "default" : TEMA_SOMUN)
}

// Primeira vez (depois das configurações carregadas): tema somun, a não ser que o clássico esteja ligado.
let feito = false
loaded.subscribe((ok) => {
    if (!ok || feito) return
    feito = true
    setTimeout(() => {
        const s = get(special) || {}
        if (s.plLayoutClassico) return
        if (!s.plSomunTema) {
            special.update((a) => {
                a.plSomunTema = true
                return a
            })
            usarTema(TEMA_SOMUN)
        } else if (get(theme) === TEMA_SOMUN) {
            // o tema pode ter sido salvo antes desta versão: garante as cores atuais
            themes.update((a) => {
                a[TEMA_SOMUN] = clone(defaultThemes[TEMA_SOMUN])
                return a
            })
            updateThemeValues(get(themes)[TEMA_SOMUN])
        }
    }, 0)
})
