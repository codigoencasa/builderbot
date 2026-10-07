import { describe, expect, jest, test } from '@jest/globals'

// Mock the native binding — these tests only exercise waitForIceGathering logic.
jest.mock('@roamhq/wrtc', () => ({}))

import { waitForIceGathering } from '../src/calls/webrtc'

interface FakePc {
    iceGatheringState: string
    onicegatheringstatechange: (() => void) | null
}

const makePc = (state: string): FakePc => ({
    iceGatheringState: state,
    onicegatheringstatechange: null,
})

describe('waitForIceGathering', () => {
    test('resolves immediately when ICE gathering is already complete', async () => {
        const pc = makePc('complete')
        await expect(waitForIceGathering(pc as never, 50)).resolves.toBeUndefined()
    })

    test('resolves when gathering completes before the timeout', async () => {
        jest.useFakeTimers()
        try {
            const pc = makePc('gathering')
            const pending = waitForIceGathering(pc as never, 5000)

            pc.iceGatheringState = 'complete'
            pc.onicegatheringstatechange?.()

            await expect(pending).resolves.toBeUndefined()
        } finally {
            jest.useRealTimers()
        }
    })

    test('resolves on timeout when gathering never completes (non-trickle ICE safety net)', async () => {
        jest.useFakeTimers()
        try {
            const pc = makePc('gathering')
            const pending = waitForIceGathering(pc as never, 500)

            jest.advanceTimersByTime(500)

            await expect(pending).resolves.toBeUndefined()
        } finally {
            jest.useRealTimers()
        }
    })

    test('restores the previous onicegatheringstatechange handler after resolving', async () => {
        jest.useFakeTimers()
        try {
            const prev = jest.fn()
            const pc: FakePc = { iceGatheringState: 'gathering', onicegatheringstatechange: prev as () => void }
            const pending = waitForIceGathering(pc as never, 500)

            jest.advanceTimersByTime(500)
            await pending

            expect(pc.onicegatheringstatechange).toBe(prev)
        } finally {
            jest.useRealTimers()
        }
    })
})
