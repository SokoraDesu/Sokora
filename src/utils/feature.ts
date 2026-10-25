import type {
  FeatureName,
  FeatureOutput,
  PrimitiveFeatureError,
  PrimitiveFeatureSuccess,
} from "types";
import { errorToFeature } from "./errorType";

type MethodType<P, O> = (
  ok: (s: O) => PrimitiveFeatureSuccess<O>,
  fail: <F>(f: F) => PrimitiveFeatureError<F>,
  options: P,
) => Promise<FeatureOutput<O>>;

export type MethodParameters<P, O> = Parameters<MethodType<P, O>>;

export function feature<P, O>(
  featureName: FeatureName,
  method: MethodType<P, O>,
): (options: P) => Promise<FeatureOutput<O>> {
  const ok = <S>(s: S): PrimitiveFeatureSuccess<S> => {
    return {
      success: true,
      feature: featureName,
      out: s,
    };
  };

  const fail = <F>(f: F, isEx = false): PrimitiveFeatureError<F> => {
    return {
      success: false,
      reason: isEx ? "exception" : "user",
      feature: featureName,
      out: f,
    };
  };

  return async function (options: P): Promise<FeatureOutput<O>> {
    try {
      return await method(ok, fail, options);
    } catch (error) {
      return fail(errorToFeature(error), true);
    }
  };
}
