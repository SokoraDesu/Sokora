import { evaluate } from "mathjs";
import type { FeatureOutput } from "types";
import { feature, type MethodParameters } from "utils/feature";

// IDEA: figure out how to make feature()'s asyncness not create warnings
// eslint-disable-next-line @typescript-eslint/require-await
async function method(
  ...parameters: MethodParameters<{ expression: string }, number>
): Promise<FeatureOutput<number>> {
  const [ok, fail, options] = parameters;
  try {
    const result: unknown = evaluate(options.expression);
    if (typeof result != "number" || Number.isNaN(result) || !Number.isFinite(result))
      throw new TypeError("Invalid result");

    return ok(result);
  } catch (error) {
    return fail({
      title: "Invalid expression.",
      reason: String(error).includes("Invalid result")
        ? `Preferably, provide expressions with a result a computer can manage (expr. \`${options.expression}\` gave a result above compute limit).`
        : "Please provide a valid mathematical expression. Examples: ’sin(pi/4)’, ’10*2+(6/3)’, ’sqrt(25)’",
    });
  }
}

export const calc = feature("math/calc", method);
