<template>
  <HeightProfileEditor
    v-if="featureId"
    :feature-id="featureId"
    @update-title="updateTitle"
  />
  <v-row v-else no-gutters class="py-0 px-1">
    <v-col>{{ $t('heightProfile.initialMessage') }} </v-col>
  </v-row>
</template>
<script lang="ts">
  import { defineComponent, inject, onUnmounted, PropType, ref } from 'vue';
  import { VCol, VRow } from 'vuetify/lib';
  import { VcsUiApp, WindowState } from '@vcmap/ui';
  import { SessionType } from '@vcmap/core';
  import { getLogger } from '@vcsuite/logger';
  import { name } from '../package.json';
  import HeightProfileEditor from './HeightProfileEditor.vue';
  import { HeightProfilePlugin } from './index.js';

  export const HeightProfileWrapperId = 'heightProfileWrapper_window_id';
  export default defineComponent({
    name: 'CreateProfileFeatureWrapper',
    components: {
      VRow,
      VCol,
      HeightProfileEditor,
    },
    props: {
      windowState: {
        type: Object as PropType<WindowState>,
        default: () => ({}),
      },
    },
    setup(props, { emit }) {
      const { windowState } = props;
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const featureId = ref<string | undefined>();

      const session = plugin.session.value;

      if (session?.type !== SessionType.CREATE) {
        getLogger(name).error('could not find Create Session');
        emit('close');
      } else {
        const sessionListener = session.featureCreated.addEventListener(
          (feature) => {
            featureId.value = feature.getId() as string;
          },
        );
        onUnmounted(sessionListener);
      }

      const updateTitle = (title: string): void => {
        windowState.headerTitle = title;
      };

      return {
        featureId,
        updateTitle,
      };
    },
  });
</script>
<style scoped lang="scss"></style>
