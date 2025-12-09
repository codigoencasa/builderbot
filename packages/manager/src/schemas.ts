import { z } from 'zod'

/**
 * Reserved tenant IDs that cannot be used
 */
const RESERVED_TENANT_IDS = ['active', 'health', 'flows', 'api'] as const

/**
 * Custom refinement to prevent reserved tenant IDs
 */
const tenantIdSchema = z
    .string()
    .min(1, 'tenantId is required')
    .max(50, 'tenantId must be 50 characters or less')
    .regex(/^[a-zA-Z0-9-_]+$/, 'tenantId can only contain letters, numbers, hyphens and underscores')
    .refine(
        (val: string) => !RESERVED_TENANT_IDS.includes(val as (typeof RESERVED_TENANT_IDS)[number]),
        (val: string) => ({ message: `"${val}" is a reserved tenantId and cannot be used` })
    )

/**
 * Schema for creating a new bot
 */
export const createBotSchema = z.object({
    tenantId: tenantIdSchema,
    name: z.string().min(1, 'name cannot be empty').max(100, 'name must be 100 characters or less').optional(),
    flowIds: z.array(z.string().min(1, 'flowId cannot be empty')).min(1, 'At least one flowId is required'),
    port: z
        .number()
        .int('port must be an integer')
        .min(1024, 'port must be 1024 or higher')
        .max(65535, 'port must be 65535 or lower')
        .optional(),
    providerOptions: z.record(z.any()).optional(),
})

/**
 * Schema for updating a bot
 */
export const updateBotSchema = z.object({
    name: z.string().min(1, 'name cannot be empty').max(100, 'name must be 100 characters or less').optional(),
})

/**
 * Schema for sending a message
 */
export const sendMessageSchema = z.object({
    number: z
        .string()
        .min(10, 'number must be at least 10 characters')
        .max(20, 'number must be 20 characters or less')
        .regex(/^[0-9+]+$/, 'number can only contain digits and + symbol'),
    message: z.string().min(1, 'message cannot be empty').max(4096, 'message must be 4096 characters or less'),
    media: z.string().url('media must be a valid URL').optional(),
})

/**
 * Schema for restarting a bot
 */
export const restartBotSchema = z.object({
    flowIds: z.array(z.string().min(1)).min(1, 'At least one flowId is required'),
    port: z
        .number()
        .int('port must be an integer')
        .min(1024, 'port must be 1024 or higher')
        .max(65535, 'port must be 65535 or lower')
        .optional(),
    name: z.string().min(1).max(100).optional(),
})

/**
 * Reserved flow IDs
 */
const RESERVED_FLOW_IDS = ['active', 'all'] as const

/**
 * Flow step schema - defines a single step in the flow
 */
const flowStepSchema = z.object({
    /** The message to send */
    answer: z.string().min(1).max(4096),
    /** Optional delay before sending (ms) */
    delay: z.number().int().min(0).max(30000).optional(),
    /** Optional media URL to attach */
    media: z.string().url().optional(),
    /** Whether to capture user response */
    capture: z.boolean().optional(),
})

/**
 * Schema for creating a dynamic flow
 */
export const createFlowSchema = z.object({
    /** Unique flow identifier */
    id: z
        .string()
        .min(1, 'id is required')
        .max(50, 'id must be 50 characters or less')
        .regex(/^[a-zA-Z0-9-_]+$/, 'id can only contain letters, numbers, hyphens and underscores')
        .refine(
            (val: string) => !RESERVED_FLOW_IDS.includes(val as (typeof RESERVED_FLOW_IDS)[number]),
            (val: string) => ({ message: `"${val}" is a reserved flow id` })
        ),
    /** Display name for the flow */
    name: z.string().min(1).max(100),
    /** Keywords that trigger this flow */
    keyword: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    /** Steps/answers in the flow */
    steps: z.array(flowStepSchema).min(1, 'At least one step is required'),
})

/**
 * Schema for updating a flow
 */
export const updateFlowSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    keyword: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
    steps: z.array(flowStepSchema).min(1).optional(),
})

/**
 * Type exports inferred from schemas
 */
export type CreateBotInput = z.infer<typeof createBotSchema>
export type UpdateBotInput = z.infer<typeof updateBotSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type RestartBotInput = z.infer<typeof restartBotSchema>
export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>
export type FlowStep = z.infer<typeof flowStepSchema>

/**
 * Validation result type
 */
export interface ValidationResult<T> {
    success: boolean
    data?: T
    error?: string
    errors?: Array<{ field: string; message: string }>
}

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data)

    if (result.success) {
        return {
            success: true,
            data: result.data,
        }
    }

    const errors = result.error.errors.map((err: z.ZodIssue) => ({
        field: err.path.join('.') || 'root',
        message: err.message,
    }))

    return {
        success: false,
        error: errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join(', '),
        errors,
    }
}
