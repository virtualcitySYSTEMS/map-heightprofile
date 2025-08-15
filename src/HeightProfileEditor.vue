<template>
  <VcsWorkspaceWrapper
    :disable-add="isCreateSession || currentIsPersisted"
    :disable-new="isCreateSession"
    @add-clicked="addToWorkspace"
    @new-clicked="newProfile"
  >
    <VcsFormSection
      :heading="`heightProfile.points`"
      :header-actions="[editAction]"
    >
      <v-container class="pa-0">
        <VcsDataTable
          item-key="id"
          :headers="headers"
          :show-searchbar="false"
          :items="points"
        />
      </v-container>
    </VcsFormSection>
    <CollectionComponentStandalone />
  </VcsWorkspaceWrapper>
</template>

<script lang="ts">
  import {
    computed,
    defineComponent,
    inject,
    onUnmounted,
    provide,
    ref,
  } from 'vue';
  import { VContainer } from 'vuetify/components';
  import {
    getDefaultProjection,
    mercatorProjection,
    Projection,
    SessionType,
  } from '@vcmap/core';
  import type { VcsUiApp, WindowState } from '@vcmap/ui';
  import {
    CollectionComponentStandalone,
    VcsDataTable,
    VcsFormSection,
    VcsWorkspaceWrapper,
  } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import { createEditAction, createNewProfile } from './helper/actionHelper.js';
  import {
    type HeightProfileFeature,
    resultCollectionComponentSymbol,
  } from './heightProfileFeature.js';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';

  export const windowIdHeightProfileEditor = 'heightProfileEditor_window_id';

  export default defineComponent({
    name: 'HeightProfileEditorComponent',
    components: {
      VContainer,
      VcsDataTable,
      VcsFormSection,
      VcsWorkspaceWrapper,
      CollectionComponentStandalone,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
    },
    emits: ['update-title'],
    setup(props, { emit, attrs }) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const { layer, session, heightProfileCategory: category } = plugin;
      const isCreateSession = computed(
        () => session.value?.type === SessionType.CREATE,
      );
      const points = ref();
      const feature = (layer.getFeatureById(props.featureId) ||
        category.collection.getByKey(props.featureId)) as HeightProfileFeature;

      function setPointsFromFeature(featureItem: HeightProfileFeature): void {
        let count = 0;
        const coords = featureItem.getGeometry()?.getCoordinates() ?? [];
        points.value = coords.map((coord) => {
          const coordP = Projection.transform(
            getDefaultProjection(),
            mercatorProjection,
            coord,
          );
          count += 1;
          return {
            id: `${app.vueI18n.t('heightProfile.point')} ${count}`,
            name: undefined,
            x: coordP[0].toFixed(2),
            y: coordP[1].toFixed(2),
          };
        });
      }

      if (!feature) {
        throw new Error('Feature not found');
      }
      function emitTitle(): void {
        emit('update-title', String(feature.getProperty('name')));
      }
      const currentIsPersisted = ref(
        category.collection.hasKey(props.featureId),
      );
      if (currentIsPersisted.value && category.selection.value.length > 0) {
        if (feature) {
          if ((attrs['window-state'] as WindowState)?.headerTitle) {
            (attrs['window-state'] as WindowState).headerTitle = String(
              feature.getProperty('name'),
            );
          }
        }
      }

      if (feature.getGeometry()) {
        setPointsFromFeature(feature);
      }

      function addToWorkspace(): void {
        if (feature) {
          category.collection.add(feature);
          emitTitle();
        }
      }

      const workspaceAddedListener = category.collection.added.addEventListener(
        (item) => {
          if (feature === item) {
            currentIsPersisted.value = true;
          }
        },
      );

      const collectionComponent = feature[resultCollectionComponentSymbol];

      provide('collectionComponent', collectionComponent);

      const featureListenerGeometry = feature
        .getGeometry()
        ?.on('change', () => {
          setPointsFromFeature(feature);
        });

      const listeners = [
        app.localeChanged.addEventListener(() => {
          setPointsFromFeature(feature);
        }),
      ];

      const headers: Array<{ title: string; value: string }> = [
        { title: 'heightProfile.pointsMultiple', value: 'id' },
        { title: 'X', value: 'x' },
        { title: 'Y', value: 'y' },
      ];

      const { action: editAction, destroy } = createEditAction(
        app,
        feature,
        plugin,
      );

      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        workspaceAddedListener();
        destroy();
        listeners.forEach((listener) => {
          listener();
        });
      });

      return {
        addToWorkspace,
        headers,
        points,
        isCreateSession,
        currentIsPersisted,
        editAction,
        newProfile: createNewProfile.bind(null, app, layer, session, category),
      };
    },
  });
</script>
<style lang="scss" scoped></style>
