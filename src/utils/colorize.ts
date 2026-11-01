import { getColor, getSwatches } from "colorthief";
import type { RGBTuple, User } from "discord.js";

/**
Sokolors, colors of Sokora, get it?
*/
export enum Sokolors {
  Red = 30,
  Yellow = 110,
  Green = 140,
  Blue = 240,
  Purple = 300,
}

function randomizeColor(hue: number, saturation: number, lightness: number): RGBTuple {
  const [h, s, l] = [
    hue + 10 * Math.random(),
    saturation + 10 * Math.random(),
    lightness + 10 * Math.random(),
  ];
  return Bun.color(`hsl(${h}, ${s}%, ${l}%)`, "[rgb]") as RGBTuple;
}

function genColor(hue: Sokolors): RGBTuple | undefined {
  return (
    Bun.color(
      `oklch(${70 + 10 * Math.random()}% ${0.09 + 0.02 * Math.random()} ${hue + 5 * Math.random()})`,
      "[rgb]",
    ) ?? undefined
  );
}

/**
 * Gives you a (slightly) randomized color from either a predefined hue or from an image.
 * @param options - Options.
 * @returns Randomized color from a hue or an image.
 */
export async function colorize(options: {
  hue: Sokolors;
  user?: User;
  avatar?: string;
}): Promise<RGBTuple | undefined> {
  const { user, avatar, hue } = options;

  if (!avatar) return genColor(hue);

  const buffer = Buffer.from(await (await fetch(avatar)).arrayBuffer());
  if (!buffer) return genColor(hue);

  let color = (await getSwatches(buffer, { quality: 5 })).Vibrant?.color;
  color ??= (await getColor(buffer, { quality: 5 })) ?? undefined;
  if (!color)
    if (user) {
      const accentColor = user.hexAccentColor;
      if (!accentColor) return genColor(hue);
      const hsl = Bun.color(accentColor, "hsl");
      if (!hsl) throw new Error(`Invalid HSL obtained from ${accentColor}.`);
      return randomizeColor(
        Number.parseInt(hsl[0].replace("hsl(", "")),
        Number.parseInt(hsl[1]),
        Number.parseInt(hsl[2].replace(")", "")),
      );
    } else return genColor(hue);

  const [r, g, b] = color.array();
  if (r == g && g == b) return [r, g, b];

  const hsl = color.hsl();
  return randomizeColor(hsl.h, hsl.s, hsl.l);
}
