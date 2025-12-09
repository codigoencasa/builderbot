import { addKeyword } from '@builderbot/bot'

import type { CreateFlowInput, UpdateFlowInput, FlowStep } from './schemas'
import type { Flow } from './types'

/**
 * Flow definition stored in registry
 */
export interface FlowDefinition {
    id: string
    name: string
    flow: Flow
    /** Whether this flow was created dynamically via API */
    dynamic: boolean
    /** Original configuration for dynamic flows */
    config?: CreateFlowInput
    /** Timestamp when flow was registered */
    createdAt: Date
    /** Timestamp when flow was last updated */
    updatedAt: Date
}

/**
 * FlowRegistry manages flow definitions that can be used when creating bots
 */
export class FlowRegistry {
    private flows: Map<string, FlowDefinition> = new Map()

    /**
     * Register a programmatic flow (created with addKeyword)
     */
    register(id: string, name: string, flow: Flow): FlowDefinition {
        const definition: FlowDefinition = {
            id,
            name,
            flow,
            dynamic: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        this.flows.set(id, definition)
        return definition
    }

    /**
     * Register a dynamic flow from JSON configuration
     */
    registerDynamic(config: CreateFlowInput): FlowDefinition {
        const { id, name, keyword, steps } = config

        const flow = this.buildFlowFromSteps(keyword, steps)

        const definition: FlowDefinition = {
            id,
            name,
            flow,
            dynamic: true,
            config,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        this.flows.set(id, definition)
        return definition
    }

    /**
     * Update a dynamic flow
     */
    update(id: string, updates: UpdateFlowInput): FlowDefinition | null {
        const existing = this.flows.get(id)
        if (!existing || !existing.dynamic || !existing.config) {
            return null
        }

        // Merge updates with existing config
        const newConfig: CreateFlowInput = {
            ...existing.config,
            ...(updates.name && { name: updates.name }),
            ...(updates.keyword && { keyword: updates.keyword }),
            ...(updates.steps && { steps: updates.steps }),
        }

        // Rebuild flow
        const flow = this.buildFlowFromSteps(newConfig.keyword, newConfig.steps)

        const definition: FlowDefinition = {
            id,
            name: newConfig.name,
            flow,
            dynamic: true,
            config: newConfig,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
        }

        this.flows.set(id, definition)
        return definition
    }

    /**
     * Remove a flow from registry
     */
    remove(id: string): boolean {
        return this.flows.delete(id)
    }

    /**
     * Get a flow by ID
     */
    get(id: string): FlowDefinition | undefined {
        return this.flows.get(id)
    }

    /**
     * Get all registered flows
     */
    getAll(): FlowDefinition[] {
        return Array.from(this.flows.values())
    }

    /**
     * Check if a flow exists
     */
    has(id: string): boolean {
        return this.flows.has(id)
    }

    /**
     * Get all flow IDs
     */
    getIds(): string[] {
        return Array.from(this.flows.keys())
    }

    /**
     * Get count of registered flows
     */
    count(): number {
        return this.flows.size
    }

    /**
     * Clear all flows
     */
    clear(): void {
        this.flows.clear()
    }

    /**
     * Get flows by type (dynamic or programmatic)
     */
    getByType(dynamic: boolean): FlowDefinition[] {
        return this.getAll().filter((f) => f.dynamic === dynamic)
    }

    /**
     * Resolve multiple flow IDs to Flow objects
     */
    resolveFlows(flowIds: string[]): { flows: Flow[]; missing: string[] } {
        const flows: Flow[] = []
        const missing: string[] = []

        for (const id of flowIds) {
            const definition = this.flows.get(id)
            if (definition) {
                flows.push(definition.flow)
            } else {
                missing.push(id)
            }
        }

        return { flows, missing }
    }

    /**
     * Build a flow from steps configuration
     */
    private buildFlowFromSteps(keyword: string | string[], steps: FlowStep[]): Flow {
        const keywords: string | [string, ...string[]] = Array.isArray(keyword)
            ? (keyword as [string, ...string[]])
            : keyword

        let flow = addKeyword(keywords)

        for (const step of steps) {
            const options: any = {}

            if (step.delay) options.delay = step.delay
            if (step.media) options.media = step.media
            if (step.capture) options.capture = step.capture

            flow = flow.addAnswer(step.answer, Object.keys(options).length > 0 ? options : undefined)
        }

        return flow
    }

    /**
     * Export all dynamic flows as serializable configs
     */
    exportDynamicFlows(): CreateFlowInput[] {
        return this.getByType(true)
            .filter((f) => f.config)
            .map((f) => f.config!)
    }

    /**
     * Import dynamic flows from configs
     */
    importDynamicFlows(configs: CreateFlowInput[]): { imported: number; failed: string[] } {
        const failed: string[] = []
        let imported = 0

        for (const config of configs) {
            try {
                if (!this.has(config.id)) {
                    this.registerDynamic(config)
                    imported++
                }
            } catch {
                failed.push(config.id)
            }
        }

        return { imported, failed }
    }
}
