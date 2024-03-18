<template>
  <VcsFormSection :heading="title" start-open :header-actions="actions">
    <v-container class="py-0 px-0">
      <v-sheet v-if="items.length < 1" class="ma-2 pl-2">
        {{ $t('heightProfile.title') }}
      </v-sheet>
      <VcsList
        v-else
        :items="items"
        :selectable="selectable"
        :show-title="false"
        v-model="selected"
      >
      </VcsList>
    </v-container>
  </VcsFormSection>
</template>
<script lang="ts">
  import { Ref, defineComponent, inject, onUnmounted, ref } from 'vue';
  import { VContainer, VSheet } from 'vuetify/lib';
  import { CesiumMap, Collection } from '@vcmap/core';
  import {
    VcsUiApp,
    VcsFormSection,
    VcsList,
    CollectionComponentClass,
    VcsAction,
    vcsAppSymbol,
    WindowSlot,
    VcsListItem,
    type WindowComponentOptions,
  } from '@vcmap/ui';
  import { Scene } from '@vcmap-cesium/engine';
  import { name } from '../package.json';
  import HeightProfileParameterComponent, {
    windowIdSetParameter,
  } from './SetParameterComponent.vue';

  import type { HeightProfilePlugin } from './index.js';
  import { HeightProfileResult } from './setup.js';

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

  export default defineComponent({
    name: 'CollectionComponent',
    components: {
      VContainer,
      VSheet,
      VcsFormSection,
      VcsList,
    },
    props: {
      featureId: {
        type: String,
        required: true,
      },
      parentId: {
        type: String,
        default: undefined,
      },
      owner: {
        type: [String, Symbol],
        default: vcsAppSymbol,
      },
    },
    setup({ featureId, owner, parentId }, { emit }) {
      const app = inject<VcsUiApp>('vcsApp')!;
      const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
      const feature = plugin.layer.getFeatureById(featureId);
      const selected = ref([]) as Ref<VcsListItem[]>;

      const collection = feature?.get(
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
          owner,
        );

      const contentComponent = {
        id: windowIdSetParameter,
        parentId,
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
        },
      };

      let scene: Scene | undefined;
      if (app.maps.activeMap instanceof CesiumMap) {
        scene = app.maps.activeMap.getScene();
      }

      onUnmounted(() => {
        collectionComponent.destroy();
      });

      if (scene) {
        const addAnchorAction = createAddHeightProfileAction(
          contentComponent,
          app,
        );

        collectionComponent.addActions([
          {
            action: addAnchorAction,
            owner,
          },
          {
            action: {
              name: 'list.selectAll',
              callback(): void {
                const currentSelection = [...selected.value];
                selected.value = collectionComponent.items.value.filter(
                  (item) => !item.disabled,
                );
                selected.value.forEach((item: VcsListItem) => {
                  if (
                    item.selectionChanged &&
                    !currentSelection.includes(item)
                  ) {
                    item.selectionChanged(true);
                  }
                });
                emit('input', selected.value);
              },
            },
            owner,
          },
          {
            action: {
              name: 'list.clearSelection',
              callback(): void {
                [...selected.value].forEach((item: VcsListItem) => {
                  if (item.selectionChanged) {
                    item.selectionChanged(false);
                  }
                });
                selected.value = [];
                emit('input', selected.value);
              },
            },
            owner,
          },
        ]);
      }
      return {
        selected,
        title: collectionComponent.title,
        items: collectionComponent.items,
        selectable: collectionComponent.selectable,
        actions: collectionComponent.getActions(),
      };
    },
  });
</script>
<style scoped lang="scss"></style>
