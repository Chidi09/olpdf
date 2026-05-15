import { defineComponent, ref, onMounted, onUnmounted, watch, h } from 'vue';
import { OlPDFEmbed } from '@olpdf/embed';
import type { DocumentModel } from '@olpdf/embed';

/**
 * Drop-in OLPDF editor for Vue 3 and Nuxt.
 *
 * @example
 * <!-- In Nuxt, wrap in <ClientOnly> to skip SSR -->
 * <ClientOnly>
 *   <OlpdfEditor
 *     documentId="doc_abc123"
 *     :token="serverToken"
 *     @model-update="save"
 *   />
 * </ClientOnly>
 */
export const OlpdfEditor = defineComponent({
  name: 'OlpdfEditor',

  props: {
    host: { type: String, default: 'https://olpdf.xyz' },
    documentId: { type: String, required: true },
    token: { type: String, required: true },
    class: { type: String, default: 'w-full h-screen' },
  },

  emits: {
    ready: () => true,
    'model-update': (_model: DocumentModel) => true,
    'export-complete': (_url: string) => true,
    'page-added': (_pageIndex: number, _width: number, _height: number) => true,
    'page-removed': (_pageIndex: number) => true,
  },

  setup(props, { emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let editor: OlPDFEmbed | null = null;

    function init() {
      if (!containerRef.value) return;
      editor?.destroy();
      editor = new OlPDFEmbed(containerRef.value, {
        host: props.host,
        documentId: props.documentId,
        token: props.token,
      });
      editor.on('event:ready', () => emit('ready'));
      editor.on<{ documentModel: DocumentModel }>('event:modelUpdate', ({ documentModel }) => emit('model-update', documentModel));
      editor.on<{ url: string }>('event:exportComplete', ({ url }) => emit('export-complete', url));
      editor.on<{ pageIndex: number; width: number; height: number }>('event:pageAdded', ({ pageIndex, width, height }) => emit('page-added', pageIndex, width, height));
      editor.on<{ pageIndex: number }>('event:pageRemoved', ({ pageIndex }) => emit('page-removed', pageIndex));
    }

    onMounted(init);
    watch(() => [props.documentId, props.token], init);
    onUnmounted(() => editor?.destroy());

    return () =>
      h('div', {
        ref: containerRef,
        class: props.class,
        style: 'overflow:hidden',
      });
  },
});

export default OlpdfEditor;

// Plugin for app.use(OlpdfPlugin)
export const OlpdfPlugin = {
  install(app: { component: (name: string, component: unknown) => void }) {
    app.component('OlpdfEditor', OlpdfEditor);
  },
};
