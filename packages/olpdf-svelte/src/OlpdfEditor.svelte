<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { OlPDFEmbed } from '@olpdf/embed';
  import type { DocumentModel } from '@olpdf/embed';

  /** Your OLPDF instance host. Defaults to https://olpdf.xyz */
  export let host: string = 'https://olpdf.xyz';
  /** The document ID to load */
  export let documentId: string;
  /** Short-lived embed token from your backend */
  export let token: string;
  /** CSS class for the container div */
  export let className: string = 'w-full h-screen';

  /** Dispatched on every AST edit */
  export let onModelUpdate: ((model: DocumentModel) => void) | undefined = undefined;
  /** Dispatched when an export finishes */
  export let onExportComplete: ((url: string) => void) | undefined = undefined;
  /** Dispatched when the editor is ready */
  export let onReady: (() => void) | undefined = undefined;

  let container: HTMLDivElement;
  let editor: OlPDFEmbed | undefined;

  onMount(() => {
    editor = new OlPDFEmbed(container, { host, documentId, token });
    editor.on('READY', () => onReady?.());
    editor.on('MODEL_UPDATE', ({ documentModel }) => onModelUpdate?.(documentModel));
    editor.on('EXPORT_COMPLETE', ({ url }) => onExportComplete?.(url));
  });

  // Re-initialise if documentId or token change at runtime
  $: if (editor && (documentId || token)) {
    editor.destroy();
    editor = new OlPDFEmbed(container, { host, documentId, token });
    editor.on('MODEL_UPDATE', ({ documentModel }) => onModelUpdate?.(documentModel));
  }

  onDestroy(() => editor?.destroy());
</script>

<!--
  @component
  Drop-in OLPDF editor for Svelte and SvelteKit.

  @example
  <script>
    import OlpdfEditor from '@olpdf/svelte';
  </script>
  <OlpdfEditor
    documentId="doc_abc123"
    token={serverToken}
    onModelUpdate={(model) => save(model)}
  />
-->
<div bind:this={container} class={className} style="overflow:hidden" />
