<template>
  <AbstractConfigEditor v-bind="{ ...$attrs, ...$props }" @submit="apply">
    <v-container class="pa-1">
      <v-row no-gutters>
        <v-col cols="6">
          <VcsLabel html-for="decimalPlaces">{{
            $t('heightProfile.config.decimalPlaces')
          }}</VcsLabel>
        </v-col>
        <v-col cols="6" class="gc-2 d-flex">
          <span class="d-flex align-center">
            {{ localConfig.decimalPlaces }}
          </span>
          <VcsSlider
            id="decimalPlaces"
            v-model.number="localConfig.decimalPlaces"
            step="1"
            min="0"
            max="3"
          />
        </v-col>
      </v-row>
    </v-container>
  </AbstractConfigEditor>
</template>

<script lang="ts">
  import type { PropType } from 'vue';
  import { defineComponent, ref, toRaw } from 'vue';
  import { VCol, VContainer, VRow } from 'vuetify/components';
  import { AbstractConfigEditor, VcsLabel, VcsSlider } from '@vcmap/ui';
  import type { HeightProfileConfig } from './index.js';
  import { getDefaultOptions } from './index.js';

  export default defineComponent({
    name: 'HeightProfileConfigEditor',
    components: {
      AbstractConfigEditor,
      VCol,
      VContainer,
      VRow,
      VcsLabel,
      VcsSlider,
    },
    props: {
      getConfig: {
        type: Function as PropType<() => HeightProfileConfig>,
        required: true,
      },
      setConfig: {
        type: Function as PropType<(config: object | undefined) => void>,
        required: true,
      },
    },
    setup(props) {
      const config: HeightProfileConfig = props.getConfig();
      const localConfig = ref({ ...getDefaultOptions(), ...config });

      function apply(): void {
        props.setConfig(structuredClone(toRaw(localConfig.value)));
      }
      return { localConfig, apply };
    },
  });
</script>
