<template>
  <div>
    <VcsHelp
      v-if="!creationFinished"
      :text="$t('heightProfile.initialMessage')"
      :show="true"
    ></VcsHelp>
    <HeightProfileEditor
      v-if="featureId"
      :feature-id="featureId"
      @update-title="updateTitle"
    />
  </div>
</template>
<script lang="ts">
  import { defineComponent, inject, onUnmounted, PropType, ref } from 'vue';
  import { VcsHelp, VcsUiApp, WindowState } from '@vcmap/ui';
  import { SessionType } from '@vcmap/core';
  import { getLogger } from '@vcsuite/logger';
  import { name } from '../package.json';
  import HeightProfileEditor from './HeightProfileEditor.vue';
  import { HeightProfilePlugin } from './index.js';

  export default defineComponent({
    name: 'CreateProfileFeatureWrapper',
    components: {
      VcsHelp,
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
      const creationFinished = ref(false);
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

        const sessionFinishedListener =
          session.creationFinished.addEventListener(() => {
            creationFinished.value = true;
          });

        const sessionStoppedListener = session.stopped.addEventListener(() => {
          if (!featureId.value) {
            emit('close');
          }
        });

        onUnmounted(() => {
          if (creationFinished.value === false) {
            session.stop();
          }
          sessionListener();
          sessionFinishedListener();
          sessionStoppedListener();
        });
      }

      const updateTitle = (title: string): void => {
        windowState.headerTitle = title;
      };

      return {
        featureId,
        updateTitle,
        creationFinished,
      };
    },
  });
</script>
<style scoped lang="scss"></style>
