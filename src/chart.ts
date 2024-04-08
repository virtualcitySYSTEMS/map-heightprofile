import { Collection, Projection } from '@vcmap/core';
import { Coordinate } from 'ol/coordinate';
import Feature from 'ol/Feature';
import { LineString, Point } from 'ol/geom';
import { Stroke, Style } from 'ol/style';
import { NotificationType, VcsUiApp } from '@vcmap/ui';
import { ApexOptions } from 'apexcharts';
import { name } from '../package.json';
import type { HeightProfilePlugin } from './index.js';
import type { HeightProfileResult } from './setup.js';

type ApexConfig = {
  config: object;
  dataPointIndex: number;
  globals: object;
  seriesIndex: number;
};

type ApexChartContext = {
  addPointAnnotation: (annotation: ApexPointAnnotation, flag: boolean) => void;
  updateSeries: (
    series: Array<{
      name: string;
      data: Array<[number, number]>;
      color?: string | undefined;
      zIndex?: number | undefined;
    }>,
  ) => void;
  clearAnnotations: () => void;
};
const measureColor = '#FF0000';
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
      Projection.wgs84ToMercator(position[0]!),
      Projection.wgs84ToMercator([
        position[1]![0],
        position[1]![1],
        position[2]![2],
      ]),
      Projection.wgs84ToMercator(position[2]!),
      Projection.wgs84ToMercator(position[3]!),
    ]),
    olcs_altitudeMode: 'absolute',
  });
  const style: Style = new Style({
    stroke: new Stroke({
      color: measureColor,
      width: 5,
    }),
  });

  feature.setStyle(style);
  feature.setId('_measurement');
  plugin.measurementLayer.addFeatures([feature]);

  return (): void => {
    plugin.measurementLayer.removeFeaturesById(['_measurement']);
  };
}

function calcSideLength(
  p1: [number, number],
  p2: [number, number],
): [number, number, number] {
  const p3: [number, number] = [p1[0], p2[1]];

  const side1 = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
  const side2 = Math.sqrt((p3[0] - p1[0]) ** 2 + (p3[1] - p1[1]) ** 2);
  const side3 = Math.sqrt((p2[0] - p3[0]) ** 2 + (p2[1] - p3[1]) ** 2);

  return [side1, side2, side3];
}

type ApexPointAnnotation = {
  x: number;
  y: number;
  label: {
    borderColor: string;
    style: { color: string; background: string };
    text: string;
  };
};

