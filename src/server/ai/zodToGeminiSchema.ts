import { z } from "zod";

/**
 * Convert a (subset of) Zod schema into Gemini's OpenAPI-style `responseSchema`.
 * Supports objects, arrays, strings, numbers, booleans, enums, optional/nullable/default and
 * refinements (unwrapped). Anything else returns null, and the caller falls back to plain JSON mode.
 * Zod remains the source of truth: the output is always validated with the original schema.
 */
export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
  items?: GeminiSchema;
  enum?: string[];
  format?: string;
  nullable?: boolean;
  description?: string;
};

export function zodToGeminiSchema(schema: z.ZodTypeAny): GeminiSchema | null {
  const def = schema._def as { typeName: z.ZodFirstPartyTypeKind; description?: string };
  const withDesc = (s: GeminiSchema | null): GeminiSchema | null => (s && schema.description ? { ...s, description: schema.description } : s);
  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, GeminiSchema> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        const conv = zodToGeminiSchema(v as z.ZodTypeAny);
        if (!conv) return null;
        properties[k] = conv;
        if (!(v as z.ZodTypeAny).isOptional()) required.push(k);
      }
      return withDesc({ type: "OBJECT", properties, required, propertyOrdering: Object.keys(properties) });
    }
    case z.ZodFirstPartyTypeKind.ZodArray: {
      const items = zodToGeminiSchema((schema as z.ZodArray<z.ZodTypeAny>).element);
      return items ? withDesc({ type: "ARRAY", items }) : null;
    }
    case z.ZodFirstPartyTypeKind.ZodString:
      return withDesc({ type: "STRING" });
    case z.ZodFirstPartyTypeKind.ZodNumber: {
      const isInt = (schema as z.ZodNumber)._def.checks.some((c) => c.kind === "int");
      return withDesc({ type: isInt ? "INTEGER" : "NUMBER" });
    }
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return withDesc({ type: "BOOLEAN" });
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return withDesc({ type: "STRING", format: "enum", enum: [...(schema as z.ZodEnum<[string, ...string[]]>).options] });
    case z.ZodFirstPartyTypeKind.ZodOptional:
    case z.ZodFirstPartyTypeKind.ZodDefault:
      return zodToGeminiSchema((schema._def as { innerType: z.ZodTypeAny }).innerType);
    case z.ZodFirstPartyTypeKind.ZodNullable: {
      const inner = zodToGeminiSchema((schema._def as { innerType: z.ZodTypeAny }).innerType);
      return inner ? { ...inner, nullable: true } : null;
    }
    case z.ZodFirstPartyTypeKind.ZodEffects:
      return zodToGeminiSchema((schema._def as { schema: z.ZodTypeAny }).schema);
    default:
      return null;
  }
}
