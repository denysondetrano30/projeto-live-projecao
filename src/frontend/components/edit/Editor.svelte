<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../types/Tabs"
    import { activeEdit, activePopup, activeShow, cloudUsers, drawer, drawerOpenedInEdit, editMode, focusMode, refreshEditSlide, showsCache, slideNotesActive, special } from "../../stores"
    import { isActiveShowInUseByCloudUser } from "../../utils/cloudSync"
    import { getAccess } from "../../utils/profile"
    import Icon from "../helpers/Icon.svelte"
    import { getLayoutRef } from "../helpers/show"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Splash from "../main/Splash.svelte"
    import Tabs from "../main/Tabs.svelte"
    import TextEditor from "../show/TextEditor.svelte"
    import AudioEditor from "./editors/AudioEditor.svelte"
    import CameraEditor from "./editors/CameraEditor.svelte"
    import EffectEditor from "./editors/EffectEditor.svelte"
    import MediaEditor from "./editors/MediaEditor.svelte"
    import OverlayEditor from "./editors/OverlayEditor.svelte"
    import SceneEditor from "./editors/SceneEditor.svelte"
    import SlideEditor from "./editors/SlideEditor.svelte"
    import TemplateEditor from "./editors/TemplateEditor.svelte"
    import ItemAddMenu from "./ItemAddMenu.svelte"
    import { getSlideChords } from "./scripts/chords"
    import { getSlideText } from "./scripts/textStyle"
    import SomunEditor from "./SomunEditor.svelte"
    import { layoutClassico, plEditorCompleto } from "../../utils/projetoLiveLayout"
    import { voltarPara } from "../../utils/projetoLiveEditor"

    // somun tela (28/11): Editor único no lugar do editor do slide e do antigo "Padrões"
    $: unico = !$layoutClassico && !$plEditorCompleto
    function voltarAoEditor() {
        const antes = $voltarPara
        voltarPara.set(null)
        plEditorCompleto.set(false)
        if (antes) activeEdit.set(antes)
    }

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""
    $: currentShow = $showsCache[currentShowId]
    $: ref = getLayoutRef(currentShowId, currentShow)
    $: Slide = currentShow?.slides && $activeEdit.slide != null ? currentShow.slides[ref[$activeEdit.slide]?.id] : null

    $: profile = getAccess("shows")
    $: isLocked = currentShow?.locked || Slide?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

    $: chordCount = Slide ? getSlideChords(Slide).length : 0

    // no need to add chords on scripture/events
    $: chordsHidden = !!currentShow?.reference?.type
    $: chordsDisabled = !Slide || isLocked || (chordCount < 1 && !getSlideText(Slide))

    $: if ($editMode === "chords" && (chordsHidden || chordsDisabled)) editMode.set("default")

    $: if ($refreshEditSlide) {
        setTimeout(() => refreshEditSlide.set(false), 100)
    }

    // TODO: could add more tabs, like to edit slide layers (like background media)
    $: editTabs = {
        default: { name: "tools.slide", icon: "slide" }, // example.default
        ...(!chordsHidden && { chords: { name: "edit.chords", icon: "chords", data: chordCount > 0 ? chordCount : undefined, disabled: chordsDisabled } }),
        text_edit: { name: "show.text", tooltip: "show.text [Ctrl+Shift+T]", icon: "text_edit" }
    } as TabsObj

    onMount(() => {
        // close drawer
        if (!$drawerOpenedInEdit) {
            const minHeight = 40
            if ($drawer.height > minHeight) drawer.set({ height: minHeight, stored: $drawer.height, autoclosed: true })
        }

        // mainly for overlay preview
        if ($activeShow?.id && ($activeShow.type || "show") !== "show" && (!$activeEdit.id || $activeEdit.type === $activeShow.type)) {
            activeEdit.set({ id: $activeShow.id, type: $activeShow.type, items: [] } as any)
        }
    })

    let hideCloudConflict = false
</script>

<div class="editor">
    {#key $refreshEditSlide}
        {#if $activeEdit.type === "overlay"}
            <OverlayEditor />

            <ItemAddMenu />
        {:else if $activeEdit.type === "template"}
            {#if $voltarPara && !$layoutClassico}
                <button class="plVoltar" on:click={voltarAoEditor}>← Voltar ao Editor</button>
            {/if}
            <TemplateEditor />

            <ItemAddMenu />
        {:else if $activeEdit.type === "scene"}
            <SceneEditor />
        {:else if $activeEdit.type === "effect"}
            <EffectEditor />

            <FloatingInputs gradient style="width: 50px;height: 50px;border: none;">
                <MaterialButton
                    class="addButton"
                    title="edit.add_items"
                    style="width: 50px;height: 50px;"
                    on:click={() => {
                        activePopup.set("effect_items")
                        // const currentEffect = $effects[$activeEdit.id || ""] || {}
                        // const nextIndex = currentEffect?.items?.length || 0
                        // if (!openedMenus[nextIndex]) openedMenus[nextIndex] = true
                    }}
                >
                    <Icon id="add" size={1.5} white />
                </MaterialButton>
            </FloatingInputs>
        {:else if $activeEdit.type === "media"}
            <MediaEditor />
        {:else if $activeEdit.type === "camera"}
            {#key $activeEdit.id}
                <CameraEditor />
            {/key}
        {:else if $activeEdit.type === "audio"}
            <AudioEditor />
        {:else if $activeEdit.slide !== undefined}
            {#if !hideCloudConflict && isActiveShowInUseByCloudUser({ $activeShow, $cloudUsers })}
                <div class="darken">
                    <p style="text-align: center;font-size: 1.5em;display: block;background-color: black;padding: 10px;border-radius: 4px;">
                        Currently in use on another computer!<br />
                        <MaterialButton variant="outlined" icon="check" on:click={() => (hideCloudConflict = true)} />
                    </p>
                </div>
            {/if}

            {#if !$focusMode}
                <Tabs tabs={editTabs} bind:active={$editMode} />
            {/if}

            <div class="content">
                {#if $editMode === "text_edit" && !$focusMode}
                    <TextEditor currentShow={$showsCache[$activeShow?.id || ""]} />
                {:else if $editMode === "default" && unico}
                    <SomunEditor />
                {:else}
                    {#if $plEditorCompleto && !$layoutClassico}
                        <button class="plVoltar" on:click={voltarAoEditor}>← Voltar ao Editor</button>
                    {/if}
                    <SlideEditor />

                    {#if $editMode === "default" && !$slideNotesActive && !$special.slideTimelineActive && !$focusMode}
                        <ItemAddMenu {isLocked} />
                    {/if}
                {/if}
            </div>
        {:else if !$layoutClassico}
            <!-- nada aberto: o Editor mostra a aparência da Bíblia e das músicas com um exemplo -->
            <SomunEditor />
        {:else}
            <Splash />
        {/if}
    {/key}
</div>

<style>
    .editor {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .plVoltar {
        align-self: flex-start;
        margin: 6px 10px;
        padding: 5px 12px;
        border-radius: 7px;
        border: 1px solid #3a3a3a;
        background: #1c1c1c;
        color: var(--text);
        font-family: inherit;
        cursor: pointer;
        z-index: 5;
    }

    .darken {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        background-color: rgba(0, 0, 0, 0.5);

        display: flex;
        align-items: center;
        justify-content: center;

        z-index: 200;
    }
</style>
