/**
 * LAYER: Domain
 * Contains: Barrel of flow-building methods
 * Rules: Re-exports only, no logic.
 * BigO: O(1) score:5
 * keywords: [addAnswer, addKeyword, toCtx]
 * GOAL: Expose the flow builders through a single import surface.
 */
import { addAnswer } from './addAnswer'
import { addChild } from './addChild'
import { addKeyword } from './addKeyword'
import { toCtx } from './toCtx'
import { toJson } from './toJson'
import { toSerialize } from './toSerialize'

export { addAnswer, addKeyword, addChild, toCtx, toJson, toSerialize }
