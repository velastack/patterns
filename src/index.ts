import generateForm from "./patterns/generate/form";
import generateResource from "./patterns/generate/resource";
import generateScaffold from "./patterns/generate/scaffold";
import generateSchema from "./patterns/generate/schema";
import enableAuth from "./patterns/enable/auth";

export default {
  version: "0.1.0",
  patterns: [generateForm, generateSchema, generateResource, generateScaffold, enableAuth],
};
