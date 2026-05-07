import * as changeCase from "change-case";
import { APP_DIR, PUBLIC_DIR } from "../core/constants";
import { InvalidArgumentError } from "../core/errors";
import type { Options } from "../core/types";
import type {
  Model,
  RouteInfo,
  RouteKind,
  ScaffoldFilePaths,
  ScaffoldUrls,
} from "./types";

const ROUTES_ROOT = "src/routes";
const DYNAMIC_PARAM_RE = /\[([^\]]+)\]/g;
const VALID_SEGMENT_RE = /^[a-zA-Z0-9_\-[\]()]+$/;

function defaultGroup(features: Options["features"]): string {
  return features.auth ? APP_DIR : PUBLIC_DIR;
}

function defaultRouteSegment(model: Model, kind: RouteKind): string {
  return kind === "scaffold"
    ? changeCase.kebabCase(model.pluralDisplayName)
    : changeCase.kebabCase(model.displayName);
}

function stripRouteGroups(filePath: string): string {
  const withoutRoot = filePath.startsWith(`${ROUTES_ROOT}/`)
    ? filePath.slice(ROUTES_ROOT.length + 1)
    : filePath;
  const segments = withoutRoot.split("/").filter((segment) => {
    return !(segment.startsWith("(") && segment.endsWith(")"));
  });
  return `/${segments.join("/")}`;
}

function extractDynamicParams(filePath: string): string[] {
  const params: string[] = [];
  for (const match of filePath.matchAll(DYNAMIC_PARAM_RE)) {
    params.push(match[1]);
  }
  return params;
}

function validateRouteInput(input: string): void {
  if (input.startsWith("/")) {
    throw new InvalidArgumentError(
      `Route must not start with "/". Got: "${input}"`,
    );
  }
  if (input.startsWith(`${ROUTES_ROOT}/`) || input === ROUTES_ROOT) {
    throw new InvalidArgumentError(
      `Route must not start with "${ROUTES_ROOT}/" — paths are rooted there automatically. Got: "${input}"`,
    );
  }
  const segments = input.split("/");
  for (const segment of segments) {
    if (segment.length === 0) {
      throw new InvalidArgumentError(
        `Route must not contain empty segments. Got: "${input}"`,
      );
    }
    if (segment === "." || segment === "..") {
      throw new InvalidArgumentError(
        `Route must not contain "." or ".." segments. Got: "${input}"`,
      );
    }
    if (segment.startsWith("_")) {
      throw new InvalidArgumentError(
        `Route segments must not start with underscore. Got: "${segment}"`,
      );
    }
    if (!VALID_SEGMENT_RE.test(segment)) {
      throw new InvalidArgumentError(
        `Route segment "${segment}" contains invalid characters. Allowed: letters, digits, underscore, dash, brackets, parentheses.`,
      );
    }
  }
}

function hasRouteGroup(input: string): boolean {
  return input
    .split("/")
    .some((segment) => segment.startsWith("(") && segment.endsWith(")"));
}

export function parseRoute(
  routeInput: string | undefined,
  model: Model,
  options: Pick<Options, "features">,
  kind: RouteKind,
): RouteInfo {
  if (routeInput === undefined || routeInput === "") {
    const segment = defaultRouteSegment(model, kind);
    const fileBase = `${ROUTES_ROOT}/${defaultGroup(options.features)}/${segment}`;
    return {
      fileBase,
      urlBase: stripRouteGroups(fileBase),
      dynamicParams: extractDynamicParams(fileBase),
    };
  }

  validateRouteInput(routeInput);

  const normalized = hasRouteGroup(routeInput)
    ? routeInput
    : `${defaultGroup(options.features)}/${routeInput}`;
  const fileBase = `${ROUTES_ROOT}/${normalized}`;

  return {
    fileBase,
    urlBase: stripRouteGroups(fileBase),
    dynamicParams: extractDynamicParams(fileBase),
  };
}

export function scaffoldFilePaths(route: RouteInfo): ScaffoldFilePaths {
  return {
    list: route.fileBase,
    new: `${route.fileBase}/new`,
    show: `${route.fileBase}/[id]`,
    edit: `${route.fileBase}/[id]/edit`,
  };
}

export function scaffoldUrls(route: RouteInfo): ScaffoldUrls {
  return {
    list: route.urlBase,
    new: `${route.urlBase}/new`,
    show: `${route.urlBase}/[id]`,
    edit: `${route.urlBase}/[id]/edit`,
  };
}
