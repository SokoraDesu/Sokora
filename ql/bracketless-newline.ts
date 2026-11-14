import type { Rule } from "eslint";

export const bracketlessNewline: Rule.RuleModule = {
  meta: {
    type: "layout",
    fixable: "whitespace",
    schema: [],
    messages: {
      missingNewline: "Add a newline after a bracketless if statement.",
    },
  },
  create: context => {
    return {
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      IfStatement(node) {
        if (
          node.consequent.type === "BlockStatement" ||
          node.alternate ||
          !node.loc ||
          !node.consequent.loc ||
          node.loc.start.line === node.consequent.loc.end.line
        )
          return;

        const source = context.sourceCode;

        const tokenAfter = source.getTokenAfter(node, { includeComments: true });
        if (!tokenAfter?.loc || ["}", ")"].includes(tokenAfter.value)) return;

        if (tokenAfter.loc.start.line - node.loc.end.line <= 1)
          context.report({
            node,
            messageId: "missingNewline",
            fix: fixer => fixer.insertTextAfter(node, "\n"),
          });
      },
    };
  },
};
