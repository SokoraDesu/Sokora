import type { Message, TextChannel } from "discord.js";

export default class Crazy {
  async run(message: Message) {
    const crazy = message.content.toLowerCase().split("crazy");

    if (!crazy[1]) return;
    if (
      ((crazy[0].endsWith(" ") || crazy[0].endsWith("")) && crazy[1].startsWith(" ")) ||
      message.content.toLowerCase() == "crazy"
    ) {
      await (message.channel as TextChannel).send(
        "Crazy? I was crazy once.\nThey locked me in a room.\nA rubber room.\nA rubber room with rats.\nAnd rats make me crazy.\nCrazy? I was crazy once..."
      );
    }
  }
}
