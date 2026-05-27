import type { Mentionable } from "./types";

/**
 * Handles role mentions, channel mentions, timestamps, and more.
 *
 * @param {string | number} who Who to mention? If it's a timestamp, pass `Date.now()`.
 * @param {string} type What to mention?
 * @returns {string} A `<MENTION>` string.
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
