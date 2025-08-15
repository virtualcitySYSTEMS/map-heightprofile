import { Projection, VcsEvent } from '@vcmap/core';
import type { Coordinate } from 'ol/coordinate';
import type { LineString } from 'ol/geom.js';
import type { Scene } from '@vcmap-cesium/engine';
import {
  Cartographic,
  LinearSpline,
  Cartesian3,
  EllipsoidGeodesic,
  Math as CesiumMath,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import type { VcsUiApp } from '@vcmap/ui';
import { NotificationType } from '@vcmap/ui';
import type { ElevationType } from '../setupResultCollectionComponent.js';

type Result<T, E = Error> =
  | { ok: true; readonly points: T }
  | { ok: false; readonly error: E };

export class CancelledError extends Error {}

type HeightProfileCalculation = {
  readonly progress: VcsEvent<number>;
  readonly totalNumberOfPoints: number;
  cancel(this: void): void;
  readonly ready: Promise<Result<Coordinate[]>>;
  readonly resolutionValue: number;
};

async function heightCalc(
  elevationType: ElevationType,
  scene: Scene,
  scratchCartographic: Cartographic,
): Promise<Cartographic> {
  if (elevationType === 'terrain') {
    await sampleTerrainMostDetailed(scene.terrainProvider, [
      scratchCartographic,
    ]);
  } else if (elevationType === 'both') {
    await scene.sampleHeightMostDetailed([scratchCartographic]);
  }
  return scratchCartographic;
}

export function createHeightProfileCalculation(
  geometry: LineString,
  resolution: number,
  elevationType: ElevationType,
  maxNumberOfPoints: number,
  scene: Scene,
  app: VcsUiApp,
): HeightProfileCalculation {
  let resolutionValue = resolution;
  const coordinates = geometry.getCoordinates();
  const cartographics = coordinates.map((c) => {
    const wgs84Coord = Projection.mercatorToWgs84(c);
    return Cartographic.fromDegrees(
      wgs84Coord[0],
      wgs84Coord[1],
      wgs84Coord[2],
    );
  });

  const progress = new VcsEvent<number>();
  const segments = cartographics
    .map((c, index: number) => {
      if (index > 0) {
        const start = cartographics[index - 1];
        const end = c;
        const { surfaceDistance } = new EllipsoidGeodesic(start, end);
        return {
          start,
          end,
          surfaceDistance,
        };
      }
      return null;
    })
    .filter((s) => s) as {
    start: Cartographic;
    end: Cartographic;
    surfaceDistance: number;
  }[];

  const totalSurfaceDistance = segments.reduce(
    (prev, { surfaceDistance }) => prev + surfaceDistance,
    0,
  );
  let totalNumberOfPoints = Math.floor(totalSurfaceDistance / resolutionValue);
  if (totalNumberOfPoints > maxNumberOfPoints) {
    resolutionValue = Number(
      (totalSurfaceDistance / maxNumberOfPoints).toFixed(1),
    );
    totalNumberOfPoints = Math.floor(totalSurfaceDistance / resolutionValue);
  } else if (totalNumberOfPoints <= 1) {
    app.notifier.add({
      type: NotificationType.WARNING,
      message: 'heightProfile.resolutionProblem',
    });
  }

  let combindedTime = 0;
  const spline = new LinearSpline({
    times: [0].concat(
      segments.map(({ surfaceDistance }) => {
        const segmentTime = surfaceDistance / resolutionValue;
        combindedTime += segmentTime;
        return combindedTime;
      }),
    ),
    points: cartographics.map((c) => Cartographic.toCartesian(c)),
  });

  const scratchCartesian = new Cartesian3();
  const scratchCartographic = new Cartographic();

  const positions = new Array(totalNumberOfPoints);
  let isCanceled = false;

  function cancel(this: void): void {
    isCanceled = true;
  }
  const calculate = async (): Promise<Result<Coordinate[]>> => {
    for (let i = 0; i <= totalNumberOfPoints; i++) {
      if (isCanceled) {
        return { ok: false, error: new CancelledError('Canceled') };
      }

      spline.evaluate(i, scratchCartesian);

      Cartographic.fromCartesian(
        scratchCartesian,
        undefined,
        scratchCartographic,
      );

      try {
        // eslint-disable-next-line no-await-in-loop
        await heightCalc(elevationType, scene, scratchCartographic);
      } catch (error) {
        if (error instanceof Error) {
          return { ok: false, error };
        } else {
          return { ok: false, error: new Error(String(error)) };
        }
      }

      progress.raiseEvent(i / totalNumberOfPoints);

      positions[i] = [
        CesiumMath.toDegrees(scratchCartographic.longitude),
        CesiumMath.toDegrees(scratchCartographic.latitude),
        scratchCartographic.height,
      ];
    }

    return { ok: true, points: positions };
  };

  return {
    resolutionValue,
    progress,
    totalNumberOfPoints,
    cancel,
    ready: calculate(),
  };
}
