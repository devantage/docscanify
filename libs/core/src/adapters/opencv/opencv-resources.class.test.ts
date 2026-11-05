import type { OpenCv, OpenCvDeletable } from './opencv.interface';
import { OpenCvResources } from './opencv-resources.class';

function createFakeCv(onDelete: jest.Mock): OpenCv {
  class FakeResource implements OpenCvDeletable {
    public delete(): void {
      onDelete();
    }
  }

  return { Mat: FakeResource, MatVector: FakeResource } as unknown as OpenCv;
}

describe('OpenCvResources', (): void => {
  it('returns what it tracks', (): void => {
    const resource: OpenCvDeletable = { delete: jest.fn() };

    expect(new OpenCvResources(createFakeCv(jest.fn())).track(resource)).toBe(
      resource,
    );
  });

  it('deletes everything it creates or tracks when released', (): void => {
    const onDelete: jest.Mock = jest.fn();
    const tracked: { delete: jest.Mock } = { delete: jest.fn() };
    const resources: OpenCvResources = new OpenCvResources(
      createFakeCv(onDelete),
    );

    resources.createMat();
    resources.createMatVector();
    resources.track(tracked);
    resources.release();

    expect(onDelete).toHaveBeenCalledTimes(2);
    expect(tracked.delete).toHaveBeenCalledTimes(1);
  });
});
