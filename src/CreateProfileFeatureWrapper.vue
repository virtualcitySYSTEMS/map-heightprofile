<template>
  <HeightProfileEditor v-if="featureId" :feature-id="featureId" />
  <v-row v-else no-gutters class="py-0 px-1">
    <v-col>{{ $t('heightProfile.initialMessage') }} </v-col>
  </v-row>
</template>
<script lang="ts">
  import { defineComponent, inject, onUnmounted, ref } from 'vue';
  import { VCol, VRow } from 'vuetify/lib';
  import { VcsUiApp } from '@vcmap/ui';
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
    setup(_p, { emit }) {
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

      return {
        featureId,
      };
    },
  });
</script>
<style scoped lang="scss"></style>
