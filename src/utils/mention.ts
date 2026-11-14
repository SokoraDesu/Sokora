import type { Mention, Mentionable } from "types";

/**
 * Handles role mentions, channel mentions, timestamps, and more.
 * @param who - Who to mention? If it's a timestamp, pass the current epoch.
 * @param type - What to mention?
 * @returns A `<MENTION>` string.
 */
export function mention(who: string | number, type: Mentionable): string {
  switch (type) {
    case "CHANNEL": {
      return `<#${who}>`;
    }
    case "USER": {
      return `<@${who}>`;
    }
    case "ROLE": {
      return `<@&${who}>`;
    }
    case "DEFAULT_TIMESTAMP":
    case "DETAILED_TIMESTAMP":
    case "SIMPLE_TIMESTAMP": {
      const number_ = Number(who);
      // just return the string untouched if it's not okay
      if (Number.isNaN(number_)) return who.toString();
      switch (type) {
        case "DEFAULT_TIMESTAMP": {
          return `<t:${Math.floor(number_ / 1000)}:D>`;
        }
        case "SIMPLE_TIMESTAMP": {
          return `<t:${Math.floor(number_ / 1000)}:d>`;
        }
        case "DETAILED_TIMESTAMP": {
          return `<t:${Math.floor(number_ / 1000)}>`;
        }
      }
    }
  }
}

/**
 * Reverses mentions, telling you the type and giving you the value.
 *
 * @param mnt - Mention
 * @returns `undefined` if not a valid mention, `Mention` otherwise.
 */
export function unmention(mnt: string): undefined | Mention {
  const out = /<(#|@|@&|t:)(\d+)(:D|:d|:S)?>/.exec(mnt);

  return out
    ? {
        type: ({ "#": "CHANNEL", "@": "USER", "@&": "ROLE", "t:": "TIMESTAMP" } as const)[
          out[1]
        ] as "USER",
        res: out[2],
      }
    : undefined;
}
