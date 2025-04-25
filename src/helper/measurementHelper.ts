import type { VcsUiApp } from '@vcmap/ui';
import type { Collection } from '@vcmap/core';
import { Projection } from '@vcmap/core';
import Feature from 'ol/Feature';
import { LineString } from 'ol/geom';
import { Stroke, Style } from 'ol/style';
import type { Ref } from 'vue';
import type { ChartObject, ChartMeasurement, SeriesEntry } from 'apexcharts';
import { getLogger } from '@vcsuite/logger';
import type { HeightProfileResult } from '../setupResultCollectionComponent.js';
import type { HeightProfilePlugin } from '../index.js';
import { name } from '../../package.json';

export const measureColor = '#FF0000';

export function calcSideLength(
  p1: [number, number],
  p2: [number, number],
): [number, number, number] {
  const p3: [number, number] = [p1[0], p2[1]];

  const side1 = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
  const side2 = Math.sqrt((p3[0] - p1[0]) ** 2 + (p3[1] - p1[1]) ** 2);
  const side3 = Math.sqrt((p2[0] - p3[0]) ** 2 + (p2[1] - p3[1]) ** 2);

  return [side1, side2, side3];
}

export function createPointAnnotation(
  x: number,
  y: number,
  text: string,
  chartContext: ChartObject,
): void {
  const annotation = {
    x,
    y,
    label: {
      borderColor: measureColor,
      style: {
        color: '#fff',
        background: measureColor,
      },
      text,
    },
  };
  chartContext.addPointAnnotation(annotation, false);
}

function addTriangleToChartContext(
  app: VcsUiApp,
  values: [number, number][],
  series: SeriesEntry[],
  chartContext: ChartObject,
  measurementActive: Ref<boolean>,
): () => void {
  const points = [
    [values[0][0], values[1][1]],
    [values[0][0], values[0][1]],
    [values[1][0], values[1][1]],
    [values[0][0], values[1][1]],
  ] as Array<[number, number]>;

  const seriesElement = {
    name: app.vueI18n.t('heightProfile.measureLine'),
    id: 'measurements',
    data: points,
    color: measureColor,
    zIndex: 99,
  };
  series.push(seriesElement);

  chartContext.updateSeries(series).catch(() => {
    getLogger(name).error('failed to update series');
  });
  const iconStart = document.querySelector('.custom-icon-start');
  if (iconStart) {
    iconStart.classList.remove('primary--text');
    measurementActive.value = false;
  }

  if (values.length === 2) {
    const sides = calcSideLength(values[0], values[1]);
    createPointAnnotation(
      (values[1][0] - values[0][0]) / 2 + values[0][0],
      values[1][1],
      sides[2].toFixed(2),
      chartContext,
    );
    createPointAnnotation(
      values[0][0],
      (values[1][1] - values[0][1]) / 2 + values[0][1],
      sides[1].toFixed(2),
      chartContext,
    );
    createPointAnnotation(
      (values[1][0] - values[0][0]) / 2 + values[0][0],
      (values[1][1] - values[0][1]) / 2 + values[0][1],
      sides[0].toFixed(2),
      chartContext,
    );
  }
  return () => {
    const indexToRemove = series.indexOf(seriesElement);
    if (indexToRemove !== -1) {
      series.splice(indexToRemove, 1);
    }
    if (
      chartContext &&
      chartContext.updateSeries &&
      document.querySelector('#apexChartId')
    ) {
      chartContext.updateSeries(series).catch(() => {
        getLogger(name).error('failed to update series');
      });
    }
  };
}

