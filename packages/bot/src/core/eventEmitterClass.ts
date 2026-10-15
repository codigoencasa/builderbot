/**
 * LAYER: Infrastructure
 * Contains: EventEmitterClass — typed wrapper over node:events
 * Rules: Wraps a platform primitive. No business rules.
 * BigO: O(1) score:5
 * keywords: [EventEmitterClass, HostEventTypes, CoreClass]
 * GOAL: Provide a typed event-emitter base for core and providers.
 */
import { EventEmitter } from 'node:events'

import type { TContext } from '../types'

export type HostEventTypes = {
    send_message: [arg1: TContext & { from: string; answer: string | string[]; respMessage: any }]
    notice: [arg1: { title: string; instructions: string[] }]
}

export class EventEmitterClass<TEvents extends Record<string, any>> {
    private emitter = new EventEmitter()

    emit<TEventName extends keyof TEvents & string>(eventName: TEventName, ...eventArg: TEvents[TEventName]) {
        this.emitter.emit(eventName, ...(eventArg as []))
    }

    on<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        handler: (...eventArg: TEvents[TEventName]) => void
    ) {
        this.emitter.on(eventName, handler as any)
    }

    off<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        handler: (...eventArg: TEvents[TEventName]) => void
    ) {
        this.emitter.off(eventName, handler as any)
    }
}
