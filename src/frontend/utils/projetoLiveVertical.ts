// Projeto Live: "Telão vertical" para a live em pé (18/11, pedido da pessoa).
//
// Quando o OBS usa o vertical (9:16), ele pede "NDIV on" e a Projeção cria uma segunda saída
// escondida, "Transmissão vertical (OBS)", 1080x1920, mandada por NDI com o nome
// "Projeto Live - Telão vertical". No OBS, onde a fonte "Telão (projeção)" estiver, a versão vertical
// da cena usa esse sinal sozinha.
//
// Decisões da pessoa:
// - arte 16:9 sem versão vertical: a arte inteira no meio e a própria arte ampliada e desfocada em
//   cima e embaixo (o "blur" do FreeShow, no estilo "Vertical (OBS)");
// - arte com versão vertical (botão direito na arte > "Versão vertical..."): o vertical mostra a outra
//   (guardada em media[caminho].plVertical);
// - letra e textos: reorganizados para a tela em pé pelo modelo "Letra vertical" (o estilo usa esse
//   modelo); a pessoa ajusta estilo e modelo na própria Projeção, como qualquer outro.

import { get } from "svelte/store"
import { OUTPUT } from "../../types/Channels"
import type { Styles } from "../../types/Settings"
import type { Template } from "../../types/Show"
import { clone } from "../components/helpers/array"
import { defaultOutput } from "../components/helpers/output"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import { receiveToMain, requestMain, sendMain } from "../IPC/main"
import { media, outputs, styles, templates } from "../stores"
import { mediaExtensions } from "../values/extensions"
import { isOutputWindow } from "./common"
import { send } from "./request"

export const SAIDA_VERTICAL = "pl_transmissao_vertical"
export const NOME_NDI_VERTICAL = "Projeto Live - Telão vertical"
export const ESTILO_VERTICAL = "pl_vertical"
export const MODELO_VERTICAL = "pl_letra_vertical"

const LARGURA = 1080
const ALTURA = 1920

let quer = false

// O modelo da letra em pé: uma caixa de texto larga no meio da tela, letra grande que encolhe
// quando o verso é comprido. Só é criado se não existir (a pessoa pode mudar à vontade).
// Medidas: as posições valem como proporção de uma tela 1920x1080 esticada no tamanho da saída (em pé,
// os 1080 do alto viram a altura inteira); o tamanho da letra segue a largura (1920 = largura toda).
// Modelos das versões anteriores (18/11, medidas erradas) são trocados se ninguém mexeu neles.
const ESTILOS_ANTIGOS = ["top:560px;left:60px;width:960px;height:800px;", "top:1000px;left:110px;width:1700px;height:1400px;"]
function garantirModelo() {
    const atual = get(templates)[MODELO_VERTICAL]
    if (atual && !ESTILOS_ANTIGOS.includes(atual.items?.[0]?.style || "")) return
    const modelo: Template = {
        name: "Letra vertical",
        color: null,
        category: "song",
        settings: { resolution: { width: 1920, height: 1080 } },
        items: [
            {
                style: "top:270px;left:96px;width:1728px;height:540px;",
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "Letra vertical", style: "font-size: 150px;font-weight: bold;text-shadow: 4px 4px 12px rgb(0 0 0 / 80%);" }] }]
            }
        ]
    } as any
    templates.update((a) => {
        a[MODELO_VERTICAL] = modelo
        return a
    })
}

// O estilo da saída vertical: 1080x1920, arte com fundo desfocado, modelo da letra em pé.
// Criado uma vez; depois a pessoa ajusta em Configurações > Estilos.
export function garantirEstiloVertical() {
    garantirModelo()
    if (get(styles)[ESTILO_VERTICAL]) return
    const estilo: Styles = {
        name: "Vertical (OBS)",
        aspectRatio: { width: LARGURA, height: ALTURA },
        fit: "blur",
        blurAmount: 40,
        blurOpacity: 0.7,
        template: MODELO_VERTICAL,
        templateScripture: MODELO_VERTICAL
    }
    styles.update((a) => {
        a[ESTILO_VERTICAL] = estilo
        return a
    })
}

