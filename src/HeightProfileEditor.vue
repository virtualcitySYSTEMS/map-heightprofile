<template>
  <v-sheet>
    <VcsFormSection
      :heading="`heightProfile.points`"
      :header-actions="[editAction]"
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
    <CollectionComponentStandalone> </CollectionComponentStandalone>
    <div class="d-flex w-full justify-space-between px-2 pt-2 pb-1">
      <VcsFormButton
        icon="$vcsComponentsPlus"
        :disabled="isCreateSession || currentIsPersisted"
        @click="addToWorkspace()"
      />
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
  import {
    computed,
    defineComponent,
    inject,
    onUnmounted,
    provide,
    ref,
  } from 'vue';
  import { VContainer, VSheet } from 'vuetify/components';
  import {
    getDefaultProjection,
    mercatorProjection,
    Projection,
    SessionType,
  } from '@vcmap/core';
  import {
    CollectionComponentStandalone,
    VcsDataTable,
    VcsFormButton,
    VcsFormSection,
    VcsUiApp,
    WindowState,
  } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import {
    createCreateAction,
    createEditAction,
  } from './helper/actionHelper.js';
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
      VSheet,
      VcsFormSection,
      VcsDataTable,
      VcsFormButton,
      VContainer,
      CollectionComponentStandalone,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
    },
    setup(props, { emit, attrs }) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const isCreateSession = computed(
        () => plugin.session.value?.type === SessionType.CREATE,
      );
      const isEditSession = computed(
        () => plugin.session.value?.type === SessionType.EDIT_GEOMETRY,
      );
      const points = ref();
      const feature = (plugin.layer.getFeatureById(props.featureId) ||
        plugin.heightProfileCategory.collection.getByKey(
          props.featureId,
        )) as HeightProfileFeature;

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
        plugin.heightProfileCategory.collection.hasKey(props.featureId),
      );
      if (
        currentIsPersisted.value &&
        plugin.heightProfileCategory.selection.value.length > 0
      ) {
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
          plugin.heightProfileCategory.collection.add(feature);
          emitTitle();
        }
      }

      const workspaceAddedListener =
        plugin.heightProfileCategory.collection.added.addEventListener(
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

      const { action, destroy } = createCreateAction(
        app,
        plugin.layer,
        plugin.session,
        plugin.heightProfileCategory,
      );

      const headers: Array<{ title: string; value: string }> = [
        {
          title: 'heightProfile.pointsMultiple',
          value: 'id',
        },
        {
          title: 'X',
          value: 'x',
        },
        {
          title: 'Y',
          value: 'y',
        },
      ];

      const { action: editAction, destroy: destroyEditAction } =
        createEditAction(app, feature, plugin);

      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        workspaceAddedListener();
        destroyEditAction();
        destroy();
        listeners.forEach((listener) => listener());
      });

      return {
        addToWorkspace,
        headers,
        points,
        action,
        isCreateSession,
        isEditSession,
        currentIsPersisted,
        editAction,
      };
    },
  });
</script>
<style lang="scss" scoped></style>
