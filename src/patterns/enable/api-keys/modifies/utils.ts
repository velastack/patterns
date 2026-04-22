import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const TIME_AGO_SNIPPET = dedent`
  const TIME_AGO_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 60 * 60 * 24 * 365],
      ['month', 60 * 60 * 24 * 30],
      ['day', 60 * 60 * 24],
      ['hour', 60 * 60],
      ['minute', 60],
      ['second', 1]
  ];

  export function timeAgo(date: Date | string | number, locale?: string) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const diff = (new Date(date).getTime() - Date.now()) / 1000;

      for (const [unit, secs] of TIME_AGO_UNITS) {
          if (Math.abs(diff) >= secs || unit === 'second') {
              return rtf.format(Math.round(diff / secs), unit);
          }
      }
  }
`;

const NOT_FOUND_HINT = dedent`
  Create src/lib/utils.ts with a timeAgo helper:

  ${TIME_AGO_SNIPPET}
`;

const UNITS_SNIPPET = dedent`
  const TIME_AGO_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 60 * 60 * 24 * 365],
      ['month', 60 * 60 * 24 * 30],
      ['day', 60 * 60 * 24],
      ['hour', 60 * 60],
      ['minute', 60],
      ['second', 1]
  ];
`;

const FUNCTION_SNIPPET = dedent`
  export function timeAgo(date: Date | string | number, locale?: string) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const diff = (new Date(date).getTime() - Date.now()) / 1000;

      for (const [unit, secs] of TIME_AGO_UNITS) {
          if (Math.abs(diff) >= secs || unit === 'second') {
              return rtf.format(Math.round(diff / secs), unit);
          }
      }
  }
`;

export function modifyUtils(utilsPath: string): ModifyOutcome {
  if (!fs.existsSync(utilsPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(utilsPath, "utf8");
  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(utilsPath);

  const hasTimeAgo =
    sourceFile.getFunction("timeAgo") !== undefined ||
    sourceFile.getVariableDeclaration("timeAgo") !== undefined;
  const hasUnits =
    sourceFile.getVariableDeclaration("TIME_AGO_UNITS") !== undefined;

  if (hasTimeAgo && hasUnits) {
    return { status: "success", changed: false };
  }

  const toAppend: string[] = [];
  if (!hasUnits) toAppend.push(UNITS_SNIPPET);
  if (!hasTimeAgo) toAppend.push(FUNCTION_SNIPPET);

  sourceFile.addStatements("\n" + toAppend.join("\n\n") + "\n");
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