function createPointAnnotation(
  x: number,
  y: number,
  text: string,
  chartContext: ApexChartContext,
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

type ChartMeasurement = {
  readonly finished: boolean;
  addValue: (value: [number, number]) => void;
  destroy: () => void;
};

function addTriangleToChartContext(
  app: VcsUiApp,
  values: [number, number][],
  series: SeriesEntry[],
  chartContext: ApexChartContext,
): () => void {
  const points = [
    [values[0][0], values[1][1]],
    [values[0][0], values[0][1]],
    [values[1][0], values[1][1]],
    [values[0][0], values[1][1]],
  ] as Array<[number, number]>;

  const seriesElement = {
    name: `${String(app.vueI18n.t('heightProfile.measureLine'))}`,
    id: 'measurements',
    data: points,
    color: measureColor,
    zIndex: 99,
  };
  series.push(seriesElement);

  chartContext.updateSeries(series);

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

  return () => {
    const indexToRemove = series.indexOf(seriesElement);
    if (indexToRemove !== -1) {
      series.splice(indexToRemove, 1);
    }
    chartContext.updateSeries(series);
  };
}

function startChartMeasurement(
  app: VcsUiApp,
  chartContext: ApexChartContext,
  series: SeriesEntry[],
  results: Collection<HeightProfileResult>,
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
    addValue(value: [number, number]): void {
      if (finished) {
        throw new Error('Measurement already finished');
      }
      createPointAnnotation(
        value[0],
        value[1],
        `${String(app.vueI18n.t('heightProfile.point'))}-1`,
        chartContext,
      );
      values.push(value);

      finished = values.length === 2;
      if (finished) {
        destroy = addTriangleToChartContext(app, values, series, chartContext);
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
      chartContext?.clearAnnotations();
    },
  };

  if (initialValue) {
    measurement.addValue(initialValue);
  }
  return measurement;
}

function placeTooltip(plugin: HeightProfilePlugin, point: Coordinate): void {
  plugin.measurementLayer.removeFeaturesById(['_tooltip']);
  const feature = new Feature({
    geometry: new Point(Projection.wgs84ToMercator(point)),
    olcs_extrudedHeight: 5,
    olcs_altitudeMode: 'absolute',
  });
  feature.setId('_tooltip');
  plugin.measurementLayer.addFeatures([feature]);
}

export const windowIdGraph = 'heightProfileGraph_window_id';

export type SeriesEntry = {
  name: string;
  data: Array<[number, number]>;
  id?: string | undefined;
  color?: string | undefined;
  zIndex?: number | undefined;
};

export function setupChart(
  app: VcsUiApp,
  results: Collection<HeightProfileResult>,
  resultNames: string[],
): {
  series: SeriesEntry[];
  chartOptions: ApexOptions;
  destroy: () => void;
} {
  let currentMeasurment: ChartMeasurement | undefined;
  const plugin = app.plugins.getByKey(name) as HeightProfilePlugin;
  const series = resultNames
    .map((id): SeriesEntry | undefined => {
      const result = results.getByKey(id);
      if (result) {
        const heightsArray = result.resultPoints.map(
          (innerArray) => innerArray[2],
        );

        return {
          name: result.properties.title,
          id,
          data: heightsArray.map((data, index) => [
            index * result.resolution,
            data,
          ]),
        };
      }
      return undefined;
    })
    .filter((r): r is SeriesEntry => !!r);

  const chartOptions: ApexOptions = {
    chart: {
      height: 350,
      type: 'line',
      zoom: {
        enabled: true,
      },
      toolbar: {
        show: true,
        tools: {
          zoom: false,
          zoomin: true,
          zoomout: true,
        },
      },
      events: {
        click(
          _event: object,
          chartContext: ApexChartContext,
          config: ApexConfig,
        ): void {
          if (config.dataPointIndex >= 0) {
            if (series?.length === 1 || currentMeasurment?.finished) {
              const value = series[0].data[config.dataPointIndex];
              if (currentMeasurment && !currentMeasurment.finished) {
                currentMeasurment.addValue(value);
              } else {
                currentMeasurment?.destroy();
                currentMeasurment = startChartMeasurement(
                  app,
                  chartContext,
                  series,
                  results,
                  value,
                );
              }
            } else {
              app.notifier.add({
                type: NotificationType.WARNING,
                message: String('heightProfile.measurementWarning'),
              });
            }
          }
        },
        mouseMove(
          _event: object,
          _chartContext: ApexChartContext,
          config: ApexConfig,
        ): void {
          if (config.dataPointIndex >= 0) {
            const values = results.getByKey(series[config.seriesIndex].id);
            const point = values?.resultPoints[config.dataPointIndex];
            if (point) {
              placeTooltip(plugin, point);
            }
          } else {
            plugin.measurementLayer.removeFeaturesById(['_tooltip']);
          }
        },
        mouseLeave(): void {
          plugin.layer.removeFeaturesById(['_tooltip']);
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'straight',
    },
    grid: {
      row: {
        colors: ['#f3f3f3', 'transparent'],
        opacity: 0.5,
      },
    },
    xaxis: {
      type: 'numeric',
    },
    yaxis: {
      labels: {
        formatter(value: number): string {
          return Math.floor(value).toString();
        },
      },
    },
  };

  return {
    series,
    chartOptions,
    destroy(): void {
      plugin.measurementLayer.removeAllFeatures();
      currentMeasurment?.destroy();
    },
  };
}
