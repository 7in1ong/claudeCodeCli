/**
 * Tool Base Types and Abstract Class
 *
 * Defines the core interface and types for the tool calling framework.
 * Every tool must extend BaseTool and implement the execute() method.
 */

/**
 * JSON Schema definition for tool input parameters.
 * Compatible with Anthropic API's Tool.InputSchema.
 */
export type JSONSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Result returned by a tool's execute() method.
 */
export interface ToolResult {
  /** Whether the tool executed successfully. */
  success: boolean;
  /** The output content of the tool execution. */
  content: string;
  /** Error message when success is false. */
  error?: string;
  /** Whether user confirmation is required before applying the result. */
  needsConfirmation?: boolean;
}

/**
 * Abstract base class for all tools.
 *
 * Subclasses must implement execute() and provide name, description,
 * and inputSchema. The inputSchema is used to generate the Anthropic
 * API tools parameter and to validate inputs from the LLM.
 *
 * @example
 * ```ts
 * class EchoTool extends BaseTool {
 *   readonly name = "echo";
 *   readonly description = "Echoes the input back";
 *   readonly inputSchema = {
 *     type: "object" as const,
 *     properties: { message: { type: "string" } },
 *     required: ["message"],
 *   };
 *
 *   async execute(params: Record<string, unknown>): Promise<ToolResult> {
 *     return { success: true, content: String(params["message"]) };
 *   }
 * }
 * ```
 */
export abstract class BaseTool {
  /** Unique name identifying this tool. */
  abstract readonly name: string;

  /** Human-readable description of what this tool does. */
  abstract readonly description: string;

  /** JSON Schema defining the expected input parameters. */
  abstract readonly inputSchema: JSONSchema;

  /**
   * Whether this tool requires user confirmation before execution.
   * Defaults to false — read-only tools (e.g. read_file, list_files)
   * do not need approval. Mutating tools (bash, write_file) should
   * override this to true.
   */
  readonly requiresConfirmation: boolean = false;

  /**
   * Execute the tool with the given parameters.
   *
   * @param params - Input parameters matching the inputSchema definition.
   * @returns A ToolResult indicating success, failure, or need for confirmation.
   */
  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;
}
