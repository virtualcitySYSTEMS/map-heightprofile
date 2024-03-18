<template>
  <v-sheet>
    <VcsFormSection
      :heading="`heightProfile.points`"
      :header-actions="editActions"
    >
      <v-container class="pa-0">
        <vcs-data-table
          item-key="id"
          :headers="headers"
          :show-searchbar="false"
          :items="points"
        >
        </vcs-data-table
      ></v-container>
    </VcsFormSection>
    <HeightProfileCollection
      :feature-id="featureId"
      owner="Test"
      :parent-id="windowIdHeightProfile"
    />
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton icon="$vcsComponentsPlus" :disabled="isCreateSession" />
      <VcsFormButton
        variant="filled"
        :id="action.name"
        :disabled="isCreateSession"
        :tooltip="action.title"
        @click.stop="action.callback($event)"
      >
        {{ $t('heightProfile.new') }}
      </VcsFormButton>
    </div>
  </v-sheet>
</template>
<script lang="ts">
  import { defineComponent, inject, ref, onUnmounted, computed } from 'vue';
  import { VSheet, VContainer } from 'vuetify/lib';
  import { SessionType, getFlatCoordinatesFromGeometry } from '@vcmap/core';
  import {
    VcsDataTable,
    VcsFormSection,
    VcsFormButton,
    VcsUiApp,
  } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import { HeightProfileResult, createAction } from './setup.js';
  import { createHeightProfileCalculation } from './calculationHelper.js';
  import HeightProfileCollection from './HeightProfileCollection.vue';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';

  export const windowIdHeightProfile = 'heightProfileEditor_window_id';
  export default defineComponent({
    name: 'HeightProfileEditorComponent',
    components: {
      VSheet,
      VcsFormSection,
      VcsDataTable,
      VcsFormButton,
      VContainer,
      HeightProfileCollection,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
    },
    setup(props) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const isCreateSession = computed(
        () => plugin.session.value?.type === SessionType.CREATE,
      );
      const isEditSession = computed(
        () => plugin.session.value?.type === SessionType.EDIT_GEOMETRY,
      );
      const points = ref();

      const feature = plugin.layer.getFeatureById(props.featureId);
      if (!feature) {
        throw new Error('Feature not found');
      }

      const results = ref<HeightProfileResult[]>(
        (feature.get('results') as HeightProfileResult[] | undefined) ?? [],
      );
      const featureListenerGeometry = feature
        .getGeometry()
        ?.on('change', () => {
          const geometry = feature.getGeometry();
          const coords = getFlatCoordinatesFromGeometry(geometry!);
          const positions = [];
          for (const coord of coords) {
            if (coord) {
              positions.push({
                id: `Punkt ${positions.length + 1}`,
                name: undefined,
                x: coord[0].toFixed(2),
                y: coord[1].toFixed(2),
                z: coord[2].toFixed(2),
              });
            }
          }

          points.value = positions;
        });

      const featureListenerProperty = feature.on('propertychange', (event) => {
        if (event.key === 'results') {
          results.value = feature.get('results') as HeightProfileResult[];
        }
      });

      const { action, destroy } = createAction(
        app,
        plugin.layer,
        plugin.session,
      );

      const headers: Array<{ text: string; value: string }> = [
        {
          text: 'heightProfile.pointsMultiple',
          value: 'id',
        },
        {
          text: 'X',
          value: 'x',
        },
        {
          text: 'Y',
          value: 'y',
        },
        {
          text: 'Z',
          value: 'z',
        },
      ];

      const editActions = ref([
        {
          name: 'editAction',
          icon: '$vcsEditVertices',
          title: 'heightProfile.edit',
          disabled: isCreateSession,
          active: isEditSession,
          callback(): void {},
        },
      ]);

      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        unByKey(featureListenerProperty);
        destroy();
      });

      return {
        createHeightProfileCalculation,
        headers,
        points,
        action,
        isCreateSession,
        isEditSession,
        editActions,
        windowIdHeightProfile,
      };
    },
  });
</script>
<style lang="scss" scoped></style>