function arrumar(forcar = false) {
    const atual = get(outputs)[SAIDA_VERTICAL]
    if (!quer) {
        if (atual) {
            send(OUTPUT, ["REMOVE"], { id: SAIDA_VERTICAL })
            outputs.update((a) => {
                delete a[SAIDA_VERTICAL]
                return a
            })
        }
        return
    }
    garantirEstiloVertical()
    if (!forcar && atual && atual.bounds?.width === LARGURA && atual.bounds?.height === ALTURA && atual.style === ESTILO_VERTICAL && atual.ndi && atual.ndiData?.name === NOME_NDI_VERTICAL) return
    outputs.update((a) => {
        a[SAIDA_VERTICAL] = {
            ...clone(defaultOutput),
            ...(a[SAIDA_VERTICAL] || {}),
            name: "Transmissão vertical (OBS)",
            enabled: true,
            active: true,
            invisible: true,
            style: ESTILO_VERTICAL,
            bounds: { x: 0, y: 0, width: LARGURA, height: ALTURA },
            ndi: true,
            ndiData: { ...(a[SAIDA_VERTICAL]?.ndiData || {}), name: NOME_NDI_VERTICAL }
        } as any
        delete (a[SAIDA_VERTICAL] as any).mapa
        delete (a[SAIDA_VERTICAL] as any).mascaraAtiva
        delete (a[SAIDA_VERTICAL] as any).rtmp
        return a
    })
    send(OUTPUT, ["CREATE"], { ...get(outputs)[SAIDA_VERTICAL], id: SAIDA_VERTICAL })
}

// Chamado quando algum OBS pede (ou nenhum pede mais) o telão vertical.
export function setProjetoLiveNdiVertical(on: boolean) {
    // só a janela principal cuida da saída (este arquivo também é carregado pelas janelas das saídas)
    if (isOutputWindow()) return
    // OBS acabou de pedir: cria a janela de novo mesmo que a saída já esteja na lista (ela pode ter
    // ficado guardada sem janela)
    const forcar = on && !quer
    quer = on
    try {
        arrumar(forcar)
    } catch (err) {
        console.warn("Projeto Live: telão vertical:", err)
    }
}

// A arte que o vertical mostra no lugar desta (ou a própria, se não tiver versão vertical).
export function caminhoParaSaida(outputId: string, caminho: string, _atualiza: any = null): string {
    if (outputId !== SAIDA_VERTICAL || !caminho) return caminho
    return (get(media)[caminho] as any)?.plVertical || caminho
}

export function versaoVertical(caminho: string): string {
    return (get(media)[caminho] as any)?.plVertical || ""
}

export function definirVersaoVertical(caminho: string, vertical: string) {
    if (!caminho) return
    media.update((a) => {
        const atual: any = a[caminho] || {}
        if (vertical) atual.plVertical = vertical
        else delete atual.plVertical
        a[caminho] = atual
        return a
    })
}

// A saída fica guardada nas configurações: se a Projeção abrir e nenhum OBS pedir o vertical, ela sai
// (para não ficar mandando NDI à toa).
// (18/11: antes isto rodava também dentro da própria janela vertical, que se apagava depois de 15 s;
// e o aviso do OBS podia chegar antes de a janela principal estar pronta e se perder. Agora a janela
// principal pergunta o estado ao programa algumas vezes no começo.)
;[5000, 15000, 30000].forEach((ms) =>
    setTimeout(async () => {
        if (isOutputWindow()) return
        try {
            const on = !!(await requestMain(Main.PROJETO_LIVE_NDI_VERTICAL_STATE))
            if (on !== quer || (!on && get(outputs)[SAIDA_VERTICAL])) setProjetoLiveNdiVertical(on)
        } catch (err) {
            console.warn("Projeto Live: telão vertical:", err)
        }
    }, ms)
)

// Botão direito na arte > "Versão vertical...": escolhe o arquivo em pé; se já tiver, tira.
const PICK_ID = "pl_versao_vertical"
let escolhendoPara = ""
let ouvindo = false
export function alternarVersaoVertical(caminho: string) {
    if (!caminho) return
    if (versaoVertical(caminho)) {
        definirVersaoVertical(caminho, "")
        return
    }
    if (!ouvindo) {
        ouvindo = true
        receiveToMain(ToMain.OPEN_FILE2, (data: any) => {
            if (data?.id !== PICK_ID || data?.channel !== "MEDIA" || !data.files?.length || !escolhendoPara) return
            const escolhido = typeof data.files[0] === "string" ? data.files[0] : data.files[0]?.path
            if (escolhido && escolhido !== escolhendoPara) definirVersaoVertical(escolhendoPara, escolhido)
            escolhendoPara = ""
        })
    }
    escolhendoPara = caminho
    sendMain(Main.OPEN_FILE, { channel: "MEDIA", id: PICK_ID, filter: { name: "Arte vertical (9:16)", extensions: mediaExtensions }, multiple: false } as any)
}
