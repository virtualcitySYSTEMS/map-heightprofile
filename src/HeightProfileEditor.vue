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
    defineComponent,
    inject,
    ref,
    onUnmounted,
    computed,
    provide,
    watch,
    nextTick,
  } from 'vue';
  import { VSheet, VContainer } from 'vuetify/lib';
  import {
    Collection,
    SessionType,
    getFlatCoordinatesFromGeometry,
    getDefaultProjection,
    Projection,
    mercatorProjection,
  } from '@vcmap/core';
  import {
    VcsDataTable,
    VcsFormSection,
    VcsFormButton,
    VcsUiApp,
    CollectionComponentClass,
    CollectionComponentStandalone,
    WindowSlot,
    VcsAction,
    WindowComponentOptions,
    CollectionComponentListItem,
  } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import Feature from 'ol/Feature.js';
  import {
    HeightProfileResult,
    createCreateAction,
    getHeightProfileEditorId,
    createEditAction,
  } from './setup.js';
  import { name } from '../package.json';
  import type { HeightProfilePlugin } from './index.js';
  import HeightProfileParameterComponent, {
    windowIdSetParameter,
  } from './HeightProfileParameterComponent.vue';
  import { windowIdGraph } from './chart.js';
  import GraphComponent from './GraphComponent.vue';

  export function createGraphComponentOptions(
    props: {
      featureId: string;
      resultNames: string[];
    },
    collection: Collection<HeightProfileResult>,
    parentId: string,
  ): WindowComponentOptions {
    return {
      id: windowIdGraph,
      parentId,
      component: GraphComponent,
      slot: WindowSlot.DYNAMIC_CHILD,
      position: {
        left: '35%',
        right: '35%',
        top: '10%',
      },
      state: {
        headerTitle: 'heightProfile.title',
      },
      props,
      provides: {
        collection,
      },
    };
  }
  function createAddHeightProfileAction(
    contentComponent: WindowComponentOptions,
    app: VcsUiApp,
  ): VcsAction {
    return {
      name: 'heightProfile.collection.add',
      title: 'heightProfile.collection.add',
      icon: '$vcsPlus',
      callback(): void {
        app.windowManager.add(contentComponent, name);
      },
    };
  }

  function setupCollectionComponent(
    app: VcsUiApp,
    feature: Feature,
    featureId: string,
  ): {
    destroy: () => void;
    collectionComponent: CollectionComponentClass<HeightProfileResult>;
  } {
    const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
    const windowIdHeightProfile = getHeightProfileEditorId(
      plugin.heightProfileCategory,
    );
    const collection = feature.get(
      'results',
    ) as Collection<HeightProfileResult>;

    const collectionComponent: CollectionComponentClass<HeightProfileResult> =
      new CollectionComponentClass(
        {
          id: 'heightProfileCollection',
          title: 'heightProfile.calcResults',
          draggable: false,
          renamable: true,
          removable: true,
          selectable: true,
          collection,
        },
        name,
      );

    const contentComponent = {
      id: windowIdSetParameter,
      parentId: windowIdHeightProfile,
      component: HeightProfileParameterComponent,
      slot: WindowSlot.DYNAMIC_CHILD,
      state: {
        headerTitle: 'heightProfile.title',
      },
      props: {
        featureId,
      },
      provides: {
        collection,
        collectionComponent,
      },
    };

    const addAnchorAction = createAddHeightProfileAction(contentComponent, app);

    collectionComponent.addActions([
      {
        action: addAnchorAction,
        owner: name,
      },
    ]);

    function showGraphAction(
      item: HeightProfileResult,
      listItem: CollectionComponentListItem,
    ): VcsAction {
      return {
        name: 'heightProfile.graphAction',
        title: 'heightProfile.graphAction',
        callback(): void {
          const props = {
            featureId,
            resultNames: [item.name],
          };
          if (!app.windowManager.has(windowIdGraph)) {
            app.windowManager.add(
              createGraphComponentOptions(
                props,
                collection,
                windowIdHeightProfile,
              ),
              name,
            );
          }
          if (
            !collectionComponent.selection.value.find(
              (l) => l.name === listItem.name,
            )
          ) {
            collectionComponent.selection.value = [
              listItem,
              ...collectionComponent.selection.value,
            ];
          }
        },
      };
    }

    collectionComponent.addItemMapping({
      mappingFunction: (item, _c, listItem) => {
        listItem.actions = [
          ...listItem.actions,
          showGraphAction(item, listItem),
        ];
      },
      owner: name,
    });

    const selectionWatcher = watch(
      collectionComponent.selection,
      async (newValue, oldValue) => {
        if (newValue !== oldValue) {
          const names = [];
          for (const item of newValue) {
            names.push(item.name);
          }
          app.windowManager.remove(windowIdGraph);

          const props = {
            featureId,
            resultNames: names,
          };
          await nextTick();
          if (names.length > 0) {
            app.windowManager.add(
              createGraphComponentOptions(
                props,
                collection,
                windowIdHeightProfile,
              ),
              name,
            );
          }
        }
      },
    );

    return {
      destroy: (): void => {
        selectionWatcher();
        collectionComponent.destroy();
      },
      collectionComponent,
    };
  }

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
      const feature =
        plugin.layer.getFeatureById(props.featureId) ||
        plugin.heightProfileCategory.collection.getByKey(props.featureId)
          ?.feature;
      if (!feature) {
        throw new Error('Feature not found');
      }
      const currentIsPersisted = ref(
        plugin.heightProfileCategory.collection.hasKey(props.featureId),
      );

      if (feature.getGeometry()) {
        const coords = getFlatCoordinatesFromGeometry(feature.getGeometry()!);
        const positions = [];
        for (const coord of coords) {
          if (coord) {
            const coordP = Projection.transform(
              getDefaultProjection(),
              mercatorProjection,
              coord,
            );
            positions.push({
              id: `Punkt ${positions.length + 1}`,
              name: undefined,
              x: coordP[0].toFixed(2),
              y: coordP[1].toFixed(2),
            });
          }
        }
        points.value = positions;
      }

      function addToWorkspace(): void {
        if (feature) {
          plugin.heightProfileCategory.collection.add({
            name: feature.getId() as string,
            feature,
          });
        }
      }

      const workspaceAddedListener =
        plugin.heightProfileCategory.collection.added.addEventListener(
          (item) => {
            if (feature === item.feature) {
              currentIsPersisted.value = true;
            }
          },
        );

      const { collectionComponent, destroy: destroyCollectionComponent } =
        setupCollectionComponent(app, feature, props.featureId);

      provide('collectionComponent', collectionComponent);

      const featureListenerGeometry = feature
        .getGeometry()
        ?.on('change', () => {
          const geometry = feature.getGeometry();
          const coords = getFlatCoordinatesFromGeometry(geometry!);
          const positions = [];
          for (const coord of coords) {
            if (coord) {
              const coordP = Projection.transform(
                getDefaultProjection(),
                mercatorProjection,
                coord,
              );
              positions.push({
                id: `Punkt ${positions.length + 1}`,
                name: undefined,
                x: coordP[0].toFixed(2),
                y: coordP[1].toFixed(2),
              });
            }
          }

          points.value = positions;
        });

      const { action, destroy } = createCreateAction(
        app,
        plugin.layer,
        plugin.session,
        plugin.heightProfileCategory,
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
      ];

      const { action: editAction, destroy: destroyEditAction } =
        createEditAction(app, feature, plugin);
      const editActions = ref([editAction]);

      onUnmounted(() => {
        unByKey(featureListenerGeometry!);
        workspaceAddedListener();
        destroyEditAction();
        destroy();
        destroyCollectionComponent();
      });

      return {
        addToWorkspace,
        headers,
        points,
        action,
        isCreateSession,
        isEditSession,
        currentIsPersisted,
        editActions,
      };
    },
  });
</script>
<style lang="scss" scoped></style>