function addChartMeasurementFeature(
  plugin: HeightProfilePlugin,
  points: Array<[number, number]>,
  series: Array<{
    name: string;
    data: Array<[number, number]>;
    id?: string | undefined;
    color?: string | undefined;
    zIndex?: number | undefined;
  }>,
  results: Collection<HeightProfileResult>,
): () => void {
  const mapPoints = [
    [points[0][0], points[1][1]],
    [points[0][0], points[0][1]],
    [points[1][0], points[1][1]],
    [points[0][0], points[1][1]],
  ] as Array<[number, number]>;
  const position = mapPoints
    .map(
      (value) =>
        results.getByKey(series[0].id)?.resultPoints[
          value[0] / (results.getByKey(series[0].id)?.resolution ?? 0)
        ],
    )
    .filter((point) => point !== undefined);

  plugin.measurementLayer.removeAllFeatures();

  const feature: Feature = new Feature({
    geometry: new LineString([
      Projection.wgs84ToMercator(position[0]),
      Projection.wgs84ToMercator([
        position[1][0],
        position[1][1],
        position[2][2],
      ]),
      Projection.wgs84ToMercator(position[2]),
      Projection.wgs84ToMercator(position[3]),
    ]),
    olcs_altitudeMode: 'absolute',
  });
  const style: Style = new Style({
    stroke: new Stroke({
      color: measureColor,
      width: 3,
    }),
  });

  feature.setStyle(style);
  feature.setId('_measurement');
  plugin.measurementLayer.addFeatures([feature]);

  return (): void => {
    plugin.measurementLayer.removeFeaturesById(['_measurement']);
  };
}

function createMeasurementPointAnnotation(
  values: [number, number][],
  app: VcsUiApp,
  chartContext: ChartObject,
): void {
  createPointAnnotation(
    values[values.length - 2][0],
    values[values.length - 2][1],
    `${String(app.vueI18n.t('heightProfile.point'))}-${values.length - 1}`,
    chartContext,
  );
  createPointAnnotation(
    values[values.length - 1][0],
    values[values.length - 1][1],
    `${String(app.vueI18n.t('heightProfile.point'))}-${values.length}`,
    chartContext,
  );
}

export function startChartMeasurement(
  app: VcsUiApp,
  chartContext: ChartObject,
  series: SeriesEntry[],
  results: Collection<HeightProfileResult>,
  measurementActive: Ref<boolean>,
  initialValue?: [number, number],
): ChartMeasurement {
  const values: [number, number][] = [];

  let finished = false;

  let destroy = (): void => {};
  let destroyMeasurementLayer = (): void => {};

  const measurement = {
    get finished(): boolean {
      return finished;
    },
    get values(): [number, number][] {
      return values;
    },
    addValue(value: [number, number]): void {
      if (finished) {
        throw new Error('Measurement already finished');
      }
      createPointAnnotation(
        value[0],
        value[1],
        `${String(app.vueI18n.t('heightProfile.point'))}-${values.length + 1}`,
        chartContext,
      );
      values.push(value);

      finished = values.length === 2;
      if (finished) {
        destroy = addTriangleToChartContext(
          app,
          values,
          series,
          chartContext,
          measurementActive,
        );
        createMeasurementPointAnnotation(values, app, chartContext);

        const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
        destroyMeasurementLayer = addChartMeasurementFeature(
          plugin,
          values,
          series,
          results,
        );
      }
    },
    destroy(): void {
      finished = true;
      destroy();
      destroyMeasurementLayer();
      if (
        chartContext &&
        chartContext.clearAnnotations &&
        document.querySelector('#apexChartId')
      ) {
        chartContext.clearAnnotations();
      }

      values.splice(0);
    },
  };

  if (initialValue) {
    measurement.addValue(initialValue);
  }
  return measurement;
}

export function addMeasurementAnnotationsToGraph(
  values: [number, number][],
  chartContext: ChartObject,
  app: VcsUiApp,
): void {
  if (values.length === 2) {
    const side = calcSideLength(values[0], values[1]);
    createPointAnnotation(
      (values[1][0] - values[0][0]) / 2 + values[0][0],
      values[1][1],
      side[2].toFixed(2),
      chartContext,
    );
    createPointAnnotation(
      values[0][0],
      (values[1][1] - values[0][1]) / 2 + values[0][1],
      side[1].toFixed(2),
      chartContext,
    );
    createPointAnnotation(
      (values[1][0] - values[0][0]) / 2 + values[0][0],
      (values[1][1] - values[0][1]) / 2 + values[0][1],
      side[0].toFixed(2),
      chartContext,
    );

    createMeasurementPointAnnotation(values, app, chartContext);
  }
}
